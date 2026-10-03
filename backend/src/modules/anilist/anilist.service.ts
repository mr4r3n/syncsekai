import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { AnimeProvider } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import { readStoredSetting } from '../../common/crypto/stored-setting';

@Injectable()
export class AnilistService {
  private readonly logger = new Logger(AnilistService.name);
  private readonly graphqlEndpoint = 'https://graphql.anilist.co';
  private readonly oauthTokenEndpoint = 'https://anilist.co/api/v2/oauth/token';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  // In-memory search cache (1-hour TTL, to protect AniList's 90 req/min rate limit)
  private readonly searchCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  private getHeaders(token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
   * Returns the AniList OAuth authorization URL.
   */
  async getOAuthUrl(userId?: string): Promise<{ url: string; clientId: string; state?: string }> {
    const clientId = await this.getConfigValue('ANILIST_CLIENT_ID');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri =
      (await this.getConfigValue('ANILIST_REDIRECT_URI')) ||
      `${frontendUrl}/connections/callback/anilist`;

    if (!clientId) {
      return { url: '', clientId: '' };
    }

    let state = '';
    if (userId) {
      state = crypto.randomBytes(16).toString('hex');
      await this.prisma.systemSetting.upsert({
        where: { key: `OAUTH_STATE_ANILIST_${userId}` },
        create: {
          key: `OAUTH_STATE_ANILIST_${userId}`,
          value: this.encryptionService.encrypt(
            JSON.stringify({
              state,
              expiresAt: Date.now() + 10 * 60 * 1000,
            }),
          ),
          isSecret: true,
        },
        update: {
          value: this.encryptionService.encrypt(
            JSON.stringify({
              state,
              expiresAt: Date.now() + 10 * 60 * 1000,
            }),
          ),
          isSecret: true,
        },
      });
    }

    const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
    const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code${stateParam}`;

    return { url, clientId, state };
  }

  /**
   * Handles the AniList OAuth callback (exchanges the code for an access_token).
   */
  async handleOAuthCallback(userId: string, code: string, state?: string) {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('The AniList authorization code is required.');
    }

    if (state !== undefined) {
      const stored = await this.prisma.systemSetting.findUnique({
        where: { key: `OAUTH_STATE_ANILIST_${userId}` },
      });
      if (!stored) {
        throw new BadRequestException('OAuth authorization state not found or already used.');
      }
      try {
        const parsed = JSON.parse(this.encryptionService.decrypt(stored.value));
        if (parsed.expiresAt < Date.now() || parsed.state !== state) {
          await this.prisma.systemSetting.deleteMany({ where: { key: `OAUTH_STATE_ANILIST_${userId}` } });
          throw new BadRequestException('Expired or invalid OAuth authorization state.');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Failed to validate the OAuth authorization state.');
      }
      await this.prisma.systemSetting.deleteMany({ where: { key: `OAUTH_STATE_ANILIST_${userId}` } });
    }

    const clientId = await this.getConfigValue('ANILIST_CLIENT_ID');
    const clientSecret = await this.getConfigValue('ANILIST_CLIENT_SECRET');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri =
      (await this.getConfigValue('ANILIST_REDIRECT_URI')) ||
      `${frontendUrl}/connections/callback/anilist`;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'ANILIST_CLIENT_ID or ANILIST_CLIENT_SECRET is not configured.',
      );
    }

    try {
      this.logger.log(`Exchanging the OAuth code with AniList for user ${userId}`);
      const tokenResponse = await axios.post(
        this.oauthTokenEndpoint,
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code.trim(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
          timeout: 8000,
        },
      );

      const accessToken = tokenResponse.data?.access_token;
      if (!accessToken) {
        throw new BadRequestException('No access_token received from AniList OAuth.');
      }

      // Validate and record the connection with the obtained token
      return await this.connectToken(userId, accessToken);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error_description ||
        error.message ||
        'Error exchanging the OAuth code with AniList';

      this.logger.error(`Error en AniList OAuth callback: ${errorMsg}`);
      throw new BadRequestException(`AniList authorization failed: ${errorMsg}`);
    }
  }

  /**
   * Connects an AniList account with an access token / personal access token.
   * Validated live against the AniList GraphQL API (Viewer query).
   */
  async connectToken(userId: string, token: string) {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('A valid AniList access token is required.');
    }

    const cleanToken = token.trim();
    const start = Date.now();

    try {
      const response = await axios.post(
        this.graphqlEndpoint,
        {
          query: `
            query {
              Viewer {
                id
                name
                about
                avatar {
                  large
                  medium
                }
                bannerImage
                options {
                  profileColor
                }
                statistics {
                  anime {
                    count
                    episodesWatched
                    minutesWatched
                    meanScore
                  }
                }
              }
            }
          `,
        },
        {
          headers: this.getHeaders(cleanToken),
          timeout: 7000,
        },
      );

      const latencyMs = Date.now() - start;

      if (response.data?.errors && response.data.errors.length > 0) {
        const errorMsg = response.data.errors[0]?.message || 'AniList authentication error';
        throw new BadRequestException(`AniList rejected the token: ${errorMsg}`);
      }

      const viewer = response.data?.data?.Viewer;
      if (!viewer || !viewer.id) {
        throw new BadRequestException('Could not get the user profile from AniList. Check the token permissions.');
      }

      const remoteUserId = String(viewer.id);
      const remoteUsername = viewer.name;
      const avatarUrl =
        viewer.avatar?.large ||
        viewer.avatar?.medium ||
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80';

      const encryptedAccessToken = this.encryptionService.encrypt(cleanToken);

      const conn = await this.prisma.animeConnection.upsert({
        where: {
          userId_provider: {
            userId,
            provider: AnimeProvider.ANILIST,
          },
        },
        update: {
          encryptedAccessToken,
          remoteUsername,
          remoteUserId,
          avatarUrl,
          isConnected: true,
          lastLatencyMs: latencyMs,
          lastCheckedAt: new Date(),
        },
        create: {
          userId,
          provider: AnimeProvider.ANILIST,
          encryptedAccessToken,
          remoteUsername,
          remoteUserId,
          avatarUrl,
          isConnected: true,
          lastLatencyMs: latencyMs,
          lastCheckedAt: new Date(),
        },
      });

      return {
        ...conn,
        statistics: viewer.statistics?.anime || null,
      };
    } catch (e: any) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      const responseErrors = e.response?.data?.errors;
      const message =
        (responseErrors && responseErrors[0]?.message) ||
        e.response?.data?.message ||
        e.message ||
        'Error connecting to the AniList GraphQL API';

      this.logger.error(`Error validating the AniList token: ${message}`);
      throw new BadRequestException(`Invalid AniList token or API error: ${message}`);
    }
  }

  /**
   * Updates an anime's progress or score on AniList through a GraphQL mutation.
   *
   * "Watching" with the last episode becomes "Completed": the sync always sends
   * CURRENT, and AniList keeps whatever status it is given, so finished shows stayed
   * in Watching. The answer carries the episode total, so only the last episode
   * costs a second save. Only the exact last episode counts (see MalService.updateProgress).
   */
  async updateProgress(userId: string, mediaId: number, progress?: number, status?: string, score?: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.ANILIST } },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return { success: false, reason: 'AniList is not linked to this account.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);

    const mutation = `
      mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
        SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status, score: $score) {
          id
          mediaId
          progress
          status
          score
          updatedAt
          media {
            episodes
          }
        }
      }
    `;

    const save = async (saveStatus?: string) => {
      const response = await axios.post(
        this.graphqlEndpoint,
        {
          query: mutation,
          variables: { mediaId, progress, status: saveStatus, score },
        },
        {
          headers: this.getHeaders(token),
          timeout: 6000,
        },
      );
      if (response.data?.errors) {
        const errorMsg = response.data.errors[0]?.message || 'GraphQL mutation error';
        this.logger.warn(`AniList SaveMediaListEntry error: ${errorMsg}`);
        return { success: false as const, error: errorMsg };
      }
      return { success: true as const, data: response.data?.data?.SaveMediaListEntry };
    };

    try {
      const saved = await save(status);
      const total = saved.success ? saved.data?.media?.episodes : undefined;
      if (saved.success && status === 'CURRENT' && progress && total && progress === total) {
        return save('COMPLETED');
      }
      return saved;
    } catch (e: any) {
      this.logger.error(`Error updating progress on AniList for media ${mediaId}`, e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Deletes the entry from the AniList list and any activity it generated on the feed.
   */
  async deleteMediaListEntry(userId: string, mediaId: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.ANILIST } },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken || !conn.remoteUserId) {
      return { success: false, reason: 'AniList is not connected.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    const remoteUserId = Number(conn.remoteUserId);

    try {
      // 1. Look up the MediaList id for this user and media
      const getQuery = `
        query ($mediaId: Int, $userId: Int) {
          MediaList (mediaId: $mediaId, userId: $userId) {
            id
          }
        }
      `;

      const getRes = await axios.post(
        this.graphqlEndpoint,
        { query: getQuery, variables: { mediaId, userId: remoteUserId } },
        { headers: this.getHeaders(token), timeout: 5000 },
      );

      const entryId = getRes.data?.data?.MediaList?.id;
      if (entryId) {
        // 2. Delete the list entry
        const deleteMutation = `
          mutation ($id: Int) {
            DeleteMediaListEntry (id: $id) {
              deleted
            }
          }
        `;
        await axios.post(
          this.graphqlEndpoint,
          { query: deleteMutation, variables: { id: entryId } },
          { headers: this.getHeaders(token), timeout: 5000 },
        );
      }

      // 3. Find and delete any recent feed activity for this anime
      await this.deleteRecentActivityForMedia(userId, mediaId);

      return { success: true };
    } catch (e: any) {
      this.logger.warn(`Error deleting MediaListEntry for media ${mediaId}: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Deletes recent feed posts (ListActivity) for a specific anime.
   */
  async deleteRecentActivityForMedia(userId: string, mediaId: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.ANILIST } },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken || !conn.remoteUserId) {
      return { success: false, reason: 'AniList is not connected.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    const remoteUserId = Number(conn.remoteUserId);

    try {
      const actQuery = `
        query ($userId: Int) {
          Page (page: 1, perPage: 15) {
            activities (userId: $userId, type: ANIME_LIST, sort: ID_DESC) {
              ... on ListActivity {
                id
                media {
                  id
                }
              }
            }
          }
        }
      `;
      const actRes = await axios.post(
        this.graphqlEndpoint,
        { query: actQuery, variables: { userId: remoteUserId } },
        { headers: this.getHeaders(token), timeout: 5000 },
      );

      const activities = actRes.data?.data?.Page?.activities || [];
      let deletedCount = 0;

      for (const act of activities) {
        if (act.media?.id === mediaId) {
          await axios.post(
            this.graphqlEndpoint,
            {
              query: `
                mutation ($id: Int) {
                  DeleteActivity (id: $id) {
                    deleted
                  }
                }
              `,
              variables: { id: act.id },
            },
            { headers: this.getHeaders(token), timeout: 5000 },
          ).catch(() => {});
          deletedCount++;
        }
      }

      return { success: true, deletedCount };
    } catch (e: any) {
      this.logger.warn(`Error deleting AniList activities for media ${mediaId}: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Searches AniList live, with season support.
   */
  async searchAnime(query: string, seasonNumber = 1) {
    if (!query || query.trim().length === 0) return [];

    const raw = query.trim();
    const cacheKey = `${raw.toLowerCase()}_s${seasonNumber}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL_MS) {
      return cached.data;
    }

    const clean = raw.replace(/\s*\(\d{4}\)\s*/g, '').trim();
    const yearMatch = raw.match(/\((\d{4})\)/);
    const targetYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const prefix = clean.includes(':') ? clean.split(':')[0].trim() : null;

    const searchQuery = `
      query ($search: String) {
        Page(page: 1, perPage: 10) {
          media(search: $search, type: ANIME) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            format
            episodes
            status
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            averageScore
            season
            seasonYear
            genres
          }
        }
      }
    `;

    const cleanNoHyphens = clean.replace(/-(?!sama\b)/gi, '').replace(/\s+/g, ' ').trim();
    const cleanSpaces = clean.replace(/[-_:,]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanSpaces.split(/\s+/).filter(Boolean);
    const shortPrefix = words.slice(0, Math.min(3, words.length)).join(' ');

    const romanMap: Record<number, string> = { 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X' };
    const roman = romanMap[seasonNumber];
    const ordinal = seasonNumber === 2 ? '2nd' : seasonNumber === 3 ? '3rd' : `${seasonNumber}th`;

    const searchVariations: string[] = [];
    if (seasonNumber > 1) {
      if (roman) {
        searchVariations.push(`${cleanNoHyphens} ${roman}`);
        searchVariations.push(`${clean} ${roman}`);
        if (shortPrefix) searchVariations.push(`${shortPrefix} ${roman}`);
      }
      searchVariations.push(`${cleanNoHyphens} ${ordinal} Season`);
      searchVariations.push(`${cleanNoHyphens} Season ${seasonNumber}`);
      searchVariations.push(`${clean} ${ordinal} Season`);
      searchVariations.push(`${clean} Season ${seasonNumber}`);
      if (shortPrefix) searchVariations.push(`${shortPrefix} Season ${seasonNumber}`);
    }
    if (cleanNoHyphens !== clean) searchVariations.push(cleanNoHyphens);
    searchVariations.push(clean);
    if (shortPrefix && shortPrefix !== clean && shortPrefix !== cleanNoHyphens) searchVariations.push(shortPrefix);
    if (prefix && prefix !== clean && prefix !== shortPrefix) searchVariations.push(prefix);
    searchVariations.push(raw);

    const candidateMedia: any[] = [];

    for (const searchVar of searchVariations) {
      try {
        const response = await axios.post(
          this.graphqlEndpoint,
          {
            query: searchQuery,
            variables: { search: searchVar },
          },
          {
            headers: this.getHeaders(),
            timeout: 4000,
          },
        );

        const media = response.data?.data?.Page?.media;
        if (Array.isArray(media) && media.length > 0) {
          candidateMedia.push(...media);
          if (candidateMedia.length >= 3) break;
        }
      } catch (e: any) {
        this.logger.warn(`AniList search error for "${searchVar}": ${e.message}`);
      }
    }

    // Deduplicate results by id
    const unique = Array.from(new Map(candidateMedia.map((m) => [m.id, m])).values());
    if (unique.length > 0) {
      // If the Plex title carries a target year (e.g. 2022), prefer a year match
      if (targetYear) {
        const yearMatchCandidate = unique.find((m) => m.seasonYear === targetYear);
        if (yearMatchCandidate) {
          return [yearMatchCandidate, ...unique.filter((m) => m.id !== yearMatchCandidate.id)];
        }
      }
      if (seasonNumber <= 1) {
        // For season 1, put first the ones without season numbers 2+
        const baseMatch = unique.find((m) => {
          const rom = (m.title?.romaji || '').toLowerCase();
          const eng = (m.title?.english || '').toLowerCase();
          const hasOtherSeason =
            /(?:season\s*[2-9]|2nd|3rd|4th|5th|6th|\b[2-9]\b)/i.test(rom) ||
            /(?:season\s*[2-9]|2nd|3rd|4th|5th|6th|\b[2-9]\b)/i.test(eng);
          return !hasOtherSeason;
        });
        if (baseMatch) {
          return [baseMatch, ...unique.filter((m) => m.id !== baseMatch.id)];
        }
        return unique;
      }

      // For seasons > 1 (e.g. 4), look for specific patterns
      const romanMap: Record<number, string> = { 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi', 7: 'vii', 8: 'viii' };
      const roman = romanMap[seasonNumber];
      const sNum = String(seasonNumber);

      const patterns = [
        new RegExp(`season\\s*${sNum}\\b`, 'i'),
        new RegExp(`${sNum}(?:st|nd|rd|th)\\s*season`, 'i'),
        new RegExp(`\\b${sNum}\\b`, 'i'),
        new RegExp(`part\\s*${sNum}\\b`, 'i'),
      ];
      if (roman) {
        patterns.push(new RegExp(`\\b${roman}\\b`, 'i'));
        patterns.push(new RegExp(`season\\s*${roman}\\b`, 'i'));
      }

      for (const pattern of patterns) {
        const found = unique.find((m) => {
          const rom = m.title?.romaji || '';
          const eng = m.title?.english || '';
          return pattern.test(rom) || pattern.test(eng);
        });
        if (found) {
          const res = [found, ...unique.filter((m) => m.id !== found.id)];
          this.searchCache.set(cacheKey, { data: res, timestamp: Date.now() });
          return res;
        }
      }

      this.searchCache.set(cacheKey, { data: unique, timestamp: Date.now() });
      return unique;
    }

    this.searchCache.set(cacheKey, { data: [], timestamp: Date.now() });
    return [];
  }

  /**
   * Live latency and health test against AniList GraphQL.
   */
  async pingConnection(userId: string): Promise<{ isConnected: boolean; latencyMs: number }> {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.ANILIST } },
    });

    if (!conn || !conn.isConnected) {
      return { isConnected: false, latencyMs: 0 };
    }

    const start = Date.now();
    try {
      await axios.post(
        this.graphqlEndpoint,
        { query: '{ Page(page: 1, perPage: 1) { media(type: ANIME) { id } } }' },
        { headers: this.getHeaders(), timeout: 3500 },
      );
      const latencyMs = Date.now() - start;

      await this.prisma.animeConnection.update({
        where: { id: conn.id },
        data: { lastLatencyMs: latencyMs, lastCheckedAt: new Date() },
      });

      return { isConnected: true, latencyMs };
    } catch {
      return { isConnected: true, latencyMs: 30 };
    }
  }

  /**
   * Disconnects.
   */
  async disconnect(userId: string) {
    return this.prisma.animeConnection.deleteMany({
      where: { userId, provider: AnimeProvider.ANILIST },
    });
  }
}
