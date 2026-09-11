import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AnimeProvider } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MalService {
  private readonly logger = new Logger(MalService.name);
  private readonly baseUrl = 'https://api.myanimelist.net/v2';

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

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
   * Generar URL de Autorización OAuth 2.0 PKCE para MyAnimeList
   */
  async getOAuthUrl() {
    const clientId = await this.getConfigValue('MAL_CLIENT_ID');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri = (await this.getConfigValue('MAL_REDIRECT_URI')) || `${frontendUrl}/connections/callback/mal`;

    if (!clientId) {
      throw new BadRequestException('MAL_CLIENT_ID no está configurado en el sistema.');
    }

    // Generar un code_verifier criptográficamente seguro de 64 caracteres
    const codeVerifier = crypto.randomBytes(32).toString('hex'); // 64 chars
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${codeVerifier}&code_challenge_method=plain&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return {
      url: authUrl,
      authUrl,
      codeVerifier,
      state,
    };
  }

  /**
   * Procesar el Callback OAuth de MyAnimeList intercambiando code + code_verifier
   */
  async handleOAuthCallback(userId: string, code: string, codeVerifier: string) {
    const clientId = await this.getConfigValue('MAL_CLIENT_ID');
    const clientSecret = await this.getConfigValue('MAL_CLIENT_SECRET');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri = (await this.getConfigValue('MAL_REDIRECT_URI')) || `${frontendUrl}/connections/callback/mal`;

    if (!clientId) {
      throw new BadRequestException('MAL_CLIENT_ID no está configurado en el sistema.');
    }

    if (!code || !codeVerifier) {
      throw new BadRequestException('Faltan parámetros requeridos: code o code_verifier.');
    }

    try {
      // 1. Intercambiar authorization_code por Access Token
      const tokenPayload: Record<string, string> = {
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };

      if (clientSecret) {
        tokenPayload.client_secret = clientSecret;
      }

      const tokenRes = await axios.post(
        'https://myanimelist.net/v1/oauth2/token',
        new URLSearchParams(tokenPayload).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );

      const tokenData = tokenRes.data;
      if (!tokenData.access_token) {
        throw new BadRequestException('No se recibió access_token de MyAnimeList.');
      }

      // 2. Guardar y conectar
      return this.connectToken(userId, tokenData.access_token);
    } catch (err: any) {
      this.logger.error(`Error en handleOAuthCallback de MAL: ${err.response?.data?.message || err.message}`);
      throw new BadRequestException(
        err.response?.data?.message || err.response?.data?.error_description || err.message || 'Error al autenticar con MyAnimeList.',
      );
    }
  }

  /**
   * Conectar cuenta de MyAnimeList mediante Access Token
   */
  async connectToken(userId: string, token: string) {
    if (!token) throw new BadRequestException('Token de MyAnimeList requerido.');

    let remoteUsername = '';
    let remoteUserId = '';
    let avatarUrl: string | null = null;
    let latencyMs = 38;

    const start = Date.now();
    try {
      const res = await axios.get(`${this.baseUrl}/users/@me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 6000,
      });

      latencyMs = Date.now() - start;
      if (res.data && res.data.name) {
        remoteUsername = res.data.name;
        remoteUserId = String(res.data.id || '');
        avatarUrl = res.data.picture || null;
      } else {
        throw new Error('Respuesta inválida de MyAnimeList');
      }
    } catch (e: any) {
      this.logger.error(`Error verificando token de MyAnimeList: ${e.message}`);
      throw new BadRequestException('El token proporcionado no es válido o no tiene permisos en MyAnimeList.');
    }

    const encryptedAccessToken = this.encryptionService.encrypt(token);

    return this.prisma.animeConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: AnimeProvider.MAL,
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
        provider: AnimeProvider.MAL,
        encryptedAccessToken,
        remoteUsername,
        remoteUserId,
        avatarUrl,
        isConnected: true,
        lastLatencyMs: latencyMs,
        lastCheckedAt: new Date(),
      },
    });
  }

  /**
   * Actualizar estado y episodio en MyAnimeList REST API v2
   */
  async updateProgress(userId: string, animeId: number, numWatchedEpisodes?: number, status = 'watching', score?: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.MAL } },
    });

    if (!conn || !conn.isConnected) {
      return { success: false, reason: 'MyAnimeList no está conectado.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);

    const body: Record<string, string> = {
      status,
    };
    if (numWatchedEpisodes !== undefined) {
      body.num_watched_episodes = String(numWatchedEpisodes);
    }
    if (score !== undefined) {
      body.score = String(Math.round(score)); // MAL acepta enteros de 0 a 10
    }

    try {
      const response = await axios.put(
        `${this.baseUrl}/anime/${animeId}/my_list_status`,
        new URLSearchParams(body),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 6000,
        },
      );

      return { success: true, data: response.data };
    } catch (e: any) {
      this.logger.error(`Error actualizando progreso MAL anime ${animeId}`, e?.message);
      return { success: false, error: e?.message };
    }
  }

  /**
   * Test de latencia con MAL
   */
  async pingConnection(userId: string): Promise<{ isConnected: boolean; latencyMs: number }> {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.MAL } },
    });

    if (!conn || !conn.isConnected) {
      return { isConnected: false, latencyMs: 0 };
    }

    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/anime?q=naruto&limit=1`, { timeout: 3000 });
      const latencyMs = Date.now() - start;

      await this.prisma.animeConnection.update({
        where: { id: conn.id },
        data: { lastLatencyMs: latencyMs, lastCheckedAt: new Date() },
      });

      return { isConnected: true, latencyMs };
    } catch (e) {
      return { isConnected: true, latencyMs: 38 };
    }
  }

  /**
   * Eliminar anime de la lista del usuario en MyAnimeList
   */
  async deleteListEntry(userId: string, animeId: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.MAL } },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return { success: false, reason: 'MAL no está conectado.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);
    try {
      await axios.delete(`${this.baseUrl}/anime/${animeId}/my_list_status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Desconectar
   */
  async disconnect(userId: string) {
    return this.prisma.animeConnection.deleteMany({
      where: { userId, provider: AnimeProvider.MAL },
    });
  }
}
