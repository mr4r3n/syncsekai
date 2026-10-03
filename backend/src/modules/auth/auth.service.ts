import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { verifySync } from 'otplib';
import { Role } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { emailTemplate } from '../../common/email/email-template';
import { SessionsService } from './sessions.service';
import { MailService } from './mail.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { RegistrationService } from './registration.service';

/** Sign-in with password or social provider, and lockout after failed attempts. */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  // Per-account lockout in process memory. The ThrottlerGuard limits by IP,
  // which does not stop a distributed attack on a single account or brute
  // force on a six-digit 2FA code. The counter is lost on restart and is not
  // shared between replicas; if the backend is scaled or it needs to survive
  // deployments, this moves to Redis or to a couple of columns on the User
  // table.
  private static readonly MAX_FAILED_LOGINS = 8;
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;
  private static readonly MAX_TRACKED_LOGINS = 5000;
  private readonly failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryptionService: EncryptionService,
    private mailService: MailService,
    private accountLifecycleService: AccountLifecycleService,
    private registrationService: RegistrationService,
    private sessionsService: SessionsService,
  ) {}

  private assertNotLockedOut(emailKey: string) {
    const entry = this.failedLogins.get(emailKey);
    if (entry && entry.lockedUntil > Date.now()) {
      const minutes = Math.max(1, Math.ceil((entry.lockedUntil - Date.now()) / 60000));
      throw new UnauthorizedException(
        `Too many failed attempts. Try again in ${minutes} minute(s).`,
      );
    }
  }

  /**
   * Always recorded against the submitted email, whether or not the account
   * exists: if only attempts against real accounts counted, the lockout would
   * reveal which ones exist.
   */
  private registerFailedLogin(emailKey: string) {
    const now = Date.now();
    const previous = this.failedLogins.get(emailKey);
    const count = (previous?.count || 0) + 1;

    if (count >= AuthService.MAX_FAILED_LOGINS) {
      this.failedLogins.set(emailKey, { count: 0, lockedUntil: now + AuthService.LOCKOUT_MS });
      this.logger.warn(`Account temporarily locked after failed attempts: ${emailKey}`);
    } else {
      this.failedLogins.set(emailKey, { count, lockedUntil: previous?.lockedUntil || 0 });
    }

    // Bound the memory: an attacker can send unlimited different emails.
    if (this.failedLogins.size > AuthService.MAX_TRACKED_LOGINS) {
      for (const [key, value] of this.failedLogins) {
        if (value.lockedUntil <= now) this.failedLogins.delete(key);
        if (this.failedLogins.size <= AuthService.MAX_TRACKED_LOGINS) break;
      }
    }
  }

  async onModuleInit() {
    const usersWithTotp = await this.prisma.user.findMany({
      where: { twoFactorSecret: { not: null } },
      select: { id: true, twoFactorSecret: true },
    });
    const legacySecrets = usersWithTotp.filter(
      (user) => !this.encryptionService.isEncrypted(user.twoFactorSecret),
    );
    if (legacySecrets.length === 0) return;

    await this.prisma.$transaction(
      legacySecrets.map((user) => this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: user.twoFactorSecret
            ? this.encryptionService.encrypt(user.twoFactorSecret)
            : null,
        },
      })),
    );
    this.logger.log(`Migrated ${legacySecrets.length} legacy TOTP secret(s) to AES-GCM encryption.`);
  }

  async login(dto: LoginDto, clientIp = '127.0.0.1', userAgent = '', deviceId: string | null = null) {
    const emailKey = dto.email.trim().toLowerCase();
    this.assertNotLockedOut(emailKey);

    const user = await this.prisma.user.findUnique({
      where: { email: emailKey },
      include: {
        settings: true,
        plexConnection: true,
        animeConnections: true,
      },
    });

    if (!user) {
      this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account is linked to an external OAuth provider. Sign in with the matching button.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account has not been activated yet. Check the link sent to your email.');
    }

    // TWO-FACTOR AUTHENTICATION (2FA)
    if (user.twoFactorEnabled && user.twoFactorType !== 'NONE') {
      if (!dto.twoFactorCode) {
        // For email 2FA, generate and send the OTP code
        if (user.twoFactorType === 'EMAIL_OTP') {
          const code = crypto.randomInt(100000, 1000000).toString();
          const codeHash = await bcrypt.hash(code, 10);
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { emailOtpCode: codeHash, emailOtpExpiresAt: expiresAt },
          });

          const sent = await this.mailService.sendEmail(
            user.email,
            'SyncSekai — Sign-in code',
            emailTemplate({
              frontendUrl: await this.mailService.getFrontendUrl(),
              title: 'Your sign-in code',
              paragraphs: ['Someone is signing in to your account. Enter this code to continue:'],
              code: code,
              note: 'It expires in 10 minutes and works only once. If it was not you, someone knows your password: change it.',
            }),
          );
          if (!sent && process.env.NODE_ENV === 'production') {
            throw new ServiceUnavailableException('The 2FA code could not be delivered.');
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('\n' + '='.repeat(72));
            console.log('🔐 [DEV EMAIL SIMULATOR] EMAIL 2FA SIGN-IN CODE');
            console.log(`To: ${user.email} (User: ${user.username})`);
            console.log(`👉 6-DIGIT CODE: >>> ${code} <<<`);
            console.log(`Expires at: ${expiresAt.toLocaleTimeString()}`);
            console.log('='.repeat(72) + '\n');
          }
        }

        return {
          requires2FA: true,
          twoFactorType: user.twoFactorType,
          email: user.email,
          message: user.twoFactorType === 'EMAIL_OTP'
            ? 'Enter the code sent to your email'
            : 'Enter the code from your authenticator app',
        };
      }

      // Verify the submitted 2FA code
      if (user.twoFactorType === 'APP_TOTP') {
        const totpSecret = this.encryptionService.decrypt(user.twoFactorSecret || '');
        const verifyRes = verifySync({ token: dto.twoFactorCode.trim(), secret: totpSecret });
        if (!verifyRes || !verifyRes.valid) {
          // A six-digit code falls to brute force without a per-account limit.
          this.registerFailedLogin(emailKey);
          throw new UnauthorizedException('Incorrect or expired 2FA code.');
        }
      } else if (user.twoFactorType === 'EMAIL_OTP') {
        const otpMatches = user.emailOtpCode
          ? await bcrypt.compare(dto.twoFactorCode.trim(), user.emailOtpCode)
          : false;
        if (!otpMatches) {
          this.registerFailedLogin(emailKey);
          throw new UnauthorizedException('Incorrect email verification code.');
        }
        if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
          throw new UnauthorizedException('The verification code has expired.');
        }
        // Consume the code
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailOtpCode: null, emailOtpExpiresAt: null },
        });
      }
    }

    // Fully authenticated (password and, if applicable, 2FA): the history is discarded.
    this.failedLogins.delete(emailKey);

    await this.accountLifecycleService.unlockOnSignIn(user.id);
    const sessionToken = await this.sessionsService.createSession(user.id, clientIp, userAgent, deviceId, 'Web browser');

    const payload = {
      sub: user.id,
      userToken: user.userToken,
      sessionToken,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        userToken: user.userToken,
        email: user.email,
        username: user.username,
        role: user.role,
        webhookToken: user.webhookToken,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorType: user.twoFactorType,
        settings: user.settings,
        hasPlex: !!user.plexConnection?.isConnected,
        connectedAnimeCount: user.animeConnections.filter(c => c.isConnected).length,
      },
    };
  }

  /**
   * Sign-in and self-registration through social OAuth (Google, Discord; the
   * GitHub branch is supported here but has no routes yet).
   */
  async handleSocialAuthLogin(
    data: {
      provider: 'google' | 'discord' | 'github';
      providerId: string;
      email: string;
      username: string;
      emailVerified: boolean;
      avatarUrl?: string | null;
      currentUserId?: string;
    },
    clientIp = '127.0.0.1',
    userAgent = '',
    deviceId: string | null = null,
  ) {
    const email = data.email.trim().toLowerCase();
    if (!data.providerId || !data.emailVerified) {
      throw new UnauthorizedException('The provider did not confirm a verifiable identity and email.');
    }

    let user: any = null;

    // 1. The request comes from an authenticated user (direct linking)
    if (data.currentUserId) {
      user = await this.prisma.user.findUnique({
        where: { id: data.currentUserId },
        include: { settings: true },
      });
    }

    // 2. No currentUserId: look the user up by social id or by email
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            data.provider === 'google' ? { googleId: data.providerId } : undefined,
            data.provider === 'discord' ? { discordId: data.providerId } : undefined,
            data.provider === 'github' ? { githubId: data.providerId } : undefined,
            { email },
          ].filter(Boolean) as any,
        },
        include: { settings: true },
      });
    }

    if (user) {
      // An account that was never activated still has its activation token; one an
      // administrator deactivated does not, and stays closed.
      const pendingActivation = !user.isActive && Boolean(user.activationToken);
      if (!user.isActive && !pendingActivation) {
        throw new UnauthorizedException('Your account has been deactivated by an administrator.');
      }
      if (user.settings?.isSuspended) {
        throw new UnauthorizedException('Your account has been suspended by the administrator.');
      }

      // If the user already exists, link the social provider without touching username or avatar
      const updateData: any = {};
      if (pendingActivation) {
        // The provider just verified the email, which is what activation proves. The
        // password goes: whoever registered the address without owning it must not keep
        // a way in. The owner can set a new one from Security.
        Object.assign(updateData, { isActive: true, activationToken: null, activationExpiresAt: null, passwordHash: null });
      }
      if (data.provider === 'google' && user.googleId !== data.providerId) updateData.googleId = data.providerId;
      if (data.provider === 'discord' && user.discordId !== data.providerId) updateData.discordId = data.providerId;
      if (data.provider === 'github' && user.githubId !== data.providerId) updateData.githubId = data.providerId;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { settings: true },
        });
      }
    } else {
      // New account: same gates as email sign-up.
      await this.registrationService.ensureRegistrationOpen();
      const domainCheck = await this.registrationService.checkDomain(email);
      if (!domainCheck.isAllowed) {
        throw new BadRequestException(domainCheck.message);
      }

      // Self-registration only for new users coming from /login or /register
      // Sanitize the username
      let baseUsername = data.username ? data.username.replace(/[^a-zA-Z0-9_-]/g, '').trim() : email.split('@')[0];
      if (!baseUsername || baseUsername.length < 3) baseUsername = `user_${data.providerId.slice(-4)}`;

      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await this.prisma.user.findFirst({ where: { username: uniqueUsername } })) {
        uniqueUsername = `${baseUsername}_${counter}`;
        counter++;
      }

      const userToken = `usr_live_${crypto.randomBytes(12).toString('hex')}`;
      const webhookToken = `whk_live_${crypto.randomBytes(16).toString('hex')}`;

      user = await this.prisma.user.create({
        data: {
          email,
          username: uniqueUsername,
          userToken,
          webhookToken,
          isActive: true,
          role: Role.USER,
          avatarUrl: null,
          googleId: data.provider === 'google' ? data.providerId : null,
          discordId: data.provider === 'discord' ? data.providerId : null,
          githubId: data.provider === 'github' ? data.providerId : null,
          settings: {
            create: {
              canScrobble: true,
              canAccessCatalog: true,
              canEditMappings: true,
              canSyncAnilist: true,
              canSyncMal: true,
            },
          },
        },
        include: { settings: true },
      });
      await this.registrationService.notifyAdminsOfNewUser(user, data.provider);
    }

    await this.accountLifecycleService.unlockOnSignIn(user.id);
    const sessionToken = await this.sessionsService.createSession(user.id, clientIp, userAgent, deviceId, 'OAuth Client');

    const payload = {
      sub: user.id,
      userToken: user.userToken,
      email: user.email,
      username: user.username,
      role: user.role,
      sessionToken,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async validateUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        plexConnection: true,
        animeConnections: true,
      },
    });
  }
}
