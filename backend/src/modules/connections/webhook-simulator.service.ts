import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { SyncStatus } from '@prisma/client';

/**
 * The panel's scrobble tester (simulation and dry-run mode).
 *
 * NOTE: it reimplements the pipeline instead of calling
 * ScrobblePipelineService, so it can diverge from what a real webhook does.
 */
@Injectable()
export class WebhookSimulatorService {
  private readonly logger = new Logger(WebhookSimulatorService.name);

  constructor(
    private prisma: PrismaService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
  ) {}

  /**
   * Processes or simulates an interactive scrobble event.
   */
  async simulateWebhookEvent(
    userId: string,
    payload: {
      showTitle: string;
      episodeNumber: number;
      seasonNumber?: number;
      viewPercentage: number;
      rating?: number;
      libraryName?: string;
      source?: string;
      dryRun?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
        titleMappings: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    const source = (payload.source || 'PLEX').toUpperCase();
    const serverName = source === 'JELLYFIN'
      ? user.jellyfinConnection?.serverName || 'Jellyfin Media Server'
      : source === 'EMBY'
      ? user.embyConnection?.serverName || 'Emby Media Server'
      : user.plexConnection?.serverName || 'Plex Media Server';

    // 1. Check the blocklist
    const isBlacklisted = user.blacklist.some((b) =>
      payload.showTitle.toLowerCase().includes(b.titlePattern.toLowerCase()),
    );
    if (isBlacklisted) {
      return {
        processed: false,
        status: 'IGNORED_BLACKLIST',
        message: `The title "${payload.showTitle}" is on your account's blocklist. Event silently discarded.`,
      };
    }

    // 2. Check the viewing threshold
    const threshold = user.settings?.completionPercentage ?? 85;
    if (payload.viewPercentage < threshold) {
      return {
        processed: false,
        status: 'BELOW_THRESHOLD',
        message: `Viewing (${payload.viewPercentage}%) does not reach the configured threshold (${threshold}%).`,
      };
    }

    // 3. Map the title, or look for a match on AniList if there is none
    let mapping = user.titleMappings.find(
      (m) => m.plexTitle.toLowerCase() === payload.showTitle.toLowerCase(),
    );

    const blockedGenres: string[] = user.settings?.blockedGenres || [];

    if (!mapping) {
      // Automatic AniList search to create the mapping if autoApproveMappings is on
      try {
        const searchResults = await this.anilistService.searchAnime(payload.showTitle);
        if (searchResults.length > 0) {
          const topMatch = searchResults[0];

          // Check whether the anime found matches a blocked genre
          if (blockedGenres.length > 0 && Array.isArray(topMatch.genres)) {
            const matchedBlockedGenre = topMatch.genres.find((g: string) =>
              blockedGenres.some((bg) => bg.toLowerCase() === g.toLowerCase()),
            );
            if (matchedBlockedGenre) {
              return {
                processed: false,
                status: 'IGNORED_BLACKLIST_GENRE',
                message: `The anime "${payload.showTitle}" belongs to the blocked genre "${matchedBlockedGenre}". Event silently discarded.`,
              };
            }
          }

          if (!payload.dryRun) {
            mapping = await this.prisma.titleMapping.create({
              data: {
                userId,
                plexTitle: payload.showTitle,
                plexSeason: payload.seasonNumber || 1,
                anilistMediaId: topMatch.id,
                anilistTitle: topMatch.title?.romaji || topMatch.title?.english || payload.showTitle,
                confidenceScore: 0.95,
                isApproved: user.settings?.autoApproveMappings ?? true,
                isManual: false,
              },
            });
          }
        }
      } catch (e: any) {
        this.logger.warn(`Could not auto-map "${payload.showTitle}" on AniList: ${e.message}`);
      }
    }

    // Dry-run mode (preview only, no changes to trackers or the database)
    if (payload.dryRun) {
      const willSync = {
        anilist: Boolean(mapping?.anilistMediaId && (user.settings?.canSyncAnilist ?? true)),
        mal: Boolean(mapping?.malMediaId && (user.settings?.canSyncMal ?? true)),
        kitsu: Boolean(mapping?.kitsuMediaId && (user.settings?.canSyncKitsu ?? true)),
      };
      return {
        processed: true,
        dryRun: true,
        status: 'PREVIEW_SUCCESS',
        source,
        serverName,
        mapping: mapping ? {
          id: mapping.id,
          title: mapping.anilistTitle || mapping.plexTitle,
          anilistId: mapping.anilistMediaId,
          malId: mapping.malMediaId,
          kitsuId: mapping.kitsuMediaId,
        } : null,
        willSync,
        message: `Preview for "${payload.showTitle}" (Ep. ${payload.episodeNumber}): mapping ${mapping ? 'found' : 'not resolved'}, trackers ready to sync.`,
      };
    }

    // 4. Run the scrobbles on the connected services
    let anilistStatus: SyncStatus = SyncStatus.SKIPPED;
    let malStatus: SyncStatus = SyncStatus.SKIPPED;
    let kitsuStatus: SyncStatus = SyncStatus.SKIPPED;
    const failureReasons: string[] = [];
    const impactedServices: string[] = [];

    if (mapping?.anilistMediaId && (user.settings?.canSyncAnilist ?? true)) {
      const anilistRes = await this.anilistService.updateProgress(
        userId,
        mapping.anilistMediaId,
        payload.episodeNumber,
        'CURRENT',
        payload.rating,
      );
      if (anilistRes.success) {
        anilistStatus = SyncStatus.SUCCESS;
        impactedServices.push('AniList GraphQL');
      } else {
        anilistStatus = SyncStatus.FAILED;
        failureReasons.push(`AniList: ${anilistRes.error || anilistRes.reason || 'unspecified error'}`);
      }
    }

    if (mapping?.malMediaId && (user.settings?.canSyncMal ?? true)) {
      const malRes = await this.malService.updateProgress(
        userId,
        mapping.malMediaId,
        payload.episodeNumber,
        'watching',
        payload.rating,
      );
      if (malRes.success) {
        malStatus = SyncStatus.SUCCESS;
        impactedServices.push('MyAnimeList REST v2');
      } else {
        malStatus = SyncStatus.FAILED;
        failureReasons.push(`MAL: ${malRes.error || malRes.reason || 'unspecified error'}`);
      }
    }

    if (mapping?.kitsuMediaId && (user.settings?.canSyncKitsu ?? true)) {
      const ratingTwenty = payload.rating ? Math.round(payload.rating * 2) : undefined;
      const kitsuRes = await this.kitsuService.updateProgress(
        userId,
        mapping.kitsuMediaId,
        payload.episodeNumber,
        'current',
        ratingTwenty,
      );
      if (kitsuRes.success) {
        kitsuStatus = SyncStatus.SUCCESS;
        impactedServices.push('Kitsu JSON:API');
      } else if (kitsuRes.message !== 'Kitsu is not connected for this user.') {
        kitsuStatus = SyncStatus.FAILED;
        failureReasons.push(`Kitsu: ${kitsuRes.message}`);
      }
    }

    // 5. Record in the scrobble history
    const historyEntry = await this.prisma.scrobbleHistory.create({
      data: {
        userId,
        showTitle: payload.showTitle,
        episodeNumber: payload.episodeNumber,
        seasonNumber: payload.seasonNumber || 1,
        viewPercentage: payload.viewPercentage,
        rating: payload.rating,
        anilistStatus,
        malStatus,
        kitsuStatus,
        source,
        serverName: serverName || null,
        libraryName: payload.libraryName || null,
        errorMessage: failureReasons.length ? failureReasons.join(' | ').slice(0, 500) : null,
        viewedAt: new Date(),
        payloadSnapshot: payload as any,
      },
    });

    return {
      processed: true,
      status: 'SCROBBLED_SUCCESS',
      historyEntry,
      impactedServices,
      source,
      message: `Scrobble recorded (${source}): "${payload.showTitle}" Ep. ${payload.episodeNumber} synced.`,
    };
  }
}
