import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { AnimeProvider } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class KitsuService {
  private readonly logger = new Logger(KitsuService.name);
  private readonly baseUrl = 'https://kitsu.io/api/edge';
  private readonly oauthTokenEndpoint = 'https://kitsu.io/api/oauth/token';
  private readonly userAgent = 'SyncSekai/1.0.0 (https://github.com/plexsync)';

  // In-Memory Search Cache (1 hora TTL)
  private readonly searchCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

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

  private async getConfigValue(key: string): Promise<string> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key },
      });
      if (setting && setting.value) {
        if (setting.isSecret) {
          try {
            return this.encryptionService.decrypt(setting.value);
          } catch {
            return setting.value;
          }
        }
        return setting.value;
      }
    } catch {}
    return this.configService.get<string>(key) || process.env[key] || '';
  }

  /**
   * 1. Obtener URL de autorización OAuth de Kitsu
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
   * 2. Manejar callback de OAuth de Kitsu (intercambio de code por access_token)
   */
  async handleOAuthCallback(userId: string, code: string) {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Se requiere el código de autorización de Kitsu.');
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
        'KITSU_CLIENT_ID o KITSU_CLIENT_SECRET no están configurados en el sistema.',
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
        throw new BadRequestException('Kitsu no devolvió un token de acceso válido.');
      }

      return await this.saveKitsuConnection(userId, access_token, refresh_token, expires_in);
    } catch (err: any) {
      const msg = err.response?.data?.error_description || err.response?.data?.message || err.message;
      this.logger.error(`Error en OAuth callback de Kitsu: ${msg}`);
      throw new BadRequestException(`Fallo en la autenticación con Kitsu: ${msg}`);
    }
  }

  /**
   * 3. Conexión mediante credenciales directas de Kitsu (Password Grant oficial)
   */
  async connectWithCredentials(userId: string, usernameOrEmail: string, password: string) {
    if (!usernameOrEmail?.trim() || !password) {
      throw new BadRequestException('Debes ingresar tu usuario/correo y contraseña de Kitsu.');
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
        throw new BadRequestException('Kitsu no devolvió un token de acceso válido.');
      }

      return await this.saveKitsuConnection(userId, access_token, refresh_token, expires_in);
    } catch (err: any) {
      const msg = err.response?.data?.error_description || err.response?.data?.message || err.message;
      this.logger.error(`Error autenticando con Kitsu: ${msg}`);
      throw new BadRequestException(`Credenciales de Kitsu incorrectas o error de autenticación: ${msg}`);
    }
  }

  /**
   * 4. Conexión manual mediante Token directo
   */
  async connectWithToken(userId: string, accessToken: string) {
    if (!accessToken || !accessToken.trim()) {
      throw new BadRequestException('El token de acceso de Kitsu no puede estar vacío.');
    }
    return await this.saveKitsuConnection(userId, accessToken.trim());
  }

  /**
   * Guardar / Actualizar conexión Kitsu en base de datos con AES-256
   */
  private async saveKitsuConnection(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
  ) {
    // Obtener perfil del usuario autenticado en Kitsu
    const profile = await this.fetchKitsuProfile(accessToken);

    const encryptedAccessToken = this.encryptionService.encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? this.encryptionService.encrypt(refreshToken) : null;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const connection = await this.prisma.animeConnection.upsert({
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

    this.logger.log(`Conexión a Kitsu establecida para el usuario ${userId} (@${profile.username})`);
    return {
      success: true,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      provider: 'KITSU',
    };
  }

  /**
   * Obtener perfil del usuario actual desde Kitsu
   */
  async fetchKitsuProfile(token: string): Promise<{ id: string; username: string; avatarUrl: string | null }> {
    try {
      const res = await axios.get(`${this.baseUrl}/users?filter[self]=true`, {
        headers: this.getHeaders(token),
        timeout: 10000,
      });

      const userDoc = res.data?.data?.[0];
      if (!userDoc) {
        throw new Error('No se pudo obtener el perfil de usuario de Kitsu.');
      }

      const attrs = userDoc.attributes || {};
      return {
        id: userDoc.id,
        username: attrs.name || attrs.slug || 'KitsuUser',
        avatarUrl: attrs.avatar?.original || attrs.avatar?.medium || null,
      };
    } catch (err: any) {
      throw new BadRequestException(`Token de Kitsu inválido o expirado (${err.message})`);
    }
  }

  /**
   * 4. Búsqueda de animes en Kitsu (con caché en memoria)
   */
  async searchAnime(query: string, limit = 10) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = `kitsu_search_${cleanQuery.toLowerCase()}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL_MS) {
      return cached.data;
    }

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
      this.logger.error(`Error buscando en Kitsu: ${err.message}`);
      return [];
    }
  }

  /**
   * 5. Actualizar progreso de scrobble en la biblioteca de Kitsu
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
      return { success: false, message: 'Kitsu no está conectado para este usuario.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    const remoteUserId = conn.remoteUserId;

    try {
      // 1. Verificar si ya existe una entrada de biblioteca para este anime
      const checkRes = await axios.get(
        `${this.baseUrl}/library-entries?filter[userId]=${remoteUserId}&filter[animeId]=${kitsuMediaId}`,
        {
          headers: this.getHeaders(token),
          timeout: 8000,
        },
      );

      const existingEntry = checkRes.data?.data?.[0];

      if (existingEntry) {
        // PATCH: Actualizar entrada existente
        const entryId = existingEntry.id;
        const currentProgress = existingEntry.attributes?.progress || 0;

        // No retroceder progreso si ya está más avanzado salvo que se fuerce (ej. reversión)
        const newProgress = forceProgress ? episodeNumber : Math.max(currentProgress, episodeNumber);

        const patchBody: any = {
          data: {
            id: entryId,
            type: 'libraryEntries',
            attributes: {
              progress: newProgress,
              status: status,
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

        this.logger.log(`Kitsu: Entrada ${entryId} actualizada a ep ${newProgress} para user ${userId}`);
        return { success: true, message: `Progreso actualizado a ep ${newProgress} en Kitsu.` };
      } else {
        // POST: Crear nueva entrada en biblioteca
        const postBody: any = {
          data: {
            type: 'libraryEntries',
            attributes: {
              progress: episodeNumber,
              status: status,
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

        this.logger.log(`Kitsu: Nueva entrada creada para anime ${kitsuMediaId} en user ${userId}`);
        return { success: true, message: `Anime añadido y actualizado a ep ${episodeNumber} en Kitsu.` };
      }
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.detail || err.message;
      this.logger.error(`Error actualizando progreso en Kitsu: ${msg}`);
      return { success: false, message: `Fallo en Kitsu: ${msg}` };
    }
  }

  /**
   * Eliminar entrada de la biblioteca de Kitsu (usado al revertir a ep 0)
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
      return { success: false, message: 'Kitsu no está conectado para este usuario.' };
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
        this.logger.log(`Kitsu: Entrada ${existingEntry.id} eliminada para anime ${kitsuMediaId}`);
        return { success: true, message: 'Entrada de Kitsu eliminada correctamente.' };
      }
      return { success: true, message: 'Entrada no existía en Kitsu.' };
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.detail || err.message;
      this.logger.error(`Error eliminando entrada en Kitsu: ${msg}`);
      return { success: false, message: `Fallo en Kitsu: ${msg}` };
    }
  }

  /**
   * 6. Desconectar Kitsu
   */
  async disconnect(userId: string) {
    await this.prisma.animeConnection.deleteMany({
      where: {
        userId,
        provider: AnimeProvider.KITSU,
      },
    });
    return { success: true, message: 'Cuenta de Kitsu desconectada correctamente.' };
  }

  /**
   * 7. Medir latencia de Kitsu
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

    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/anime?page[limit]=1`, {
        headers: this.getHeaders(),
        timeout: 5000,
      });
      const latencyMs = Date.now() - start;

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
   * 8. Obtener la biblioteca completa de animes del usuario desde Kitsu
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
      // Si no tenemos remoteUserId, consultarlo con filter[self]=true
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
        throw new Error('No se pudo identificar el remoteUserId de Kitsu.');
      }

      // Obtener hasta 500 entradas de la biblioteca del usuario con anime incluido
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
          title: animeAttr.canonicalTitle || animeAttr.titles?.en || animeAttr.titles?.en_jp || 'Sin Título',
          romajiTitle: animeAttr.titles?.en_jp || animeAttr.canonicalTitle || 'Sin Título',
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
      this.logger.error(`Error consultando biblioteca de Kitsu: ${err.message}`);
      return [];
    }
  }
}
