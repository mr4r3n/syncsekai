import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CoversService } from './covers.service';

/**
 * Titles (English, romaji, native) and MAL id of AniList anime, requested in
 * batches and kept in memory. Used by the panel's cover listing.
 */
@Injectable()
export class AnimeMetadataService {
  private readonly logger = new Logger(AnimeMetadataService.name);

  constructor(private coversService: CoversService) {}

  private animeMetaCache = new Map<number, { english: string; romaji: string; native: string; malId: number | null }>();

  async batchFetchAnimeMetadata(ids: number[]): Promise<Map<number, { english: string; romaji: string; native: string; malId: number | null }>> {
    const missing = ids.filter((id) => id > 0 && !this.animeMetaCache.has(id));
    if (missing.length > 0) {
      for (let i = 0; i < missing.length; i += 50) {
        const chunk = missing.slice(i, i + 50);
        try {
          const query = `
            query ($ids: [Int]) {
              Page(page: 1, perPage: 50) {
                media(id_in: $ids, type: ANIME) {
                  id
                  idMal
                  title {
                    english
                    romaji
                    native
                  }
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { ids: chunk } },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              },
              timeout: 6000,
            },
          );
          const list = res.data?.data?.Page?.media || [];
          for (const item of list) {
            this.animeMetaCache.set(item.id, {
              english: item.title?.english || '',
              romaji: item.title?.romaji || '',
              native: item.title?.native || '',
              malId: item.idMal || null,
            });
            if (item.idMal) this.coversService.registerAlias(`mal_${item.idMal}`, `al_${item.id}`);
          }
        } catch (e: any) {
          this.logger.warn(`Error in batchFetchAnimeMetadata (AniList): ${e.message}. Querying Kitsu...`);
          // Fall back to Kitsu so the titles are not left empty
          for (const id of chunk) {
            if (!this.animeMetaCache.has(id)) {
              try {
                const kRes = await axios.get(
                  `https://kitsu.io/api/edge/mappings?filter[external_site]=anilist/anime&filter[external_id]=${id}&include=item`,
                  {
                    headers: {
                      Accept: 'application/vnd.api+json',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    },
                    timeout: 4000,
                  },
                );
                const item = kRes.data?.included?.[0]?.attributes;
                if (item) {
                  this.animeMetaCache.set(id, {
                    english: item.titles?.en || item.canonicalTitle || '',
                    romaji: item.titles?.en_jp || item.canonicalTitle || '',
                    native: item.titles?.ja_jp || '',
                    malId: null,
                  });
                }
              } catch {}
            }
          }
        }
      }
    }
    return this.animeMetaCache;
  }

  /**
   * Whatever is already in memory, without touching the network.
   *
   * Whoever renders a screen needs to answer now; missing titles will appear on
   * the next load, once `preloadAnimeMetadata` has fetched them. A file without
   * a title is shown by its name, which is enough information to manage it.
   */
  getCachedMetadata(ids: number[]) {
    const found = new Map<number, { english: string; romaji: string; native: string; malId: number | null }>();
    for (const id of ids) {
      const meta = this.animeMetaCache.get(id);
      if (meta) found.set(id, meta);
    }
    return found;
  }

  private preloadInFlight: Promise<unknown> | null = null;

  /**
   * Fills the cache in the background, outside the request: with an empty cache,
   * resolving metadata inline takes minutes and the proxy times out first.
   * Only one preload at a time. The cache lives in memory and is lost on
   * restart.
   */
  preloadAnimeMetadata(ids: number[]): void {
    if (this.preloadInFlight) return;
    const missing = ids.filter((id) => id > 0 && !this.animeMetaCache.has(id));
    if (missing.length === 0) return;

    this.preloadInFlight = this.batchFetchAnimeMetadata(missing)
      .catch((e: any) => {
        // Nobody awaits this promise: without this catch, a failure here would be an
        // unhandled rejection and would take the process down.
        this.logger.warn(`Background metadata preload failed: ${e?.message || e}`);
      })
      .finally(() => {
        this.preloadInFlight = null;
      });
  }
}
