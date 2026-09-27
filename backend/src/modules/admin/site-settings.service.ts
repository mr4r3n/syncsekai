import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SITE_SETTINGS,
  ICON_VERSION_KEY,
  findSiteSetting,
  resolveSiteSettings,
  validateSiteSetting,
} from '../../common/security/site-setting-definitions';
import { reencodeSiteIcon, SITE_ICON_VARIANTS } from '../../common/security/image-file';
import { SYSTEM_CREDENTIALS, findCredential, displayValue } from '../../common/security/system-credentials';
import { EncryptionService } from '../../common/crypto/encryption.service';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

/** Public site settings, system credentials and maintenance mode. */
@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /** Public site settings, with the stored value and the default of each. */
  async getSiteSettings() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: SITE_SETTINGS.map((a) => a.key) } },
      select: { key: true, value: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((f) => [f.key, f]));
    return {
      settings: SITE_SETTINGS.map((a) => ({
        key: a.key,
        field: a.field,
        value: byKey.get(a.key)?.value || '',
        defaultValue: a.defaultValue,
        maxLength: a.maxLength,
        updatedAt: byKey.get(a.key)?.updatedAt?.toISOString() || null,
      })),
      effective: resolveSiteSettings(new Map(rows.map((f) => [f.key, f.value || '']))),
      iconVersion: (await this.prisma.systemSetting.findUnique({ where: { key: ICON_VERSION_KEY } }))?.value || null,
    };
  }

  private get siteIconDir() {
    return path.join(process.cwd(), 'uploads', 'site');
  }

  /** Replaces the site icon. The version changes the URL to bust the cache. */
  async uploadSiteIcon(adminId: string, fileBuffer: Buffer) {
    fs.mkdirSync(this.siteIconDir, { recursive: true });
    await reencodeSiteIcon(fileBuffer, this.siteIconDir);
    const version = String(Date.now());
    await this.prisma.systemSetting.upsert({
      where: { key: ICON_VERSION_KEY },
      update: { value: version, isSecret: false },
      create: { key: ICON_VERSION_KEY, value: version, isSecret: false },
    });
    await this.prisma.auditLog
      .create({ data: { level: 'INFO', service: 'ADMIN', message: 'Site icon updated', details: { adminId } } })
      .catch(() => {});
    return { success: true, iconVersion: version };
  }

  /** Goes back to the built-in icon. */
  async deleteSiteIcon(adminId: string) {
    // The version in the database decides whether it is served; a file that
    // cannot be deleted is not shown.
    await this.prisma.systemSetting.deleteMany({ where: { key: ICON_VERSION_KEY } });
    for (const v of Object.values(SITE_ICON_VARIANTS)) {
      const onDisk = path.join(this.siteIconDir, v.file);
      try {
        if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
      } catch (err: any) {
        this.logger.warn(`Could not delete ${v.file}: ${err.message}`);
      }
    }
    await this.prisma.auditLog
      .create({ data: { level: 'INFO', service: 'ADMIN', message: 'Site icon reset', details: { adminId } } })
      .catch(() => {});
    return { success: true, iconVersion: null };
  }

  /** An empty value goes back to the default. Keys outside the list are ignored. */
  async updateSiteSettings(adminId: string, changes: Record<string, string>) {
    const entries = Object.entries(changes || {});
    if (entries.length === 0) throw new BadRequestException('No changes were sent.');

    const updated: string[] = [];
    for (const [key, rawValue] of entries) {
      const setting = findSiteSetting(key);
      if (!setting) continue;
      const value = String(rawValue ?? '').trim();
      const reason = validateSiteSetting(setting, value);
      if (reason) throw new BadRequestException(reason);
      await this.prisma.systemSetting.upsert({
        where: { key: key },
        update: { value: value, isSecret: false },
        create: { key: key, value: value, isSecret: false },
      });
      updated.push(key);
    }
    if (updated.length === 0) throw new BadRequestException('None of the submitted keys can be changed here.');

    await this.prisma.auditLog
      .create({ data: { level: 'INFO', service: 'ADMIN', message: `Site settings updated: ${updated.join(', ')}`, details: { adminId, keys: updated } } })
      .catch(() => {});
    return { success: true, updated: updated };
  }

  /**
   * State of the system credentials, WITHOUT returning any secret.
   *
   * An administrator needs to know what is set and since when, not to reread a
   * client secret. Returning them would turn any XSS or stolen session into a
   * credential leak, for nothing in return.
   */
  async getSystemCredentials() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: SYSTEM_CREDENTIALS.map((c) => c.key) } },
      select: { key: true, value: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((f) => [f.key, f]));

    return {
      credentials: SYSTEM_CREDENTIALS.map((cred) => {
        const row = byKey.get(cred.key);
        const value = row?.value || '';
        return {
          key: cred.key,
          group: cred.group,
          label: cred.label,
          isSecret: cred.secret,
          configured: value.length > 0,
          value: displayValue(cred, value),
          updatedAt: row?.updatedAt?.toISOString() || null,
        };
      }),
    };
  }

  /**
   * Changes system credentials.
   *
   * It asks for the password again on purpose: someone already inside the panel
   * can do a lot of damage, but rotating the OAuth credentials is one of the few
   * actions done twice a year that affect every account, so a stolen session
   * should not be enough.
   *
   * An empty value deletes the credential; that is not the same as not sending
   * it, which leaves it as is. Without that difference there would be no way to
   * disable a provider from here.
   */
  async updateSystemCredentials(
    adminId: string,
    currentPassword: string,
    changes: Record<string, string>,
  ) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.passwordHash) {
      throw new ForbiddenException(
        'This account has no local password, so it cannot confirm the change.',
      );
    }
    if (!currentPassword || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new ForbiddenException('The password is not correct.');
    }

    const entries = Object.entries(changes || {});
    if (entries.length === 0) {
      throw new BadRequestException('No changes were sent.');
    }

    const updated: string[] = [];
    for (const [key, rawValue] of entries) {
      const cred = findCredential(key);
      // Closed list: any other key is silently ignored instead of letting this
      // become "write whatever you want into the configuration".
      if (!cred) continue;

      const value = String(rawValue ?? '').trim();
      const saved = value && cred.secret ? this.encryptionService.encrypt(value) : value;

      await this.prisma.systemSetting.upsert({
        where: { key: key },
        update: { value: saved, isSecret: cred.secret },
        create: { key: key, value: saved, isSecret: cred.secret },
      });
      updated.push(key);
    }

    if (updated.length === 0) {
      throw new BadRequestException('None of the submitted keys can be changed here.');
    }

    // WHAT was changed is logged, never the value.
    await this.prisma.auditLog
      .create({
        data: {
          level: 'WARN',
          service: 'ADMIN',
          message: `System credentials updated: ${updated.join(', ')}`,
          details: { adminId, keys: updated },
        },
      })
      .catch(() => {});

    return { success: true, updated: updated };
  }

  /**
   * Returns the maintenance mode state.
   */
  async getMaintenanceStatus() {
    const [enabledSetting, messageSetting, endSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_ESTIMATED_END' } }),
    ]);

    return {
      enabled: enabledSetting?.value === 'true',
      message: messageSetting?.value || 'We are tuning SyncSekai\'s sync engines. We will be back shortly.',
      estimatedEnd: endSetting?.value || null,
    };
  }

  /**
   * Turns maintenance mode on or off.
   */
  async setMaintenanceStatus(enabled: boolean, message?: string, estimatedEnd?: string) {
    await this.prisma.systemSetting.upsert({
      where: { key: 'MAINTENANCE_MODE' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'MAINTENANCE_MODE', value: enabled ? 'true' : 'false' },
    });

    if (message !== undefined) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'MAINTENANCE_MESSAGE' },
        update: { value: message },
        create: { key: 'MAINTENANCE_MESSAGE', value: message },
      });
    }

    if (estimatedEnd !== undefined) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'MAINTENANCE_ESTIMATED_END' },
        update: { value: estimatedEnd },
        create: { key: 'MAINTENANCE_ESTIMATED_END', value: estimatedEnd },
      });
    }

    return this.getMaintenanceStatus();
  }
}
