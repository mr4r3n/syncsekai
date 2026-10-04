import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { CoversService } from '../covers/covers.service';
import { AnimeProvider, SyncStatus } from '@prisma/client';
import axios from 'axios';
import { inferSeasonNumber, clampProgress, ANILIST_GRAPHQL_ENDPOINT, BROWSER_USER_AGENT } from './catalog-utils';
import { withTrackerPriority } from '../../common/http/tracker-gate';

export interface CatalogAnimeItem {
  id: string | number;
  anilistId?: number;
  malId?: number;
  kitsuId?: string | number;
  title: string;
  romajiTitle: string;
  englishTitle?: string;
  nativeTitle?: string;
  coverUrl: string;
  bannerUrl?: string;
  coverColor?: string;
  episodesTotal: number;
  episodesWatched: number;
  progressPercentage: number;
  status: 'CURRENT' | 'COMPLETED' | 'PLANNING' | 'PAUSED' | 'DROPPED' | string;
  rating: number;
  averageScore?: number;
  format?: string;
  season?: string;
  seasonYear?: number;
  seasonNumber?: number;
  inUserList?: boolean;
  studio?: string;
  genres: string[];
  description?: string;
  syncedPlex: boolean;
  syncedJellyfin?: boolean;
  syncedEmby?: boolean;
  syncedAnilist: boolean;
  syncedMal: boolean;
  syncedKitsu?: boolean;
  updatedAt?: string | null;
  nextAiringEpisode?: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
}

export interface CatalogQueryOptions {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  provider?: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL' | 'ALL';
  forceRefresh?: boolean;
}

export interface UserCacheEntry {
  timestamp: number;
  /** Set when a rebuild failed (e.g. the tracker is busy): until then the old list is served. */
  retryAfter?: number;
  rawItems: CatalogAnimeItem[];
  username: string | null;
  avatarUrl: string | null;
}

/** The user's catalog: unified list from their trackers or, without any, the local one. */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  // In-memory cache per user and provider. 30 minutes, or until the user scrobbles something
  // newer: each rebuild costs a request of the tracker's shared budget (30 a minute on AniList).
  // ponytail: per process and lost on restart, so the first visit after a deploy asks again.
  readonly userCache = new Map<string, UserCacheEntry>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;
  /** After a failed rebuild, the previous list is served without asking again for this long. */
  private readonly RETRY_AFTER_FAILURE_MS = 60 * 1000;
  /** The refresh button is ignored on a list younger than this (a double click, not a change on the tracker). */
  private readonly MIN_REFRESH_AGE_MS = 10 * 1000;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private kitsuService: KitsuService,
    private coversService: CoversService,
  ) {}

  /**
   * Mappings store the three ids of the same anime: they are the source for
   * knowing that `mal_X` and `al_Y` are the same cover before downloading
   * anything. One query per catalog; without it each tracker would keep its own
   * copy.
   */
  private async linkCoversFromMappings(
    field: 'malMediaId' | 'kitsuMediaId',
    prefix: 'mal_' | 'kitsu_',
    ids: Array<number | undefined | null>,
  ): Promise<void> {
    const validItems = [...new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))];
    if (validItems.length === 0) return;
    try {
      const mappings = await this.prisma.titleMapping.findMany({
        where: { [field]: { in: validItems }, anilistMediaId: { not: null } },
        select: { anilistMediaId: true, [field]: true },
      });
      for (const m of mappings) {
        this.coversService.registerAlias(`${prefix}${(m as any)[field]}`, `al_${m.anilistMediaId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not link covers from mappings (${field}): ${err.message}`);
    }
  }

  /**
   * Returns the paginated catalog.
   */
  async getCatalog(userId?: string, options: CatalogQueryOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 32));
    const statusFilter = options.status || 'ALL';
    const searchQuery = (options.search || '').trim().toLowerCase();
    const forceRefresh = !!options.forceRefresh;

    if (!userId) {
      return {
        connected: false,
        source: 'none',
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalPages: 1,
          totalItems: 0,
          filteredItems: 0,
        },
        counts: { all: 0, watching: 0, completed: 0, planning: 0, paused: 0, dropped: 0 },
        items: [],
        message: 'Sign in to see your catalog.',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        animeConnections: true,
        titleMappings: true,
        scrobbleHistory: {
          orderBy: { viewedAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const anilistConn = user.animeConnections.find(
      (c) => c.provider === AnimeProvider.ANILIST && c.isConnected,
    );

    const malConn = user.animeConnections.find(
      (c) => c.provider === AnimeProvider.MAL && c.isConnected,
    );

    const kitsuConn = user.animeConnections.find(
      (c) => c.provider === AnimeProvider.KITSU && c.isConnected,
    );

    const isPlexConnected = !!(user.plexConnection && user.plexConnection.isConnected);
    const isJellyfinConnected = !!((user as any).jellyfinConnection && (user as any).jellyfinConnection.isConnected);
    const isEmbyConnected = !!((user as any).embyConnection && (user as any).embyConnection.isConnected);
    const isMediaServerConnected = isPlexConnected || isJellyfinConnected || isEmbyConnected;
    const isMalConnected = !!malConn;
    const isAnilistConnected = !!anilistConn;
    const isKitsuConnected = !!kitsuConn;

    const providersStatus = {
      plex: {
        isConnected: isPlexConnected,
        serverName: user.plexConnection?.serverName || 'Plex Media Server',
        serverUrl: user.plexConnection?.serverUrl || null,
      },
      jellyfin: {
        isConnected: isJellyfinConnected,
        serverName: (user as any).jellyfinConnection?.serverName || 'Jellyfin Media Server',
        serverUrl: (user as any).jellyfinConnection?.serverUrl || null,
      },
      emby: {
        isConnected: isEmbyConnected,
        serverName: (user as any).embyConnection?.serverName || 'Emby Media Server',
        serverUrl: (user as any).embyConnection?.serverUrl || null,
      },
      anilist: {
        isConnected: isAnilistConnected,
        username: anilistConn?.remoteUsername || null,
      },
      mal: {
        isConnected: isMalConnected,
        username: malConn?.remoteUsername || null,
      },
      kitsu: {
        isConnected: isKitsuConnected,
        username: kitsuConn?.remoteUsername || null,
      },
    };

    const requestedProvider = options.provider?.toUpperCase();
    const hasAnilist = !!(anilistConn && anilistConn.encryptedAccessToken);
    const hasMal = !!(malConn && malConn.encryptedAccessToken);
    const hasKitsu = !!(kitsuConn && kitsuConn.encryptedAccessToken);
    const hasAnyExternal = hasAnilist || hasMal || hasKitsu;

    let rawItems: CatalogAnimeItem[] = [];
    let username: string | null = null;
    /** Set when the tracker could not be asked and an older list is served: when that list was fetched. */
    let staleSince: number | undefined;
    let avatarUrl: string | null = null;
    let activeProvider: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL' = 'LOCAL';

    if (requestedProvider === 'LOCAL' || (!hasAnyExternal && isMediaServerConnected)) {
      // Standalone local tracker: built directly from scrobbles and favorites
      activeProvider = 'LOCAL';
      username = user.username;
      avatarUrl = user.avatarUrl;

      const [scrobbles, favorites, mappings] = await Promise.all([
        this.prisma.scrobbleHistory.findMany({
          where: { userId },
          orderBy: { viewedAt: 'desc' },
        }),
        this.prisma.userFavorite.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.titleMapping.findMany({
          where: {
            OR: [
              { userId },
              { isGlobal: true, isApproved: true },
            ],
          },
        }),
      ]);

      const mappingMap = new Map<string, any>();
      for (const m of mappings) {
        const mKey = (m.plexTitle || '').toLowerCase().trim();
        if (mKey && !mappingMap.has(mKey)) {
          mappingMap.set(mKey, m);
        }
      }

      // Preload public Kitsu metadata for local titles
      const uniqueShowTitles = Array.from(new Set(scrobbles.map((s) => s.showTitle.trim()))).filter(Boolean);
      const kitsuMetaMap = new Map<string, any>();
      // Decoration only (cover, episode count): what Kitsu already answered is used now; the
      // rest is asked in the background (Kitsu takes one request a second) and shows on a
      // later visit, instead of this page waiting for it.
      for (const title of uniqueShowTitles) {
        const cachedResults = this.kitsuService.cachedSearch(title);
        if (cachedResults?.length) {
          kitsuMetaMap.set(title.toLowerCase().trim(), cachedResults[0]);
        } else if (!cachedResults) {
          void withTrackerPriority('background', () => this.kitsuService.searchAnime(title, 1)).catch(() => {});
        }
      }

      const localMap = new Map<string, CatalogAnimeItem>();

      for (const scrobble of scrobbles) {
        const key = scrobble.showTitle.toLowerCase().trim();
        const epNum = Number(scrobble.episodeNumber || 1);
        const existing = localMap.get(key);
        const mapping = mappingMap.get(key);
        const kitsuMeta = kitsuMetaMap.get(key);

        const watched = existing ? Math.max(existing.episodesWatched, epNum) : epNum;
        const totalEp = (kitsuMeta?.episodesTotal && kitsuMeta.episodesTotal > 0)
          ? kitsuMeta.episodesTotal
          : (existing?.episodesTotal && existing.episodesTotal > 0)
            ? existing.episodesTotal
            : 0;
        const progressPct = totalEp > 0 ? Math.min(100, Math.round((watched / totalEp) * 100)) : 0;
        
        let status = 'CURRENT';
        if (totalEp > 0 && watched >= totalEp) {
          status = 'COMPLETED';
        }

        const isJellyfinScrobble = scrobble.source === 'JELLYFIN' || (!scrobble.source && isJellyfinConnected);
        const isEmbyScrobble = scrobble.source === 'EMBY' || (!scrobble.source && isEmbyConnected && !isJellyfinConnected);
        const isPlexScrobble = scrobble.source === 'PLEX' || (!scrobble.source && isPlexConnected && !isJellyfinConnected && !isEmbyConnected);
        const serverSourceLabel = isJellyfinScrobble ? 'Jellyfin' : isEmbyScrobble ? 'Emby' : isPlexScrobble ? 'Plex' : 'Media Server';

        const anilistId = mapping?.anilistMediaId || existing?.anilistId || undefined;
        const malId = mapping?.malMediaId || existing?.malId || undefined;
        const kitsuId = mapping?.kitsuMediaId ? Number(mapping.kitsuMediaId) : (existing?.kitsuId || kitsuMeta?.kitsuId || undefined);

        let cover = existing?.coverUrl || kitsuMeta?.coverUrl;
        if (!cover || cover.includes('dicebear.com')) {
          // The cover on disk now; a missing one is looked up in the background and shows on a
          // later visit (the lookup can wait its turn in the trackers' queue, this page should not).
          const local = this.coversService.localCoverFor(scrobble.showTitle, anilistId || null);
          if (!local) void this.coversService.getOrFetchCover(scrobble.showTitle, anilistId || null).catch(() => {});
          cover = local || kitsuMeta?.coverUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(scrobble.showTitle)}`;
        }

        const generatedId = Math.abs(key.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));

        localMap.set(key, {
          id: anilistId || kitsuId || generatedId,
          anilistId: anilistId || 0,
          malId: malId,
          kitsuId: kitsuId,
          title: kitsuMeta?.title || scrobble.showTitle,
          romajiTitle: mapping?.anilistTitle || kitsuMeta?.romajiTitle || scrobble.showTitle,
          coverUrl: cover,
          bannerUrl: kitsuMeta?.bannerUrl || cover,
          format: (kitsuMeta?.subtype || 'TV').toUpperCase(),
          // `season` is the AIRING season ("SPRING 2024"), as with the other
          // providers. The local database does not know it, so it is null.
          // Do not put the season NUMBER here (e.g. `T2`): the card renders this
          // field next to the value it already takes from seasonNumber and would
          // show "T2 T2".
          season: undefined,
          seasonNumber: scrobble.seasonNumber || 1,
          episodesTotal: totalEp,
          episodesWatched: watched,
          progressPercentage: progressPct,
          status,
          rating: scrobble.rating || 0,
          averageScore: kitsuMeta?.averageScore ? Math.round(kitsuMeta.averageScore) : 85,
          genres: ['Anime'],
          studio: 'Local Library',
          description: kitsuMeta?.synopsis || `Played on ${serverSourceLabel} (${scrobble.showTitle}, season ${scrobble.seasonNumber || 1}). Synced to your standalone database.`,
          syncedPlex: (existing?.syncedPlex ?? false) || isPlexScrobble,
          syncedJellyfin: (existing?.syncedJellyfin ?? false) || isJellyfinScrobble,
          syncedEmby: (existing?.syncedEmby ?? false) || isEmbyScrobble,
          syncedAnilist: scrobble.anilistStatus === SyncStatus.SUCCESS,
          syncedMal: scrobble.malStatus === SyncStatus.SUCCESS,
          syncedKitsu: scrobble.kitsuStatus === SyncStatus.SUCCESS,
          updatedAt: scrobble.viewedAt.toISOString(),
          nextAiringEpisode: null,
        });
      }

      // Add favorites that are not in the scrobbles. By id too: the favorite keeps
      // the tracker's title and the scrobble the server's ("Sousou no Frieren" vs
      // "Frieren: Beyond Journey's End"), so matching titles alone listed it twice.
      const watchedIds = new Set([...localMap.values()].map((item) => String(item.id)));
      for (const fav of favorites) {
        const key = fav.title.toLowerCase().trim();
        if (!localMap.has(key) && !watchedIds.has(String(fav.animeId))) {
          localMap.set(key, {
            id: Number(fav.animeId) || Math.abs(key.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0)),
            title: fav.title,
            romajiTitle: fav.title,
            coverUrl: fav.coverUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(fav.title)}`,
            bannerUrl: fav.coverUrl || undefined,
            format: 'TV',
            season: 'TV',
            seasonNumber: 1,
            episodesTotal: 12,
            episodesWatched: 0,
            progressPercentage: 0,
            status: 'PLANNING',
            rating: 0,
            averageScore: 85,
            genres: fav.genres || ['Anime'],
            studio: 'Favorites',
            description: `Anime added to your local favorites.`,
            syncedPlex: false,
            syncedAnilist: false,
            syncedMal: false,
            syncedKitsu: false,
            updatedAt: fav.createdAt.toISOString(),
            nextAiringEpisode: null,
          });
        }
      }

      rawItems = Array.from(localMap.values());
    } else if (!hasAnyExternal) {
      return {
        connected: false,
        source: 'none',
        activeProvider: null,
        username: null,
        providers: providersStatus,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalPages: 1,
          totalItems: 0,
          filteredItems: 0,
        },
        counts: { all: 0, watching: 0, completed: 0, planning: 0, paused: 0, dropped: 0 },
        items: [],
        message: 'You have not linked your anime accounts (AniList, MyAnimeList or Kitsu) or played any anime yet.',
      };
    } else {
      if (requestedProvider === 'KITSU' && hasKitsu) {
        activeProvider = 'KITSU';
      } else if (requestedProvider === 'MAL' && hasMal) {
        activeProvider = 'MAL';
      } else if (requestedProvider === 'ANILIST' && hasAnilist) {
        activeProvider = 'ANILIST';
      } else if (hasAnilist) {
        activeProvider = 'ANILIST';
      } else if (hasMal) {
        activeProvider = 'MAL';
      } else if (hasKitsu) {
        activeProvider = 'KITSU';
      } else {
        activeProvider = 'LOCAL';
      }

      const cacheKey = `${userId}_${activeProvider}`;
      const cached = this.userCache.get(cacheKey);
      const now = Date.now();
      const lastScrobbleAt = user.scrobbleHistory[0]?.createdAt?.getTime() ?? 0;
      const refreshAsked = forceRefresh && (!cached || now - cached.timestamp > this.MIN_REFRESH_AGE_MS);
      const isCacheValid =
        cached &&
        ((cached.retryAfter !== undefined && now < cached.retryAfter) ||
          (now - cached.timestamp < this.CACHE_TTL_MS && cached.timestamp >= lastScrobbleAt && !refreshAsked));

      username = (activeProvider === 'MAL' ? malConn?.remoteUsername : activeProvider === 'KITSU' ? kitsuConn?.remoteUsername : anilistConn?.remoteUsername) || null;
      avatarUrl = (activeProvider === 'MAL' ? malConn?.avatarUrl : activeProvider === 'KITSU' ? kitsuConn?.avatarUrl : anilistConn?.avatarUrl) || null;

      if (isCacheValid && cached && cached.rawItems.length > 0) {
        rawItems = cached.rawItems;
        username = cached.username || username;
        avatarUrl = cached.avatarUrl || avatarUrl;
      } else if (activeProvider === 'MAL' && malConn?.encryptedAccessToken) {
      // Query the MyAnimeList REST API v2
      try {
        const malToken = this.encryptionService.decrypt(malConn.encryptedAccessToken);
        const malRes = await axios.get(
          'https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,num_episodes,mean,status,genres,main_picture,alternative_titles,start_season,synopsis,studios&limit=1000',
          {
            headers: {
              Authorization: `Bearer ${malToken}`,
              'User-Agent': BROWSER_USER_AGENT,
            },
            timeout: 9000,
          },
        );

        const dataEntries = malRes.data?.data || [];
        const fetchedItems: CatalogAnimeItem[] = [];
        await this.linkCoversFromMappings('malMediaId', 'mal_', dataEntries.map((e: any) => e?.node?.id));

        const malStatusMap: Record<string, string> = {
          watching: 'CURRENT',
          completed: 'COMPLETED',
          on_hold: 'PAUSED',
          dropped: 'DROPPED',
          plan_to_watch: 'PLANNING',
        };

        for (const entry of dataEntries) {
          const node = entry.node;
          const listStatus = entry.list_status || {};
          if (!node || !node.id) continue;

          const title = node.alternative_titles?.en || node.title || 'Untitled';
          const romajiTitle = node.title || title;
          const episodesTotal = Number(node.num_episodes || 0);
          const episodesWatched = clampProgress(listStatus.num_episodes_watched, episodesTotal);

          let progressPercentage = 0;
          if (episodesTotal > 0) {
            progressPercentage = Math.min(100, Math.round((episodesWatched / episodesTotal) * 100));
          } else if (listStatus.status === 'completed') {
            progressPercentage = 100;
          }

          const remoteCover = node.main_picture?.large || node.main_picture?.medium || '';
          let coverUrl = remoteCover || '';
          if (node.id && remoteCover) {
            const safeKey = this.coversService.canonicalKey(`mal_${node.id}`);
            this.coversService.downloadAndSaveCover(safeKey, remoteCover).catch(() => {});
            if (this.coversService.hasLocalCover(safeKey)) {
              coverUrl = `/api/covers/${safeKey}`;
            } else {
              coverUrl = `/api/covers/${safeKey}?fallback=${encodeURIComponent(remoteCover)}&title=${encodeURIComponent(title)}`;
            }
          }

          const status = malStatusMap[listStatus.status] || 'CURRENT';
          const score = Number(listStatus.score || 0);
          const averageScore = node.mean ? Math.round(Number(node.mean) * 10) : undefined;
          const studioName = node.studios?.[0]?.name || 'Studio';

          fetchedItems.push({
            id: `mal_${node.id}`,
            anilistId: 0,
            malId: node.id,
            title,
            romajiTitle,
            englishTitle: node.alternative_titles?.en || undefined,
            nativeTitle: node.alternative_titles?.ja || undefined,
            coverUrl,
            coverColor: '#2e51a2',
            episodesTotal,
            episodesWatched,
            progressPercentage,
            status,
            rating: score,
            averageScore,
            format: 'TV',
            season: node.start_season ? `${node.start_season.season} ${node.start_season.year}` : 'TV',
            seasonYear: node.start_season?.year || undefined,
            seasonNumber: inferSeasonNumber(
              title,
              romajiTitle,
              node.alternative_titles?.en,
              node.alternative_titles?.ja,
            ),
            inUserList: true,
            studio: studioName,
            genres: (node.genres || []).map((g: any) => g.name),
            description: node.synopsis || '',
            syncedPlex: isPlexConnected,
            syncedAnilist: isAnilistConnected,
            syncedMal: true,
            updatedAt: listStatus.updated_at || null,
            nextAiringEpisode: null,
          });
        }

        fetchedItems.sort((a, b) => {
          if (a.status === 'CURRENT' && b.status !== 'CURRENT') return -1;
          if (a.status !== 'CURRENT' && b.status === 'CURRENT') return 1;
          return (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        });

        rawItems = fetchedItems;
        this.userCache.set(cacheKey, {
          timestamp: Date.now(),
          rawItems,
          username: username ?? null,
          avatarUrl: avatarUrl ?? null,
        });
      } catch (malErr: any) {
        this.logger.error(`Error querying MyAnimeList REST: ${malErr.message}`);
        if (cached) {
          rawItems = cached.rawItems;
          cached.retryAfter = Date.now() + this.RETRY_AFTER_FAILURE_MS;
        } else {
          return {
            connected: true,
            source: 'mal',
            activeProvider: 'MAL',
            username,
            avatarUrl,
            providers: providersStatus,
            pagination: { currentPage: page, itemsPerPage: limit, totalPages: 1, totalItems: 0, filteredItems: 0 },
            counts: { all: 0, watching: 0, completed: 0, planning: 0, paused: 0, dropped: 0 },
            items: [],
            error: malErr.message || 'Connection error with MyAnimeList',
          };
        }
      }
    } else if (activeProvider === 'KITSU' && kitsuConn?.encryptedAccessToken) {
      // Query the Kitsu JSON:API
      try {
        const kitsuItems = await this.kitsuService.getUserLibrary(userId);
        await this.linkCoversFromMappings('kitsuMediaId', 'kitsu_', kitsuItems.map((i) => i.kitsuId));
        for (const item of kitsuItems) {
          if (item.kitsuId && item.coverUrl && !item.coverUrl.startsWith('/api/covers/')) {
            const safeKey = this.coversService.canonicalKey(`kitsu_${item.kitsuId}`);
            this.coversService.downloadAndSaveCover(safeKey, item.coverUrl).catch(() => {});
            item.coverUrl = `/api/covers/${safeKey}`;
          }
        }
        kitsuItems.sort((a, b) => {
          if (a.status === 'CURRENT' && b.status !== 'CURRENT') return -1;
          if (a.status !== 'CURRENT' && b.status === 'CURRENT') return 1;
          return (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        });
        rawItems = kitsuItems;
        this.userCache.set(cacheKey, {
          timestamp: Date.now(),
          rawItems,
          username: username ?? null,
          avatarUrl: avatarUrl ?? null,
        });
      } catch (kitsuErr: any) {
        this.logger.error(`Error querying Kitsu: ${kitsuErr.message}`);
        if (cached) {
          rawItems = cached.rawItems;
          cached.retryAfter = Date.now() + this.RETRY_AFTER_FAILURE_MS;
        } else {
          return {
            connected: true,
            source: 'kitsu',
            activeProvider: 'KITSU',
            username,
            avatarUrl,
            providers: providersStatus,
            pagination: { currentPage: page, itemsPerPage: limit, totalPages: 1, totalItems: 0, filteredItems: 0 },
            counts: { all: 0, watching: 0, completed: 0, planning: 0, paused: 0, dropped: 0 },
            items: [],
            error: kitsuErr.message || 'Connection error with Kitsu',
          };
        }
      }
    } else if (anilistConn?.encryptedAccessToken) {
      // Query AniList GraphQL with an optimized query
      try {
        const token = this.encryptionService.decrypt(anilistConn.encryptedAccessToken);
        const remoteUserId = anilistConn.remoteUserId ? Number(anilistConn.remoteUserId) : null;

        const query = `
          query ($userId: Int, $userName: String) {
            MediaListCollection(userId: $userId, userName: $userName, type: ANIME) {
              lists {
                name
                isCustomList
                status
                entries {
                  id
                  mediaId
                  status
                  score
                  progress
                  updatedAt
                  media {
                    id
                    idMal
                    title {
                      romaji
                      english
                      native
                      userPreferred
                    }
                    format
                    status
                    description(asHtml: false)
                    episodes
                    season
                    seasonYear
                    averageScore
                    genres
                    coverImage {
                      extraLarge
                      large
                      medium
                      color
                    }
                    bannerImage
                    studios(isMain: true) {
                      nodes {
                        name
                      }
                    }
                    nextAiringEpisode {
                      episode
                      airingAt
                      timeUntilAiring
                    }
                  }
                }
              }
            }
          }
        `;

        const response = await axios.post(
          ANILIST_GRAPHQL_ENDPOINT,
          {
            query,
            variables: remoteUserId
              ? { userId: remoteUserId }
              : { userName: anilistConn.remoteUsername },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'User-Agent': BROWSER_USER_AGENT,
            },
            timeout: 9000,
          },
        );

        if (response.data?.errors && response.data.errors.length > 0) {
          const errorMsg = response.data.errors[0]?.message || 'Error querying the catalog on AniList';
          this.logger.warn(`AniList MediaListCollection error: ${errorMsg}`);
          return {
            connected: true,
            source: 'anilist',
            activeProvider: 'ANILIST',
            username,
            avatarUrl,
            providers: providersStatus,
            pagination: { currentPage: page, itemsPerPage: limit, totalPages: 1, totalItems: 0, filteredItems: 0 },
            counts: { all: 0, watching: 0, completed: 0, planning: 0, paused: 0, dropped: 0 },
            items: [],
            error: errorMsg,
          };
        }

        const lists = response.data?.data?.MediaListCollection?.lists || [];
        const seenMediaIds = new Set<number>();
        const fetchedItems: CatalogAnimeItem[] = [];

        for (const list of lists) {
          const entries = list.entries || [];
          for (const entry of entries) {
            const media = entry.media;
            if (!media || !media.id) continue;

            if (seenMediaIds.has(media.id)) continue;
            seenMediaIds.add(media.id);

            const preferredTitle =
              media.title?.userPreferred ||
              media.title?.romaji ||
              media.title?.english ||
              'Untitled';

            const episodesTotal = Number(media.episodes || 0);
            const episodesWatched = clampProgress(entry.progress, episodesTotal);
            let progressPercentage = 0;
            if (episodesTotal > 0) {
              progressPercentage = Math.min(100, Math.round((episodesWatched / episodesTotal) * 100));
            } else if (entry.status === 'COMPLETED') {
              progressPercentage = 100;
            }

            const hasPlexMapping = user.titleMappings.some(
              (m) => m.anilistMediaId === media.id,
            );
            const hasPlexScrobble = user.scrobbleHistory.some((h) =>
              h.showTitle.toLowerCase().includes(preferredTitle.toLowerCase()) ||
              (media.title?.romaji && h.showTitle.toLowerCase().includes(media.title.romaji.toLowerCase())),
            );

            const seasonStr =
              media.season && media.seasonYear
                ? `${media.season} ${media.seasonYear}`
                : media.seasonYear
                ? String(media.seasonYear)
                : media.format || 'TV';

            const remoteCover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
            let coverUrl = remoteCover || '';
            if (media.id && remoteCover) {
              const safeKey = `al_${media.id}`;
              this.coversService
                .downloadAndSaveCover(safeKey, remoteCover, media.idMal ? `mal_${media.idMal}` : undefined)
                .catch(() => {});
              if (this.coversService.hasLocalCover(safeKey)) {
                coverUrl = `/api/covers/${safeKey}`;
              } else {
                coverUrl = `/api/covers/${safeKey}?fallback=${encodeURIComponent(remoteCover)}&title=${encodeURIComponent(preferredTitle)}`;
              }
            }

            fetchedItems.push({
              id: entry.id || `al_${media.id}`,
              anilistId: media.id,
              malId: media.idMal || undefined,
              title: preferredTitle,
              romajiTitle: media.title?.romaji || preferredTitle,
              englishTitle: media.title?.english || undefined,
              nativeTitle: media.title?.native || undefined,
              coverUrl,
              bannerUrl: media.bannerImage || undefined,
              coverColor: media.coverImage?.color || '#e5a00d',
              episodesTotal,
              episodesWatched,
              progressPercentage,
              status: entry.status || 'CURRENT',
              rating: Number(entry.score || 0),
              averageScore: media.averageScore ? Number(media.averageScore) : undefined,
              format: media.format || 'TV',
              season: seasonStr,
              seasonYear: media.seasonYear || undefined,
              seasonNumber: inferSeasonNumber(
                preferredTitle,
                media.title?.romaji,
                media.title?.english,
                media.title?.native,
              ),
              inUserList: true,
              studio: media.studios?.nodes?.[0]?.name || 'Studio',
              genres: media.genres || [],
              description: media.description ? media.description.replace(/<[^>]*>?/gm, '') : '',
              syncedPlex: isPlexConnected && (hasPlexMapping || hasPlexScrobble || true),
              syncedAnilist: true,
              syncedMal: isMalConnected && !!media.idMal,
              updatedAt: entry.updatedAt ? new Date(entry.updatedAt * 1000).toISOString() : null,
              nextAiringEpisode: media.nextAiringEpisode || null,
            });
          }
        }

        // Sort: CURRENT first, then by update date, newest first
        fetchedItems.sort((a, b) => {
          if (a.status === 'CURRENT' && b.status !== 'CURRENT') return -1;
          if (a.status !== 'CURRENT' && b.status === 'CURRENT') return 1;
          return (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        });

        rawItems = fetchedItems;

        // Store in the cache
        this.userCache.set(cacheKey, {
          timestamp: Date.now(),
          rawItems,
          username: username ?? null,
          avatarUrl: avatarUrl ?? null,
        });
      } catch (error: any) {
        this.logger.warn(`Local/offline mode or catalog query error (${error.message})`);
        if (cached) {
          rawItems = cached.rawItems;
          cached.retryAfter = Date.now() + this.RETRY_AFTER_FAILURE_MS;
        } else {
          rawItems = [];
        }
      }
    }
      // A list whose rebuild failed (tracker busy or down) is served as it was: the page says how old it is.
      if (cached && rawItems === cached.rawItems && cached.retryAfter !== undefined) staleSince = cached.timestamp;
    }

    // Compute the global counters
    const allCount = rawItems.length;
    const watchingCount = rawItems.filter((i) => i.status === 'CURRENT').length;
    const completedCount = rawItems.filter((i) => i.status === 'COMPLETED').length;
    const planningCount = rawItems.filter((i) => i.status === 'PLANNING').length;
    const pausedCount = rawItems.filter((i) => i.status === 'PAUSED').length;
    const droppedCount = rawItems.filter((i) => i.status === 'DROPPED').length;

    // Apply filters in memory
    let filtered = rawItems;

    if (statusFilter === 'CURRENT') {
      filtered = filtered.filter((i) => i.status === 'CURRENT');
    } else if (statusFilter === 'COMPLETED') {
      filtered = filtered.filter((i) => i.status === 'COMPLETED');
    } else if (statusFilter === 'PLANNING') {
      filtered = filtered.filter((i) => i.status === 'PLANNING');
    } else if (statusFilter === 'PAUSED_DROPPED') {
      filtered = filtered.filter((i) => i.status === 'PAUSED' || i.status === 'DROPPED');
    }

    if (searchQuery) {
      filtered = filtered.filter((item) => {
        return (
          item.title.toLowerCase().includes(searchQuery) ||
          (item.romajiTitle && item.romajiTitle.toLowerCase().includes(searchQuery)) ||
          (item.englishTitle && item.englishTitle.toLowerCase().includes(searchQuery)) ||
          (item.studio && item.studio.toLowerCase().includes(searchQuery)) ||
          (item.genres && item.genres.some((g) => g.toLowerCase().includes(searchQuery)))
        );
      });
    }

    // Exact pagination
    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return {
      connected: true,
      source: activeProvider.toLowerCase(),
      activeProvider,
      username,
      avatarUrl,
      providers: providersStatus,
      pagination: {
        currentPage: safePage,
        itemsPerPage: limit,
        totalPages,
        totalItems: allCount,
        filteredItems: totalFiltered,
      },
      counts: {
        all: allCount,
        watching: watchingCount,
        completed: completedCount,
        planning: planningCount,
        paused: pausedCount,
        dropped: droppedCount,
        favorites: await this.prisma.userFavorite.count({ where: { userId } }),
      },
      items: paginatedItems,
      ...(staleSince !== undefined && { staleSince: new Date(staleSince).toISOString() }),
    };
  }

  /**
   * Clears a user's cache. Entries are per provider (`<userId>_<PROVIDER>`);
   * the LOCAL catalog is not cached.
   */
  invalidateUserCache(userId: string) {
    for (const provider of ['ANILIST', 'MAL', 'KITSU']) {
      this.userCache.delete(`${userId}_${provider}`);
    }
  }
}
