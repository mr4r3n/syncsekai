import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { ensureDirectoryExists } from './ensure-directory';

export interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'DATABASE' | 'FULL_SYSTEM';
  source: 'MANUAL' | 'SCHEDULED' | 'IMPORTED';
  totalRecords: number;
  tablesCount: number;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time: string; // '03:00'
  includeMedia: boolean;
  retentionCount: number;
  lastRunAt: string | null;
}

/** Backups: listing, schedule, creation, deletion and pruning. */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  /** Maximum size that is opened just to read the metadata for the listing. */
  private static readonly MAX_METADATA_PEEK_BYTES = 20 * 1024 * 1024;
  // Also used by the restore (BackupRestoreService).
  static readonly MAX_UNCOMPRESSED_BACKUP_BYTES = 3 * 1024 * 1024 * 1024;
  private readonly backupsDir = path.resolve(process.cwd(), 'backups');
  private readonly uploadsDir = path.resolve(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
  ) {
    ensureDirectoryExists(this.backupsDir);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Lists existing backups and the schedule configuration.
   */
  async getBackupsList() {
    ensureDirectoryExists(this.backupsDir);

    const files = fs.readdirSync(this.backupsDir);
    const backups: BackupItem[] = [];

    for (const file of files) {
      if (!file.endsWith('.psbackup') && !file.endsWith('.json.gz') && !file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(this.backupsDir, file);
      try {
        const stats = fs.statSync(filePath);
        let type: 'DATABASE' | 'FULL_SYSTEM' = 'DATABASE';
        let source: 'MANUAL' | 'SCHEDULED' | 'IMPORTED' = 'MANUAL';
        let totalRecords = 0;
        let tablesCount = 0;

        // Try to read the file's metadata
        try {
          let contentStr = '';
          if (file.endsWith('.psbackup') || file.endsWith('.gz')) {
            /*
             * The metadata lives inside the file itself, so reading it means
             * decompressing the whole thing. With 60 MB backups, and several in
             * the folder, that is hundreds of megabytes decompressed every time
             * the screen opens.
             *
             * Above this size it is not opened: the type and origin are
             * inferred from the name, which is what the `catch` below does
             * anyway. The record count is lost, which is a cosmetic detail in a
             * listing.
             *
             * The proper fix is to write the metadata to a separate file when
             * the backup is created and read that. If the listing gets slow,
             * that is the fix.
             */
            if (stats.size > BackupService.MAX_METADATA_PEEK_BYTES) {
              throw new Error('Too large to read its metadata for the listing.');
            }
            const buffer = fs.readFileSync(filePath);
            const decompressed = zlib.gunzipSync(buffer, {
              maxOutputLength: BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES,
            });
            contentStr = decompressed.toString('utf8');
          } else {
            if (stats.size > BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES) {
              throw new Error('The backup exceeds the allowed limit.');
            }
            contentStr = fs.readFileSync(filePath, 'utf8');
          }

          const parsed = JSON.parse(contentStr);
          if (parsed.metadata) {
            type = parsed.metadata.type || (parsed.files ? 'FULL_SYSTEM' : 'DATABASE');
            source = parsed.metadata.source || 'MANUAL';
            totalRecords = parsed.metadata.totalRecords || 0;
            tablesCount = parsed.metadata.tablesCount || (parsed.data ? Object.keys(parsed.data).length : 0);
          }
        } catch {
          // Fall back to detection by name
          if (file.includes('full') || file.includes('system')) {
            type = 'FULL_SYSTEM';
          }
          if (file.includes('sched') || file.includes('auto')) {
            source = 'SCHEDULED';
          }
        }

        backups.push({
          filename: file,
          sizeBytes: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          type,
          source,
          totalRecords,
          tablesCount,
        });
      } catch (err: any) {
        this.logger.warn(`Error reading backup stats ${file}: ${err.message}`);
      }
    }

    // Sort from newest to oldest
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const schedule = await this.getScheduleConfig();

    return {
      backups,
      schedule,
      totalBackups: backups.length,
      storageUsedFormatted: this.formatBytes(backups.reduce((acc, b) => acc + b.sizeBytes, 0)),
    };
  }

  /**
   * Returns the backup schedule configuration.
   */
  async getScheduleConfig(): Promise<BackupScheduleConfig> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'BACKUP_AUTO_ENABLED',
            'BACKUP_FREQUENCY',
            'BACKUP_TIME',
            'BACKUP_INCLUDE_MEDIA',
            'BACKUP_RETENTION_COUNT',
            'BACKUP_LAST_RUN',
          ],
        },
      },
    });

    const getVal = (k: string, def: string) => settings.find((s) => s.key === k)?.value ?? def;

    return {
      enabled: getVal('BACKUP_AUTO_ENABLED', 'false') === 'true',
      frequency: (getVal('BACKUP_FREQUENCY', 'DAILY') as any) || 'DAILY',
      time: getVal('BACKUP_TIME', '03:00'),
      includeMedia: getVal('BACKUP_INCLUDE_MEDIA', 'true') === 'true',
      retentionCount: parseInt(getVal('BACKUP_RETENTION_COUNT', '7'), 10) || 7,
      lastRunAt: getVal('BACKUP_LAST_RUN', '') || null,
    };
  }

  /**
   * Saves the backup schedule configuration.
   */
  async saveScheduleConfig(dto: Partial<BackupScheduleConfig>) {
    const updates: { key: string; value: string }[] = [];

    if (dto.enabled !== undefined) {
      updates.push({ key: 'BACKUP_AUTO_ENABLED', value: String(dto.enabled) });
    }
    if (dto.frequency) {
      updates.push({ key: 'BACKUP_FREQUENCY', value: dto.frequency });
    }
    if (dto.time) {
      updates.push({ key: 'BACKUP_TIME', value: dto.time });
    }
    if (dto.includeMedia !== undefined) {
      updates.push({ key: 'BACKUP_INCLUDE_MEDIA', value: String(dto.includeMedia) });
    }
    if (dto.retentionCount !== undefined) {
      updates.push({ key: 'BACKUP_RETENTION_COUNT', value: String(dto.retentionCount) });
    }

    for (const item of updates) {
      await this.prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value, isSecret: false },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'BACKUP',
        message: 'Automatic backup settings updated',
        details: dto as any,
      },
    });

    return {
      success: true,
      message: 'Backup schedule saved.',
      schedule: await this.getScheduleConfig(),
    };
  }

  /**
   * Creates a backup (database only, or full with media files).
   */
  async createBackup(type: 'DATABASE' | 'FULL_SYSTEM' = 'DATABASE', source: 'MANUAL' | 'SCHEDULED' = 'MANUAL') {
    ensureDirectoryExists(this.backupsDir);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `plexsync_${type === 'FULL_SYSTEM' ? 'full' : 'db'}_${source === 'SCHEDULED' ? 'auto_' : ''}${timestampStr}.psbackup`;
    const filePath = path.join(this.backupsDir, filename);

    this.logger.log(`Creating backup (${type}, source: ${source})...`);

    try {
      // 1. Dump every PostgreSQL table
      const [
        systemSettings,
        domainPolicies,
        users,
        userSettings,
        plexConnections,
        jellyfinConnections,
        animeConnections,
        titleMappings,
        userFavorites,
        blacklistEntries,
        scrobbleHistories,
        notifications,
        tickets,
        ticketMessages,
        systemAnnouncements,
        systemMetrics,
        auditLogs,
        embyConnections,
        siteLinks,
        announcementPresets,
        ticketAttachments,
      ] = await Promise.all([
        this.prisma.systemSetting.findMany(),
        this.prisma.domainPolicy.findMany(),
        this.prisma.user.findMany(),
        this.prisma.userSettings.findMany(),
        this.prisma.plexConnection.findMany(),
        this.prisma.jellyfinConnection.findMany(),
        this.prisma.animeConnection.findMany(),
        this.prisma.titleMapping.findMany(),
        this.prisma.userFavorite.findMany(),
        this.prisma.blacklistEntry.findMany(),
        this.prisma.scrobbleHistory.findMany({ take: 50000, orderBy: { createdAt: 'desc' } }),
        this.prisma.notification.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }),
        this.prisma.ticket.findMany({ take: 2000, orderBy: { createdAt: 'desc' } }),
        this.prisma.ticketMessage.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
        this.prisma.systemAnnouncement.findMany(),
        this.prisma.systemMetric.findMany({ take: 5000 }),
        this.prisma.auditLog.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }),
        this.prisma.embyConnection.findMany(),
        this.prisma.siteLink.findMany(),
        this.prisma.announcementPreset.findMany(),
        this.prisma.ticketAttachment.findMany({ take: 10000 }),
      ]);

      const dataPayload = {
        systemSettings,
        domainPolicies,
        users,
        userSettings,
        plexConnections,
        jellyfinConnections,
        animeConnections,
        titleMappings,
        userFavorites,
        blacklistEntries,
        scrobbleHistories,
        notifications,
        tickets,
        ticketMessages,
        systemAnnouncements,
        systemMetrics,
        auditLogs,
        embyConnections,
        siteLinks,
        announcementPresets,
        ticketAttachments,
      };

      let totalRecords = 0;
      for (const key of Object.keys(dataPayload)) {
        totalRecords += (dataPayload as any)[key].length;
      }

      // 2. Collect media files if FULL_SYSTEM
      const filesPayload: Record<string, string> = {};
      if (type === 'FULL_SYSTEM') {
        const readFilesRecursive = (dir: string, baseRelative: string) => {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullP = path.join(dir, entry.name);
            const relP = path.join(baseRelative, entry.name).replace(/\\/g, '/');
            if (entry.isDirectory()) {
              readFilesRecursive(fullP, relP);
            } else if (entry.isFile()) {
              try {
                const buf = fs.readFileSync(fullP);
                filesPayload[relP] = buf.toString('base64');
              } catch (e: any) {
                this.logger.warn(`Could not include file ${relP}: ${e.message}`);
              }
            }
          }
        };

        readFilesRecursive(this.uploadsDir, 'uploads');
      }

      // 3. Build the final package
      const packageObj = {
        metadata: {
          app: 'SyncSekai',
          version: '3.3',
          backupVersion: 2,
          generatedAt: now.toISOString(),
          type,
          source,
          totalRecords,
          tablesCount: Object.keys(dataPayload).length,
          filesCount: Object.keys(filesPayload).length,
        },
        data: dataPayload,
        files: filesPayload,
      };

      // 4. Compress to .psbackup (gzipped JSON)
      const jsonStr = JSON.stringify(packageObj);
      const compressedBuffer = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), { level: 9 });
      fs.writeFileSync(filePath, compressedBuffer);

      const stats = fs.statSync(filePath);

      this.logger.log(`Backup created: ${filename} (${this.formatBytes(stats.size)})`);

      // 5. Audit log entry
      await this.prisma.auditLog.create({
        data: {
          level: 'INFO',
          service: 'BACKUP',
          message: `${source === 'SCHEDULED' ? 'Automatic' : 'Manual'} backup created (${type})`,
          details: {
            filename,
            sizeBytes: stats.size,
            totalRecords,
            type,
            source,
          },
        },
      });

      // 6. If automatic, prune old backups according to retention
      if (source === 'SCHEDULED') {
        await this.pruneOldBackups();
      }

      return {
        success: true,
        message: 'Backup created.',
        filename,
        sizeBytes: stats.size,
        sizeFormatted: this.formatBytes(stats.size),
        createdAt: now.toISOString(),
        totalRecords,
        type,
        source,
      };
    } catch (err: any) {
      this.logger.error(`Error creating the backup: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Failed to create the backup: ${err.message}`);
    }
  }

  /**
   * Returns the path of a backup file to download.
   */
  getBackupFilePath(filename: string): string {
    const cleanName = path.basename(filename);
    const filePath = path.join(this.backupsDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file ${cleanName} does not exist.`);
    }

    return filePath;
  }

  /**
   * Deletes a backup file.
   */
  async deleteBackup(filename: string) {
    const cleanName = path.basename(filename);
    const filePath = path.join(this.backupsDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file ${cleanName} does not exist.`);
    }

    fs.unlinkSync(filePath);

    await this.prisma.auditLog.create({
      data: {
        level: 'WARN',
        service: 'BACKUP',
        message: `Backup deleted: ${cleanName}`,
      },
    });

    return {
      success: true,
      message: `Backup ${cleanName} deleted.`,
    };
  }

  /**
   * Prunes old backups according to the configured retention count.
   */
  async pruneOldBackups() {
    try {
      const schedule = await this.getScheduleConfig();
      const retention = Math.max(1, schedule.retentionCount || 7);

      const files = fs.readdirSync(this.backupsDir);
      const autoBackups: { file: string; mtime: number }[] = [];

      for (const file of files) {
        if (file.includes('auto_') || file.includes('sched')) {
          const p = path.join(this.backupsDir, file);
          const st = fs.statSync(p);
          autoBackups.push({ file, mtime: st.mtimeMs });
        }
      }

      autoBackups.sort((a, b) => b.mtime - a.mtime);

      if (autoBackups.length > retention) {
        const toDelete = autoBackups.slice(retention);
        for (const item of toDelete) {
          const p = path.join(this.backupsDir, item.file);
          fs.unlinkSync(p);
          this.logger.log(`Automatic backup pruned by retention: ${item.file}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error pruning old backups: ${err.message}`);
    }
  }

  /**
   * Cron runner: runs periodically to process scheduled backups.
   */
  @Cron('*/15 * * * *') // Every 15 minutes, check whether a backup is due
  async handleScheduledCron() {
    try {
      const schedule = await this.getScheduleConfig();
      if (!schedule.enabled) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [targetHour, targetMinute] = schedule.time.split(':').map((v) => parseInt(v, 10) || 0);

      // Skip unless this is the target hour's slot (15-minute window)
      if (schedule.frequency !== 'HOURLY') {
        if (currentHour !== targetHour || currentMinute > 15) {
          return;
        }
      }

      // Check whether it already ran today or within the current interval
      if (schedule.lastRunAt) {
        const lastRun = new Date(schedule.lastRunAt);
        const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

        if (schedule.frequency === 'HOURLY' && diffHours < 0.9) return;
        if (schedule.frequency === 'DAILY' && diffHours < 20) return;
        if (schedule.frequency === 'WEEKLY' && diffHours < 140) return;
        if (schedule.frequency === 'MONTHLY' && diffHours < 650) return;
      }

      this.logger.log(`Running scheduled automatic backup (${schedule.frequency})...`);

      const type = schedule.includeMedia ? 'FULL_SYSTEM' : 'DATABASE';
      await this.createBackup(type, 'SCHEDULED');

      // Update the last run date
      await this.prisma.systemSetting.upsert({
        where: { key: 'BACKUP_LAST_RUN' },
        update: { value: now.toISOString() },
        create: { key: 'BACKUP_LAST_RUN', value: now.toISOString(), isSecret: false },
      });
    } catch (err: any) {
      this.logger.error(`Automatic backup cron error: ${err.message}`);
    }
  }
}
