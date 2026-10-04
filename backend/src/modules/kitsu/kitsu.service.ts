import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { AnimeProvider } from '@prisma/client';
import axios from 'axios';
import { readStoredSetting } from '../../common/crypto/stored-setting';
import { apiLatency } from '../../common/http/tracker-gate';

@Injectable()
export class KitsuService {
  private readonly logger = new Logger(KitsuService.name);
  private readonly baseUrl = 'https://kitsu.io/api/edge';
  private readonly oauthTokenEndpoint = 'https://kitsu.io/api/oauth/token';
  private readonly userAgent = 'SyncSekai/1.0.0 (https://github.com/plexsync)';

  // In-memory search cache (1-hour TTL)
  private readonly searchCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
  private readonly searchesInFlight = new Map<string, Promise<any[]>>();
  // ponytail: Kitsu entries found by MAL/AniList id, in memory (they do not change); lost on restart.
  private readonly externalIds = new Map<string, { kitsuId: number; title: string }>();

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  private getHeaders(token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'User-Agent': this.userAgent,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private getConfigValue(key: string): Promise<string> {
    return readStoredSetting(this.prisma, this.encryptionService, key);
  }

  /**
   * Returns the Kitsu OAuth authorization URL.
   */
  async getOAuthUrl(): Promise<{ url: string; clientId: string }> {
    const clientId = await this.getConfigValue('KITSU_CLIENT_ID');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri =
      (await this.getConfigValue('KITSU_REDIRECT_URI')) ||
      `${frontendUrl}/connections/callback/kitsu`;

    if (!clientId) {
      return { url: '', clientId: '' };
    }

    const url = `https://kitsu.app/oauth/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

    return { url, clientId };
  }

  /**
   * Handles the Kitsu OAuth callback (exchanges the code for an access_token).
   */
  async handleOAuthCallback(userId: string, code: string) {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('The Kitsu authorization code is required.');
    }

    const clientId = await this.getConfigValue('KITSU_CLIENT_ID');
    const clientSecret = await this.getConfigValue('KITSU_CLIENT_SECRET');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri =
      (await this.getConfigValue('KITSU_REDIRECT_URI')) ||
      `${frontendUrl}/connections/callback/kitsu`;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'KITSU_CLIENT_ID or KITSU_CLIENT_SECRET is not configured.',
      );
    }

    try {
      const tokenRes = await axios.post(
        this.oauthTokenEndpoint,
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          timeout: 10000,
        },
      );

      const { access_token, refresh_token, expires_in } = tokenRes.data;
      if (!access_token) {
        throw new BadRequestException('Kitsu did not return a valid access token.');
      }

      return await this.saveKitsuConnection(userId, access_token, refresh_token, expires_in);
    } catch (err: any) {
      const msg = err.response?.data?.error_description || err.response?.data?.message || err.message;
      this.logger.error(`Error en OAuth callback de Kitsu: ${msg}`);
      throw new BadRequestException(`Kitsu authentication failed: ${msg}`);
    }
  }

  /**
   * Connects with Kitsu credentials directly (official password grant).
   */
  async connectWithCredentials(userId: string, usernameOrEmail: string, password: string) {
    if (!usernameOrEmail?.trim() || !password) {
      throw new BadRequestException('Enter your Kitsu username/email and password.');
    }

    try {
      const clientId =
        (await this.getConfigValue('KITSU_CLIENT_ID')) ||
        'dd031b32d2f56c990b1425efe6c42ad847e7fe3ab46bf1299f05ecd856bdb7dd';
      const clientSecret =
        (await this.getConfigValue('KITSU_CLIENT_SECRET')) ||
        '54d7307928f63414defd96399fc31ba847961ceaecef3a5fd93144e960c0e151';

      const tokenRes = await axios.post(
        this.oauthTokenEndpoint,
        {
          grant_type: 'password',
          client_id: clientId,
          client_secret: clientSecret,
          username: usernameOrEmail.trim(),
          password: password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          timeout: 10000,
        },
      );

      const { access_token, refresh_token, expires_in } = tokenRes.data;
      if (!access_token) {
        throw new BadRequestException('Kitsu did not return a valid access token.');
      }

      return await this.saveKitsuConnection(userId, access_token, refresh_token, expires_in);
    } catch (err: any) {
      const msg = err.response?.data?.error_description || err.response?.data?.message || err.message;
      this.logger.error(`Error authenticating with Kitsu: ${msg}`);
      throw new BadRequestException(`Incorrect Kitsu credentials or authentication error: ${msg}`);
    }
  }

  /**
   * Connects manually with a token.
   */
  async connectWithToken(userId: string, accessToken: string) {
    if (!accessToken || !accessToken.trim()) {
      throw new BadRequestException('The Kitsu access token cannot be empty.');
    }
    return await this.saveKitsuConnection(userId, accessToken.trim());
  }

  /**
   * Saves or updates the Kitsu connection in the database, encrypted with AES-256.
   */
  private async saveKitsuConnection(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
  ) {
    // Get the authenticated user's Kitsu profile
    const profile = await this.fetchKitsuProfile(accessToken);

    const encryptedAccessToken = this.encryptionService.encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? this.encryptionService.encrypt(refreshToken) : null;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await this.prisma.animeConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.KITSU,
        },
      },
      create: {
        userId,
        provider: AnimeProvider.KITSU,
        remoteUsername: profile.username,
        remoteUserId: String(profile.id),
        avatarUrl: profile.avatarUrl,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        isConnected: true,
        lastCheckedAt: new Date(),
      },
      update: {
        remoteUsername: profile.username,
        remoteUserId: String(profile.id),
        avatarUrl: profile.avatarUrl,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        isConnected: true,
        lastCheckedAt: new Date(),
      },
    });

    this.logger.log(`Kitsu connected for user ${userId} (@${profile.username})`);
    return {
      success: true,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      provider: 'KITSU',
    };
  }

  /**
   * Returns the current user's profile from Kitsu.
   */
  async fetchKitsuProfile(token: string): Promise<{ id: string; username: string; avatarUrl: string | null }> {
    try {
      const res = await axios.get(`${this.baseUrl}/users?filter[self]=true`, {
        headers: this.getHeaders(token),
        timeout: 10000,
      });

      const userDoc = res.data?.data?.[0];
      if (!userDoc) {
        throw new Error('Could not get the Kitsu user profile.');
      }

      const attrs = userDoc.attributes || {};
      return {
        id: userDoc.id,
        username: attrs.name || attrs.slug || 'KitsuUser',
        avatarUrl: attrs.avatar?.original || attrs.avatar?.medium || null,
      };
    } catch (err: any) {
      throw new BadRequestException(`Invalid or expired Kitsu token (${err.message})`);
    }
  }

  /** A search already answered within the last hour, without asking Kitsu (undefined if none). */
  cachedSearch(query: string): any[] | undefined {
    const cached = this.searchCache.get(`kitsu_search_${query.trim().toLowerCase()}`);
    return cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL_MS ? cached.data : undefined;
  }

  /**
   * Searches anime on Kitsu (with an in-memory cache).
   */
  async searchAnime(query: string, limit = 10) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = `kitsu_search_${cleanQuery.toLowerCase()}`;
    const cached = this.cachedSearch(query);
    if (cached) return cached;
    // The same search already on its way (another visitor, a queued background lookup) is shared.
    const pending = this.searchesInFlight.get(cacheKey);
    if (pending) return pending;
    const search = this.fetchSearch(cleanQuery, limit, cacheKey).finally(() => this.searchesInFlight.delete(cacheKey));
    this.searchesInFlight.set(cacheKey, search);
    return search;
  }

  private async fetchSearch(cleanQuery: string, limit: number, cacheKey: string): Promise<any[]> {
    try {
      const res = await axios.get(
        `${this.baseUrl}/anime?filter[text]=${encodeURIComponent(cleanQuery)}&page[limit]=${limit}`,
        {
          headers: this.getHeaders(),
          timeout: 8000,
        },
      );

      const items = (res.data?.data || []).map((item: any) => {
        const attr = item.attributes || {};
        return {
          id: Number(item.id),
          kitsuId: Number(item.id),
          title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || cleanQuery,
          romajiTitle: attr.titles?.en_jp || attr.canonicalTitle,
          englishTitle: attr.titles?.en || undefined,
          coverUrl: attr.posterImage?.medium || attr.posterImage?.original || '',
          bannerUrl: attr.coverImage?.original || undefined,
          episodesTotal: attr.episodeCount || 0,
          status: attr.status,
          averageScore: attr.averageRating ? Number(attr.averageRating) : undefined,
          synopsis: attr.synopsis,
          subtype: attr.subtype,
          startDate: attr.startDate,
        };
      });

      this.searchCache.set(cacheKey, { data: items, timestamp: Date.now() });
      return items;
    } catch (err: any) {
      // A full queue is expected under load; it is retried on a later visit.
      if (err?.code !== 'TRACKER_BUSY') this.logger.error(`Error searching Kitsu: ${err.message}`);
      return [];
    }
  }

  /**
   * The Kitsu entry for a MyAnimeList or AniList id, from Kitsu's own mappings.
   * A title search returns the first season for every sequel ("Clevatess" for
   * "Clevatess II"), so syncing by title put sequels on the first season.
   */
  async findByExternalIds(
    malId?: number | null,
    anilistId?: number | null,
  ): Promise<{ kitsuId: number; title: string } | null> {
    const sites: Array<[string, number | null | undefined]> = [
      ['myanimelist/anime', malId],
      ['anilist/anime', anilistId],
    ];
    for (const [site, id] of sites) {
      if (!id) continue;
      const key = `${site}:${id}`;
      const known = this.externalIds.get(key);
      if (known) return known;
      try {
        const res = await axios.get(
          `${this.baseUrl}/mappings?filter[externalSite]=${site}&filter[externalId]=${id}&include=item&fields[anime]=canonicalTitle`,
          { headers: this.getHeaders(), timeout: 8000 },
        );
        const item = (res.data?.included || []).find((i: any) => i.type === 'anime');
        if (item) {
          const found = { kitsuId: Number(item.id), title: item.attributes?.canonicalTitle || '' };
          this.externalIds.set(key, found);
          return found;
        }
      } catch (err: any) {
        this.logger.warn(`Could not look up the Kitsu entry for ${key}: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Updates scrobble progress in the Kitsu library.
   *
   * "current" with the last episode is saved as "completed": Kitsu keeps the status
   * it is given, so finished shows stayed in Watching. Only the exact last episode
   * counts (see MalService.updateProgress).
   */
  async updateProgress(
    userId: string,
    kitsuMediaId: number,
    episodeNumber: number,
    status: 'current' | 'completed' | 'on_hold' | 'dropped' | 'planned' = 'current',
    ratingTwenty?: number,
    forceProgress: boolean = false,
  ): Promise<{ success: boolean; message?: string }> {
    const conn = await this.prisma.animeConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.KITSU,
        },
      },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return { success: false, message: 'Kitsu is not connected for this user.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    const remoteUserId = conn.remoteUserId;

    try {
      // 1. Check whether a library entry already exists for this anime (with its episode count)
      const checkRes = await axios.get(
        `${this.baseUrl}/library-entries?filter[userId]=${remoteUserId}&filter[animeId]=${kitsuMediaId}&include=anime&fields[anime]=episodeCount`,
        {
          headers: this.getHeaders(token),
          timeout: 8000,
        },
      );

      const existingEntry = checkRes.data?.data?.[0];
      let episodeCount = Number(checkRes.data?.included?.[0]?.attributes?.episodeCount) || 0;
      if (!existingEntry && status === 'current') {
        const animeRes = await axios
          .get(`${this.baseUrl}/anime/${kitsuMediaId}?fields[anime]=episodeCount`, { headers: this.getHeaders(token), timeout: 8000 })
          .catch(() => null);
        episodeCount = Number(animeRes?.data?.data?.attributes?.episodeCount) || 0;
      }
      const finalStatus = (progress: number) =>
        status === 'current' && episodeCount && progress === episodeCount ? 'completed' : status;

      if (existingEntry) {
        // PATCH: update the existing entry
        const entryId = existingEntry.id;
        const currentProgress = existingEntry.attributes?.progress || 0;

        // Never move progress backwards if it is already further ahead, unless forced (e.g. a revert)
        const newProgress = forceProgress ? episodeNumber : Math.max(currentProgress, episodeNumber);

        const patchBody: any = {
          data: {
            id: entryId,
            type: 'libraryEntries',
            attributes: {
              progress: newProgress,
              status: finalStatus(newProgress),
            },
          },
        };

        if (ratingTwenty !== undefined && ratingTwenty > 0) {
          patchBody.data.attributes.ratingTwenty = ratingTwenty;
        }

        await axios.patch(`${this.baseUrl}/library-entries/${entryId}`, patchBody, {
          headers: this.getHeaders(token),
          timeout: 8000,
        });

        this.logger.log(`Kitsu: entry ${entryId} updated to ep ${newProgress} for user ${userId}`);
        return { success: true, message: `Progress updated to ep ${newProgress} on Kitsu.` };
      } else {
        // POST: create a new library entry
        const postBody: any = {
          data: {
            type: 'libraryEntries',
            attributes: {
              progress: episodeNumber,
              status: finalStatus(episodeNumber),
            },
            relationships: {
              anime: {
                data: {
                  type: 'anime',
                  id: String(kitsuMediaId),
                },
              },
              user: {
                data: {
                  type: 'users',
                  id: String(remoteUserId),
                },
              },
            },
          },
        };

        if (ratingTwenty !== undefined && ratingTwenty > 0) {
          postBody.data.attributes.ratingTwenty = ratingTwenty;
        }

        await axios.post(`${this.baseUrl}/library-entries`, postBody, {
          headers: this.getHeaders(token),
          timeout: 8000,
        });

        this.logger.log(`Kitsu: new entry created for anime ${kitsuMediaId} for user ${userId}`);
        return { success: true, message: `Anime added and updated to ep ${episodeNumber} on Kitsu.` };
      }
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.detail || err.message;
      this.logger.error(`Error updating progress on Kitsu: ${msg}`);
      return { success: false, message: `Kitsu failure: ${msg}` };
    }
  }

  /**
   * Deletes an entry from the Kitsu library (used when reverting to episode 0).
   */
  async deleteLibraryEntry(userId: string, kitsuMediaId: number): Promise<{ success: boolean; message?: string }> {
    const conn = await this.prisma.animeConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.KITSU,
        },
      },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return { success: false, message: 'Kitsu is not connected for this user.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    const remoteUserId = conn.remoteUserId;

    try {
      const checkRes = await axios.get(
        `${this.baseUrl}/library-entries?filter[userId]=${remoteUserId}&filter[animeId]=${kitsuMediaId}`,
        {
          headers: this.getHeaders(token),
          timeout: 8000,
        },
      );

      const existingEntry = checkRes.data?.data?.[0];
      if (existingEntry?.id) {
        await axios.delete(`${this.baseUrl}/library-entries/${existingEntry.id}`, {
          headers: this.getHeaders(token),
          timeout: 8000,
        });
        this.logger.log(`Kitsu: entry ${existingEntry.id} deleted for anime ${kitsuMediaId}`);
        return { success: true, message: 'Kitsu entry deleted.' };
      }
      return { success: true, message: 'The entry did not exist on Kitsu.' };
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.detail || err.message;
      this.logger.error(`Error deleting the Kitsu entry: ${msg}`);
      return { success: false, message: `Kitsu failure: ${msg}` };
    }
  }

  /**
   * Disconnects Kitsu.
   */
  async disconnect(userId: string) {
    await this.prisma.animeConnection.deleteMany({
      where: {
        userId,
        provider: AnimeProvider.KITSU,
      },
    });
    return { success: true, message: 'Kitsu account disconnected.' };
  }

  /**
   * Measures Kitsu latency.
   */
  async pingConnection(userId: string) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.KITSU,
        },
      },
    });

    if (!conn || !conn.isConnected) {
      return { isConnected: false, latencyMs: 0 };
    }

    try {
      const latencyMs = await apiLatency('kitsu', () =>
        axios.get(`${this.baseUrl}/anime?page[limit]=1`, {
          headers: this.getHeaders(),
          timeout: 5000,
        }),
      );

      await this.prisma.animeConnection.update({
        where: { id: conn.id },
        data: { lastLatencyMs: latencyMs, lastCheckedAt: new Date() },
      });

      return { isConnected: true, latencyMs };
    } catch (err: any) {
      return { isConnected: false, latencyMs: 0, error: err.message };
    }
  }

  /**
   * Returns the user's full anime library from Kitsu.
   */
  async getUserLibrary(userId: string): Promise<any[]> {
    const conn = await this.prisma.animeConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.KITSU,
        },
      },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return [];
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    let remoteUserId = conn.remoteUserId;

    try {
      // Without a remoteUserId, look it up with filter[self]=true
      if (!remoteUserId) {
        const selfRes = await axios.get(`${this.baseUrl}/users?filter[self]=true`, {
          headers: this.getHeaders(token),
          timeout: 8000,
        });
        const userDoc = selfRes.data?.data?.[0];
        if (userDoc?.id) {
          remoteUserId = userDoc.id;
          await this.prisma.animeConnection.update({
            where: { id: conn.id },
            data: { remoteUserId },
          });
        }
      }

      if (!remoteUserId) {
        throw new Error('Could not identify the Kitsu remoteUserId.');
      }

      // Fetch up to 500 entries of the user's library, with the anime included
      const res = await axios.get(
        `${this.baseUrl}/library-entries?filter[userId]=${remoteUserId}&filter[kind]=anime&include=anime,anime.categories&page[limit]=500&sort=-updated_at`,
        {
          headers: this.getHeaders(token),
          timeout: 12000,
        },
      );

      const entries = res.data?.data || [];
      const included = res.data?.included || [];

      const animeMap = new Map<string, any>();
      const categoryMap = new Map<string, string>();

      for (const item of included) {
        if (item.type === 'anime') {
          animeMap.set(item.id, item.attributes);
        } else if (item.type === 'categories') {
          const catName = item.attributes?.title || item.attributes?.slug;
          if (catName) categoryMap.set(item.id, catName);
        }
      }

      const results: any[] = [];
      const statusMap: Record<string, string> = {
        current: 'CURRENT',
        completed: 'COMPLETED',
        on_hold: 'PAUSED',
        dropped: 'DROPPED',
        planned: 'PLANNING',
      };

      for (const entry of entries) {
        const animeId = entry.relationships?.anime?.data?.id;
        const animeAttr = animeMap.get(animeId);
        if (!animeAttr) continue;

        const episodesTotal = Number(animeAttr.episodeCount || 0);
        const progress = Number(entry.attributes?.progress || 0);
        const progressPct = episodesTotal > 0 ? Math.min(100, Math.round((progress / episodesTotal) * 100)) : (entry.attributes?.status === 'completed' ? 100 : 0);
        const scoreTen = entry.attributes?.ratingTwenty ? (Number(entry.attributes.ratingTwenty) / 2) : 0;

        results.push({
          id: `kitsu_${animeId}`,
          kitsuId: Number(animeId),
          anilistId: 0,
          malId: undefined,
          title: animeAttr.canonicalTitle || animeAttr.titles?.en || animeAttr.titles?.en_jp || 'Untitled',
          romajiTitle: animeAttr.titles?.en_jp || animeAttr.canonicalTitle || 'Untitled',
          englishTitle: animeAttr.titles?.en || undefined,
          nativeTitle: animeAttr.titles?.ja_jp || undefined,
          coverUrl: animeAttr.posterImage?.large || animeAttr.posterImage?.medium || animeAttr.posterImage?.original || '',
          bannerUrl: animeAttr.coverImage?.original || undefined,
          coverColor: '#fd755c',
          episodesTotal,
          episodesWatched: progress,
          progressPercentage: progressPct,
          status: statusMap[entry.attributes?.status] || 'CURRENT',
          rating: scoreTen,
          averageScore: animeAttr.averageRating ? Math.round(Number(animeAttr.averageRating)) : undefined,
          format: (animeAttr.subtype || 'TV').toUpperCase(),
          season: animeAttr.startDate ? `${new Date(animeAttr.startDate).getFullYear()}` : 'TV',
          seasonYear: animeAttr.startDate ? new Date(animeAttr.startDate).getFullYear() : undefined,
          inUserList: true,
          studio: 'Kitsu Library',
          genres: ['Anime'],
          description: animeAttr.synopsis || '',
          syncedPlex: true,
          syncedAnilist: false,
          syncedMal: false,
          syncedKitsu: true,
          updatedAt: entry.attributes?.updatedAt || null,
          nextAiringEpisode: null,
        });
      }

      return results;
    } catch (err: any) {
      this.logger.error(`Error querying the Kitsu library: ${err.message}`);
      return [];
    }
  }
}
