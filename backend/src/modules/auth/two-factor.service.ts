import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { emailTemplate } from '../../common/email/email-template';
import { MailService } from './mail.service';

/** Two-factor authentication (TOTP and email) and backup codes. */
@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private mailService: MailService,
  ) {}

  // 2FA: generate the TOTP secret and QR code
  async generateTotp(userId: string, currentPasswordOrCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    // If the user already has 2FA enabled, require re-authentication before reconfiguring
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!currentPasswordOrCode) {
        throw new BadRequestException('Verify your current 2FA factor or password to reconfigure the authenticator.');
      }
      let verified = false;
      const existingSecret = this.encryptionService.decrypt(user.twoFactorSecret);
      const otpCheck = verifySync({ token: currentPasswordOrCode.trim(), secret: existingSecret.trim() });
      if (otpCheck && otpCheck.valid) {
        verified = true;
      } else if (user.passwordHash) {
        verified = await bcrypt.compare(currentPasswordOrCode, user.passwordHash);
      }
      if (!verified) {
        throw new BadRequestException('The current factor code or password is incorrect.');
      }
    }

    const secret = generateSecret({ length: 20 });
    await this.prisma.systemSetting.upsert({
      where: { key: `TOTP_SETUP_${userId}` },
      create: {
        key: `TOTP_SETUP_${userId}`,
        value: this.encryptionService.encrypt(JSON.stringify({
          secret,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })),
        isSecret: true,
      },
      update: {
        value: this.encryptionService.encrypt(JSON.stringify({
          secret,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })),
        isSecret: true,
      },
    });
    const otpauth = generateURI({ secret, label: user.email, issuer: 'SyncSekai' });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
      width: 260,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return {
      secret,
      qrCodeDataUrl,
      otpauth,
    };
  }

  // 2FA: enable TOTP
  async enableTotp(userId: string, token: string, currentPasswordOrCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    // If the user already has 2FA enabled, require the current factor or the password
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!currentPasswordOrCode) {
        throw new BadRequestException('Verify your current 2FA factor or password to replace the existing configuration.');
      }
      let verified = false;
      const existingSecret = this.encryptionService.decrypt(user.twoFactorSecret);
      const otpCheck = verifySync({ token: currentPasswordOrCode.trim(), secret: existingSecret.trim() });
      if (otpCheck && otpCheck.valid) {
        verified = true;
      } else if (user.passwordHash) {
        verified = await bcrypt.compare(currentPasswordOrCode, user.passwordHash);
      }
      if (!verified) {
        throw new BadRequestException('The current factor verification code or password is not correct.');
      }
    }

    const pending = await this.prisma.systemSetting.findUnique({
      where: { key: `TOTP_SETUP_${userId}` },
    });
    if (!pending) {
      throw new BadRequestException('The TOTP setup does not exist or has expired.');
    }
    const parsed = JSON.parse(this.encryptionService.decrypt(pending.value));
    if (!parsed.secret || Number(parsed.expiresAt) < Date.now()) {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('The TOTP setup has expired.');
    }
    const secret = String(parsed.secret);
    const result = verifySync({ token: token.trim(), secret: secret.trim() });
    if (!result || !result.valid) {
      throw new BadRequestException('The 6-digit code is incorrect or has expired.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'APP_TOTP',
        twoFactorSecret: this.encryptionService.encrypt(secret),
      },
    });
    await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });

    return {
      message: 'Two-step authentication (authenticator app) enabled.',
      twoFactorEnabled: true,
      twoFactorType: 'APP_TOTP',
    };
  }

  // 2FA: request an OTP code by email
  async requestEmailOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailOtpCode: codeHash,
        emailOtpExpiresAt: expiresAt,
      },
    });

    const sent = await this.mailService.sendEmail(
      user.email,
      'SyncSekai — Verification code',
      emailTemplate({
        frontendUrl: await this.mailService.getFrontendUrl(),
        title: 'Your verification code',
        paragraphs: ['Enter this code to confirm the operation:'],
        code: code,
        note: 'It expires in 10 minutes and works only once. Nobody from SyncSekai will ever ask you for it through any other channel.',
      }),
    );
    if (!sent && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('The 2FA code could not be delivered.');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('🔐 [DEV EMAIL SIMULATOR] EMAIL 2FA CODE (ACTIVATION / SETUP)');
      console.log(`To: ${user.email} (User: ${user.username})`);
      console.log(`👉 6-DIGIT CODE: >>> ${code} <<<`);
      console.log(`Expires at: ${expiresAt.toLocaleTimeString()}`);
      console.log('='.repeat(72) + '\n');
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      message: `Verification code sent to ${user.email}`,
      ...(isDev ? { previewCode: code } : {}),
    };
  }

  // 2FA: enable email 2FA
  async enableEmailOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const otpMatches = user.emailOtpCode
      ? await bcrypt.compare(code.trim(), user.emailOtpCode)
      : false;
    if (!otpMatches) {
      throw new BadRequestException('The verification code is invalid.');
    }

    if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
      throw new BadRequestException('The verification code has expired. Request a new one.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'EMAIL_OTP',
        emailOtpCode: null,
        emailOtpExpiresAt: null,
      },
    });

    return {
      message: 'Two-step authentication (email) enabled.',
      twoFactorEnabled: true,
      twoFactorType: 'EMAIL_OTP',
    };
  }

  // 2FA: disable
  async disable2Fa(userId: string, password?: string, verificationCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (user.passwordHash) {
      if (!password) {
        throw new UnauthorizedException('Confirm your current password.');
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) throw new UnauthorizedException('Incorrect password.');
    }
    if (user.twoFactorType === 'APP_TOTP') {
      const secret = this.encryptionService.decrypt(user.twoFactorSecret || '');
      const result = verifySync({ token: verificationCode?.trim() || '', secret });
      if (!result?.valid) {
        throw new UnauthorizedException('Confirm a valid 2FA code.');
      }
    } else if (user.twoFactorType === 'EMAIL_OTP') {
      const codeMatches = user.emailOtpCode && verificationCode
        ? await bcrypt.compare(verificationCode.trim(), user.emailOtpCode)
        : false;
      if (!codeMatches || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
        throw new UnauthorizedException('Confirm a valid 2FA code.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorType: 'NONE',
        twoFactorSecret: null,
        emailOtpCode: null,
        emailOtpExpiresAt: null,
      },
    });

    return {
      message: 'Two-step authentication disabled.',
      twoFactorEnabled: false,
      twoFactorType: 'NONE',
    };
  }

  /**
   * Generates a new batch of 8 emergency recovery codes.
   */
  async generateBackupCodes(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    // Generate 8 readable alphanumeric codes in XXXX-XXXX format
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const codes: string[] = [];

    for (let i = 0; i < 8; i++) {
      let part1 = '';
      let part2 = '';
      for (let j = 0; j < 4; j++) {
        part1 += charset[crypto.randomInt(0, charset.length)];
        part2 += charset[crypto.randomInt(0, charset.length)];
      }
      codes.push(`${part1}-${part2}`);
    }

    // Pick a random challenge index (0 to 7)
    const challengeIndex = crypto.randomInt(0, codes.length);

    // Persist the challenge and batch on the server to guarantee single use and authorized validation
    await this.prisma.systemSetting.upsert({
      where: { key: `BACKUP_CODES_SETUP_${userId}` },
      create: {
        key: `BACKUP_CODES_SETUP_${userId}`,
        value: this.encryptionService.encrypt(
          JSON.stringify({
            codes,
            challengeIndex,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }),
        ),
        isSecret: true,
      },
      update: {
        value: this.encryptionService.encrypt(
          JSON.stringify({
            codes,
            challengeIndex,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }),
        ),
        isSecret: true,
      },
    });

    return {
      codes,
      challengeIndex,
      challengeNumber: challengeIndex + 1,
      totalCodes: codes.length,
    };
  }

  /**
   * Verifies the challenge code and stores the hashed codes in the database.
   */
  async verifyAndSaveBackupCodes(
    userId: string,
    data: { codes: string[]; challengeIndex: number; confirmedCode: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    // Validate against the challenge stored on the server
    const pending = await this.prisma.systemSetting.findUnique({
      where: { key: `BACKUP_CODES_SETUP_${userId}` },
    });
    if (!pending) {
      throw new BadRequestException('There is no recovery code batch pending verification, or it has expired.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(this.encryptionService.decrypt(pending.value));
    } catch {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('Failed to decrypt the verification batch.');
    }

    if (!parsed.codes || Number(parsed.expiresAt) < Date.now()) {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('The recovery code request has expired.');
    }

    const expectedCode = String(parsed.codes[parsed.challengeIndex] || '').trim().toUpperCase().replace(/\s+/g, '');
    const providedCode = (data.confirmedCode || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!providedCode || providedCode !== expectedCode) {
      throw new BadRequestException(
        `The code does not match code #${parsed.challengeIndex + 1}. Make sure you saved all your codes and try again.`,
      );
    }

    // Hash each emergency code from the authentic list generated by the server
    const hashedCodes = await Promise.all(
      parsed.codes.map((c: string) => bcrypt.hash(c.trim().toUpperCase(), 10)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        backupCodes: hashedCodes,
        backupCodesGeneratedAt: new Date(),
      },
    });

    await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });

    // Audit log entry
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'AUTH_SECURITY',
        message: `User @${user.username} generated and enabled 8 new emergency recovery codes.`,
      },
    });

    return {
      success: true,
      message: 'Emergency recovery codes enabled and saved.',
      remainingCount: hashedCodes.length,
      generatedAt: new Date(),
    };
  }

  /**
   * Returns the state of the user's recovery codes.
   */
  async getBackupCodesStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        backupCodes: true,
        backupCodesGeneratedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      hasBackupCodes: (user.backupCodes || []).length > 0,
      remainingCount: (user.backupCodes || []).length,
      generatedAt: user.backupCodesGeneratedAt,
    };
  }

  /**
   * Resets the password with an emergency recovery code (no email needed).
   */
  async recoverWithBackupCode(data: {
    identifier: string;
    backupCode: string;
    newPassword: string;
  }) {
    const cleanIdentifier = (data.identifier || '').trim().toLowerCase();
    const cleanCode = (data.backupCode || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!cleanIdentifier || !cleanCode) {
      throw new BadRequestException('Provide your username or email and the emergency code.');
    }

    if (!data.newPassword || data.newPassword.length < 12) {
      throw new BadRequestException('The new password must be at least 12 characters long.');
    }

    // Find the user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { username: { equals: cleanIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
      throw new BadRequestException('Invalid credentials or emergency recovery code.');
    }

    // Check whether the code matches one of the stored hashes
    let matchIndex = -1;
    for (let i = 0; i < user.backupCodes.length; i++) {
      const isMatch = await bcrypt.compare(cleanCode, user.backupCodes[i]);
      if (isMatch) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      throw new BadRequestException('The emergency recovery code is incorrect or has already been used.');
    }

    // Burn the used code: remove it from the list
    const updatedBackupCodes = [...user.backupCodes];
    updatedBackupCodes.splice(matchIndex, 1);

    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    // Update the password and store the remaining codes
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        backupCodes: updatedBackupCodes,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revoke every open session
    try {
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });
    } catch {}

    // Audit log entry
    await this.prisma.auditLog.create({
      data: {
        level: 'WARN',
        service: 'EMERGENCY_RECOVERY',
        message: `User @${user.username} recovered their account with an emergency code. ${updatedBackupCodes.length} valid codes left.`,
      },
    });

    return {
      success: true,
      message: 'Your password has been reset with your emergency code. You can now sign in with your new password.',
      remainingCodes: updatedBackupCodes.length,
    };
  }
}
