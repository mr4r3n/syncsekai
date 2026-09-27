import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { InitializeSetupDto, TestSmtpDto } from './setup.dto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { getRequiredSecret } from '../../common/security/required-secret';
import { validateNetworkHost } from '../../common/security/network-target';
import { findNetwork } from '../../common/security/social-networks';
import { SITE_SETTINGS, ICON_VERSION_KEY, resolveSiteSettings, readMaintenanceStatus } from '../../common/security/site-setting-definitions';
import { emailTemplate, escapeHtml } from '../../common/email/email-template';
import { isIP } from 'net';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  private verifyBootstrapToken(provided: string) {
    const expected = getRequiredSecret(this.configService, 'SETUP_BOOTSTRAP_TOKEN');
    const left = Buffer.from(provided || '', 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new ForbiddenException('Invalid bootstrap token.');
    }
  }

  async getSetupStatus() {
    const initSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'SYSTEM_INITIALIZED' },
    });

    const adminCount = await this.prisma.user.count({
      where: { role: 'ADMIN' },
    });

    const isInstalled = (initSetting?.value === 'true' && adminCount > 0);

    return {
      isInstalled,
      requiresSetup: !isInstalled,
    };
  }

  /**
   * Public numbers for the landing page.
   *
   * Everything returned here is measured or counted; without data it returns
   * null, never a default value.
   */
  async getPublicStats() {
    const startDb = Date.now();
    // The result matters: it is the only real measurement that the database answers.
    const databaseAlive = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    const dbLatencyMs = Date.now() - startDb;

    const [totalScrobbles, successfulScrobbles, totalUsers, totalMappings, recent] =
      await Promise.all([
        this.prisma.scrobbleHistory.count().catch(() => 0),
        this.prisma.scrobbleHistory
          .count({ where: { OR: [{ anilistStatus: 'SUCCESS' }, { malStatus: 'SUCCESS' }] } })
          .catch(() => 0),
        this.prisma.user.count().catch(() => 0),
        this.prisma.titleMapping.count().catch(() => 0),
        /*
         * The latest submissions to each tracker, which is where their status
         * comes from.
         *
         * The alternative was calling AniList and MAL on every landing page visit:
         * it costs page latency, can get us rate-limited by their APIs, and would
         * still only say whether they answer a stranger, not whether OUR
         * submissions work. The latter is what matters to whoever looks at this
         * page.
         */
        this.prisma.scrobbleHistory
          .findMany({
            take: 50,
            orderBy: { viewedAt: 'desc' },
            select: { anilistStatus: true, malStatus: true, kitsuStatus: true },
          })
          .catch(() => [] as Array<{ anilistStatus: string; malStatus: string; kitsuStatus: string }>),
      ]);

    /** ONLINE if the last known attempt succeeded; DEGRADED if it failed; unknown without data. */
    const trackerStatus = (field: 'anilistStatus' | 'malStatus' | 'kitsuStatus') => {
      const attempts = recent
        .map((r: any) => r[field])
        .filter((s: string) => s === 'SUCCESS' || s === 'FAILED');
      if (attempts.length === 0) return 'UNKNOWN';
      return attempts[0] === 'SUCCESS' ? 'ONLINE' : 'DEGRADED';
    };

    // Without scrobbles there is no success rate: a made-up percentage here is
    // exactly the figure someone would use to decide whether to trust the service.
    const successRate =
      totalScrobbles > 0
        ? `${((successfulScrobbles / totalScrobbles) * 100).toFixed(1)}%`
        : null;

    // Uptime of the service itself, not the host: os.uptime() would publicly reveal
    // how long the machine has gone without a reboot, which is patching
    // information and adds nothing to a status page.
    const serviceUptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(serviceUptimeSeconds / 86400);
    const hours = Math.floor((serviceUptimeSeconds % 86400) / 3600);
    const mins = Math.floor((serviceUptimeSeconds % 3600) / 60);
    const uptimeFormatted = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;

    const services = {
      // The backend is answering this very request.
      backend: 'ONLINE',
      database: databaseAlive ? 'ONLINE' : 'OFFLINE',
      anilist: trackerStatus('anilistStatus'),
      mal: trackerStatus('malStatus'),
      kitsu: trackerStatus('kitsuStatus'),
    };

    return {
      // Degraded if anything we do measure is not fine.
      status:
        !databaseAlive || Object.values(services).includes('DEGRADED') ? 'DEGRADED' : 'OPERATIONAL',
      uptimeFormatted,
      // There is no `uptimePercentage`: it is not measured anywhere. It can come
      // back when there is an outage log to compute it from.
      successRate,
      latency: `${dbLatencyMs}ms`,
      totalScrobbles,
      totalUsers,
      totalMappings,
      services: services,
    };
  }


  async getMaintenanceStatus() {
    const { enabled, message, estimatedEnd } = await readMaintenanceStatus(this.prisma);
    return { inMaintenance: enabled, message, estimatedEnd };
  }

  async hasCustomIcon(): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: ICON_VERSION_KEY } });
    return Boolean(row?.value);
  }

  /** Name, title, description, contact and registration state. All public. */
  async getSiteSettings() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...SITE_SETTINGS.map((a) => a.key), ICON_VERSION_KEY] } },
      select: { key: true, value: true },
    });
    return resolveSiteSettings(new Map(rows.map((f) => [f.key, f.value || ''])));
  }

  /**
   * Footer links for the public site.
   *
   * No session: the footer is on the landing page, which people without an
   * account see. Returns ONLY the enabled links and only the fields that are
   * rendered; a disabled link must not reach the client even hidden, because
   * "hidden" in a browser means opening the developer tools and reading it.
   */
  async getSiteLinks() {
    try {
      const links = await this.prisma.siteLink.findMany({
        where: { isEnabled: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          kind: true,
          provider: true,
          label: true,
          url: true,
          description: true,
          descriptionEs: true,
          iconUrl: true,
        },
      });

      // The light icon variant is resolved here, not in the browser: if the footer
      // had to infer it from the file name, changing a site icon would break that
      // inference without anyone noticing.
      const withIcons = links.map((l) => ({
        ...l,
        iconDarkUrl: l.provider ? (findNetwork(l.provider)?.iconDark ?? null) : null,
      }));

      return {
        social: withIcons.filter((l) => l.kind === 'SOCIAL'),
        friends: withIcons.filter((l) => l.kind === 'FRIEND'),
      };
    } catch {
      // If the table does not exist yet (half-updated installation), the footer
      // stays as it was instead of bringing down the whole landing page.
      return { social: [], friends: [] };
    }
  }

  async testSmtp(dto: TestSmtpDto) {
    const status = await this.getSetupStatus();
    if (status.isInstalled) {
      throw new ForbiddenException('The open SMTP test is disabled after installation.');
    }
    this.verifyBootstrapToken(dto.bootstrapToken);
    if (![25, 465, 587, 2525].includes(dto.smtpPort)) {
      throw new BadRequestException('The SMTP port is not allowed.');
    }
    const validatedAddresses = await validateNetworkHost(dto.smtpHost, { allowPrivate: false, allowPublic: true });

    try {
      const transporter = nodemailer.createTransport({
        host: validatedAddresses[0],
        port: dto.smtpPort,
        secure: dto.smtpPort === 465,
        auth: dto.smtpUser && dto.smtpPassword ? {
          user: dto.smtpUser,
          pass: dto.smtpPassword,
        } : undefined,
        tls: {
          rejectUnauthorized: true,
          ...(isIP(dto.smtpHost) ? {} : { servername: dto.smtpHost }),
        },
      });

      await transporter.verify();

      await transporter.sendMail({
        from: dto.smtpFrom,
        to: dto.testRecipient,
        subject: 'SyncSekai — SMTP mail server check',
        html: emailTemplate({
          title: 'Your mail server works',
          paragraphs: [
            'If you are reading this, SyncSekai can send email through your SMTP server.',
            `Server: <strong>${escapeHtml(dto.smtpHost)}:${dto.smtpPort}</strong>`,
          ],
          note: 'Test email from the setup wizard. With this working, account activation, password reset and verification codes work too.',
        }),
      });

      return {
        success: true,
        message: `Test email sent to ${dto.testRecipient}.`,
      };
    } catch (err: any) {
      this.logger.error(`Error checking SMTP: ${err.message}`);
      throw new BadRequestException('Could not validate the SMTP settings.');
    }
  }

  async initialize(dto: InitializeSetupDto) {
    const status = await this.getSetupStatus();
    if (status.isInstalled) {
      throw new ForbiddenException('The system is already initialized and sealed against reinstallation.');
    }
    this.verifyBootstrapToken(dto.bootstrapToken);
    await this.prisma.systemSetting.deleteMany({
      where: {
        key: 'SETUP_LOCK',
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    try {
      await this.prisma.systemSetting.create({
        data: { key: 'SETUP_LOCK', value: crypto.randomUUID(), isSecret: true },
      });
    } catch {
      throw new ForbiddenException('Initialization is already in progress or completed.');
    }

    this.logger.log(`Starting the system setup for domain: ${dto.appDomain}...`);

    // 1. Save the system settings
    const settingsToSave: { key: string; value: string; isSecret: boolean }[] = [
      { key: 'APP_DOMAIN', value: dto.appDomain.replace(/\/$/, ''), isSecret: false },
      { key: 'WEBHOOK_PUBLIC_URL', value: dto.webhookPublicUrl || `${dto.appDomain.replace(/\/$/, '')}/api/plex/webhook`, isSecret: false },
      { key: 'SMTP_HOST', value: dto.smtpHost || '', isSecret: false },
      { key: 'SMTP_PORT', value: String(dto.smtpPort || 587), isSecret: false },
      { key: 'SMTP_USER', value: dto.smtpUser || '', isSecret: false },
      { key: 'SMTP_PASS', value: dto.smtpPassword ? this.encryptionService.encrypt(dto.smtpPassword) : '', isSecret: true },
      { key: 'SMTP_FROM', value: dto.smtpFrom || '', isSecret: false },
      { key: 'ANILIST_CLIENT_ID', value: dto.anilistClientId || '', isSecret: false },
      { key: 'ANILIST_CLIENT_SECRET', value: dto.anilistClientSecret ? this.encryptionService.encrypt(dto.anilistClientSecret) : '', isSecret: true },
      { key: 'MAL_CLIENT_ID', value: dto.malClientId || '', isSecret: false },
      { key: 'MAL_CLIENT_SECRET', value: dto.malClientSecret ? this.encryptionService.encrypt(dto.malClientSecret) : '', isSecret: true },
      { key: 'GOOGLE_CLIENT_ID', value: dto.googleClientId || '', isSecret: false },
      { key: 'GOOGLE_CLIENT_SECRET', value: dto.googleClientSecret ? this.encryptionService.encrypt(dto.googleClientSecret) : '', isSecret: true },
      { key: 'DISCORD_CLIENT_ID', value: dto.discordClientId || '', isSecret: false },
      { key: 'DISCORD_CLIENT_SECRET', value: dto.discordClientSecret ? this.encryptionService.encrypt(dto.discordClientSecret) : '', isSecret: true },
      { key: 'PLEX_CLIENT_ID', value: dto.plexClientId || 'plexsync-app', isSecret: false },
    ];

    for (const setting of settingsToSave) {
      await this.prisma.systemSetting.upsert({
        where: { key: setting.key },
        create: setting,
        update: setting,
      });
    }

    // 2. Create or update the super admin
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
    const userToken = `usr_live_${crypto.randomBytes(6).toString('hex')}`;
    const webhookToken = `whk_live_${crypto.randomBytes(12).toString('hex')}`;

    const existingAdmin = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.adminEmail.toLowerCase() },
          { username: dto.adminUsername },
        ],
      },
    });

    let adminUser;
    if (existingAdmin) {
      adminUser = await this.prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          username: dto.adminUsername,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });
    } else {
      adminUser = await this.prisma.user.create({
        data: {
          username: dto.adminUsername,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          userToken,
          webhookToken,
        },
      });
    }

    // 3. Create the administrator's UserSettings
    await this.prisma.userSettings.upsert({
      where: { userId: adminUser.id },
      create: {
        userId: adminUser.id,
        completionPercentage: 85,
        syncRatings: true,
        emailErrorAlerts: true,
        autoApproveMappings: true,
        preferredTracker: 'BOTH',
      },
      update: {
        syncRatings: true,
        emailErrorAlerts: true,
      },
    });

    // 4. Seed the default domain policies if there are none
    const defaultDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'yahoo.com'];
    for (const dom of defaultDomains) {
      await this.prisma.domainPolicy.upsert({
        where: { domain: dom },
        create: { domain: dom, isAllowed: true, reason: 'Official trusted provider' },
        update: {},
      });
    }

    await this.prisma.systemSetting.upsert({
      where: { key: 'SYSTEM_INITIALIZED' },
      create: { key: 'SYSTEM_INITIALIZED', value: 'true', isSecret: false },
      update: { value: 'true', isSecret: false },
    });
    await this.prisma.systemSetting.deleteMany({ where: { key: 'SETUP_LOCK' } });

    this.logger.log(`✨ SyncSekai initialized for the super admin: ${adminUser.username} <${adminUser.email}>`);

    return {
      success: true,
      message: 'Installation complete. You can now sign in with your administrator account.',
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
      },
    };
  }
}
