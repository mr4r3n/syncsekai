import { Injectable, Logger, OnModuleInit, BeforeApplicationShutdown } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { CoversService } from '../covers/covers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityMappingService } from '../mappings/community-mapping.service';
import { SyncStatus, Prisma, MappingSource, AnimeProvider } from '@prisma/client';
import axios from 'axios';
import { recordActivity } from '../../common/logging/activity-log';
import { withTrackerPriority } from '../../common/http/tracker-gate';

// Common intermediate shape across sources (Plex, Jellyfin, whatever comes next).
// Each source knows how to translate ITS payload into this; from here on nothing
// knows Plex or Jellyfin exist. See processScrobbleEvent() below.
export type ScrobbleSource = 'PLEX' | 'JELLYFIN' | 'EMBY';

export interface NormalizedScrobbleEvent {
  source: ScrobbleSource;
  event: string; // 'media.play' | 'media.pause' | 'media.resume' | 'media.stop' | 'media.scrobble' | 'media.rate' | other, untranslated
  showTitle: string;
  librarySectionTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  viewOffsetMs: number;
  durationMs: number;
  rating?: number | string | null;
  accountUsername: string; // user who played it, as reported by the source
  serverTitle?: string;
  hasPayload: boolean; // false if the source brought no usable item data (Plex: no Metadata)
  rawPayload: any; // stored as is in ScrobbleHistory.payloadSnapshot for debugging
}

/**
 * History rows whose tracker sync runs in this process right now ("syncing" in the history),
 * from the pipeline and from the catalog (catalog-progress.service.ts). Shutdown and the
 * sweep for interrupted syncs tell a live sync from one a restart cut short by it.
 */
export const syncingRows = new Set<string>();
export const INTERRUPTED_SYNC = 'Interrupted by a server restart before the tracker answered.';

class AsyncKeyedLock {
  private activeLocks = new Map<string, Promise<any>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.activeLocks.get(key) || Promise.resolve();
    let nextResolve: () => void;
    const nextLock = new Promise<void>((resolve) => {
      nextResolve = resolve;
    });

    this.activeLocks.set(key, nextLock);

    try {
      await currentLock;
      return await fn();
    } finally {
      if (this.activeLocks.get(key) === nextLock) {
        this.activeLocks.delete(key);
      }
      nextResolve!();
    }
  }
}

/**
 * Scrobbling pipeline shared by Plex, Jellyfin and Emby: identifies the user,
 * resolves the title and propagates progress to the connected trackers.
 */
@Injectable()
export class ScrobblePipelineService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(ScrobblePipelineService.name);

  private readonly scrobbleLock = new AsyncKeyedLock();

  constructor(
    private prisma: PrismaService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private coversService: CoversService,
    private notificationsService: NotificationsService,
    private communityMappingService: CommunityMappingService,
  ) {}

  /**
   * Generic scrobble pipeline: shared-user routing, monitored libraries,
   * completion threshold, blocklist, deduplication, title mapping, sync with
   * the 3 trackers, history and audit.
   *
   * It does not know Plex or Jellyfin exist: it only knows NormalizedScrobbleEvent.
   *
   * Plex, Jellyfin and Emby inject this service. Candidate for its own
   * `scrobble` module.
   */
  processScrobbleEvent(...args: Parameters<ScrobblePipelineService['handleScrobbleEvent']>) {
    // Every tracker request of a scrobble goes first in the queue (common/http/tracker-gate.ts).
    return withTrackerPriority('sync', () => this.handleScrobbleEvent(...args));
  }

  /**
   * On shutdown (a deploy) the syncs under way get up to 8 s to finish; the ones still waiting
   * their turn show as interrupted right away instead of "syncing" until the sweep below.
   * The same episode played again (a watcher polling after the restart) sends them again.
   */
  async beforeApplicationShutdown() {
    const deadline = Date.now() + 8_000;
    while (syncingRows.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    if (syncingRows.size > 0) await this.markInterrupted({ id: { in: [...syncingRows] } });
  }

  onModuleInit() {
    void this.closeInterruptedSyncs();
  }

  /**
   * A sync left "syncing" by a restart that cut it short (a crash, or a shutdown that could not
   * record it) becomes FAILED, with the reason. A request waits at most 10 minutes in the
   * trackers' queue, so a row syncing for 15 that no sync of this process holds is not being
   * worked on.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  closeInterruptedSyncs() {
    // No parameters: the cron calls this with arguments of its own.
    return this.markInterrupted({
      createdAt: { lt: new Date(Date.now() - 15 * 60_000) },
      id: { notIn: [...syncingRows] },
    });
  }

  private async markInterrupted(rows: Prisma.ScrobbleHistoryWhereInput) {
    const errorMessage = INTERRUPTED_SYNC;
    try {
      const closed = await this.prisma.$transaction([
        this.prisma.scrobbleHistory.updateMany({ where: { ...rows, anilistStatus: SyncStatus.SYNCING }, data: { anilistStatus: SyncStatus.FAILED, errorMessage } }),
        this.prisma.scrobbleHistory.updateMany({ where: { ...rows, malStatus: SyncStatus.SYNCING }, data: { malStatus: SyncStatus.FAILED, errorMessage } }),
        this.prisma.scrobbleHistory.updateMany({ where: { ...rows, kitsuStatus: SyncStatus.SYNCING }, data: { kitsuStatus: SyncStatus.FAILED, errorMessage } }),
      ]);
      const count = closed.reduce((n, r) => n + r.count, 0);
      if (count > 0) this.logger.warn(`${count} tracker sync(s) cut short by a restart marked as failed.`);
    } catch (e: any) {
      this.logger.warn(`Could not close interrupted syncs: ${e.message}`);
    }
  }

  private async handleScrobbleEvent(webhookOwner: any, evt: NormalizedScrobbleEvent, clientIp = '127.0.0.1') {
    const source = evt.source;
    const showTitle = evt.showTitle;
    const librarySectionTitle = evt.librarySectionTitle;
    const episodeNumber = evt.episodeNumber;
    const seasonNumber = evt.seasonNumber;
    const viewOffset = evt.viewOffsetMs;
    const duration = evt.durationMs;
    const viewPercentage = Math.min(100, Math.round((viewOffset / duration) * 100)) || 0;
    const rating = evt.rating;
    const accountTitle = evt.accountUsername;
    const ownerConnectionUsername = (this.getConnectionUsername(webhookOwner, source) || webhookOwner.username || '').trim();

    let user = webhookOwner;
    let isSharedUser = false;

    // If the play comes from a shared user of the source server
    // (Plex: a Plex.tv account other than the webhook owner; Jellyfin: a local
    // server user other than the one linked to this account):
    if (accountTitle && ownerConnectionUsername && accountTitle.toLowerCase() !== ownerConnectionUsername.toLowerCase()) {
      isSharedUser = true;
      const matchedUser = await this.findUserByConnectionUsername(source, accountTitle, webhookOwner);

      if (matchedUser) {
        user = matchedUser;
      } else {
        this.logger.debug(
          `${source} event ignored: play by an unregistered user (@${accountTitle}) on "${showTitle}".`,
        );
        await recordActivity({
          data: {
            level: 'INFO',
            service: `${source}_WEBHOOK`,
            message: `Event ignored: user @${accountTitle} has no linked SyncSekai account, on "${showTitle} - Ep ${episodeNumber}"`,
            details: {
              accountTitle,
              serverOwner: webhookOwner.username,
              showTitle,
              episodeNumber,
              librarySectionTitle,
              isRegistered: false,
            },
          },
        });
        return {
          received: true,
          ignored: true,
          reason: `UNREGISTERED_${source}_USER`,
          accountTitle,
        };
      }
    }

    if (!user.isActive || user.settings?.isSuspended) {
      this.logger.warn(`Webhook rejected: user "${user.username}" is inactive or suspended.`);
      await recordActivity({
        data: {
          level: 'WARN',
          service: `${source}_WEBHOOK`,
          message: `Webhook rejected: user account "${user.username}" is inactive or suspended`,
          details: { clientIp, userId: user.id },
        },
      });
      return { ignored: true, reason: 'USER_SUSPENDED' };
    }

    if (user.settings && !user.settings.canScrobble && user.role !== 'ADMIN') {
      this.logger.warn(`Webhook rejected: user "${user.username}" has no automatic scrobble permission.`);
      await recordActivity({
        data: {
          level: 'WARN',
          service: `${source}_WEBHOOK`,
          message: `Webhook rejected: user "${user.username}" has no scrobble permission`,
          details: { clientIp, userId: user.id },
        },
      });
      return { ignored: true, reason: 'SCROBBLE_PERMISSION_DISABLED' };
    }

    const event = evt.event;
    const currentMinutes = Math.floor(viewOffset / 60000);
    const currentSeconds = Math.floor((viewOffset % 60000) / 1000);
    const totalMinutes = Math.floor(duration / 60000);
    const totalSeconds = Math.floor((duration % 60000) / 1000);
    const timeFormatted = duration > 0
      ? `${currentMinutes}:${currentSeconds < 10 ? '0' : ''}${currentSeconds} / ${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`
      : `${viewPercentage}%`;
    const eventLabel =
      event === 'media.play'
        ? '▶ Playing'
        : event === 'media.pause'
        ? '⏸ Paused'
        : event === 'media.resume'
        ? '▶ Resumed'
        : event === 'media.stop'
        ? '⏹ Stopped'
        : event === 'media.scrobble'
        ? '✔ Scrobble'
        : event;

    const originLabel = source === 'JELLYFIN' ? 'Jellyfin' : source === 'EMBY' ? 'Emby' : 'Plex';
    const userDisplayLabel = isSharedUser
      ? `@${user.username} (${originLabel}: @${accountTitle})`
      : `@${user.username}`;

    // Record in AuditLog right away so it shows up immediately in the Logs console with the exact minute
    await recordActivity({
      data: {
        level: 'INFO',
        service: `${source}_WEBHOOK`,
        message: `${eventLabel} ${userDisplayLabel}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] [Library: "${librarySectionTitle || 'N/A'}"]`,
        details: {
          event,
          clientIp,
          showTitle,
          librarySectionTitle,
          episodeNumber,
          viewPercentage,
          timeFormatted,
          server: evt.serverTitle,
          accountTitle,
          matchedUsername: user.username,
        },
      },
    });

    if (!evt.hasPayload) {
      return { received: true, ignored: true, reason: 'NO_METADATA' };
    }

    // Check monitored libraries:
    // If the play comes from a shared server (e.g. the admin's server), combine the host's monitored
    // libraries with the user's so a scrobble is never lost when watching in shared libraries.
    const userMonitored = this.getConnectionMonitoredLibraries(user, source);
    const serverMonitored = this.getConnectionMonitoredLibraries(webhookOwner, source);
    const combinedMonitored = isSharedUser
      ? Array.from(new Set([...userMonitored, ...serverMonitored]))
      : (userMonitored.length > 0 ? userMonitored : serverMonitored);

    if (combinedMonitored.length > 0 && librarySectionTitle) {
      const isMonitored = combinedMonitored.some((m) => m.toLowerCase() === librarySectionTitle.toLowerCase());

      if (!isMonitored) {
        this.logger.debug(`${originLabel} event ignored: library "${librarySectionTitle}" is not monitored.`);
        await recordActivity({
          data: {
            level: 'WARN',
            service: `${source}_WEBHOOK`,
            message: `Event ignored for ${userDisplayLabel}: library "${librarySectionTitle}" does not match the monitored libraries (${combinedMonitored.join(', ')})`,
          },
        });
        return { ignored: true, reason: 'LIBRARY_NOT_MONITORED' };
      }
    }

    const threshold = user.settings?.completionPercentage ?? 85;
    const isScrobbleEvent =
      event === 'media.scrobble' ||
      (event === 'media.stop' && viewPercentage >= threshold) ||
      (event === 'media.pause' && viewPercentage >= threshold);

    if (!isScrobbleEvent && event !== 'media.rate') {
      return { received: true, processed: false, reason: `EVENT_${event}_PROGRESS_${viewPercentage}_THRESHOLD_${threshold}` };
    }

    const isBlacklisted = user.blacklist.some((b) =>
      showTitle.toLowerCase().includes(b.titlePattern.toLowerCase()),
    );
    if (isBlacklisted) {
      return {
        processed: false,
        status: 'IGNORED_BLACKLIST',
        message: `The title "${showTitle}" is on the blocklist.`,
      };
    }

    const lockKey = `${user.id}:${(showTitle || '').trim().toLowerCase()}:${seasonNumber || 1}:${episodeNumber}`;
    return this.scrobbleLock.acquire(lockKey, async () => {
      // 0. Deduplication: skip duplicate scrobbles if an identical recent entry already exists (last 2 hours)
      const recentDuplicate = await this.prisma.scrobbleHistory.findFirst({
        where: {
          userId: user.id,
          showTitle: { equals: showTitle, mode: 'insensitive' },
          seasonNumber: seasonNumber || 1,
          episodeNumber,
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      // A row a restart left syncing, or marked as interrupted, never reached the trackers:
      // sent again on that same row instead of being taken for an already synced duplicate.
      // One that a sync of this process holds is still on its way.
      const interrupted =
        recentDuplicate &&
        !syncingRows.has(recentDuplicate.id) &&
        (recentDuplicate.errorMessage === INTERRUPTED_SYNC ||
          [recentDuplicate.anilistStatus, recentDuplicate.malStatus, recentDuplicate.kitsuStatus].includes(SyncStatus.SYNCING))
          ? recentDuplicate
          : null;

      if (recentDuplicate && !interrupted) {
        const consolidatedPercentage = Math.max(recentDuplicate.viewPercentage, Math.max(viewPercentage, threshold));
        const updatedEntry = await this.prisma.scrobbleHistory.update({
          where: { id: recentDuplicate.id },
          data: {
            viewPercentage: consolidatedPercentage,
            payloadSnapshot: evt.rawPayload as any,
          },
        });

        this.logger.log(
          `Duplicate scrobble skipped and consolidated for @${user.username}: "${showTitle}" Ep. ${episodeNumber} (${consolidatedPercentage}%)`,
        );

        return {
          processed: true,
          status: 'SCROBBLE_DEDUPLICATED',
          message: `Scrobble consolidated at ${consolidatedPercentage}%.`,
          historyEntry: updatedEntry,
        };
      }

      // 1. Title mapping (TitleMapping) by title and specific season
      let mapping = await this.prisma.titleMapping.findFirst({
        where: {
          userId: user.id,
          plexTitle: { equals: showTitle, mode: 'insensitive' },
          plexSeason: seasonNumber || 1,
        },
      });

      if (!mapping) {
        // Look for an official global mapping created by administrators
        mapping = await this.prisma.titleMapping.findFirst({
          where: {
            isGlobal: true,
            plexTitle: { equals: showTitle, mode: 'insensitive' },
            plexSeason: seasonNumber || 1,
          },
        });
        if (mapping) {
          this.logger.log(
            `Official global mapping applied for "${showTitle}" (season ${seasonNumber || 1}) -> AniList media ID ${mapping.anilistMediaId}`,
          );
        }
      }

      if (!mapping) {
        // Community consensus: several users corrected this title to the same anime
        const consensus = await this.communityMappingService.findConsensus(showTitle, seasonNumber || 1);
        if (consensus) {
          mapping = await this.prisma.titleMapping.create({
            data: {
              userId: user.id,
              plexTitle: showTitle,
              plexSeason: seasonNumber || 1,
              anilistMediaId: consensus.anilistMediaId,
              anilistTitle: consensus.anilistTitle,
              malMediaId: consensus.malMediaId,
              malTitle: consensus.malTitle,
              kitsuMediaId: consensus.kitsuMediaId,
              kitsuTitle: consensus.kitsuTitle,
              confidenceScore: 1.0,
              isApproved: user.settings?.autoApproveMappings ?? true,
              isManual: false,
              source: MappingSource.COMMUNITY,
            },
          });
          this.logger.log(
            `Community mapping applied for "${showTitle}" (season ${seasonNumber || 1}) -> AniList media ID ${consensus.anilistMediaId} (${consensus.voters.length} votes)`,
          );
        }
      }

      let anilistMediaId = mapping?.anilistMediaId;
      let anilistTitle = mapping?.anilistTitle;
      let malMediaId = mapping?.malMediaId;

      const blockedGenres: string[] = user.settings?.blockedGenres || [];

      if (!mapping) {
        try {
          const searchResults = await this.anilistService.searchAnime(showTitle, seasonNumber || 1);
          if (searchResults && searchResults.length > 0) {
            const match = searchResults[0];

            // Check whether the anime found matches a blocked genre
            if (blockedGenres.length > 0 && Array.isArray(match.genres)) {
              const matchedBlockedGenre = match.genres.find((g: string) =>
                blockedGenres.some((bg) => bg.toLowerCase() === g.toLowerCase()),
              );
              if (matchedBlockedGenre) {
                this.logger.warn(`Scrobble discarded for an excluded genre ("${matchedBlockedGenre}") on "${showTitle}"`);
                return {
                  processed: false,
                  status: 'IGNORED_BLACKLIST_GENRE',
                  message: `The anime "${showTitle}" matches the excluded genre "${matchedBlockedGenre}".`,
                };
              }
            }

            anilistMediaId = match.id;
            anilistTitle = match.title?.romaji || match.title?.english || match.title?.native;
            malMediaId = match.idMal || null;

            mapping = await this.prisma.titleMapping.create({
              data: {
                userId: user.id,
                plexTitle: showTitle,
                plexSeason: seasonNumber || 1,
                anilistMediaId,
                anilistTitle,
                malMediaId,
                malTitle: anilistTitle,
                confidenceScore: 0.95,
                isApproved: user.settings?.autoApproveMappings ?? true,
                isManual: false,
              },
            });
            this.logger.log(`Auto-mapping created: "${showTitle}" (season ${seasonNumber || 1}) -> AniList media ID ${anilistMediaId} ("${anilistTitle}")`);
          }
        } catch (err: any) {
          this.logger.warn(`Could not resolve an auto-mapping for "${showTitle}" (season ${seasonNumber || 1}): ${err.message}`);
        }
      }

      // If the user has not approved the mapping, hold the remote sync
      const isMappingPendingApproval = Boolean(mapping && !mapping.isApproved);

      let anilistSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let malSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let kitsuSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let syncErrorMessage: string | null = isMappingPendingApproval
        ? 'Mapping pending the user\'s approval.'
        : null;

      const preferredTracker = user.settings?.preferredTracker || 'BOTH';

      const canSyncAnilist = !isMappingPendingApproval &&
                             (user.settings?.canSyncAnilist ?? true) &&
                             (user.settings?.canScrobble ?? true) &&
                             (preferredTracker === 'BOTH' || preferredTracker === 'ANILIST');
      const canSyncMal = !isMappingPendingApproval &&
                         (user.settings?.canSyncMal ?? true) &&
                         (user.settings?.canScrobble ?? true) &&
                         (preferredTracker === 'BOTH' || preferredTracker === 'MAL');
      const canSyncKitsu = !isMappingPendingApproval &&
                           (user.settings?.canSyncKitsu ?? true) &&
                           (user.settings?.canScrobble ?? true) &&
                           (preferredTracker === 'BOTH' || preferredTracker === 'KITSU');

      // 1.9 Recorded now, as "syncing" on each linked tracker it will be sent to, so it shows in
      // the history while it waits its turn in the trackers' queue (tracker-gate.ts). Each one
      // turns SUCCESS only once that tracker has confirmed it (step 4); a tracker that is not
      // linked is SKIPPED, never "failed".
      const linked = new Set(
        (await this.prisma.animeConnection.findMany({
          where: { userId: user.id, isConnected: true },
          select: { provider: true },
        })).map((c) => c.provider),
      );
      const willSyncAnilist = canSyncAnilist && Boolean(anilistMediaId) && linked.has(AnimeProvider.ANILIST);
      const willSyncMal = canSyncMal && Boolean(malMediaId || anilistMediaId) && linked.has(AnimeProvider.MAL);
      const willSyncKitsu = canSyncKitsu && linked.has(AnimeProvider.KITSU);
      const planned = (will: boolean) => (will ? SyncStatus.SYNCING : SyncStatus.SKIPPED);
      const plan = {
        viewPercentage: Math.max(interrupted?.viewPercentage ?? 0, viewPercentage, threshold),
        rating: rating ? Number(rating) : null,
        anilistStatus: planned(willSyncAnilist),
        malStatus: planned(willSyncMal),
        kitsuStatus: planned(willSyncKitsu),
        errorMessage: syncErrorMessage,
        payloadSnapshot: evt.rawPayload as any,
      };
      let historyEntry = interrupted
        ? await this.prisma.scrobbleHistory.update({ where: { id: interrupted.id }, data: plan })
        : await this.prisma.scrobbleHistory.create({
            data: {
              userId: user.id,
              showTitle,
              episodeNumber,
              seasonNumber,
              source,
              serverName: evt.serverTitle || null,
              libraryName: librarySectionTitle || null,
              viewedAt: new Date(),
              ...plan,
            },
          });
      syncingRows.add(historyEntry.id);

      // 2. Real sync with AniList via GraphQL mutation (only if the mapping is approved)
      if (willSyncAnilist && anilistMediaId) {
        try {
          const ratingVal = user.settings?.syncRatings ? (rating ? Number(rating) : undefined) : undefined;
          const anilistRes = await this.anilistService.updateProgress(
            user.id,
            anilistMediaId,
            episodeNumber,
            'CURRENT',
            ratingVal,
          );

          if (anilistRes.success) {
            anilistSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`AniList synced for @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else {
            anilistSyncStatus = SyncStatus.FAILED;
            syncErrorMessage = `AniList error: ${anilistRes.error || anilistRes.reason}`;
          }
        } catch (err: any) {
          anilistSyncStatus = SyncStatus.FAILED;
          syncErrorMessage = `AniList error: ${err.message}`;
        }
      }

      // 3. Sync with MyAnimeList if enabled (only if the mapping is approved)
      let effectiveMalId = malMediaId;
      if (willSyncMal && !effectiveMalId && anilistMediaId) {
        try {
          const alRes = await axios.post(
            'https://graphql.anilist.co',
            {
              query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
              variables: { id: anilistMediaId },
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
          );
          const resolvedMalId = alRes.data?.data?.Media?.idMal;
          if (resolvedMalId) {
            effectiveMalId = resolvedMalId;
            await this.prisma.titleMapping.updateMany({
              where: { anilistMediaId, malMediaId: null },
              data: { malMediaId: resolvedMalId },
            }).catch(() => {});
          }
        } catch (e: any) {
          this.logger.warn(`Could not resolve idMal from AniList for ID ${anilistMediaId}: ${e.message}`);
        }
      }

      if (willSyncMal && effectiveMalId) {
        try {
          const malRes = await this.malService.updateProgress(
            user.id,
            effectiveMalId,
            episodeNumber,
            'watching',
            user.settings?.syncRatings ? (rating ? Number(rating) : undefined) : undefined,
          );
          if (malRes.success) {
            malSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`MyAnimeList synced for @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else if (malRes.reason !== 'MyAnimeList is not connected.') {
            malSyncStatus = SyncStatus.FAILED;
            if (!syncErrorMessage) syncErrorMessage = `MAL error: ${malRes.error || malRes.reason}`;
          }
        } catch (err: any) {
          malSyncStatus = SyncStatus.FAILED;
          if (!syncErrorMessage) syncErrorMessage = `MAL error: ${err.message}`;
        }
      }

      // 3.5 Sync with Kitsu if connected (only if the mapping is approved)
      let kitsuMediaId = mapping?.kitsuMediaId;

      if (willSyncKitsu && !kitsuMediaId) {
        try {
          // By the MAL/AniList id when there is one: the title alone finds the first season of a sequel.
          const found = malMediaId || anilistMediaId
            ? await this.kitsuService.findByExternalIds(malMediaId, anilistMediaId)
            : (await this.kitsuService.searchAnime(showTitle, 1))?.[0];
          if (found) {
            kitsuMediaId = found.kitsuId;
            if (mapping) {
              await this.prisma.titleMapping.update({
                where: { id: mapping.id },
                data: { kitsuMediaId, kitsuTitle: found.title },
              }).catch(() => {});
            }
          }
        } catch (e: any) {
          this.logger.warn(`Could not resolve the Kitsu ID for "${showTitle}": ${e.message}`);
        }
      }

      if (willSyncKitsu && kitsuMediaId) {
        try {
          const ratingTwenty = rating ? Math.round(Number(rating) * 2) : undefined;
          const kitsuRes = await this.kitsuService.updateProgress(
            user.id,
            kitsuMediaId,
            episodeNumber,
            'current',
            ratingTwenty,
          );
          if (kitsuRes.success) {
            kitsuSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`Kitsu synced for @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else if (kitsuRes.message !== 'Kitsu is not connected for this user.') {
            kitsuSyncStatus = SyncStatus.FAILED;
            if (!syncErrorMessage) syncErrorMessage = `Kitsu error: ${kitsuRes.message}`;
          }
        } catch (err: any) {
          kitsuSyncStatus = SyncStatus.FAILED;
          if (!syncErrorMessage) syncErrorMessage = `Kitsu error: ${err.message}`;
        }
      }

      // 4. What each tracker answered replaces "syncing" (one that was not sent ends SKIPPED)
      historyEntry = await this.prisma.scrobbleHistory
        .update({
          where: { id: historyEntry.id },
          data: {
            anilistStatus: anilistSyncStatus,
            malStatus: malSyncStatus,
            kitsuStatus: kitsuSyncStatus,
            errorMessage: syncErrorMessage,
          },
        })
        .finally(() => syncingRows.delete(historyEntry.id));

      // 4.5 Pre-cache the cover on disk right away so the history never shows it broken
      this.coversService.getOrFetchCover(showTitle, anilistMediaId).catch(() => {});

      if (isMappingPendingApproval) {
        await recordActivity({
          data: {
            level: 'WARN',
            service: `${source}_SCROBBLE`,
            message: `Scrobble held for @${user.username}: the mapping for "${showTitle}" (season ${seasonNumber || 1}) is pending approval.`,
            details: {
              userId: user.id,
              showTitle,
              seasonNumber,
              episodeNumber,
              mappingId: mapping?.id,
            },
          },
        });

        this.notificationsService.notifyUnmappedAnime(user, {
          showTitle,
          seasonNumber,
          episodeNumber,
          viewPercentage,
          frontendUrl: process.env.FRONTEND_URL,
          source,
        }).catch((e) => this.logger.warn(`Failed to send the notification: ${e.message}`));

        await this.touchLastSync(user.id, source);

        return {
          processed: true,
          status: 'MAPPING_PENDING_APPROVAL',
          historyEntry,
          message: `Scrobble recorded locally but not synced: the mapping for "${showTitle}" needs manual approval.`,
        };
      }

      // 4.6 If the anime was not synced (no tracker succeeded) or had no mapping, notify the user (in-app and Discord)
      const isAnySynced = anilistSyncStatus === SyncStatus.SUCCESS || malSyncStatus === SyncStatus.SUCCESS || kitsuSyncStatus === SyncStatus.SUCCESS;
      if (!mapping || !isAnySynced) {
        this.notificationsService.notifyUnmappedAnime(user, {
          showTitle,
          seasonNumber,
          episodeNumber,
          viewPercentage,
          frontendUrl: process.env.FRONTEND_URL,
          source,
        }).catch((e) => this.logger.warn(`Failed to send the notification: ${e.message}`));
      }

      // 5. Update the last sync of the source connection (if any)
      await this.touchLastSync(user.id, source);

      // 6. Record in AuditLog for the admin Logs console
      await recordActivity({
        data: {
          level: anilistSyncStatus === SyncStatus.SUCCESS ? 'INFO' : 'WARN',
          service: `${source}_SCROBBLE`,
          message: `Webhook scrobble @${user.username}: "${showTitle} - Ep ${episodeNumber}" (AniList: ${anilistSyncStatus}, MAL: ${malSyncStatus})`,
          details: {
            showTitle,
            episodeNumber,
            anilistMediaId,
            anilistStatus: anilistSyncStatus,
            malStatus: malSyncStatus,
          },
        },
      });

      return {
        processed: true,
        status: 'SCROBBLED_SUCCESS',
        historyEntry,
        anilistSyncStatus,
        malSyncStatus,
        message: `Scrobble recorded: "${showTitle}" Ep. ${episodeNumber} -> AniList: ${anilistSyncStatus}`,
      };
    });
  }

  /**
   * Which "connection owner" user to compare against the account that played,
   * depending on the source (plexUsername vs jellyfinUsername). The only place
   * that knows each source stores this in a different connection table.
   */
  private getConnectionUsername(user: any, source: ScrobbleSource): string {
    if (source === 'JELLYFIN') return user?.jellyfinConnection?.jellyfinUsername || '';
    if (source === 'EMBY') return user?.embyConnection?.embyUsername || '';
    return user?.plexConnection?.plexUsername || '';
  }

  private getConnectionMonitoredLibraries(user: any, source: ScrobbleSource): string[] {
    if (source === 'JELLYFIN') return user?.jellyfinConnection?.monitoredLibraries || [];
    if (source === 'EMBY') return user?.embyConnection?.monitoredLibraries || [];
    return user?.plexConnection?.monitoredLibraries || [];
  }

  // updateMany instead of update+guard: if the user has no connection for that
  // source (should not happen at this point, but defensively) it does not fail
  // with a P2025, it simply updates no rows.
  private async touchLastSync(userId: string, source: ScrobbleSource) {
    if (source === 'JELLYFIN') {
      await this.prisma.jellyfinConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    } else if (source === 'EMBY') {
      await this.prisma.embyConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    } else {
      await this.prisma.plexConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    }
  }

  /**
   * Finds which SyncSekai account has linked, in its connection for the given
   * source, the username that reported the play (routing among shared users of
   * the same source server).
   * Only searches active connections of the same server. Never by global username.
   */
  private async findUserByConnectionUsername(
    source: ScrobbleSource,
    accountUsername: string,
    webhookOwner: any,
  ) {
    const usernameFilter = { equals: accountUsername, mode: 'insensitive' as const };
    let connectionFilter: Prisma.UserWhereInput;

    if (source === 'JELLYFIN') {
      const ownerConn = webhookOwner?.jellyfinConnection;
      connectionFilter = {
        jellyfinConnection: {
          jellyfinUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    } else if (source === 'EMBY') {
      const ownerConn = webhookOwner?.embyConnection;
      connectionFilter = {
        embyConnection: {
          embyUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    } else {
      const ownerConn = webhookOwner?.plexConnection;
      connectionFilter = {
        plexConnection: {
          plexUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    }

    return this.prisma.user.findFirst({
      where: {
        ...connectionFilter,
        isActive: true,
        settings: { isSuspended: false },
      },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
      },
    });
  }
}
