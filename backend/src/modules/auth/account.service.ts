import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { verifySync } from 'otplib';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { emailTemplate, escapeHtml } from '../../common/email/email-template';
import { RegistrationService } from './registration.service';
import { MailService } from './mail.service';

/** Account profile and settings: data, email, password, webhook, linked accounts. */
@Injectable()
export class AccountService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryptionService: EncryptionService,
    private registrationService: RegistrationService,
    private mailService: MailService,
  ) {}

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string; currentPassword?: string },
    currentSessionToken?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Something went wrong.');

    let newUsername: string | undefined = undefined;
    let emailChangeRequested = false;
    let updateLastUsernameChange = false;

    if (data.username && data.username.trim() !== user.username) {
      const trimmedName = data.username.trim();

      // Check whether 30 days have passed since the last username change
      if (user.lastUsernameChange) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(user.lastUsernameChange).getTime();
        if (elapsed < thirtyDaysMs) {
          throw new BadRequestException('Something went wrong.');
        }
      }

      // Check whether another user already has this name (case-insensitive)
      const existingName = await this.prisma.user.findFirst({
        where: {
          username: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id: userId },
        },
      });
      if (existingName) {
        throw new BadRequestException('Something went wrong.');
      }

      newUsername = trimmedName;
      updateLastUsernameChange = true;
    }

    if (data.email && data.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const trimmedEmail = data.email.trim().toLowerCase();

      if (!user.passwordHash || !data.currentPassword) {
        throw new UnauthorizedException('Confirm your current password to change the email.');
      }
      const passwordMatches = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!passwordMatches) {
        throw new UnauthorizedException('The current password is incorrect.');
      }

      const domainCheck = await this.registrationService.checkDomain(trimmedEmail);
      if (!domainCheck.isAllowed) {
        throw new BadRequestException(domainCheck.message);
      }

      // Check whether another user already has this email (case-insensitive)
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: { equals: trimmedEmail, mode: 'insensitive' },
          NOT: { id: userId },
        },
      });
      if (existingEmail) {
        throw new BadRequestException('Something went wrong.');
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const frontendUrl = await this.mailService.getFrontendUrl();
      const confirmationUrl = `${frontendUrl}/confirm-email/${rawToken}`;
      const emailSent = await this.mailService.sendEmail(
        trimmedEmail,
        'SyncSekai — Confirm your new email',
        emailTemplate({
          frontendUrl,
          title: 'Confirm your new email',
          paragraphs: [
            `You asked to use this address for your SyncSekai account. Until you confirm it, the account keeps the previous one.`,
          ],
          button: { text: 'Confirm email', url: confirmationUrl },
          note: 'The link expires in one hour. If you did not request this change, ignore it and check who has access to your account.',
        }),
      );
      if (!emailSent) {
        throw new ServiceUnavailableException('The confirmation could not be sent to the new email.');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingEmail: trimmedEmail,
          emailChangeToken: tokenHash,
          emailChangeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      emailChangeRequested = true;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(newUsername ? { username: newUsername } : {}),
        ...(updateLastUsernameChange ? { lastUsernameChange: new Date() } : {}),
      },
    });

    let newAccessToken: string | undefined = undefined;
    if (newUsername && currentSessionToken) {
      newAccessToken = this.jwtService.sign({
        sub: updated.id,
        userToken: updated.userToken,
        sessionToken: currentSessionToken,
        username: updated.username,
        email: updated.email,
        role: updated.role,
      });
    }

    return {
      message: emailChangeRequested
        ? 'Profile updated. Check the new email to confirm the change.'
        : 'Profile updated.',
      accessToken: newAccessToken,
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        userToken: updated.userToken,
        lastUsernameChange: updated.lastUsernameChange,
      },
    };
  }

  async confirmEmailChange(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.prisma.user.findUnique({ where: { emailChangeToken: tokenHash } });
    if (
      !user?.pendingEmail ||
      !user.emailChangeExpiresAt ||
      user.emailChangeExpiresAt < new Date()
    ) {
      throw new BadRequestException('The confirmation link is invalid or has expired.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          emailChangeToken: null,
          emailChangeExpiresAt: null,
          userToken: `usr_live_${crypto.randomBytes(12).toString('hex')}`,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return { message: 'Email confirmed. Sign in again.' };
  }

  async regenerateWebhookToken(userId: string) {
    const newWebhookToken = `whk_live_${crypto.randomBytes(8).toString('hex')}`;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { webhookToken: newWebhookToken },
      select: { id: true, userToken: true, webhookToken: true },
    });

    return {
      message: 'Webhook token regenerated.',
      webhookToken: updated.webhookToken,
    };
  }

  async updatePassword(
    userId: string,
    data: { currentPassword?: string; newPassword?: string; twoFactorCode?: string },
    currentSessionToken: string,
  ) {
    if (!data.newPassword || data.newPassword.length < 12) {
      throw new BadRequestException('The new password must be at least 12 characters long.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (user.passwordHash) {
      if (!data.currentPassword) {
        throw new BadRequestException('Enter your current password.');
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('The current password is incorrect.');
      }
    } else if (user.twoFactorEnabled && user.twoFactorType === 'APP_TOTP') {
      const secret = this.encryptionService.decrypt(user.twoFactorSecret || '');
      const result = verifySync({ token: data.twoFactorCode?.trim() || '', secret });
      if (!result?.valid) {
        throw new UnauthorizedException('Confirm a valid 2FA code.');
      }
    } else {
      const recentSession = await this.prisma.session.findFirst({
        where: {
          userId,
          sessionToken: currentSessionToken,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      if (!recentSession) {
        throw new UnauthorizedException('Sign in again to set a password.');
      }
    }

    const newHash = await bcrypt.hash(data.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          userToken: `usr_live_${crypto.randomBytes(12).toString('hex')}`,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Password updated. Sign in again.' };
  }

  async updateSettings(userId: string, data: any) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        completionPercentage: data.completionPercentage ?? 85,
        syncRatings: data.syncRatings ?? true,
        emailErrorAlerts: data.emailErrorAlerts ?? true,
        discordNotifications: data.discordNotifications ?? true,
        webNotifications: data.webNotifications ?? true,
        autoApproveMappings: data.autoApproveMappings ?? true,
        preferredTracker: data.preferredTracker ?? 'BOTH',
        themePalette: data.themePalette ?? 'sync',
        themeMode: data.themeMode ?? 'dark',
        showInLeaderboard: Boolean(data.showInLeaderboard),
      },
      update: {
        ...(data.completionPercentage !== undefined ? { completionPercentage: Number(data.completionPercentage) } : {}),
        ...(data.syncRatings !== undefined ? { syncRatings: Boolean(data.syncRatings) } : {}),
        ...(data.emailErrorAlerts !== undefined ? { emailErrorAlerts: Boolean(data.emailErrorAlerts) } : {}),
        ...(data.discordNotifications !== undefined ? { discordNotifications: Boolean(data.discordNotifications) } : {}),
        ...(data.webNotifications !== undefined ? { webNotifications: Boolean(data.webNotifications) } : {}),
        ...(data.autoApproveMappings !== undefined ? { autoApproveMappings: Boolean(data.autoApproveMappings) } : {}),
        ...(data.preferredTracker !== undefined ? { preferredTracker: data.preferredTracker } : {}),
        ...(data.themePalette !== undefined ? { themePalette: String(data.themePalette) } : {}),
        ...(data.themeMode !== undefined ? { themeMode: String(data.themeMode) } : {}),
        ...(data.showInLeaderboard !== undefined ? { showInLeaderboard: Boolean(data.showInLeaderboard) } : {}),
      },
    });

    return {
      message: 'Settings saved.',
      settings,
    };
  }

  async unlinkSocial(userId: string, provider: 'google' | 'discord') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (provider === 'google') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { googleId: null },
      });
      return { message: 'Google account unlinked.' };
    }

    if (provider === 'discord') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { discordId: null },
      });
      return { message: 'Discord account unlinked.' };
    }

    throw new BadRequestException('Unsupported social provider.');
  }

  /**
   * Starts password recovery (forgot password).
   * Anti-enumeration: always answers with success so it does not reveal whether the email exists.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const genericResponse = {
      message: 'If the email exists on our platform, you will receive a recovery link in your inbox shortly.',
    };

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: 'insensitive' },
      },
    });

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Random 32-byte cryptographic token (64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Valid for 60 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = await this.mailService.getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const htmlContent = emailTemplate({
      frontendUrl,
      title: 'Reset your password',
      paragraphs: [
        `Hi <strong>${escapeHtml(user.username)}</strong>, someone asked to reset the password of your account.`,
      ],
      button: { text: 'Choose a new password', url: resetLink },
      note: 'The link works only once and expires in 60 minutes. If it was not you, do nothing: your current password is still valid.',
    });

    await this.mailService.sendEmail(user.email, 'SyncSekai — Reset your password', htmlContent);

    return genericResponse;
  }

  /**
   * Resets the password with a token (reset password).
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const cleanToken = dto.token.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: cleanToken,
      },
    });

    if (!user) {
      throw new BadRequestException('The recovery link is invalid or has already been used.');
    }

    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      throw new BadRequestException('The recovery link has expired. Please request a new one.');
    }

    if (dto.newPassword.length < 12) {
      throw new BadRequestException('The new password must contain at least 12 characters.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Update the password and clear the recovery token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revoke every previous session
    try {
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });
    } catch {}

    // Email a notification of the change
    const confirmationHtml = emailTemplate({
      frontendUrl: await this.mailService.getFrontendUrl(),
      title: 'Your password has changed',
      paragraphs: [
        `Hi <strong>${escapeHtml(user.username)}</strong>, the password of your SyncSekai account was just changed.`,
        'If it was you, there is nothing else to do.',
      ],
      note: 'If it was not you, someone has access to your email or your account. Contact the administrator as soon as possible.',
    });
    this.mailService.sendEmail(user.email, 'SyncSekai — Your password has been updated', confirmationHtml).catch(() => {});

    return {
      message: 'Your password has been reset. You can now sign in.',
    };
  }
}
