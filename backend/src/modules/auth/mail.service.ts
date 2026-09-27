import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { EncryptionService } from '../../common/crypto/encryption.service';

/** Sends email through the configured SMTP, and resolves the frontend's public URL. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Returns the frontend's public URL.
   */
  async getFrontendUrl(): Promise<string> {
    const domainSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'APP_DOMAIN' },
    });
    return (
      domainSetting?.value ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * Sends email through the SMTP configured in `SystemSetting`, with the
   * environment as a fallback.
   *
   * There is no other provider behind it: without `SMTP_HOST` this returns
   * `false` and the email is not sent. What is lost then is account activation,
   * password reset and email change, that is, every way in without an
   * administrator's help.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const settings = await this.prisma.systemSetting.findMany({
        where: {
          key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] },
        },
      });

      const map = new Map(settings.map((s) => [s.key, s.value]));
      const host = map.get('SMTP_HOST') || process.env.SMTP_HOST;
      const port = Number(map.get('SMTP_PORT') || process.env.SMTP_PORT || 587);
      const user = map.get('SMTP_USER') || process.env.SMTP_USER;
      let pass = map.get('SMTP_PASS') || process.env.SMTP_PASS;
      if (pass && this.encryptionService) {
        try {
          pass = this.encryptionService.decrypt(pass);
        } catch {}
      }
      const from = map.get('SMTP_FROM') || process.env.SMTP_FROM || 'SyncSekai <noreply@syncsekai.com>';

      if (!host) {
        this.logger.warn(`[SMTP] Not configured. Email to ${to} simulated in the console.`);
        return false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`[SMTP] Email sent to ${to} ("${subject}")`);
      return true;
    } catch (err: any) {
      this.logger.error(`[SMTP] Failed to send email to ${to}: ${err.message}`);
      return false;
    }
  }
}
