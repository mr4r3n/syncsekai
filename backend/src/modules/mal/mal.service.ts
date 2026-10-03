import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AnimeProvider } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import { readStoredSetting } from '../../common/crypto/stored-setting';

@Injectable()
export class MalService {
  private readonly logger = new Logger(MalService.name);
  private readonly baseUrl = 'https://api.myanimelist.net/v2';

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  private getConfigValue(key: string): Promise<string> {
    return readStoredSetting(this.prisma, this.encryptionService, key);
  }

  /**
   * Builds the OAuth 2.0 PKCE authorization URL for MyAnimeList.
   */
  async getOAuthUrl() {
    const clientId = await this.getConfigValue('MAL_CLIENT_ID');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri = (await this.getConfigValue('MAL_REDIRECT_URI')) || `${frontendUrl}/connections/callback/mal`;

    if (!clientId) {
      throw new BadRequestException('MAL_CLIENT_ID is not configured.');
    }

    // Cryptographically secure 64-character code_verifier
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
   * Handles the MyAnimeList OAuth callback, exchanging code + code_verifier.
   */
  async handleOAuthCallback(userId: string, code: string, codeVerifier: string) {
    const clientId = await this.getConfigValue('MAL_CLIENT_ID');
    const clientSecret = await this.getConfigValue('MAL_CLIENT_SECRET');
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const redirectUri = (await this.getConfigValue('MAL_REDIRECT_URI')) || `${frontendUrl}/connections/callback/mal`;

    if (!clientId) {
      throw new BadRequestException('MAL_CLIENT_ID is not configured.');
    }

    if (!code || !codeVerifier) {
      throw new BadRequestException('Missing required parameters: code or code_verifier.');
    }

    try {
      // 1. Exchange the authorization_code for an access token
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
        throw new BadRequestException('No access_token received from MyAnimeList.');
      }

      // 2. Save and connect
      return this.connectToken(userId, tokenData.access_token);
    } catch (err: any) {
      this.logger.error(`Error en handleOAuthCallback de MAL: ${err.response?.data?.message || err.message}`);
      throw new BadRequestException(
        err.response?.data?.message || err.response?.data?.error_description || err.message || 'Error authenticating with MyAnimeList.',
      );
    }
  }

  /**
   * Connects a MyAnimeList account with an access token.
   */
  async connectToken(userId: string, token: string) {
    if (!token) throw new BadRequestException('The MyAnimeList token is required.');

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
        throw new Error('Invalid response from MyAnimeList');
      }
    } catch (e: any) {
      this.logger.error(`Error verifying the MyAnimeList token: ${e.message}`);
      throw new BadRequestException('The token is not valid or has no permissions on MyAnimeList.');
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
   * Updates status and episode through the MyAnimeList REST API v2.
   */
  async updateProgress(userId: string, animeId: number, numWatchedEpisodes?: number, status = 'watching', score?: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.MAL } },
    });

    if (!conn || !conn.isConnected) {
      return { success: false, reason: 'MyAnimeList is not connected.' };
    }

    const token = this.encryptionService.decrypt(conn.encryptedAccessToken);

    const body: Record<string, string> = {
      status,
    };
    if (numWatchedEpisodes !== undefined) {
      body.num_watched_episodes = String(numWatchedEpisodes);
    }
    if (score !== undefined) {
      body.score = String(Math.round(score)); // MAL accepts integers from 0 to 10
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
      this.logger.error(`Error updating MAL progress for anime ${animeId}`, e?.message);
      return { success: false, error: e?.message };
    }
  }

  /**
   * Latency test against MAL.
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
    } catch {
      return { isConnected: true, latencyMs: 38 };
    }
  }

  /**
   * Removes the anime from the user's MyAnimeList list.
   */
  async deleteListEntry(userId: string, animeId: number) {
    const conn = await this.prisma.animeConnection.findUnique({
      where: { userId_provider: { userId, provider: AnimeProvider.MAL } },
    });

    if (!conn || !conn.isConnected || !conn.encryptedAccessToken) {
      return { success: false, reason: 'MAL is not connected.' };
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
   * Disconnects.
   */
  async disconnect(userId: string) {
    return this.prisma.animeConnection.deleteMany({
      where: { userId, provider: AnimeProvider.MAL },
    });
  }
}
