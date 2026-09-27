import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MappingSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { ensureDirectoryExists } from './ensure-directory';
import { BackupService } from './backup.service';

/**
 * Resolves where to write a file from a backup, keeping its subdirectory
 * ("uploads/avatars/x.webp"): the app serves avatars and covers from different
 * subdirectories. Returns null if the path escapes the target directory.
 */
export function resolveRestoreTarget(uploadsDir: string, relPath: string): string | null {
  const base = path.resolve(uploadsDir);
  const normalized = String(relPath || '').trim().replace(/\\/g, '/');
  if (!normalized) return null;
  // Inside a backup package paths are always relative. An absolute path or one
  // with a drive letter is malformed or hostile: it is rejected instead of being
  // silently rewritten to a target other than the one it asked for.
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;

  const relative = normalized.replace(/^uploads\//, '');
  if (!relative) return null;

  const target = path.resolve(base, relative);
  // Compare including the separator: without it, "/app/uploads-malicious"
  // would pass a startsWith("/app/uploads").
  if (target !== base && !target.startsWith(base + path.sep)) {
    return null;
  }
  return target;
}

/** Restores a backup: file validation, data and uploaded files. */
@Injectable()
export class BackupRestoreService {
  private readonly logger = new Logger(BackupRestoreService.name);

  /*
   * Size limits on restore. A small .gz can decompress into gigabytes, so an
   * uploaded file has a low limit; backups from our own backups directory have
   * a much higher one.
   */
  private static readonly MAX_UPLOADED_BACKUP_BYTES = 200 * 1024 * 1024;
  private static readonly MAX_LOCAL_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;

  constructor(
    private prisma: PrismaService,
    private backupService: BackupService,
  ) {}

  /**
   * Restores a backup.
   */
  async restoreBackup(filenameOrBuffer: string | Buffer) {
    this.logger.log('Starting backup restore...');

    let parsedPackage: any = null;

    try {
      let buffer: Buffer;
      // A file from our own backups directory is not the same as one that
      // comes from outside: we wrote the first one.
      let isLocal: boolean;
      if (typeof filenameOrBuffer === 'string') {
        const filePath = this.backupService.getBackupFilePath(filenameOrBuffer);
        buffer = fs.readFileSync(filePath);
        isLocal = true;
      } else {
        buffer = filenameOrBuffer;
        isLocal = false;
      }

      const limit = isLocal
        ? BackupRestoreService.MAX_LOCAL_BACKUP_BYTES
        : BackupRestoreService.MAX_UPLOADED_BACKUP_BYTES;
      if (buffer.length > limit) {
        const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
        throw new BadRequestException(
          `The backup file is ${mb(buffer.length)} and the limit is ${mb(limit)}.`,
        );
      }

      try {
        const decompressed = zlib.gunzipSync(buffer, {
          maxOutputLength: BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES,
        });
        parsedPackage = JSON.parse(decompressed.toString('utf8'));
      } catch {
        if (buffer.length > BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES) {
          throw new Error('The decompressed backup exceeds the allowed limit.');
        }
        parsedPackage = JSON.parse(buffer.toString('utf8'));
      }
    } catch (err: any) {
      throw new BadRequestException(`The backup file is corrupt or has an invalid format: ${err.message}`);
    }

    if (!parsedPackage.data) {
      throw new BadRequestException('The backup file contains no recognizable data.');
    }

    const { data, files } = parsedPackage;
    let restoredCount = 0;

    try {
      // 1. Restore SystemSettings
      if (Array.isArray(data.systemSettings)) {
        for (const item of data.systemSettings) {
          await this.prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: item.value, isSecret: item.isSecret ?? false },
            create: { key: item.key, value: item.value, isSecret: item.isSecret ?? false },
          });
          restoredCount++;
        }
      }

      // 2. Restore DomainPolicies
      if (Array.isArray(data.domainPolicies)) {
        for (const item of data.domainPolicies) {
          await this.prisma.domainPolicy.upsert({
            where: { domain: item.domain },
            update: { isAllowed: item.isAllowed, reason: item.reason },
            create: { domain: item.domain, isAllowed: item.isAllowed, reason: item.reason },
          });
          restoredCount++;
        }
      }

      // 3. Restore users
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          await this.prisma.user.upsert({
            where: { id: u.id },
            update: {
              userToken: u.userToken || `usr_live_${u.id}`,
              email: u.email,
              username: u.username,
              passwordHash: u.passwordHash,
              role: u.role,
              isActive: u.isActive ?? true,
              activationToken: u.activationToken,
              activationExpiresAt: u.activationExpiresAt ? new Date(u.activationExpiresAt) : null,
              twoFactorEnabled: u.twoFactorEnabled ?? false,
              twoFactorSecret: u.twoFactorSecret,
              twoFactorType: u.twoFactorType ?? 'NONE',
              emailOtpCode: u.emailOtpCode,
              emailOtpExpiresAt: u.emailOtpExpiresAt ? new Date(u.emailOtpExpiresAt) : null,
              webhookToken: u.webhookToken || `whk_live_${u.id}`,
              avatarUrl: u.avatarUrl,
              googleId: u.googleId,
              discordId: u.discordId,
              githubId: u.githubId,
              passwordResetToken: u.passwordResetToken,
              passwordResetExpiresAt: u.passwordResetExpiresAt ? new Date(u.passwordResetExpiresAt) : null,
            },
            create: {
              id: u.id,
              userToken: u.userToken || `usr_live_${u.id}`,
              email: u.email,
              username: u.username,
              passwordHash: u.passwordHash,
              role: u.role,
              isActive: u.isActive ?? true,
              activationToken: u.activationToken,
              activationExpiresAt: u.activationExpiresAt ? new Date(u.activationExpiresAt) : null,
              twoFactorEnabled: u.twoFactorEnabled ?? false,
              twoFactorSecret: u.twoFactorSecret,
              twoFactorType: u.twoFactorType ?? 'NONE',
              emailOtpCode: u.emailOtpCode,
              emailOtpExpiresAt: u.emailOtpExpiresAt ? new Date(u.emailOtpExpiresAt) : null,
              webhookToken: u.webhookToken || `whk_live_${u.id}`,
              avatarUrl: u.avatarUrl,
              googleId: u.googleId,
              discordId: u.discordId,
              githubId: u.githubId,
              passwordResetToken: u.passwordResetToken,
              passwordResetExpiresAt: u.passwordResetExpiresAt ? new Date(u.passwordResetExpiresAt) : null,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 4. Restore UserSettings
      if (Array.isArray(data.userSettings)) {
        for (const s of data.userSettings) {
          await this.prisma.userSettings.upsert({
            where: { userId: s.userId },
            update: {
              completionPercentage: s.completionPercentage ?? 85,
              syncRatings: s.syncRatings ?? true,
              emailErrorAlerts: s.emailErrorAlerts ?? true,
              autoApproveMappings: s.autoApproveMappings ?? true,
              preferredTracker: s.preferredTracker ?? 'BOTH',
              blockedGenres: s.blockedGenres ?? [],
              canScrobble: s.canScrobble ?? true,
              canAccessCatalog: s.canAccessCatalog ?? true,
              canEditMappings: s.canEditMappings ?? true,
              canSyncAnilist: s.canSyncAnilist ?? true,
              canSyncMal: s.canSyncMal ?? true,
              isSuspended: s.isSuspended ?? false,
              showInLeaderboard: s.showInLeaderboard === true,
            },
            create: {
              userId: s.userId,
              completionPercentage: s.completionPercentage ?? 85,
              syncRatings: s.syncRatings ?? true,
              emailErrorAlerts: s.emailErrorAlerts ?? true,
              autoApproveMappings: s.autoApproveMappings ?? true,
              preferredTracker: s.preferredTracker ?? 'BOTH',
              blockedGenres: s.blockedGenres ?? [],
              canScrobble: s.canScrobble ?? true,
              canAccessCatalog: s.canAccessCatalog ?? true,
              canEditMappings: s.canEditMappings ?? true,
              canSyncAnilist: s.canSyncAnilist ?? true,
              canSyncMal: s.canSyncMal ?? true,
              isSuspended: s.isSuspended ?? false,
              showInLeaderboard: s.showInLeaderboard === true,
            },
          });
          restoredCount++;
        }
      }

      // 5. Restore Plex connections
      if (Array.isArray(data.plexConnections)) {
        for (const p of data.plexConnections) {
          await this.prisma.plexConnection.upsert({
            where: { userId: p.userId },
            update: {
              serverName: p.serverName,
              serverUrl: p.serverUrl,
              plexUsername: p.plexUsername,
              encryptedAuthToken: p.encryptedAuthToken,
              monitoredLibraries: p.monitoredLibraries ?? [],
              isConnected: p.isConnected ?? false,
              lastSyncAt: p.lastSyncAt ? new Date(p.lastSyncAt) : null,
            },
            create: {
              id: p.id,
              userId: p.userId,
              serverName: p.serverName,
              serverUrl: p.serverUrl,
              plexUsername: p.plexUsername,
              encryptedAuthToken: p.encryptedAuthToken,
              monitoredLibraries: p.monitoredLibraries ?? [],
              isConnected: p.isConnected ?? false,
              lastSyncAt: p.lastSyncAt ? new Date(p.lastSyncAt) : null,
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 5.1 Restore Jellyfin connections
      if (Array.isArray(data.jellyfinConnections)) {
        for (const j of data.jellyfinConnections) {
          await this.prisma.jellyfinConnection.upsert({
            where: { userId: j.userId },
            update: {
              serverName: j.serverName,
              serverUrl: j.serverUrl,
              jellyfinUsername: j.jellyfinUsername,
              encryptedApiKey: j.encryptedApiKey,
              monitoredLibraries: j.monitoredLibraries ?? [],
              isConnected: j.isConnected ?? false,
              lastSyncAt: j.lastSyncAt ? new Date(j.lastSyncAt) : null,
            },
            create: {
              id: j.id,
              userId: j.userId,
              serverName: j.serverName,
              serverUrl: j.serverUrl,
              jellyfinUsername: j.jellyfinUsername,
              encryptedApiKey: j.encryptedApiKey,
              monitoredLibraries: j.monitoredLibraries ?? [],
              isConnected: j.isConnected ?? false,
              lastSyncAt: j.lastSyncAt ? new Date(j.lastSyncAt) : null,
              createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 6. Restore anime tracker connections
      if (Array.isArray(data.animeConnections)) {
        for (const a of data.animeConnections) {
          await this.prisma.animeConnection.upsert({
            where: {
              userId_provider: {
                userId: a.userId,
                provider: a.provider,
              },
            },
            update: {
              remoteUsername: a.remoteUsername,
              remoteUserId: a.remoteUserId,
              avatarUrl: a.avatarUrl,
              encryptedAccessToken: a.encryptedAccessToken,
              encryptedRefreshToken: a.encryptedRefreshToken,
              tokenExpiresAt: a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null,
              isConnected: a.isConnected ?? true,
              lastLatencyMs: a.lastLatencyMs,
              lastCheckedAt: a.lastCheckedAt ? new Date(a.lastCheckedAt) : null,
            },
            create: {
              id: a.id,
              userId: a.userId,
              provider: a.provider,
              remoteUsername: a.remoteUsername,
              remoteUserId: a.remoteUserId,
              avatarUrl: a.avatarUrl,
              encryptedAccessToken: a.encryptedAccessToken,
              encryptedRefreshToken: a.encryptedRefreshToken,
              tokenExpiresAt: a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null,
              isConnected: a.isConnected ?? true,
              lastLatencyMs: a.lastLatencyMs,
              lastCheckedAt: a.lastCheckedAt ? new Date(a.lastCheckedAt) : null,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 7. Restore TitleMappings
      if (Array.isArray(data.titleMappings)) {
        for (const m of data.titleMappings) {
          await this.prisma.titleMapping.upsert({
            where: {
              userId_plexTitle_plexSeason: {
                userId: m.userId,
                plexTitle: m.plexTitle,
                plexSeason: m.plexSeason ?? 1,
              },
            },
            update: {
              anilistMediaId: m.anilistMediaId,
              anilistTitle: m.anilistTitle,
              malMediaId: m.malMediaId,
              malTitle: m.malTitle,
              confidenceScore: m.confidenceScore ?? 1.0,
              isApproved: m.isApproved ?? true,
              isManual: m.isManual ?? false,
              isGlobal: m.isGlobal ?? false,
              ...(Object.values(MappingSource).includes(m.source) ? { source: m.source } : {}),
            },
            create: {
              id: m.id,
              userId: m.userId,
              plexTitle: m.plexTitle,
              plexSeason: m.plexSeason ?? 1,
              anilistMediaId: m.anilistMediaId,
              anilistTitle: m.anilistTitle,
              malMediaId: m.malMediaId,
              malTitle: m.malTitle,
              confidenceScore: m.confidenceScore ?? 1.0,
              isApproved: m.isApproved ?? true,
              isManual: m.isManual ?? false,
              isGlobal: m.isGlobal ?? false,
              ...(Object.values(MappingSource).includes(m.source) ? { source: m.source } : {}),
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 7.1 Restore user favorites
      if (Array.isArray(data.userFavorites)) {
        for (const f of data.userFavorites) {
          const animeId = f.animeId || String(f.anilistMediaId || f.id);
          await this.prisma.userFavorite.upsert({
            where: {
              userId_animeId: {
                userId: f.userId,
                animeId,
              },
            },
            update: {
              title: f.title,
              coverUrl: f.coverUrl || f.coverImage || null,
              genres: f.genres ?? [],
            },
            create: {
              id: f.id,
              userId: f.userId,
              animeId,
              title: f.title,
              coverUrl: f.coverUrl || f.coverImage || null,
              genres: f.genres ?? [],
              createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 8. Restore BlacklistEntries
      if (Array.isArray(data.blacklistEntries)) {
        for (const b of data.blacklistEntries) {
          await this.prisma.blacklistEntry.upsert({
            where: { id: b.id },
            update: {
              titlePattern: b.titlePattern,
              reason: b.reason,
            },
            create: {
              id: b.id,
              userId: b.userId,
              titlePattern: b.titlePattern,
              reason: b.reason,
              createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9. Restore scrobble history
      if (Array.isArray(data.scrobbleHistories)) {
        for (const h of data.scrobbleHistories) {
          await this.prisma.scrobbleHistory.upsert({
            where: { id: h.id },
            update: {
              showTitle: h.showTitle,
              episodeNumber: h.episodeNumber,
              seasonNumber: h.seasonNumber ?? 1,
              viewPercentage: h.viewPercentage ?? 100,
              rating: h.rating,
              anilistStatus: h.anilistStatus ?? 'SUCCESS',
              malStatus: h.malStatus ?? 'SUCCESS',
              kitsuStatus: h.kitsuStatus ?? 'PENDING',
              source: h.source ?? null,
              serverName: h.serverName ?? null,
              libraryName: h.libraryName ?? null,
              errorMessage: h.errorMessage,
              payloadSnapshot: h.payloadSnapshot,
              viewedAt: h.viewedAt ? new Date(h.viewedAt) : new Date(),
            },
            create: {
              id: h.id,
              userId: h.userId,
              showTitle: h.showTitle,
              episodeNumber: h.episodeNumber,
              seasonNumber: h.seasonNumber ?? 1,
              viewPercentage: h.viewPercentage ?? 100,
              rating: h.rating,
              anilistStatus: h.anilistStatus ?? 'SUCCESS',
              malStatus: h.malStatus ?? 'SUCCESS',
              kitsuStatus: h.kitsuStatus ?? 'PENDING',
              source: h.source ?? null,
              serverName: h.serverName ?? null,
              libraryName: h.libraryName ?? null,
              errorMessage: h.errorMessage,
              payloadSnapshot: h.payloadSnapshot,
              viewedAt: h.viewedAt ? new Date(h.viewedAt) : new Date(),
              createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.1 Restore notifications
      if (Array.isArray(data.notifications)) {
        for (const n of data.notifications) {
          await this.prisma.notification.upsert({
            where: { id: n.id },
            update: {
              type: n.type,
              title: n.title,
              message: n.message,
              isRead: n.isRead ?? false,
              metadata: n.metadata,
            },
            create: {
              id: n.id,
              userId: n.userId,
              type: n.type,
              title: n.title,
              message: n.message,
              isRead: n.isRead ?? false,
              metadata: n.metadata,
              createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.2 Restore support tickets
      if (Array.isArray(data.tickets)) {
        for (const t of data.tickets) {
          const lastReplyAt = t.lastReplyAt ? new Date(t.lastReplyAt) : new Date();
          await this.prisma.ticket.upsert({
            where: { id: t.id },
            update: {
              subject: t.subject,
              category: t.category,
              priority: t.priority,
              status: t.status,
              lastReplyAt,
              closedAt: t.closedAt ? new Date(t.closedAt) : null,
            },
            create: {
              id: t.id,
              userId: t.userId,
              subject: t.subject,
              category: t.category,
              priority: t.priority,
              status: t.status,
              lastReplyAt,
              closedAt: t.closedAt ? new Date(t.closedAt) : null,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.3 Restore ticket messages
      if (Array.isArray(data.ticketMessages)) {
        for (const tm of data.ticketMessages) {
          await this.prisma.ticketMessage.upsert({
            where: { id: tm.id },
            update: {
              content: tm.content,
              isStaff: tm.isStaff ?? false,
              isInternalNote: tm.isInternalNote ?? false,
            },
            create: {
              id: tm.id,
              ticketId: tm.ticketId,
              senderId: tm.senderId,
              content: tm.content,
              isStaff: tm.isStaff ?? false,
              isInternalNote: tm.isInternalNote ?? false,
              createdAt: tm.createdAt ? new Date(tm.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.4 Restore system announcements
      const annList = data.systemAnnouncements || data.announcements;
      if (Array.isArray(annList)) {
        for (const a of annList) {
          await this.prisma.systemAnnouncement.upsert({
            where: { id: a.id },
            update: {
              isActive: a.isActive ?? false,
              category: a.category ?? 'FESTIVE',
              themePreset: a.themePreset ?? 'CUSTOM',
              badgeText: a.badgeText,
              badgeBgColor: a.badgeBgColor,
              badgeTextColor: a.badgeTextColor,
              message: a.message,
              mediaType: a.mediaType ?? 'NONE',
              mediaUrl: a.mediaUrl,
              mediaPosition: a.mediaPosition ?? 'LEFT',
              backgroundType: a.backgroundType ?? 'GRADIENT',
              backgroundValue: a.backgroundValue,
              textColor: a.textColor,
              effectType: a.effectType ?? 'NONE',
              enableGlobalAtmosphere: a.enableGlobalAtmosphere ?? true,
              ctaText: a.ctaText,
              ctaUrl: a.ctaUrl,
              ctaTarget: a.ctaTarget ?? '_self',
              ctaBgColor: a.ctaBgColor,
              ctaTextColor: a.ctaTextColor,
              isClosable: a.isClosable ?? true,
              targetAudience: a.targetAudience ?? 'ALL',
              startsAt: a.startsAt ? new Date(a.startsAt) : null,
              endsAt: a.endsAt ? new Date(a.endsAt) : null,
              dismissExpiryDays: a.dismissExpiryDays ?? 7,
            },
            create: {
              id: a.id,
              isActive: a.isActive ?? false,
              category: a.category ?? 'FESTIVE',
              themePreset: a.themePreset ?? 'CUSTOM',
              badgeText: a.badgeText,
              badgeBgColor: a.badgeBgColor,
              badgeTextColor: a.badgeTextColor,
              message: a.message,
              mediaType: a.mediaType ?? 'NONE',
              mediaUrl: a.mediaUrl,
              mediaPosition: a.mediaPosition ?? 'LEFT',
              backgroundType: a.backgroundType ?? 'GRADIENT',
              backgroundValue: a.backgroundValue,
              textColor: a.textColor,
              effectType: a.effectType ?? 'NONE',
              enableGlobalAtmosphere: a.enableGlobalAtmosphere ?? true,
              ctaText: a.ctaText,
              ctaUrl: a.ctaUrl,
              ctaTarget: a.ctaTarget ?? '_self',
              ctaBgColor: a.ctaBgColor,
              ctaTextColor: a.ctaTextColor,
              isClosable: a.isClosable ?? true,
              targetAudience: a.targetAudience ?? 'ALL',
              startsAt: a.startsAt ? new Date(a.startsAt) : null,
              endsAt: a.endsAt ? new Date(a.endsAt) : null,
              dismissExpiryDays: a.dismissExpiryDays ?? 7,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9b. Secondary tables. scripts/check-backup-coverage.ts checks
      // that everything backed up is restored.
      for (const [key, toRestore] of [
        ['systemMetrics', (item: any) =>
          this.prisma.systemMetric.upsert({
            where: {
              metricKey_ipAddress_dateKey: {
                metricKey: item.metricKey,
                ipAddress: item.ipAddress ?? null,
                dateKey: item.dateKey,
              },
            },
            update: { value: item.value, metadata: item.metadata ?? undefined },
            create: {
              metricKey: item.metricKey,
              ipAddress: item.ipAddress ?? null,
              dateKey: item.dateKey,
              value: item.value ?? 1,
              metadata: item.metadata ?? undefined,
            },
          })],
        ['embyConnections', (item: any) =>
          this.prisma.embyConnection.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['siteLinks', (item: any) =>
          this.prisma.siteLink.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['announcementPresets', (item: any) =>
          this.prisma.announcementPreset.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['auditLogs', (item: any) =>
          // The audit log is history, not configuration. It is restored anyway so the
          // backup is faithful: otherwise the "backed up" and "restored" counts would
          // not match and there would be no way to tell why.
          this.prisma.auditLog.upsert({
            where: { id: item.id },
            update: {},
            create: item,
          })],
        ['ticketAttachments', (item: any) =>
          this.prisma.ticketAttachment.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
      ] as Array<[string, (item: any) => Promise<unknown>]>) {
        if (!Array.isArray(data[key])) continue;
        for (const item of data[key]) {
          try {
            await toRestore(item);
            restoredCount++;
          } catch (e: any) {
            // A row that does not fit (for example, an attachment of a ticket that no
            // longer exists) must not bring down the whole restore.
            this.logger.warn(`Could not restore a row of ${key}: ${e?.message || e}`);
          }
        }
      }

      // 10. Restore media files (avatars and covers)
      let restoredFilesCount = 0;
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      ensureDirectoryExists(uploadsDir);

      if (files && typeof files === 'object') {
        for (const relPath of Object.keys(files)) {
          try {
            const base64Data = files[relPath];
            // Keeps the subdirectory (avatars/, covers/) and blocks path traversal.
            const targetP = resolveRestoreTarget(uploadsDir, relPath);
            if (!targetP) {
              this.logger.warn(`Path traversal attempt blocked in backup restore: ${relPath}`);
              continue;
            }
            ensureDirectoryExists(path.dirname(targetP));
            fs.writeFileSync(targetP, Buffer.from(base64Data, 'base64'));
            restoredFilesCount++;
          } catch (e: any) {
            this.logger.warn(`Could not restore file ${relPath}: ${e.message}`);
          }
        }
      }

      this.logger.log(`Restore completed. Records: ${restoredCount}, files: ${restoredFilesCount}`);

      await this.prisma.auditLog.create({
        data: {
          level: 'INFO',
          service: 'BACKUP',
          message: 'Backup restored',
          details: {
            restoredCount,
            restoredFilesCount,
            metadata: parsedPackage.metadata,
          },
        },
      });

      return {
        success: true,
        message: `Restore completed. Processed ${restoredCount} records and ${restoredFilesCount} files.`,
        restoredRecords: restoredCount,
        restoredFiles: restoredFilesCount,
        metadata: parsedPackage.metadata,
      };
    } catch (err: any) {
      this.logger.error(`Error during the restore: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Error while restoring data: ${err.message}`);
    }
  }
}
