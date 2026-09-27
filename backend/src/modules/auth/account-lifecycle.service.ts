import { Injectable, Logger, BadRequestException, UnauthorizedException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { verifySync } from 'otplib';
import { Role } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { emailTemplate, escapeHtml } from '../../common/email/email-template';
import { hashToken } from './token-hash';
import { MailService } from './mail.service';

/** Account lifecycle: purges, inactivity and requested deletion. */
@Injectable()
export class AccountLifecycleService {
  private readonly logger = new Logger(AccountLifecycleService.name);

  /**
   * Activated accounts that never connected anything: a warning at 7 days, a
   * lock at 30 (their sessions are closed; signing in again unlocks them), and
   * deletion 60 days after the lock if they have not come back. An account that
   * connects a server or a tracker leaves the cycle on its own.
   */
  static readonly INACTIVITY_WARNING_DAYS = 7;
  static readonly INACTIVITY_LOCK_DAYS = 30;
  static readonly INACTIVITY_DELETION_DAYS = 60;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private mailService: MailService,
  ) {}

  /**
   * Daily cron: purges accounts that were never activated and are older than 24 hours.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredAccountsPurge() {
    this.logger.log('Running scheduled task: purge of expired unactivated accounts (>24h)...');
    return this.purgeExpiredInactiveAccounts();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleInactiveAccounts() {
    return this.processAccountsWithoutServices();
  }

  async processAccountsWithoutServices(): Promise<{ warned: number; locked: number; deleted: number }> {
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);
    const frontendUrl = await this.mailService.getFrontendUrl();
    const result = { warned: 0, locked: 0, deleted: 0 };

    const candidates = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: Role.USER,
        createdAt: { lt: daysAgo(AccountLifecycleService.INACTIVITY_WARNING_DAYS) },
        plexConnection: { is: null },
        jellyfinConnection: { is: null },
        embyConnection: { is: null },
        animeConnections: { none: {} },
        scrobbleHistory: { none: {} },
      },
      select: { id: true, email: true, username: true, createdAt: true, inactivityWarnedAt: true, inactivityLockedAt: true },
    });

    for (const u of candidates) {
      try {
        if (u.inactivityLockedAt) {
          const returned = await this.prisma.session.findFirst({
            where: { userId: u.id, lastActiveAt: { gt: u.inactivityLockedAt } },
            select: { id: true },
          });
          if (!returned && u.inactivityLockedAt < daysAgo(AccountLifecycleService.INACTIVITY_DELETION_DAYS)) {
            await this.prisma.user.delete({ where: { id: u.id } });
            result.deleted++;
            this.logger.log(`Account deleted for inactivity: ${u.username}`);
          }
          continue;
        }

        if (u.createdAt < daysAgo(AccountLifecycleService.INACTIVITY_LOCK_DAYS) && u.inactivityWarnedAt) {
          await this.prisma.$transaction([
            this.prisma.session.deleteMany({ where: { userId: u.id } }),
            this.prisma.user.update({ where: { id: u.id }, data: { inactivityLockedAt: new Date() } }),
          ]);
          result.locked++;
          await this.mailService.sendEmail(
            u.email,
            'SyncSekai — Your account has been locked',
            emailTemplate({
              frontendUrl,
              title: 'Your account has been locked',
              paragraphs: [
                `Hi <strong>${escapeHtml(u.username)}</strong>, your SyncSekai account has been locked because no media server or tracker was connected in the ${AccountLifecycleService.INACTIVITY_LOCK_DAYS} days since you signed up.`,
                'Signing in again unlocks it immediately. Nothing has been deleted yet.',
              ],
              button: { text: 'Sign in to unlock', url: `${frontendUrl}/login` },
              note: `If you do not sign in within ${AccountLifecycleService.INACTIVITY_DELETION_DAYS} days, the account and its data will be deleted permanently.`,
            }),
          );
          continue;
        }

        if (!u.inactivityWarnedAt) {
          await this.prisma.user.update({ where: { id: u.id }, data: { inactivityWarnedAt: new Date() } });
          result.warned++;
          await this.mailService.sendEmail(
            u.email,
            'SyncSekai — Connect your media server',
            emailTemplate({
              frontendUrl,
              title: 'Your account is ready, but nothing is connected yet',
              paragraphs: [
                `Hi <strong>${escapeHtml(u.username)}</strong>, you activated your SyncSekai account ${AccountLifecycleService.INACTIVITY_WARNING_DAYS} days ago, but no Plex, Jellyfin or Emby server and no AniList, MyAnimeList or Kitsu account are linked yet. Until then, nothing can be synced.`,
                'The guide walks you through it in a few minutes.',
              ],
              button: { text: 'Open the setup guide', url: `${frontendUrl}/docs` },
              note: `Accounts with nothing connected are locked ${AccountLifecycleService.INACTIVITY_LOCK_DAYS} days after sign-up. Signing in unlocks them; a locked account that is not signed into for ${AccountLifecycleService.INACTIVITY_DELETION_DAYS} days is deleted.`,
            }),
          );
        }
      } catch (e: any) {
        this.logger.warn(`Inactivity cycle: failed for ${u.username}: ${e.message}`);
      }
    }

    if (result.warned || result.locked || result.deleted) {
      this.logger.log(`Accounts without services: ${result.warned} warned, ${result.locked} locked, ${result.deleted} deleted.`);
    }
    return result;
  }

  /** Signing in is what unlocks an account locked for inactivity. */
  async unlockOnSignIn(userId: string) {
    await this.prisma.user.updateMany({
      where: { id: userId, inactivityLockedAt: { not: null } },
      data: { inactivityLockedAt: null },
    });
  }

  async purgeExpiredInactiveAccounts(): Promise<{ deletedCount: number }> {
    const now = new Date();
    const result = await this.prisma.user.deleteMany({
      where: {
        isActive: false,
        activationExpiresAt: {
          lt: now,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`[AccountPurgeCron] Deleted ${result.count} expired unactivated accounts (>24h).`);
    }
    return { deletedCount: result.count };
  }

  /**
   * Step 1 of account deletion: validates the password and 2FA (if enabled),
   * generates a 1-hour token and emails a secure link.
   */
  async requestAccountDeletion(
    userId: string,
    dto: { password?: string; twoFactorCode?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Last administrator safeguard
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'You cannot delete the only administrator account. Transfer the administrator role to another user first.'
        );
      }
    }

    // 1. Validate the password (if the account has one)
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('Enter your current password to authorize the request.');
      }
      const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isValidPassword) {
        throw new UnauthorizedException('The password is incorrect.');
      }
    }

    // 2. Validate 2FA (if enabled on the account)
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode || !dto.twoFactorCode.trim()) {
        throw new BadRequestException('Enter your two-factor authentication (2FA) code.');
      }

      if (user.twoFactorType === 'APP_TOTP') {
        const totpSecret = this.encryptionService.decrypt(user.twoFactorSecret || '');
        const verifyRes = verifySync({ token: dto.twoFactorCode.trim(), secret: totpSecret });
        if (!verifyRes || !verifyRes.valid) {
          throw new UnauthorizedException('The 2FA code is incorrect or has expired.');
        }
      } else if (user.twoFactorType === 'EMAIL_OTP') {
        const otpMatches = user.emailOtpCode
          ? await bcrypt.compare(dto.twoFactorCode.trim(), user.emailOtpCode)
          : false;
        if (!otpMatches) {
          throw new UnauthorizedException('The email verification code is incorrect.');
        }
        if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
          throw new UnauthorizedException('The email verification code has expired.');
        }
      }
    }

    // Unique cryptographic token valid for 1 hour
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionToken: hashToken(rawToken),
        deletionTokenExpiresAt: expiresAt,
        // An email code works once, as in sign-in and 2FA changes.
        ...(user.twoFactorEnabled && user.twoFactorType === 'EMAIL_OTP'
          ? { emailOtpCode: null, emailOtpExpiresAt: null }
          : {}),
      },
    });

    // Send the confirmation email
    const frontendUrl = await this.mailService.getFrontendUrl();
    const confirmationUrl = `${frontendUrl}/confirm-delete/${rawToken}`;

    const emailSubject = 'SyncSekai — Confirm you want to delete your account';
    const emailHtml = emailTemplate({
      frontendUrl,
      title: 'Confirm you want to delete your account',
      paragraphs: [
        `Hi <strong>${escapeHtml(user.username)}</strong>, we received a request to delete your SyncSekai account.`,
        'Confirming starts a <strong>24-hour</strong> window during which you can change your mind by signing in. After that, your connections, history and mappings are deleted, and that cannot be undone.',
      ],
      button: { text: 'Confirm deletion', url: confirmationUrl, danger: true },
      note: 'The link expires in one hour. If you did not request this, ignore it and change your password: someone has signed in to your account.',
    });

    const sent = await this.mailService.sendEmail(user.email, emailSubject, emailHtml);
    if (!sent) {
      // Without the email the link is unreachable: drop it instead of claiming it was sent.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { deletionToken: null, deletionTokenExpiresAt: null },
      });
      throw new ServiceUnavailableException('The confirmation email could not be sent. Try again later.');
    }

    return {
      success: true,
      message: 'A confirmation email has been sent to your inbox. You have 1 hour to authorize the request.',
    };
  }

  /**
   * Step 2: confirms the deletion through the emailed link.
   * Validates the token and schedules the deletion exactly 24 hours later (grace period).
   */
  async confirmAccountDeletion(rawToken: string) {
    if (!rawToken || !rawToken.trim()) {
      throw new BadRequestException('Missing confirmation token.');
    }

    const user = await this.prisma.user.findFirst({
      where: { deletionToken: hashToken(rawToken) },
    });

    if (!user || !user.deletionTokenExpiresAt || user.deletionTokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'The confirmation link is invalid or has expired. If you still want to delete your account, request a new one from the security panel.'
      );
    }

    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // exactly 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionToken: null,
        deletionTokenExpiresAt: null,
        deletionScheduledAt: scheduledAt,
      },
    });

    // Send an informational email with the exact deadline
    const formattedDate = scheduledAt.toLocaleString('en-GB', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const frontendUrl = await this.mailService.getFrontendUrl();
    const loginUrl = `${frontendUrl}/login`;

    const emailSubject = 'SyncSekai — Your account will be deleted in 24 hours';
    const emailHtml = emailTemplate({
      frontendUrl,
      title: 'Your account will be deleted in 24 hours',
      paragraphs: [
        `Hi <strong>${escapeHtml(user.username)}</strong>, you confirmed the deletion. Your account will be deleted on <strong>${escapeHtml(formattedDate)}</strong> (Madrid time).`,
        'You can still change your mind: sign in before then and press <strong>Cancel deletion</strong>.',
      ],
      button: { text: 'Sign in and cancel', url: loginUrl },
      note: 'If you do nothing, at that time your connections, history and mappings are deleted, and there is no way to recover them.',
    });

    await this.mailService.sendEmail(user.email, emailSubject, emailHtml);
    this.logger.log(`[DELETION SCHEDULED] User ${user.username} scheduled for purge in 24h (${scheduledAt.toISOString()})`);

    return {
      success: true,
      message: 'Your account is scheduled for deletion. You have 24 hours to recover it before it is permanently purged.',
      scheduledAt,
    };
  }

  /**
   * Step 3: cancels a scheduled deletion (recovers the account).
   */
  async cancelAccountDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.deletionScheduledAt && !user.deletionToken) {
      return {
        success: true,
        message: 'There is no active deletion request on this account.',
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: null,
        deletionToken: null,
        deletionTokenExpiresAt: null,
      },
    });

    this.logger.log(`[DELETION CANCELLED] User ${user.username} cancelled the deletion of their account.`);

    return {
      success: true,
      message: 'Your account deletion has been cancelled. Your account stays active with all your data intact.',
    };
  }

  /**
   * Scheduled task: purges accounts whose grace period has expired.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledAccountDeletions() {
    const now = new Date();
    const accountsToPurge = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: {
          lte: now,
        },
      },
      select: { id: true, username: true, email: true },
    });

    if (accountsToPurge.length === 0) return;

    this.logger.log(`[PURGE CRON] Purging ${accountsToPurge.length} account(s) whose 24h grace period expired...`);

    for (const acc of accountsToPurge) {
      try {
        await this.prisma.user.delete({ where: { id: acc.id } });
        this.logger.warn(`[PURGED] Account ${acc.username} (${acc.id}) permanently deleted (cascade).`);
      } catch (err: any) {
        this.logger.error(`[PURGE ERROR] Failed to delete account ${acc.id}: ${err.message}`);
      }
    }
  }
}
