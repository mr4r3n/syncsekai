import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { emailTemplate, escapeHtml } from '../../common/email/email-template';
import { hashToken } from './token-hash';
import { MailService } from './mail.service';

/** Account sign-up: domain policy, open registration, activation. */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  private readonly domainCache = new Map<string, { result: { isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' }; timestamp: number }>();
  private readonly DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async checkDomain(email: string): Promise<{ isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' }> {
    if (!email || !email.includes('@')) {
      return { isAllowed: false, message: 'Incomplete email format', status: 'denied' };
    }

    const domain = email.split('@')[1].toLowerCase().trim();

    // Check the in-memory cache
    const cached = this.domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.DOMAIN_CACHE_TTL_MS) {
      return cached.result;
    }

    let result: { isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' };
    
    // Look up the domain policy
    const policy = await this.prisma.domainPolicy.findUnique({
      where: { domain },
    });

    if (policy) {
      if (policy.isAllowed) {
        result = { isAllowed: true, message: 'Domain verified for direct sign-up.', status: 'allowed' };
      } else {
        result = { isAllowed: false, message: 'Temporary or disposable emails are not allowed.', status: 'denied' };
      }
    } else {
      // Default: Check known disposable domains
      const commonDisposable = ['yopmail.com', 'mohmal.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'trashmail.com'];
      if (commonDisposable.includes(domain)) {
        result = { isAllowed: false, message: 'Temporary emails are not allowed.', status: 'denied' };
      } else {
        const commonAllowed = ['gmail.com', 'outlook.com', 'hotmail.com', 'proton.me', 'protonmail.com', 'icloud.com', 'yahoo.com'];
        if (commonAllowed.includes(domain)) {
          result = { isAllowed: true, message: 'Domain verified for direct sign-up.', status: 'allowed' };
        } else {
          result = { isAllowed: false, message: 'This domain requires manual approval by the administrator.', status: 'requires_approval' };
        }
      }
    }

    this.domainCache.set(domain, { result, timestamp: Date.now() });
    return result;
  }

  /** Applies to email sign-up and to the first Google/Discord sign-in. */
  async ensureRegistrationOpen() {
    const record = await this.prisma.systemSetting.findUnique({ where: { key: 'REGISTRATION_OPEN' } });
    if (record?.value === 'false') {
      throw new ForbiddenException('Registration is closed on this instance. Contact the administrator if you need an account.');
    }
  }

  /**
   * Bell notification for every administrator when someone new signs up, by
   * email or through Google/Discord. It never blocks the sign-up: if it fails,
   * the notification is lost, not the user.
   */
  async notifyAdminsOfNewUser(user: { id: string; username: string; email: string }, via: string) {
    try {
      const admins = await this.prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } });
      if (admins.length === 0) return;
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'NEW_USER',
          title: `New user: ${user.username}`,
          message: `${user.email} signed up via ${via}.`,
          metadata: { userId: user.id, username: user.username, email: user.email, via },
        })),
      });
    } catch (e: any) {
      this.logger.warn(`Could not notify the administrators about the sign-up of ${user.username}: ${e.message}`);
    }
  }

  async register(dto: RegisterDto) {
    await this.ensureRegistrationOpen();

    const domainCheck = await this.checkDomain(dto.email);
    if (!domainCheck.isAllowed) {
      throw new BadRequestException(domainCheck.message);
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' } },
          { username: { equals: dto.username.trim(), mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Something went wrong.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userToken = `usr_live_${crypto.randomBytes(6).toString('hex')}`;
    const webhookToken = `whk_live_${crypto.randomBytes(8).toString('hex')}`;
    // The token is emailed in clear and only its hash is stored, as with
    // emailChangeToken: read access to the database must not be enough to
    // activate or delete anyone's account.
    const activationToken = crypto.randomBytes(24).toString('hex');
    const activationTokenHash = hashToken(activationToken);
    const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        username: dto.username.trim(),
        passwordHash,
        userToken,
        webhookToken,
        isActive: false,
        activationToken: activationTokenHash,
        activationExpiresAt,
        role: Role.USER,
        settings: {
          create: {
            completionPercentage: 85,
            syncRatings: true,
            emailErrorAlerts: true,
            autoApproveMappings: true,
          },
        },
      },
      select: {
        id: true,
        userToken: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        activationExpiresAt: true,
      },
    });

    await this.notifyAdminsOfNewUser(user, 'email');

    const frontendUrl = await this.mailService.getFrontendUrl();
    const activationLink = `${frontendUrl}/activate/${activationToken}`;
    const emailSent = await this.mailService.sendEmail(
      user.email,
      'SyncSekai — Activate your account',
      emailTemplate({
        frontendUrl,
        title: 'Activate your account',
        paragraphs: [
          `Hi <strong>${escapeHtml(user.username)}</strong>, almost there. Press the button to activate your account and start syncing what you watch.`,
        ],
        button: { text: 'Activate account', url: activationLink },
        note: 'The link expires in 24 hours. If you did not create a SyncSekai account, ignore this message: nothing is activated unless you press it.',
      }),
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('📧 [DEV EMAIL SIMULATOR] ACCOUNT ACTIVATION EMAIL');
      console.log(`To: ${dto.email} (User: ${dto.username})`);
      console.log(`Assigned role: ${user.role}`);
      console.log(`👉 Activation link: ${activationLink}`);
      console.log('=' .repeat(72) + '\n');
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      message: emailSent
        ? 'Account created. We sent an activation email, valid for 24 hours.'
        : 'Account created, but the activation email could not be delivered. Contact the administrator.',
      userToken: user.userToken,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      ...(isDev ? {
        activationToken,
        activationLink,
      } : {}),
      activationExpiresAt: user.activationExpiresAt,
    };
  }

  async activateAccount(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { activationToken: hashToken(token || '') },
    });

    if (!user) {
      throw new BadRequestException('Invalid activation token, or the account is already active.');
    }

    if (user.activationExpiresAt && user.activationExpiresAt < new Date()) {
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new BadRequestException('The 24-hour window has expired. Your account has been deleted. Sign up again.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        activationToken: null,
        activationExpiresAt: null,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('✓ [DEV ACTIVATION] ACCOUNT ACTIVATED');
      console.log(`User: ${user.username} (${user.email})`);
      console.log('='.repeat(72) + '\n');
    }

    return { message: 'Account activated. You can now sign in.' };
  }
}
