import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { CatalogAnimeItem, CatalogService } from './catalog.service';
import { inferSeasonNumber, ANILIST_GRAPHQL_ENDPOINT, BROWSER_USER_AGENT, extractBaseTitle } from './catalog-utils';

interface FranchiseCacheEntry {
  timestamp: number;
  items: any[];
}

/** An anime's franchise: related seasons and entries on AniList. */
@Injectable()
export class FranchiseService {
  private readonly logger = new Logger(FranchiseService.name);

  private readonly franchiseCache = new Map<number, FranchiseCacheEntry>();
  private readonly FRANCHISE_CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(
    private catalogService: CatalogService,
  ) {}

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
        ANILIST_GRAPHQL_ENDPOINT,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': BROWSER_USER_AGENT,
          },
          timeout: 7000,
          maxContentLength: 2 * 1024 * 1024,
        },
      );
      if (response.data?.errors?.length) {
        throw new Error(response.data.errors[0]?.message || 'AniList rejected the franchise query.');
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
    if (!seed?.id) throw new NotFoundException('The title was not found on AniList.');

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
        const title = media.title?.userPreferred || media.title?.romaji || media.title?.english || 'Untitled';
        return {
          ...media,
          seasonNumber: inferSeasonNumber(
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
    const preferredCache = this.catalogService.userCache.get(`${userId}_${provider}`)?.rawItems || [];
    const fallbackCache = this.catalogService.userCache.get(`${userId}_${provider === 'MAL' ? 'ANILIST' : provider === 'KITSU' ? 'ANILIST' : 'MAL'}`)?.rawItems || [];
    const userItems = [...preferredCache, ...fallbackCache];

    let metadata: any[] = [];
    try {
      metadata = await this.fetchFranchiseMetadata(ids.anilistId, ids.malId);
    } catch (err: any) {
      this.logger.warn(`Could not query AniList for the franchise (${err.message}). Looking for local matches...`);
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

        const title = media.title?.userPreferred || media.title?.romaji || media.title?.english || 'Untitled';
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

    // Fallback: look for seasons in the user's library by base title match
    const currentItem = userItems.find((item) =>
      (ids.anilistId && item.anilistId === ids.anilistId) ||
      (ids.malId && item.malId === ids.malId),
    );

    if (currentItem) {
      const cleanBase = extractBaseTitle(currentItem.title || currentItem.romajiTitle);
      const related = userItems.filter((item) => {
        const itemBase = extractBaseTitle(item.title || item.romajiTitle);
        return cleanBase.length >= 4 && (itemBase.includes(cleanBase) || cleanBase.includes(itemBase));
      });

      if (related.length > 0) {
        related.sort((a, b) => (Number(a.seasonNumber || inferSeasonNumber(a.title))) - (Number(b.seasonNumber || inferSeasonNumber(b.title))));
        return {
          seedAnilistId: Number(ids.anilistId || currentItem.anilistId || 0),
          totalSeasons: related.length,
          seasons: related.map((r, idx) => ({
            ...r,
            seasonNumber: Number(r.seasonNumber || inferSeasonNumber(r.title) || idx + 1),
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
}
