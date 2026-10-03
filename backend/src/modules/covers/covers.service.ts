import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { detectImageType } from '../../common/security/image-file';
import * as crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';

/**
 * The cover URL of an AniList anime. The title always goes along: it is what
 * the last step of the resolution chain (title search on Kitsu) needs when
 * AniList does not answer.
 */
export function anilistCoverUrl(anilistId: number, title?: string | null): string {
  const base = `/api/covers/al_${anilistId}`;
  return title ? `${base}?title=${encodeURIComponent(title)}` : base;
}

@Injectable()
export class CoversService {
  private readonly logger = new Logger(CoversService.name);
  private readonly coversDir = path.join(process.cwd(), 'uploads', 'covers');
  private memoryMap = new Map<string, string>(); // key -> relative web URL
  /**
   * The same anime arrives with up to four keys (al_, mal_, kitsu_, title_)
   * depending on which tracker or screen asks for it; without this, each key
   * would download its own file: the same cover three times on disk. This maps
   * which keys are the same anime; download and read always go through the
   * canonical one.
   *
   * It is persisted in a JSON file next to the covers: kept only in memory it
   * would be lost on every restart and the duplicates would come back.
   */
  private aliasMap = new Map<string, string>(); // aliasKey -> canonicalKey
  private readonly aliasFile = path.join(this.coversDir, 'aliases.json');
  private inFlightDownloads = new Map<string, Promise<string | null>>();

  constructor() {
    if (!fs.existsSync(this.coversDir)) {
      fs.mkdirSync(this.coversDir, { recursive: true });
    }
    try {
      const saved = JSON.parse(fs.readFileSync(this.aliasFile, 'utf8')) as Record<string, string>;
      for (const [alias, canonical] of Object.entries(saved)) this.aliasMap.set(alias, canonical);
    } catch {
      // No file yet, or unreadable: start empty and rebuild it through use.
    }
  }

  /** Order of preference for naming the file: the AniList id is the most stable. */
  private static keyPriority(key: string): number {
    if (key.startsWith('al_')) return 4;
    if (key.startsWith('mal_')) return 3;
    if (key.startsWith('kitsu_')) return 2;
    return 1;
  }

  /** Key under which the file is actually stored and read. */
  canonicalKey(key: string): string {
    const cleaned = this.getSafeKey(key);
    return this.aliasMap.get(cleaned) || cleaned;
  }

  private directFile(key: string): string | null {
    for (const ext of ['.webp', '.jpg', '.png', '.jpeg']) {
      const p = path.join(this.coversDir, `${key}${ext}`);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Declares that two keys are the same anime. If both already have a file, the
   * alias's is deleted; if only the alias has one, it is renamed to the
   * canonical key. Existing duplicates disappear as the catalog is used again,
   * without a separate migration.
   */
  registerAlias(a: string, b: string): void {
    let alias = this.canonicalKey(a);
    let canonical = this.canonicalKey(b);
    if (!alias || !canonical || alias === canonical) return;
    if (CoversService.keyPriority(alias) > CoversService.keyPriority(canonical)) {
      [alias, canonical] = [canonical, alias];
    }
    // Whatever pointed at the alias now points at the canonical key.
    for (const [k, v] of this.aliasMap) if (v === alias) this.aliasMap.set(k, canonical);
    this.aliasMap.set(alias, canonical);

    const fa = this.directFile(alias);
    const fc = this.directFile(canonical);
    try {
      if (fa && fc) fs.unlinkSync(fa);
      else if (fa && !fc) fs.renameSync(fa, path.join(this.coversDir, `${canonical}${path.extname(fa)}`));
    } catch (err: any) {
      this.logger.warn(`Could not merge cover ${alias} -> ${canonical}: ${err.message}`);
    }
    this.memoryMap.delete(alias);

    try {
      fs.writeFileSync(this.aliasFile, JSON.stringify(Object.fromEntries(this.aliasMap)));
    } catch (err: any) {
      this.logger.warn(`Could not save aliases.json: ${err.message}`);
    }
  }

  getSafeKey(key: string): string {
    const base = (key || '').replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '');
    return base.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Domains of the trackers' official CDNs from which covers are accepted.
   * It is an allowlist against SSRF: without it, anyone could force the backend
   * to make requests to the internal network through the controller's
   * ?fallback= parameter.
   */
  static readonly ALLOWED_COVER_DOMAINS = [
    'anilist.co',
    'myanimelist.net',
    'kitsu.app',
    'kitsu.io',
  ];

  isAllowedCoverUrl(rawUrl: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Credentials or an explicit port only appear in tampered URLs, never in a CDN's.
    if (parsed.username || parsed.password || parsed.port) return false;

    const host = parsed.hostname.toLowerCase();
    return CoversService.ALLOWED_COVER_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  }

  getTitleKey(title: string): string {
    const clean = (title || '').toLowerCase().trim();
    return `title_${crypto.createHash('md5').update(clean).digest('hex').slice(0, 16)}`;
  }

  getFilePath(safeKey: string): string | null {
    return this.directFile(this.canonicalKey(safeKey));
  }

  hasLocalCover(safeKey: string): boolean {
    return this.getFilePath(safeKey) !== null;
  }

  getLocalCoverUrl(safeKey: string): string | null {
    const cleaned = this.getSafeKey(safeKey);
    if (this.hasLocalCover(cleaned)) {
      return `/api/covers/${cleaned}`;
    }
    return null;
  }

  async downloadAndSaveCover(
    safeKey: string,
    remoteUrl: string,
    secondaryKey?: string,
  ): Promise<string | null> {
    if (!remoteUrl) return null;
    if (!this.isAllowedCoverUrl(remoteUrl)) {
      this.logger.warn(`Cover rejected: the source is not an authorized CDN (${remoteUrl.slice(0, 120)}).`);
      return null;
    }
    if (secondaryKey) this.registerAlias(secondaryKey, safeKey);
    const cleaned = this.canonicalKey(safeKey);
    if (!cleaned || cleaned.length > 96 || this.inFlightDownloads.size >= 80) return null;

    const existing = this.getLocalCoverUrl(cleaned);
    if (existing) {
      return existing;
    }

    // Deduplicate concurrent in-flight downloads
    if (this.inFlightDownloads.has(cleaned)) {
      return this.inFlightDownloads.get(cleaned)!;
    }

    const downloadPromise = (async () => {
      try {
        const res = await axios.get(remoteUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 2,
          // A redirect must stay on an allowed CDN, or the allowlist above is moot.
          beforeRedirect: (options: Record<string, any>) => {
            if (!this.isAllowedCoverUrl(`${options.protocol}//${options.hostname}${options.path || ''}`)) {
              throw new Error('Cover redirect outside the allowed CDNs.');
            }
          },
          maxContentLength: 5 * 1024 * 1024,
          maxBodyLength: 5 * 1024 * 1024,
          headers: {
            'User-Agent': 'SyncSekai/1.0',
          },
        });

        const rawBuffer = Buffer.from(res.data);
        const contentType = String(res.headers['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('image/') || rawBuffer.length > 5 * 1024 * 1024) {
          return null;
        }
        let finalBuffer = rawBuffer;
        let ext = '.webp';

        // Header check: the Content-Type is declared by the remote server, so it is
        // not enough to know this is an image.
        if (!detectImageType(rawBuffer)) {
          this.logger.warn(
            `Cover from ${remoteUrl} discarded: the bytes are not JPEG, PNG or WebP.`,
          );
          return null;
        }

        try {
          finalBuffer = await sharp(rawBuffer, { limitInputPixels: 25_000_000 })
            .webp({ quality: 92, effort: 4 })
            .toBuffer();
          ext = '.webp';
        } catch (err: any) {
          // If it cannot be re-encoded, it is discarded: no bytes are stored that no
          // decoder has validated.
          this.logger.warn(
            `Cover from ${remoteUrl} discarded: sharp could not re-encode it (${err.message}).`,
          );
          return null;
        }

        const targetPath = path.join(this.coversDir, `${cleaned}${ext}`);
        await fs.promises.writeFile(targetPath, finalBuffer);

        const webUrl = `/api/covers/${cleaned}`;
        this.memoryMap.set(cleaned, webUrl);
        return webUrl;
      } catch (err: any) {
        this.logger.warn(
          `Could not download the cover from ${remoteUrl} (${cleaned}): ${err.message}`,
        );
        return null;
      } finally {
        this.inFlightDownloads.delete(cleaned);
      }
    })();

    this.inFlightDownloads.set(cleaned, downloadPromise);
    return downloadPromise;
  }

  async fetchAndCacheOnDemand(key: string, titleHint?: string): Promise<string | null> {
    const cleaned = this.canonicalKey(key);
    const existing = this.getFilePath(cleaned);
    if (existing) return existing;

    let remoteUrl: string | null = null;
    let secondaryKey: string | undefined = undefined;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };

    // Case 1: al_{id} or a numeric AniList id
    if (cleaned.startsWith('al_') || /^\d+$/.test(cleaned)) {
      const anilistId = parseInt(cleaned.replace('al_', ''), 10);
      if (!isNaN(anilistId)) {
        try {
          const query = `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                title { romaji english native }
                coverImage {
                  extraLarge
                  large
                  medium
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { id: anilistId } },
            { headers, timeout: 6000 },
          );
          const media = res.data?.data?.Media;
          remoteUrl =
            media?.coverImage?.extraLarge ||
            media?.coverImage?.large ||
            media?.coverImage?.medium ||
            null;
          if (media?.title) {
            const possibleTitle = media.title.romaji || media.title.english;
            if (possibleTitle) {
              secondaryKey = this.getTitleKey(possibleTitle);
            }
          }
        } catch (err: any) {
          this.logger.warn(`Error looking up the cover on AniList for ID ${anilistId}: ${err.message}`);
        }

        // Fallback 1: look up the direct external mapping on Kitsu (anilist/anime)
        if (!remoteUrl) {
          try {
            const kitsuMapRes = await axios.get(
              `https://kitsu.io/api/edge/mappings?filter[external_site]=anilist/anime&filter[external_id]=${anilistId}&include=item`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const item = kitsuMapRes.data?.included?.[0]?.attributes;
            if (item?.posterImage?.large || item?.posterImage?.original || item?.posterImage?.medium) {
              remoteUrl = item.posterImage.large || item.posterImage.original || item.posterImage.medium;
            }
            if (item?.canonicalTitle || item?.titles?.en_jp) {
              const title = item.canonicalTitle || item.titles?.en_jp;
              secondaryKey = this.getTitleKey(title);
            }
          } catch {}
        }

        // Fallback 2: search Kitsu by title if a hint was given
        if (!remoteUrl && titleHint) {
          try {
            const kitsuRes = await axios.get(
              `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(titleHint)}&page[limit]=1`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const poster =
              kitsuRes.data?.data?.[0]?.attributes?.posterImage?.large ||
              kitsuRes.data?.data?.[0]?.attributes?.posterImage?.original ||
              null;
            if (poster) remoteUrl = poster;
          } catch {}
        }
      }
    }

    // Case 2: MyAnimeList mal_{id}
    if (!remoteUrl && cleaned.startsWith('mal_')) {
      const malId = parseInt(cleaned.replace('mal_', ''), 10);
      if (!isNaN(malId)) {
        try {
          const query = `
            query ($idMal: Int) {
              Media(idMal: $idMal, type: ANIME) {
                id
                coverImage {
                  extraLarge
                  large
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { idMal: malId } },
            { headers, timeout: 6000 },
          );
          remoteUrl =
            res.data?.data?.Media?.coverImage?.extraLarge ||
            res.data?.data?.Media?.coverImage?.large ||
            null;
          if (res.data?.data?.Media?.id) secondaryKey = `al_${res.data.data.Media.id}`;
        } catch {}

        if (!remoteUrl) {
          try {
            const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}`, {
              headers: { 'User-Agent': headers['User-Agent'] },
              timeout: 6000,
            });
            remoteUrl =
              jikanRes.data?.data?.images?.webp?.large_image_url ||
              jikanRes.data?.data?.images?.jpg?.large_image_url ||
              null;
          } catch {}
        }

        if (!remoteUrl) {
          try {
            const kitsuMapRes = await axios.get(
              `https://kitsu.io/api/edge/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${malId}&include=item`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const item = kitsuMapRes.data?.included?.[0]?.attributes;
            if (item?.posterImage?.large || item?.posterImage?.original) {
              remoteUrl = item.posterImage.large || item.posterImage.original;
            }
          } catch {}
        }
      }
    }

    // Case 3: Kitsu kitsu_{id}
    if (!remoteUrl && cleaned.startsWith('kitsu_')) {
      const kitsuId = parseInt(cleaned.replace('kitsu_', ''), 10);
      if (!isNaN(kitsuId)) {
        try {
          const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              'User-Agent': 'SyncSekai/1.0.0',
            },
            timeout: 6000,
          });
          const attr = kitsuRes.data?.data?.attributes;
          remoteUrl =
            attr?.posterImage?.large ||
            attr?.posterImage?.medium ||
            attr?.posterImage?.original ||
            null;
        } catch (err: any) {
          this.logger.warn(`Error looking up the cover on Kitsu for ID ${kitsuId}: ${err.message}`);
        }
      }
    }

    // Case 4: title search (titleHint or the decoded key)
    const searchTarget =
      titleHint || (cleaned.startsWith('title_') && !/^[a-f0-9]{16}$/.test(cleaned.replace('title_', ''))
        ? decodeURIComponent(key.replace(/^title_/, ''))
        : '');

    if (!remoteUrl && searchTarget && searchTarget.trim().length > 1) {
      try {
        const query = `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { search: searchTarget.trim() } },
          { headers, timeout: 6000 },
        );
        const media = res.data?.data?.Media;
        remoteUrl =
          media?.coverImage?.extraLarge ||
          media?.coverImage?.large ||
          media?.coverImage?.medium ||
          null;
        if (media?.id) {
          secondaryKey = `al_${media.id}`;
        }
      } catch (err: any) {
        this.logger.warn(
          `Error looking up the cover by title for "${searchTarget}": ${err.message}`,
        );
      }
    }

    if (remoteUrl) {
      await this.downloadAndSaveCover(cleaned, remoteUrl, secondaryKey);
      return this.getFilePath(cleaned);
    }

    return null;
  }

  async getOrFetchCover(showTitle: string, anilistId?: number | null): Promise<string | null> {
    const cleanTitle = (showTitle || '').toLowerCase().trim();
    if (!cleanTitle && !anilistId) return null;

    const titleKey = cleanTitle ? this.getTitleKey(cleanTitle) : null;
    const safeKey = anilistId ? `al_${anilistId}` : titleKey!;

    // 1. If it already exists on local disk, return it right away
    const local = this.getLocalCoverUrl(safeKey);
    if (local) return local;

    if (titleKey) {
      const localTitle = this.getLocalCoverUrl(titleKey);
      if (localTitle) return localTitle;
    }

    // 2. With an anilistId, look it up on AniList GraphQL by id
    if (anilistId) {
      try {
        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const reqHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        };
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { id: anilistId } },
          { headers: reqHeaders, timeout: 6000 },
        );
        const coverUrl =
          res.data?.data?.Media?.coverImage?.extraLarge ||
          res.data?.data?.Media?.coverImage?.large ||
          res.data?.data?.Media?.coverImage?.medium;
        if (coverUrl) {
          return await this.downloadAndSaveCover(safeKey, coverUrl, titleKey || undefined);
        }
      } catch {
        // Ignore the network error and continue
      }
    }

    // 3. Without an anilistId, or if that failed, search AniList by title
    if (cleanTitle) {
      const reqHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      };

      try {
        const query = `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { search: showTitle } },
          { headers: reqHeaders, timeout: 6000 },
        );
        const media = res.data?.data?.Media;
        const coverUrl =
          media?.coverImage?.extraLarge ||
          media?.coverImage?.large ||
          media?.coverImage?.medium;
        if (coverUrl) {
          const secondary = media?.id ? `al_${media.id}` : undefined;
          return await this.downloadAndSaveCover(titleKey!, coverUrl, secondary);
        }
      } catch {
        // Ignore the network error and try Kitsu
      }

      // Fall back to a Kitsu text search
      try {
        const kitsuRes = await axios.get(
          `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(showTitle)}&page[limit]=1`,
          {
            headers: {
              Accept: 'application/vnd.api+json',
              'User-Agent': reqHeaders['User-Agent'],
            },
            timeout: 6000,
          },
        );
        const item = kitsuRes.data?.data?.[0]?.attributes;
        const coverUrl = item?.posterImage?.large || item?.posterImage?.original || item?.posterImage?.medium;
        if (coverUrl) {
          const secondary = item?.id ? `kitsu_${item.id}` : undefined;
          return await this.downloadAndSaveCover(titleKey!, coverUrl, secondary);
        }
      } catch {}
    }

    return null;
  }

  async forceRefreshCover(key: string, titleHint?: string): Promise<{ success: boolean; url?: string; error?: string }> {
    const cleaned = this.canonicalKey(key);
    const extensions = ['.webp', '.jpg', '.png', '.jpeg'];
    for (const ext of extensions) {
      const p = path.join(this.coversDir, `${cleaned}${ext}`);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
    this.memoryMap.delete(cleaned);

    const newPath = await this.fetchAndCacheOnDemand(cleaned, titleHint);
    if (newPath) {
      return { success: true, url: `/api/covers/${cleaned}` };
    }
    return { success: false, error: 'Could not get an updated cover from the tracker.' };
  }
}
