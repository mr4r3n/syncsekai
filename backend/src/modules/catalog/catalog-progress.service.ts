import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { AnimeProvider, SyncStatus } from '@prisma/client';
import axios from 'axios';
import { CatalogService } from './catalog.service';
import { withTrackerPriority } from '../../common/http/tracker-gate';
import { syncingRows } from '../plex/scrobble-pipeline.service';

/** Progress and score changes from the catalog, propagated to the trackers. */
@Injectable()
export class CatalogProgressService {
  private readonly logger = new Logger(CatalogProgressService.name);

  constructor(
    private prisma: PrismaService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private catalogService: CatalogService,
  ) {}

  /**
   * Updates episode progress and/or score on every linked tracker (AniList, MyAnimeList, Kitsu).
   *
   * A sync in the trackers' queue, like a scrobble: it goes on for as long as the queue needs.
   * The answer waits at most 15 s; past that it says the save is still syncing (the history
   * shows it as such) instead of failing or claiming it synced.
   */
  updateProgressAndRating(...args: Parameters<CatalogProgressService['saveProgressAndRating']>) {
    const work = withTrackerPriority('sync', () => this.saveProgressAndRating(...args));
    work.catch((e) => this.logger.error(`Catalog sync failed: ${e.message}`));
    const stillSyncing = new Promise<'syncing'>((resolve) => setTimeout(() => resolve('syncing'), 15_000).unref());
    return Promise.race([work, stillSyncing]).then((result) =>
      result === 'syncing'
        ? {
            success: true,
            queued: true,
            results: {},
            updatedTrackers: [] as string[],
            message: 'Still syncing: the trackers are busy. The history shows it as synced once each one confirms it.',
          }
        : result,
    );
  }

  private async saveProgressAndRating(
    userId: string,
    data: {
      anilistMediaId?: number;
      malMediaId?: number;
      progress?: number;
      score?: number;
      status?: string;
      showTitle?: string;
      seasonNumber?: number;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        animeConnections: true,
        titleMappings: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    const isAdmin = user.role === 'ADMIN';
    const prefTracker = user.settings?.preferredTracker || 'BOTH';
    const canSyncAnilist = (isAdmin || (user.settings?.canSyncAnilist ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'ANILIST');
    const canSyncMal = (isAdmin || (user.settings?.canSyncMal ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'MAL');
    const canSyncKitsu = (isAdmin || (user.settings?.canSyncKitsu ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'KITSU');

    const anilistConn = user.animeConnections.find((c) => c.provider === AnimeProvider.ANILIST && c.isConnected);
    const malConn = user.animeConnections.find((c) => c.provider === AnimeProvider.MAL && c.isConnected);
    const kitsuConn = user.animeConnections.find((c) => c.provider === AnimeProvider.KITSU && c.isConnected);

    // In the history at once, as "syncing" on each tracker it will be sent to; step 6 writes what
    // each tracker answered. Not recording it never stops the sync itself.
    const planned = (conn: unknown, allowed: boolean) =>
      conn ? (allowed ? SyncStatus.SYNCING : SyncStatus.FAILED) : SyncStatus.SKIPPED;
    const historyEntry =
      data.progress === undefined
        ? null
        : await this.prisma.scrobbleHistory
            .create({
              data: {
                userId,
                showTitle: data.showTitle || (data.anilistMediaId ? `AniList #${data.anilistMediaId}` : `MAL #${data.malMediaId}`),
                episodeNumber: data.progress,
                seasonNumber: Number.isInteger(Number(data.seasonNumber))
                  ? Math.max(1, Math.min(50, Number(data.seasonNumber)))
                  : 1,
                viewPercentage: 100,
                rating: data.score,
                anilistStatus: planned(anilistConn, canSyncAnilist),
                malStatus: planned(malConn, canSyncMal),
                kitsuStatus: planned(kitsuConn, canSyncKitsu),
                viewedAt: new Date(),
              },
            })
            .catch((err) => {
              this.logger.warn(`Could not record the scrobble in the history: ${err.message}`);
              return null;
            });
    if (historyEntry) syncingRows.add(historyEntry.id);

    let effectiveAnilistId = data.anilistMediaId;
    let effectiveMalId = data.malMediaId;
    let effectiveKitsuId = (data as any).kitsuMediaId;
    let resolvedTitle = data.showTitle || '';

    // 1. With an AniList id but no MAL id, resolve the MAL id to sync both
    if (!effectiveMalId && effectiveAnilistId) {
      const mapping = user.titleMappings.find((m) => m.anilistMediaId === effectiveAnilistId);
      if (mapping?.malMediaId) {
        effectiveMalId = mapping.malMediaId;
      } else {
        try {
          const alRes = await axios.post(
            'https://graphql.anilist.co',
            {
              query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal title { userPreferred romaji english } } }`,
              variables: { id: effectiveAnilistId },
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
          );
          const media = alRes.data?.data?.Media;
          if (media?.idMal) {
            effectiveMalId = media.idMal;
          }
          if (!resolvedTitle && media?.title) {
            resolvedTitle = media.title.userPreferred || media.title.romaji || media.title.english || '';
          }
        } catch (e: any) {
          this.logger.warn(`Could not resolve idMal from AniList for ID ${effectiveAnilistId}: ${e.message}`);
        }
      }
    }

    // 2. With a MAL id but no AniList id, resolve the AniList id to sync both
    if (!effectiveAnilistId && effectiveMalId) {
      const mapping = user.titleMappings.find((m) => m.malMediaId === effectiveMalId);
      if (mapping?.anilistMediaId) {
        effectiveAnilistId = mapping.anilistMediaId;
      } else {
        try {
          const alRes = await axios.post(
            'https://graphql.anilist.co',
            {
              query: `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id title { userPreferred romaji english } } }`,
              variables: { idMal: effectiveMalId },
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
          );
          const media = alRes.data?.data?.Media;
          if (media?.id) {
            effectiveAnilistId = media.id;
          }
          if (!resolvedTitle && media?.title) {
            resolvedTitle = media.title.userPreferred || media.title.romaji || media.title.english || '';
          }
        } catch (e: any) {
          this.logger.warn(`Could not resolve the AniList ID from idMal ${effectiveMalId}: ${e.message}`);
        }
      }
    }

    // Persist or update the title mapping automatically
    if (effectiveAnilistId && effectiveMalId) {
      const existingMapping = user.titleMappings.find(
        (m) => m.anilistMediaId === effectiveAnilistId || m.malMediaId === effectiveMalId,
      );
      if (!existingMapping && resolvedTitle) {
        await this.prisma.titleMapping.create({
          data: {
            userId,
            plexTitle: resolvedTitle,
            anilistMediaId: effectiveAnilistId,
            malMediaId: effectiveMalId,
            isApproved: true,
          },
        }).catch(() => {});
      } else if (existingMapping && !existingMapping.malMediaId) {
        await this.prisma.titleMapping.update({
          where: { id: existingMapping.id },
          data: { malMediaId: effectiveMalId },
        }).catch(() => {});
      }
    }

    // Playback status mapping
    const standardStatus = data.status || (data.progress && data.progress > 0 ? 'CURRENT' : 'CURRENT');
    const anilistStatus = standardStatus;
    const malStatusMap: Record<string, string> = {
      CURRENT: 'watching',
      COMPLETED: 'completed',
      PAUSED: 'on_hold',
      DROPPED: 'dropped',
      PLANNING: 'plan_to_watch',
    };
    const malStatus = malStatusMap[standardStatus] || 'watching';

    const results: { anilist?: any; mal?: any } = {};

    // 3. Sync to AniList if connected and allowed
    if (anilistConn && effectiveAnilistId) {
      if (!canSyncAnilist) {
        results.anilist = { success: false, error: 'Permission canSyncAnilist revoked by the administrator.' };
      } else {
        try {
          const res = await this.anilistService.updateProgress(
            userId,
            effectiveAnilistId,
            data.progress,
            anilistStatus,
            data.score,
          );
          results.anilist = res;
        } catch (err: any) {
          this.logger.error(`Error updating progress on AniList: ${err.message}`);
          results.anilist = { success: false, error: err.message };
        }
      }
    }

    // 4. Sync to MyAnimeList if connected and allowed
    if (malConn && effectiveMalId) {
      if (!canSyncMal) {
        results.mal = { success: false, error: 'Permission canSyncMal revoked by the administrator.' };
      } else {
        try {
          const res = await this.malService.updateProgress(
            userId,
            effectiveMalId,
            data.progress,
            malStatus,
            data.score,
          );
          results.mal = res;
        } catch (err: any) {
          this.logger.error(`Error updating progress on MyAnimeList: ${err.message}`);
          results.mal = { success: false, error: err.message };
        }
      }
    }

    // 5. Sync to Kitsu if connected and allowed
    const kitsuResults: { success?: boolean; error?: string } = {};
    if (kitsuConn) {
      if (!canSyncKitsu) {
        kitsuResults.success = false;
        kitsuResults.error = 'Permission canSyncKitsu revoked by the administrator.';
      } else {
        try {
          let kitsuAnimeId = effectiveKitsuId;
          if (!kitsuAnimeId) {
            // By the MAL/AniList id when there is one: the title alone finds the first season of a sequel.
            const found = effectiveMalId || effectiveAnilistId
              ? await this.kitsuService.findByExternalIds(effectiveMalId, effectiveAnilistId)
              : resolvedTitle
                ? (await this.kitsuService.searchAnime(resolvedTitle, 1))?.[0]
                : null;
            if (found?.kitsuId) {
              kitsuAnimeId = found.kitsuId;
            }
          }
          if (kitsuAnimeId) {
            const kitsuStatusMap: Record<string, any> = {
              CURRENT: 'current',
              COMPLETED: 'completed',
              PAUSED: 'on_hold',
              DROPPED: 'dropped',
              PLANNING: 'planned',
            };
            const ratingTwenty = data.score ? Math.round(data.score * 2) : undefined;
            const res = await this.kitsuService.updateProgress(
              userId,
              kitsuAnimeId,
              data.progress || 1,
              kitsuStatusMap[standardStatus] || 'current',
              ratingTwenty,
            );
            kitsuResults.success = res.success;
          }
        } catch (err: any) {
          this.logger.error(`Error updating progress on Kitsu: ${err.message}`);
          kitsuResults.success = false;
          kitsuResults.error = err.message;
        }
      }
    }

    // 6. Record in ScrobbleHistory
    if (data.progress !== undefined) {
      // Collect the per-tracker errors: otherwise a failed sync through this path
      // would be recorded as FAILED with an empty message, and the panel would
      // count the failure with no way to know why. The errors are already in the
      // individual results.
      const failureReasons = [
        results.anilist && !results.anilist.success && anilistConn
          ? `AniList: ${results.anilist.error || results.anilist.reason || 'unspecified error'}`
          : null,
        results.mal && !results.mal.success && malConn
          ? `MAL: ${results.mal.error || results.mal.reason || 'unspecified error'}`
          : null,
        !kitsuResults.success && kitsuConn
          ? `Kitsu: ${kitsuResults.error || 'unspecified error'}`
          : null,
      ].filter(Boolean);

      if (historyEntry) {
        await this.prisma.scrobbleHistory.update({
          where: { id: historyEntry.id },
          data: {
            showTitle: resolvedTitle || (effectiveAnilistId ? `AniList #${effectiveAnilistId}` : `MAL #${effectiveMalId}`),
            anilistStatus: results.anilist?.success ? SyncStatus.SUCCESS : anilistConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
            malStatus: results.mal?.success ? SyncStatus.SUCCESS : malConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
            kitsuStatus: kitsuResults.success ? SyncStatus.SUCCESS : kitsuConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
            errorMessage: failureReasons.length ? failureReasons.join(' | ').slice(0, 500) : null,
          },
        }).catch((err) => {
          // If recording itself fails, at least leave it in the log.
          this.logger.warn(`Could not record the scrobble in the history: ${err.message}`);
        }).finally(() => syncingRows.delete(historyEntry.id));
      }
    }

    // 7. Invalidate all the user's caches so the changes show live in every tab
    this.catalogService.invalidateUserCache(userId);

    const updatedTrackers: string[] = [];
    if (results.anilist?.success) updatedTrackers.push('AniList');
    if (results.mal?.success) updatedTrackers.push('MyAnimeList');
    if (kitsuResults.success) updatedTrackers.push('Kitsu');

    return {
      success: updatedTrackers.length > 0 || (!anilistConn && !malConn && !kitsuConn),
      results: { ...results, kitsu: kitsuResults },
      updatedTrackers,
      message: updatedTrackers.length > 0
        ? `Anime synced to ${updatedTrackers.join(' & ')}`
        : 'Progress saved locally.',
    };
  }
}
