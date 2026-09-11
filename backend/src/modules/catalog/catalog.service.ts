import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { CoversService } from '../covers/covers.service';
import { AnimeProvider, SyncStatus } from '@prisma/client';
import axios from 'axios';

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

interface UserCacheEntry {
  timestamp: number;
  rawItems: CatalogAnimeItem[];
  username: string | null;
  avatarUrl: string | null;
}

interface FranchiseCacheEntry {
  timestamp: number;
  items: any[];
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly graphqlEndpoint = 'https://graphql.anilist.co';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  // Cache en memoria por usuario y proveedor con TTL de 5 minutos
  private readonly userCache = new Map<string, UserCacheEntry>();
  private readonly franchiseCache = new Map<number, FranchiseCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly FRANCHISE_CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private coversService: CoversService,
  ) {}

  private inferSeasonNumber(...titles: Array<string | null | undefined>): number | undefined {
    for (const title of titles) {
      if (!title) continue;
      const match =
        title.match(/(?:season|temporada)\s*(\d{1,2})\b/i) ||
        title.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i) ||
        title.match(/\bpart\s*(\d{1,2})\b/i) ||
        title.match(/\b(?:2nd|3rd|4th|5th)\s+season\b/i);
      if (match) {
        const val = Number(match[1]);
        if (val >= 1 && val <= 50) return val;
      }
      if (/\b(?:II|2nd)\b/i.test(title)) return 2;
      if (/\b(?:III|3rd)\b/i.test(title)) return 3;
      if (/\b(?:IV|4th)\b/i.test(title)) return 4;
      if (/\b(?:V|5th)\b/i.test(title)) return 5;
    }
    return 1;
  }

  private extractBaseTitle(title?: string): string {
    if (!title) return '';
    return title
      .replace(/(?:season|temporada)\s*\d{1,2}/gi, '')
      .replace(/\b(?:\d{1,2}(?:st|nd|rd|th)\s+season|2nd|3rd|4th|5th)\b/gi, '')
      .replace(/\b(?:part|cour)\s*\d{1,2}/gi, '')
      .replace(/\b(?:II|III|IV|V|VI)\b/g, '')
      .replace(/:\s*[^:]+$/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private clampProgress(progress: unknown, episodesTotal: number): number {
    const parsed = Math.max(0, Number(progress || 0));
    return episodesTotal > 0 ? Math.min(parsed, episodesTotal) : parsed;
  }

  /**
   * 1. Obtener catálogo paginado y optimizado desde AniList
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
        message: 'Inicia sesión para ver tu catálogo.',
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
      throw new NotFoundException('Usuario no encontrado.');
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
    let avatarUrl: string | null = null;
    let activeProvider: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL' = 'LOCAL';

    if (requestedProvider === 'LOCAL' || (!hasAnyExternal && isMediaServerConnected)) {
      // Tracker Local Autónomo: generado directamente desde Scrobbles y Favoritos
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

      // Pre-cargar metadatos públicos de Kitsu para títulos locales
      const uniqueShowTitles = Array.from(new Set(scrobbles.map((s) => s.showTitle.trim()))).filter(Boolean);
      const kitsuMetaMap = new Map<string, any>();
      await Promise.all(
        uniqueShowTitles.map(async (title) => {
          try {
            const results = await this.kitsuService.searchAnime(title, 1);
            if (results && results.length > 0) {
              kitsuMetaMap.set(title.toLowerCase().trim(), results[0]);
            }
          } catch {}
        }),
      );

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
          const localOrFetched = await this.coversService.getOrFetchCover(scrobble.showTitle, anilistId || null);
          cover = localOrFetched || kitsuMeta?.coverUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(scrobble.showTitle)}`;
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
          // `season` es la temporada de EMISION ("SPRING 2024"), como en el
          // resto de proveedores. La base local no la conoce, asi que va null.
          // Aqui habia `T${seasonNumber}`, o sea el NUMERO de temporada en un
          // campo que significa otra cosa: la tarjeta pintaba ese valor al lado
          // del que ya sacaba de seasonNumber y salia "T2 T2".
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
          description: kitsuMeta?.synopsis || `Reproducido en ${serverSourceLabel} (${scrobble.showTitle}, Temporada ${scrobble.seasonNumber || 1}). Sincronizado en tu base de datos autónoma.`,
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

      // Añadir favoritos no presentes en scrobbles
      for (const fav of favorites) {
        const key = fav.title.toLowerCase().trim();
        if (!localMap.has(key)) {
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
            studio: 'Favoritos',
            description: `Anime añadido a tus favoritos locales.`,
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
        message: 'No has vinculado tus cuentas de anime (AniList, MyAnimeList o Kitsu) ni reproducido animes en Plex todavía.',
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
      const isCacheValid = cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS && !forceRefresh;

      username = (activeProvider === 'MAL' ? malConn?.remoteUsername : activeProvider === 'KITSU' ? kitsuConn?.remoteUsername : anilistConn?.remoteUsername) || null;
      avatarUrl = (activeProvider === 'MAL' ? malConn?.avatarUrl : activeProvider === 'KITSU' ? kitsuConn?.avatarUrl : anilistConn?.avatarUrl) || null;

      if (isCacheValid && cached && cached.rawItems.length > 0) {
        rawItems = cached.rawItems;
        username = cached.username || username;
        avatarUrl = cached.avatarUrl || avatarUrl;
      } else if (activeProvider === 'MAL' && malConn?.encryptedAccessToken) {
      // Consultar MyAnimeList REST API v2
      try {
        const malToken = this.encryptionService.decrypt(malConn.encryptedAccessToken);
        const malRes = await axios.get(
          'https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,num_episodes,mean,status,genres,main_picture,alternative_titles,start_season,synopsis,studios&limit=1000',
          {
            headers: {
              Authorization: `Bearer ${malToken}`,
              'User-Agent': this.userAgent,
            },
            timeout: 9000,
          },
        );

        const dataEntries = malRes.data?.data || [];
        const fetchedItems: CatalogAnimeItem[] = [];

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

          const title = node.alternative_titles?.en || node.title || 'Sin Título';
          const romajiTitle = node.title || title;
          const episodesTotal = Number(node.num_episodes || 0);
          const episodesWatched = this.clampProgress(listStatus.num_episodes_watched, episodesTotal);

          let progressPercentage = 0;
          if (episodesTotal > 0) {
            progressPercentage = Math.min(100, Math.round((episodesWatched / episodesTotal) * 100));
          } else if (listStatus.status === 'completed') {
            progressPercentage = 100;
          }

          const remoteCover = node.main_picture?.large || node.main_picture?.medium || '';
          let coverUrl = remoteCover || '';
          if (node.id && remoteCover) {
            const safeKey = `mal_${node.id}`;
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
            seasonNumber: this.inferSeasonNumber(
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
        this.logger.error(`Error consultando MyAnimeList REST: ${malErr.message}`);
        if (cached) {
          rawItems = cached.rawItems;
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
            error: malErr.message || 'Error de conexión con MyAnimeList',
          };
        }
      }
    } else if (activeProvider === 'KITSU' && kitsuConn?.encryptedAccessToken) {
      // Consultar Kitsu JSON:API
      try {
        const kitsuItems = await this.kitsuService.getUserLibrary(userId);
        for (const item of kitsuItems) {
          if (item.kitsuId && item.coverUrl && !item.coverUrl.startsWith('/api/covers/')) {
            const safeKey = `kitsu_${item.kitsuId}`;
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
        this.logger.error(`Error consultando Kitsu: ${kitsuErr.message}`);
        if (cached) {
          rawItems = cached.rawItems;
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
            error: kitsuErr.message || 'Error de conexión con Kitsu',
          };
        }
      }
    } else if (anilistConn?.encryptedAccessToken) {
      // Consultar AniList GraphQL con query optimizada
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
          this.graphqlEndpoint,
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
              'User-Agent': this.userAgent,
            },
            timeout: 9000,
          },
        );

        if (response.data?.errors && response.data.errors.length > 0) {
          const errorMsg = response.data.errors[0]?.message || 'Error consultando catálogo en AniList';
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
              'Sin Título';

            const episodesTotal = Number(media.episodes || 0);
            const episodesWatched = this.clampProgress(entry.progress, episodesTotal);
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
              this.coversService.downloadAndSaveCover(safeKey, remoteCover).catch(() => {});
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
              seasonNumber: this.inferSeasonNumber(
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

        // Ordenar: CURRENT primero, luego fecha de actualización descendente
        fetchedItems.sort((a, b) => {
          if (a.status === 'CURRENT' && b.status !== 'CURRENT') return -1;
          if (a.status !== 'CURRENT' && b.status === 'CURRENT') return 1;
          return (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        });

        rawItems = fetchedItems;

        // Guardar en caché
        this.userCache.set(cacheKey, {
          timestamp: Date.now(),
          rawItems,
          username: username ?? null,
          avatarUrl: avatarUrl ?? null,
        });
      } catch (error: any) {
        this.logger.warn(`Modo local/desconectado o error al consultar catálogo (${error.message})`);
        if (cached) {
          rawItems = cached.rawItems;
        } else if ((options as any)?.demoMode === true) {
          rawItems = this.getMockCatalogItems(isPlexConnected, isAnilistConnected, isMalConnected);
        } else {
          rawItems = [];
        }
      }
    }
    }

    if (rawItems.length === 0 && (options as any)?.demoMode === true) {
      rawItems = this.getMockCatalogItems(isPlexConnected, isAnilistConnected, isMalConnected);
    }

    // Calcular contadores globales
    const allCount = rawItems.length;
    const watchingCount = rawItems.filter((i) => i.status === 'CURRENT').length;
    const completedCount = rawItems.filter((i) => i.status === 'COMPLETED').length;
    const planningCount = rawItems.filter((i) => i.status === 'PLANNING').length;
    const pausedCount = rawItems.filter((i) => i.status === 'PAUSED').length;
    const droppedCount = rawItems.filter((i) => i.status === 'DROPPED').length;

    // Aplicar filtros en memoria
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

    // Paginación precisa
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
      },
      items: paginatedItems,
    };
  }

  private async fetchFranchiseMetadata(anilistId?: number, malId?: number) {
    if (anilistId) {
      const cached = this.franchiseCache.get(anilistId);
      if (cached && Date.now() - cached.timestamp < this.FRANCHISE_CACHE_TTL_MS) {
        return cached.items;
      }
    }

    const mediaFields = `
      id
      idMal
      title { userPreferred romaji english native }
      format
      status
      description(asHtml: false)
      episodes
      season
      seasonYear
      averageScore
      genres
      coverImage { extraLarge large medium color }
      bannerImage
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { episode airingAt timeUntilAiring }
      relations { edges { relationType node { id } } }
    `;
    const requestGraphql = async (query: string, variables: Record<string, unknown>) => {
      const response = await axios.post(
        this.graphqlEndpoint,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
          timeout: 7000,
          maxContentLength: 2 * 1024 * 1024,
        },
      );
      if (response.data?.errors?.length) {
        throw new Error(response.data.errors[0]?.message || 'AniList rechazó la consulta de franquicia.');
      }
      return response.data?.data;
    };

    // AniList returns 404 when id and idMal are sent together, even if one is null.
    const seedQuery = anilistId
      ? `query ($id: Int) { Media(id: $id, type: ANIME) { ${mediaFields} } }`
      : `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${mediaFields} } }`;
    const seedData = await requestGraphql(
      seedQuery,
      anilistId ? { id: anilistId } : { idMal: malId },
    );
    const seed = seedData?.Media;
    if (!seed?.id) throw new NotFoundException('No se encontró la obra en AniList.');

    const cachedByResolvedId = this.franchiseCache.get(Number(seed.id));
    if (cachedByResolvedId && Date.now() - cachedByResolvedId.timestamp < this.FRANCHISE_CACHE_TTL_MS) {
      return cachedByResolvedId.items;
    }

    const seedId = Number(seed.id);
    const nodes = new Map<number, any>([[seedId, seed]]);
    const pending = new Set<number>();
    const processed = new Set<number>([seedId]);
    for (const edge of seed.relations?.edges || []) {
      if (['PREQUEL', 'SEQUEL'].includes(edge.relationType) && edge.node?.id) {
        pending.add(Number(edge.node.id));
      }
    }
    const maxNodes = 20;
    let rounds = 0;

    while (pending.size > 0 && nodes.size < maxNodes && rounds < 10) {
      const ids = [...pending].filter((id) => !processed.has(id)).slice(0, maxNodes - nodes.size);
      pending.clear();
      if (ids.length === 0) break;

      const batchQuery = `
        query ($ids: [Int]) {
          Page(page: 1, perPage: 25) {
            media(id_in: $ids, type: ANIME) { ${mediaFields} }
          }
        }
      `;
      const batchData = await requestGraphql(batchQuery, { ids });
      const mediaItems = batchData?.Page?.media || [];
      for (const media of mediaItems) {
        const mediaId = Number(media.id);
        processed.add(mediaId);
        nodes.set(mediaId, media);
        for (const edge of media.relations?.edges || []) {
          if (!['PREQUEL', 'SEQUEL'].includes(edge.relationType) || !edge.node?.id) continue;
          const relatedId = Number(edge.node.id);
          if (!processed.has(relatedId) && nodes.size + pending.size < maxNodes) pending.add(relatedId);
        }
      }
      rounds++;
    }

    const mainFormats = new Set(['TV', 'TV_SHORT', 'ONA']);
    const mainNodes = [...nodes.values()].filter(
      (media) => mainFormats.has(media.format) || Number(media.id) === Number(seed.id),
    );
    const mainIds = new Set(mainNodes.map((media) => Number(media.id)));
    const predecessors = new Map<number, Set<number>>();
    for (const media of mainNodes) predecessors.set(Number(media.id), new Set());
    for (const media of mainNodes) {
      const currentId = Number(media.id);
      for (const edge of media.relations?.edges || []) {
        const relatedId = Number(edge.node?.id);
        if (!mainIds.has(relatedId)) continue;
        if (edge.relationType === 'PREQUEL') predecessors.get(currentId)?.add(relatedId);
        if (edge.relationType === 'SEQUEL') predecessors.get(relatedId)?.add(currentId);
      }
    }

    const rankMemo = new Map<number, number>();
    const getRank = (id: number, visiting = new Set<number>()): number => {
      if (rankMemo.has(id)) return rankMemo.get(id)!;
      if (visiting.has(id)) return 1;
      const nextVisiting = new Set(visiting).add(id);
      const previous = [...(predecessors.get(id) || [])];
      const rank = previous.length > 0
        ? Math.max(...previous.map((predecessor) => getRank(predecessor, nextVisiting))) + 1
        : 1;
      rankMemo.set(id, rank);
      return rank;
    };

    const items = mainNodes
      .map((media) => {
        const title = media.title?.userPreferred || media.title?.romaji || media.title?.english || 'Sin título';
        return {
          ...media,
          seasonNumber: this.inferSeasonNumber(
            title,
            media.title?.romaji,
            media.title?.english,
            media.title?.native,
          ) || getRank(Number(media.id)),
        };
      })
      .sort((a, b) =>
        a.seasonNumber - b.seasonNumber
        || Number(a.seasonYear || 0) - Number(b.seasonYear || 0)
        || Number(a.id) - Number(b.id),
      );

    const timestamp = Date.now();
    for (const item of items) {
      this.franchiseCache.set(Number(item.id), { timestamp, items });
    }
    return items;
  }

  async getFranchise(
    userId: string,
    ids: { anilistId?: number; malId?: number; provider?: 'ANILIST' | 'MAL' | 'KITSU' },
  ) {
    const provider = ids.provider === 'MAL' ? 'MAL' : ids.provider === 'KITSU' ? 'KITSU' : 'ANILIST';
    const preferredCache = this.userCache.get(`${userId}_${provider}`)?.rawItems || [];
    const fallbackCache = this.userCache.get(`${userId}_${provider === 'MAL' ? 'ANILIST' : provider === 'KITSU' ? 'ANILIST' : 'MAL'}`)?.rawItems || [];
    const userItems = [...preferredCache, ...fallbackCache];

    let metadata: any[] = [];
    try {
      metadata = await this.fetchFranchiseMetadata(ids.anilistId, ids.malId);
    } catch (err: any) {
      this.logger.warn(`No se pudo consultar AniList para franquicia (${err.message}). Buscando coincidencias locales...`);
    }

    if (metadata && metadata.length > 0) {
      const seasons: CatalogAnimeItem[] = metadata.map((media) => {
        const existing = userItems.find((item) =>
          (!!item.anilistId && item.anilistId > 0 && item.anilistId === Number(media.id))
          || (!!item.malId && item.malId === Number(media.idMal)),
        );
        if (existing) {
          return {
            ...existing,
            anilistId: Number(media.id),
            malId: Number(media.idMal) || existing.malId,
            seasonNumber: Number(media.seasonNumber),
            inUserList: true,
          };
        }

        const title = media.title?.userPreferred || media.title?.romaji || media.title?.english || 'Sin título';
        const episodesTotal = Number(media.episodes || 0);
        const remoteCover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
        return {
          id: `related_${media.id}`,
          anilistId: Number(media.id),
          malId: Number(media.idMal) || undefined,
          title,
          romajiTitle: media.title?.romaji || title,
          englishTitle: media.title?.english || undefined,
          nativeTitle: media.title?.native || undefined,
          coverUrl: remoteCover,
          bannerUrl: media.bannerImage || undefined,
          coverColor: media.coverImage?.color || '#e5a00d',
          episodesTotal,
          episodesWatched: 0,
          progressPercentage: 0,
          status: 'NOT_IN_LIST',
          rating: 0,
          averageScore: Number(media.averageScore) || undefined,
          format: media.format || 'TV',
          season: media.season && media.seasonYear
            ? `${media.season} ${media.seasonYear}`
            : media.seasonYear ? String(media.seasonYear) : media.format || 'TV',
          seasonYear: Number(media.seasonYear) || undefined,
          seasonNumber: Number(media.seasonNumber),
          studio: media.studios?.nodes?.[0]?.name || 'Studio',
          genres: media.genres || [],
          description: media.description ? String(media.description).replace(/<[^>]*>?/gm, '') : '',
          syncedPlex: false,
          syncedAnilist: false,
          syncedMal: false,
          nextAiringEpisode: media.nextAiringEpisode || null,
          inUserList: false,
        };
      });

      return {
        seedAnilistId: Number(ids.anilistId || seasons.find((item) => item.malId === ids.malId)?.anilistId || 0),
        totalSeasons: seasons.length,
        seasons,
      };
    }

    // Fallback inteligente: buscar temporadas en la biblioteca del usuario por coincidencia de título base
    const currentItem = userItems.find((item) =>
      (ids.anilistId && item.anilistId === ids.anilistId) ||
      (ids.malId && item.malId === ids.malId),
    );

    if (currentItem) {
      const cleanBase = this.extractBaseTitle(currentItem.title || currentItem.romajiTitle);
      const related = userItems.filter((item) => {
        const itemBase = this.extractBaseTitle(item.title || item.romajiTitle);
        return cleanBase.length >= 4 && (itemBase.includes(cleanBase) || cleanBase.includes(itemBase));
      });

      if (related.length > 0) {
        related.sort((a, b) => (Number(a.seasonNumber || this.inferSeasonNumber(a.title))) - (Number(b.seasonNumber || this.inferSeasonNumber(b.title))));
        return {
          seedAnilistId: Number(ids.anilistId || currentItem.anilistId || 0),
          totalSeasons: related.length,
          seasons: related.map((r, idx) => ({
            ...r,
            seasonNumber: Number(r.seasonNumber || this.inferSeasonNumber(r.title) || idx + 1),
            inUserList: true,
          })),
        };
      }
    }

    return {
      seedAnilistId: Number(ids.anilistId || 0),
      totalSeasons: 1,
      seasons: currentItem ? [currentItem] : [],
    };
  }

  /**
   * 2. Actualizar progreso de episodios y/o calificación en todos los Trackers vinculados (AniList, MyAnimeList, etc.)
   */
  async updateProgressAndRating(
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

    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const isAdmin = user.role === 'ADMIN';
    const prefTracker = user.settings?.preferredTracker || 'BOTH';
    const canSyncAnilist = (isAdmin || (user.settings?.canSyncAnilist ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'ANILIST');
    const canSyncMal = (isAdmin || (user.settings?.canSyncMal ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'MAL');
    const canSyncKitsu = (isAdmin || (user.settings?.canSyncKitsu ?? true)) && (prefTracker === 'BOTH' || prefTracker === 'KITSU');

    const anilistConn = user.animeConnections.find((c) => c.provider === AnimeProvider.ANILIST && c.isConnected);
    const malConn = user.animeConnections.find((c) => c.provider === AnimeProvider.MAL && c.isConnected);
    const kitsuConn = user.animeConnections.find((c) => c.provider === AnimeProvider.KITSU && c.isConnected);

    let effectiveAnilistId = data.anilistMediaId;
    let effectiveMalId = data.malMediaId;
    let effectiveKitsuId = (data as any).kitsuMediaId;
    let resolvedTitle = data.showTitle || '';

    // 1. Si no tenemos MAL ID pero sí AniList ID, resolver MAL ID para sincronizar ambos
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
          this.logger.warn(`No se pudo resolver idMal desde AniList para ID ${effectiveAnilistId}: ${e.message}`);
        }
      }
    }

    // 2. Si no tenemos AniList ID pero sí MAL ID, resolver AniList ID para sincronizar ambos
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
          this.logger.warn(`No se pudo resolver AniList ID desde idMal ${effectiveMalId}: ${e.message}`);
        }
      }
    }

    // Persistir/actualizar el mapeo de títulos automáticamente
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

    // Mapeo de estados de reproducción
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

    // 3. Sincronizar en AniList si está conectado y permitido
    if (anilistConn && effectiveAnilistId) {
      if (!canSyncAnilist) {
        results.anilist = { success: false, error: 'Permiso canSyncAnilist revocado por el administrador.' };
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
          this.logger.error(`Error actualizando progreso en AniList: ${err.message}`);
          results.anilist = { success: false, error: err.message };
        }
      }
    }

    // 4. Sincronizar en MyAnimeList si está conectado y permitido
    if (malConn && effectiveMalId) {
      if (!canSyncMal) {
        results.mal = { success: false, error: 'Permiso canSyncMal revocado por el administrador.' };
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
          this.logger.error(`Error actualizando progreso en MyAnimeList: ${err.message}`);
          results.mal = { success: false, error: err.message };
        }
      }
    }

    // 5. Sincronizar en Kitsu si está conectado y permitido
    const kitsuResults: { success?: boolean; error?: string } = {};
    if (kitsuConn) {
      if (!canSyncKitsu) {
        kitsuResults.success = false;
        kitsuResults.error = 'Permiso canSyncKitsu revocado por el administrador.';
      } else {
        try {
          let kitsuAnimeId = effectiveKitsuId;
          if (!kitsuAnimeId && resolvedTitle) {
            const searchRes = await this.kitsuService.searchAnime(resolvedTitle, 1);
            if (searchRes?.[0]?.kitsuId) {
              kitsuAnimeId = searchRes[0].kitsuId;
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
          this.logger.error(`Error actualizando progreso en Kitsu: ${err.message}`);
          kitsuResults.success = false;
          kitsuResults.error = err.message;
        }
      }
    }

    // 6. Registrar en ScrobbleHistory
    if (data.progress !== undefined) {
      // Sin esto, una sincronización fallida por esta vía quedaba registrada como
      // FAILED con el mensaje vacío: el panel contaba el fallo pero no había forma
      // de saber por qué. Los errores ya venían en los resultados individuales,
      // solo faltaba recogerlos.
      const motivosFallo = [
        results.anilist && !results.anilist.success && anilistConn
          ? `AniList: ${results.anilist.error || results.anilist.reason || 'error no especificado'}`
          : null,
        results.mal && !results.mal.success && malConn
          ? `MAL: ${results.mal.error || results.mal.reason || 'error no especificado'}`
          : null,
        !kitsuResults.success && kitsuConn
          ? `Kitsu: ${kitsuResults.error || 'error no especificado'}`
          : null,
      ].filter(Boolean);

      await this.prisma.scrobbleHistory.create({
        data: {
          userId,
          showTitle: resolvedTitle || (effectiveAnilistId ? `AniList #${effectiveAnilistId}` : `MAL #${effectiveMalId}`),
          episodeNumber: data.progress,
          seasonNumber: Number.isInteger(Number(data.seasonNumber))
            ? Math.max(1, Math.min(50, Number(data.seasonNumber)))
            : 1,
          viewPercentage: 100,
          rating: data.score,
          anilistStatus: results.anilist?.success ? SyncStatus.SUCCESS : anilistConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
          malStatus: results.mal?.success ? SyncStatus.SUCCESS : malConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
          kitsuStatus: kitsuResults.success ? SyncStatus.SUCCESS : kitsuConn ? SyncStatus.FAILED : SyncStatus.SKIPPED,
          errorMessage: motivosFallo.length ? motivosFallo.join(' | ').slice(0, 500) : null,
          viewedAt: new Date(),
        },
      }).catch((err) => {
        // Si el propio registro falla, al menos que quede en el log.
        this.logger.warn(`No se pudo registrar el scrobble en el historial: ${err.message}`);
      });
    }

    // 7. Invalidar todos los cachés del usuario para reflejar los cambios en vivo en todas las pestañas
    this.userCache.delete(`${userId}_ANILIST`);
    this.userCache.delete(`${userId}_MAL`);
    this.userCache.delete(`${userId}_KITSU`);

    const updatedTrackers: string[] = [];
    if (results.anilist?.success) updatedTrackers.push('AniList');
    if (results.mal?.success) updatedTrackers.push('MyAnimeList');
    if (kitsuResults.success) updatedTrackers.push('Kitsu');

    return {
      success: updatedTrackers.length > 0 || (!anilistConn && !malConn && !kitsuConn),
      results: { ...results, kitsu: kitsuResults },
      updatedTrackers,
      message: updatedTrackers.length > 0
        ? `Anime sincronizado con éxito en ${updatedTrackers.join(' & ')}`
        : 'Progreso guardado localmente.',
    };
  }

  /**
   * Generar lista mock de animes realistas para entorno local y de pruebas
   */
  private getMockCatalogItems(isPlexConnected: boolean, isAnilistConnected: boolean, isMalConnected: boolean): CatalogAnimeItem[] {
    return [
      {
        id: 'mock_154587',
        anilistId: 154587,
        malId: 52991,
        title: 'Frieren: Beyond Journey\'s End',
        romajiTitle: 'Sousou no Frieren',
        englishTitle: 'Frieren: Beyond Journey\'s End',
        nativeTitle: '葬送のフリーレン',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        coverColor: '#589cd4',
        episodesTotal: 28,
        episodesWatched: 28,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 10,
        averageScore: 94,
        format: 'TV',
        season: 'FALL 2023',
        seasonYear: 2023,
        studio: 'Madhouse',
        genres: ['Adventure', 'Drama', 'Fantasy'],
        description: 'Tras derrotar al Rey Demonio junto a su grupo de héroes, la elfa Frieren emprende un viaje para comprender mejor a la humanidad y el paso del tiempo.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_145064',
        anilistId: 145064,
        malId: 51009,
        title: 'Jujutsu Kaisen Season 2',
        romajiTitle: 'Jujutsu Kaisen 2nd Season',
        englishTitle: 'JUJUTSU KAISEN Season 2',
        nativeTitle: '呪術廻戦 懐玉・玉折／渋谷事変',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1792/138022l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1792/138022l.jpg',
        coverColor: '#2b58a6',
        episodesTotal: 23,
        episodesWatched: 23,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 89,
        format: 'TV',
        season: 'SUMMER 2023',
        seasonYear: 2023,
        studio: 'MAPPA',
        genres: ['Action', 'Fantasy', 'Supernatural'],
        description: 'La juventud de Satoru Gojo y Suguru Geto da paso al cataclísmico incidente de Shibuya que cambiará el mundo de los hechiceros.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_151807',
        anilistId: 151807,
        malId: 52299,
        title: 'Solo Leveling',
        romajiTitle: 'Ore dake Level Up na Ken',
        englishTitle: 'Solo Leveling',
        nativeTitle: '俺だけレベルアップな件',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1801/142390l.webp',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1801/142390l.webp',
        coverColor: '#1a3068',
        episodesTotal: 12,
        episodesWatched: 12,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 84,
        format: 'TV',
        season: 'WINTER 2024',
        seasonYear: 2024,
        studio: 'A-1 Pictures',
        genres: ['Action', 'Adventure', 'Fantasy'],
        description: 'El cazador de rango E Sung Jinwoo obtiene un sistema de misiones secreto que le permite subir de nivel sin límites.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_166240',
        anilistId: 166240,
        malId: 55701,
        title: 'Demon Slayer: Hashira Training Arc',
        romajiTitle: 'Kimetsu no Yaiba: Hashira Geiko-hen',
        englishTitle: 'Demon Slayer: Kimetsu no Yaiba Hashira Training Arc',
        nativeTitle: '鬼滅の刃 柱稽古編',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1565/142711l.webp',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1565/142711l.webp',
        coverColor: '#e03e3e',
        episodesTotal: 8,
        episodesWatched: 8,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 85,
        format: 'TV',
        season: 'SPRING 2024',
        seasonYear: 2024,
        studio: 'ufotable',
        genres: ['Action', 'Fantasy', 'Supernatural'],
        description: 'Tanjiro y el Cuerpo de Cazadores de Demonios inician el exhaustivo entrenamiento bajo la tutela directa de los Pilares.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_166531',
        anilistId: 166531,
        malId: 55791,
        title: '【OSHI NO KO】Season 2',
        romajiTitle: 'Oshi no Ko 2nd Season',
        englishTitle: '【OSHI NO KO】Season 2',
        nativeTitle: '【推しの子】第2期',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1006/143302l.webp',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1006/143302l.webp',
        coverColor: '#d63384',
        episodesTotal: 13,
        episodesWatched: 8,
        progressPercentage: 62,
        status: 'CURRENT',
        rating: 9,
        averageScore: 87,
        format: 'TV',
        season: 'SUMMER 2024',
        seasonYear: 2024,
        studio: 'Doga Kobo',
        genres: ['Drama', 'Mystery', 'Psychological'],
        description: 'Aqua y Akane participan en la adaptación teatral 2.5D de Tokyo Blade mientras continúan desentrañando el misterio de Ai.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        nextAiringEpisode: { episode: 9, airingAt: Math.floor(Date.now() / 1000) + 86400 * 2, timeUntilAiring: 86400 * 2 },
      },
      {
        id: 'mock_130003',
        anilistId: 130003,
        malId: 47917,
        title: 'BOCCHI THE ROCK!',
        romajiTitle: 'Bocchi the Rock!',
        englishTitle: 'BOCCHI THE ROCK!',
        nativeTitle: 'ぼっち・ざ・ろっく！',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1448/127956l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1448/127956l.jpg',
        coverColor: '#e91e63',
        episodesTotal: 12,
        episodesWatched: 12,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 10,
        averageScore: 89,
        format: 'TV',
        season: 'FALL 2022',
        seasonYear: 2022,
        studio: 'CloverWorks',
        genres: ['Comedy', 'Music', 'Slice of Life'],
        description: 'Hitori Gotoh, una guitarrista con extrema timidez y ansiedad social, se une a la banda Kessoku Band.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_153518',
        anilistId: 153518,
        malId: 52701,
        title: 'Delicious in Dungeon',
        romajiTitle: 'Dungeon Meshi',
        englishTitle: 'Delicious in Dungeon',
        nativeTitle: 'ダンジョン飯',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1441/122795l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1441/122795l.jpg',
        coverColor: '#d48806',
        episodesTotal: 24,
        episodesWatched: 18,
        progressPercentage: 75,
        status: 'CURRENT',
        rating: 9,
        averageScore: 86,
        format: 'TV',
        season: 'WINTER 2024',
        seasonYear: 2024,
        studio: 'Trigger',
        genres: ['Adventure', 'Comedy', 'Fantasy', 'Gourmet'],
        description: 'Para rescatar a su hermana antes de que sea digerida por un dragón, Laios y su grupo aprenden a cocinar monstruos de la mazmorra.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_153288',
        anilistId: 153288,
        malId: 52588,
        title: 'Kaiju No. 8',
        romajiTitle: 'Kaijuu 8-gou',
        englishTitle: 'Kaiju No. 8',
        nativeTitle: '怪獣8号',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        coverColor: '#00a8ff',
        episodesTotal: 12,
        episodesWatched: 4,
        progressPercentage: 33,
        status: 'CURRENT',
        rating: 8,
        averageScore: 82,
        format: 'TV',
        season: 'SPRING 2024',
        seasonYear: 2024,
        studio: 'Production I.G',
        genres: ['Action', 'Sci-Fi'],
        description: 'Kafka Hibino adquiere la habilidad de convertirse en Kaiju mientras intenta cumplir su promesa de unirse a la Fuerza de Defensa.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_127230',
        anilistId: 127230,
        malId: 44511,
        title: 'Chainsaw Man',
        romajiTitle: 'Chainsaw Man',
        englishTitle: 'Chainsaw Man',
        nativeTitle: 'チェンソーマン',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        coverColor: '#ff5722',
        episodesTotal: 12,
        episodesWatched: 12,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 86,
        format: 'TV',
        season: 'FALL 2022',
        seasonYear: 2022,
        studio: 'MAPPA',
        genres: ['Action', 'Horror', 'Supernatural'],
        description: 'Denji vive en la pobreza extrema hasta fusionarse con su perro demoníaco Pochita, convirtiéndose en Chainsaw Man.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_166873',
        anilistId: 166873,
        malId: 55888,
        title: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2',
        romajiTitle: 'Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2',
        englishTitle: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2',
        nativeTitle: '無職転生Ⅱ ～異世界行ったら本気だす～ 第2クール',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1876/141251l.webp',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1876/141251l.webp',
        coverColor: '#4caf50',
        episodesTotal: 12,
        episodesWatched: 12,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 86,
        format: 'TV',
        season: 'SPRING 2024',
        seasonYear: 2024,
        studio: 'Studio Bind',
        genres: ['Adventure', 'Drama', 'Fantasy'],
        description: 'Rudeus viaja al continente de Begaritt para rescatar a su madre Zenith en el laberinto de teletransporte.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_140960',
        anilistId: 140960,
        malId: 50265,
        title: 'Spy x Family',
        romajiTitle: 'SPY×FAMILY',
        englishTitle: 'SPY x FAMILY',
        nativeTitle: 'スパイファミリー',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1441/122795l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1441/122795l.jpg',
        coverColor: '#009688',
        episodesTotal: 25,
        episodesWatched: 25,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 9,
        averageScore: 85,
        format: 'TV',
        season: 'SPRING 2022',
        seasonYear: 2022,
        studio: 'WIT Studio & CloverWorks',
        genres: ['Action', 'Comedy', 'Supernatural'],
        description: 'El agente Twilight forma una familia falsa con una asesina a sueldo y una niña telépata para cumplir su misión de paz mundial.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 90 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_9253',
        anilistId: 9253,
        malId: 9253,
        title: 'Steins;Gate',
        romajiTitle: 'Steins;Gate',
        englishTitle: 'Steins;Gate',
        nativeTitle: 'シュタインズ・ゲート',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg',
        coverColor: '#673ab7',
        episodesTotal: 24,
        episodesWatched: 24,
        progressPercentage: 100,
        status: 'COMPLETED',
        rating: 10,
        averageScore: 91,
        format: 'TV',
        season: 'SPRING 2011',
        seasonYear: 2011,
        studio: 'White Fox',
        genres: ['Drama', 'Psychological', 'Sci-Fi', 'Thriller'],
        description: 'Rintaro Okabe inventa accidentalmente un dispositivo capaz de enviar mensajes de texto al pasado, desatando consecuencias mortales.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 120 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_170001',
        anilistId: 170001,
        malId: 58001,
        title: 'Chainsaw Man: Reze Arc Movie',
        romajiTitle: 'Chainsaw Man: Gekijouban Reze-hen',
        englishTitle: 'Chainsaw Man - The Movie: Reze Arc',
        nativeTitle: '劇場版 チェンソーマン レゼ篇',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        coverColor: '#e91e63',
        episodesTotal: 1,
        episodesWatched: 0,
        progressPercentage: 0,
        status: 'PLANNING',
        rating: 0,
        averageScore: 90,
        format: 'MOVIE',
        season: '2025',
        seasonYear: 2025,
        studio: 'MAPPA',
        genres: ['Action', 'Horror', 'Romance'],
        description: 'Denji conoce a una misteriosa chica en un café durante una tarde lluviosa, dando inicio al arco de la Bomba.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
      {
        id: 'mock_171002',
        anilistId: 171002,
        malId: 58102,
        title: 'Sousou no Frieren Season 2',
        romajiTitle: 'Sousou no Frieren 2nd Season',
        englishTitle: 'Frieren: Beyond Journey\'s End Season 2',
        nativeTitle: '葬送のフリーレン 第2期',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        coverColor: '#00bcd4',
        episodesTotal: 24,
        episodesWatched: 0,
        progressPercentage: 0,
        status: 'PLANNING',
        rating: 0,
        averageScore: 93,
        format: 'TV',
        season: '2025',
        seasonYear: 2025,
        studio: 'Madhouse',
        genres: ['Adventure', 'Drama', 'Fantasy'],
        description: 'La segunda temporada que continúa el viaje de Frieren, Fern y Stark hacia las tierras del norte y Aureole.',
        syncedPlex: true,
        syncedAnilist: true,
        syncedMal: true,
        updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        nextAiringEpisode: null,
      },
    ];
  }

  /**
   * Obtener estadísticas consolidadas de visualización del usuario (Tracker Autónomo)
   */
  async getUserStats(userId: string) {
    const [scrobbles, favoritesCount, mappings] = await Promise.all([
      this.prisma.scrobbleHistory.findMany({
        where: { userId },
        orderBy: { viewedAt: 'desc' },
      }),
      this.prisma.userFavorite.count({ where: { userId } }),
      this.prisma.titleMapping.findMany({
        where: { userId },
        select: { plexTitle: true, anilistTitle: true },
      }),
    ]);

    const totalEpisodes = scrobbles.length;
    const totalMinutes = totalEpisodes * 24; // 24 minutos por episodio promedio de anime
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const totalDays = Math.round((totalHours / 24) * 10) / 10;

    // Conteo de series únicas
    const uniqueShows = new Set(scrobbles.map((s) => s.showTitle.toLowerCase().trim()));
    const totalShows = uniqueShows.size;

    // Puntuación media
    const ratedScrobbles = scrobbles.filter((s) => s.rating && s.rating > 0);
    const meanScore = ratedScrobbles.length > 0
      ? Math.round((ratedScrobbles.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedScrobbles.length) * 10) / 10
      : 8.5; // default representativo

    // Animes completados (estimación basada en número de episodios o estado)
    const completedCount = scrobbles.filter((s) => s.viewPercentage >= 90).length > 0
      ? Math.max(1, Math.floor(totalShows * 0.4))
      : 0;

    // Distribución de Géneros Top
    const genreCounts: Record<string, number> = {
      'Action': Math.max(1, Math.round(totalEpisodes * 0.35)),
      'Shounen': Math.max(1, Math.round(totalEpisodes * 0.28)),
      'Fantasy': Math.max(1, Math.round(totalEpisodes * 0.22)),
      'Drama': Math.max(1, Math.round(totalEpisodes * 0.15)),
      'Comedy': Math.max(1, Math.round(totalEpisodes * 0.12)),
    };

    const totalGenreHits = Object.values(genreCounts).reduce((a, b) => a + b, 0);
    const topGenres = Object.entries(genreCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalGenreHits > 0 ? Math.round((count / totalGenreHits) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEpisodes,
      totalHours,
      totalDays,
      totalShows,
      completedCount,
      watchingCount: Math.max(1, totalShows - completedCount),
      meanScore,
      favoritesCount,
      topGenres,
    };
  }

  /**
   * Conmutar anime favorito (marcar/desmarcar)
   */
  async toggleFavorite(
    userId: string,
    data: {
      animeId: string;
      title: string;
      coverUrl?: string;
      genres?: string[];
    },
  ) {
    const existing = await this.prisma.userFavorite.findUnique({
      where: {
        userId_animeId: {
          userId,
          animeId: String(data.animeId),
        },
      },
    });

    if (existing) {
      await this.prisma.userFavorite.delete({
        where: { id: existing.id },
      });
      return { isFavorite: false, message: 'Eliminado de favoritos.' };
    } else {
      await this.prisma.userFavorite.create({
        data: {
          userId,
          animeId: String(data.animeId),
          title: data.title,
          coverUrl: data.coverUrl || null,
          genres: data.genres || [],
        },
      });
      return { isFavorite: true, message: 'Añadido a favoritos.' };
    }
  }

  /**
   * Obtener lista de animes favoritos del usuario
   */
  async getFavorites(userId: string) {
    return this.prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Exportar biblioteca y progreso de animes del usuario en formatos estándar (MAL XML, JSON, CSV)
   */
  async exportAnimeData(userId: string, format: 'mal_xml' | 'json' | 'csv' = 'mal_xml') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

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
        where: { userId },
      }),
    ]);

    // Agrupar por showTitle
    const showMap = new Map<string, {
      title: string;
      episodesWatched: number;
      seasonNumber: number;
      viewPercentage: number;
      rating: number;
      status: string;
      malId?: number;
      anilistId?: number;
      updatedAt: Date;
    }>();

    for (const s of scrobbles) {
      const key = s.showTitle.toLowerCase().trim();
      const mapping = mappings.find((m) => m.plexTitle.toLowerCase().trim() === key);
      const existing = showMap.get(key);

      const epNum = Number(s.episodeNumber || 1);
      const watched = existing ? Math.max(existing.episodesWatched, epNum) : epNum;
      const score = Math.round(Number(s.rating || existing?.rating || 0));
      const status = s.viewPercentage >= 85 ? 'Completed' : 'Watching';

      showMap.set(key, {
        title: s.showTitle,
        episodesWatched: watched,
        seasonNumber: s.seasonNumber || 1,
        viewPercentage: s.viewPercentage,
        rating: score,
        status,
        malId: mapping?.malMediaId || undefined,
        anilistId: mapping?.anilistMediaId || undefined,
        updatedAt: s.viewedAt,
      });
    }

    // Añadir favoritos no reproducidos como 'Plan to Watch'
    for (const f of favorites) {
      const key = f.title.toLowerCase().trim();
      if (!showMap.has(key)) {
        showMap.set(key, {
          title: f.title,
          episodesWatched: 0,
          seasonNumber: 1,
          viewPercentage: 0,
          rating: 0,
          status: 'Plan to Watch',
          updatedAt: f.createdAt,
        });
      }
    }

    const items = Array.from(showMap.values());
    const username = user?.username || 'SyncSekaiUser';

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `plexsync_anime_export_${username}_${Date.now()}.json`,
        content: JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            platform: 'SyncSekai',
            username,
            totalItems: items.length,
            anime: items,
          },
          null,
          2,
        ),
      };
    }

    if (format === 'csv') {
      const rows = [
        ['Title', 'Episodes Watched', 'Season', 'Status', 'Score', 'Last Updated'],
        ...items.map((i) => [
          `"${i.title.replace(/"/g, '""')}"`,
          i.episodesWatched,
          i.seasonNumber,
          `"${i.status}"`,
          i.rating,
          `"${i.updatedAt.toISOString()}"`,
        ]),
      ];
      return {
        contentType: 'text/csv',
        filename: `plexsync_anime_export_${username}_${Date.now()}.csv`,
        content: rows.map((r) => r.join(',')).join('\n'),
      };
    }

    // Default: MAL XML Standard (Universal format supported by MAL, AniList, Kitsu, and Anime-Planet import)
    const watchingCount = items.filter((i) => i.status === 'Watching').length;
    const completedCount = items.filter((i) => i.status === 'Completed').length;
    const plannedCount = items.filter((i) => i.status === 'Plan to Watch').length;

    const animeNodes = items
      .map((i) => {
        return `  <anime>
    <series_animedb_id>${i.malId || 0}</series_animedb_id>
    <series_title><![CDATA[${i.title}]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>${Math.max(i.episodesWatched, 12)}</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>${i.episodesWatched}</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>${i.rating}</my_score>
    <my_status>${i.status}</my_status>
    <my_times_watched>1</my_times_watched>
    <my_tags><![CDATA[Exported from SyncSekai]]></my_tags>
    <update_on_import>1</update_on_import>
  </anime>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!--
  Exported from SyncSekai
  Universal MyAnimeList / AniList / Kitsu XML Import Specification
-->
<myanimelist>
  <myinfo>
    <user_id>1</user_id>
    <user_name>${username}</user_name>
    <user_export_type>1</user_export_type>
    <user_total_anime>${items.length}</user_total_anime>
    <user_total_watching>${watchingCount}</user_total_watching>
    <user_total_completed>${completedCount}</user_total_completed>
    <user_total_onhold>0</user_total_onhold>
    <user_total_dropped>0</user_total_dropped>
    <user_total_plantowatch>${plannedCount}</user_total_plantowatch>
  </myinfo>
${animeNodes}
</myanimelist>`;

    return {
      contentType: 'application/xml',
      filename: `plexsync_mal_export_${username}_${Date.now()}.xml`,
      content: xml,
    };
  }

  /**
   * Importar animes y progreso desde archivos de exportación externos (MAL XML, AniList JSON, CSV)
   */
  async importAnimeData(userId: string, rawData: string) {
    if (!rawData || !rawData.trim()) {
      throw new BadRequestException('El contenido del archivo a importar está vacío.');
    }

    const trimmed = rawData.trim();
    let importedCount = 0;
    let favoritesCount = 0;

    // Caso 1: Archivo XML estándar de MyAnimeList / Kitsu / AniList
    if (trimmed.startsWith('<?xml') || trimmed.includes('<myanimelist>') || trimmed.includes('<anime>')) {
      const animeBlocks = trimmed.split(/<\/?anime>/).filter((b) => b.includes('<series_title>'));

      for (const block of animeBlocks) {
        const titleMatch = block.match(/<series_title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/series_title>/);
        const epMatch = block.match(/<my_watched_episodes>(\d+)<\/my_watched_episodes>/);
        const scoreMatch = block.match(/<my_score>(\d+)<\/my_score>/);
        const statusMatch = block.match(/<my_status>(.*?)<\/my_status>/);

        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].trim();
          const epWatched = epMatch ? parseInt(epMatch[1], 10) : 1;
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
          const status = statusMatch ? statusMatch[1].trim().toLowerCase() : 'completed';

          if (status === 'plan to watch' || epWatched === 0) {
            await this.prisma.userFavorite.upsert({
              where: {
                userId_animeId: {
                  userId,
                  animeId: String(Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                },
              },
              create: {
                userId,
                animeId: String(Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                title,
                genres: ['Imported'],
              },
              update: {},
            });
            favoritesCount++;
          } else {
            await this.prisma.scrobbleHistory.create({
              data: {
                userId,
                showTitle: title,
                episodeNumber: Math.max(1, epWatched),
                seasonNumber: 1,
                viewPercentage: status === 'completed' ? 100 : 85,
                rating: score > 0 ? score : null,
                viewedAt: new Date(),
              },
            });
            importedCount++;
          }
        }
      }
    }
    // Caso 2: Archivo JSON (SyncSekai / AniList / Kitsu)
    else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : parsed.anime || parsed.items || [];

        for (const item of list) {
          const title = item.title || item.name || item.series_title;
          if (!title) continue;

          const epWatched = item.episodesWatched || item.episodeNumber || item.progress || 1;
          const score = item.rating || item.score || null;

          if (item.status === 'PLANNING' || item.status === 'Plan to Watch' || epWatched === 0) {
            await this.prisma.userFavorite.upsert({
              where: {
                userId_animeId: {
                  userId,
                  animeId: String(item.id || Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                },
              },
              create: {
                userId,
                animeId: String(item.id || Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                title,
                coverUrl: item.coverUrl || null,
                genres: item.genres || ['Imported'],
              },
              update: {},
            });
            favoritesCount++;
          } else {
            await this.prisma.scrobbleHistory.create({
              data: {
                userId,
                showTitle: title,
                episodeNumber: Math.max(1, Number(epWatched)),
                seasonNumber: Number(item.seasonNumber || item.season || 1),
                viewPercentage: 100,
                rating: score ? Number(score) : null,
                viewedAt: new Date(),
              },
            });
            importedCount++;
          }
        }
      } catch (err: any) {
        throw new BadRequestException('El formato JSON no es válido: ' + err.message);
      }
    }
    // Caso 3: Archivo CSV
    else {
      const lines = trimmed.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2) {
          const title = cols[0];
          const epWatched = parseInt(cols[1], 10) || 1;
          const score = parseInt(cols[4], 10) || null;

          await this.prisma.scrobbleHistory.create({
            data: {
              userId,
              showTitle: title,
              episodeNumber: Math.max(1, epWatched),
              seasonNumber: 1,
              viewPercentage: 100,
              rating: score,
              viewedAt: new Date(),
            },
          });
          importedCount++;
        }
      }
    }

    this.invalidateUserCache(userId);

    return {
      success: true,
      importedCount,
      favoritesCount,
      totalProcessed: importedCount + favoritesCount,
      message: `Se importaron ${importedCount} series al historial y ${favoritesCount} a tu lista de favoritos/planeados.`,
    };
  }

  /**
   * Limpiar caché de un usuario
   */
  invalidateUserCache(userId: string) {
    this.userCache.delete(userId);
  }
}
