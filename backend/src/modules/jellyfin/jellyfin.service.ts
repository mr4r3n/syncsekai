import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { ScrobblePipelineService, NormalizedScrobbleEvent } from '../plex/scrobble-pipeline.service';
import { lanAddress } from '../../common/http/lan-address';
import axios from 'axios';
import { decodeHtmlEntities } from '../../common/text/decode-html-entities';
import {
  validateMediaServerTarget,
  type ValidatedNetworkTarget,
} from '../../common/security/network-target';
import { recordActivity } from '../../common/logging/activity-log';

export interface JellyfinLibraryItem {
  id: string;
  key: string;
  title: string;
  type: string; // Jellyfin CollectionType: 'tvshows' | 'movies' | 'mixed' | ...
  path?: string;
  monitored: boolean;
}

export interface JellyfinUserOption {
  id: string;
  name: string;
}

/**
 * Jellyfin adapter. Only this file (and jellyfin-watcher.service.ts, for the
 * session fallback) knows how to read the Jellyfin API and webhook. Everything
 * generic (shared-user routing, threshold, tracker sync, etc.) lives in
 * ScrobblePipelineService.processScrobbleEvent(), reused as is.
 */
@Injectable()
export class JellyfinService {
  private readonly logger = new Logger(JellyfinService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    private scrobblePipelineService: ScrobblePipelineService,
  ) {}

  private getHeaders(apiKey: string) {
    // Jellyfin kept the header name from its Emby origin for compatibility.
    return { 'X-Emby-Token': apiKey, Accept: 'application/json' };
  }

  validateUserServerTarget(serverUrl: string): Promise<ValidatedNetworkTarget> {
    return validateMediaServerTarget(serverUrl, 'JELLYFIN');
  }

  async validateUserServerUrl(serverUrl: string): Promise<string> {
    return (await this.validateUserServerTarget(serverUrl)).url;
  }

  /**
   * GET /System/Info: used both to test the connection and to suggest a server
   * name when the user does not type one.
   */
  private async fetchSystemInfo(serverUrl: string, apiKey: string): Promise<{ serverName?: string; version?: string; id?: string }> {
    const target = await this.validateUserServerTarget(serverUrl);
    const response = await axios.get(`${target.url}/System/Info`, {
      headers: this.getHeaders(apiKey),
      timeout: 5000,
      maxRedirects: 2,
      maxContentLength: 2 * 1024 * 1024,
      httpAgent: target.httpAgent,
      httpsAgent: target.httpsAgent,
    });
    return {
      serverName: response.data?.ServerName,
      version: response.data?.Version,
      id: response.data?.Id,
    };
  }

  /**
   * GET /Library/VirtualFolders: requires an API key with administrator
   * permissions (like /Users). It is the Jellyfin equivalent of
   * /library/sections in Plex.
   */
  async fetchLibraries(serverUrl: string, apiKey: string): Promise<JellyfinLibraryItem[]> {
    if (!serverUrl || !apiKey) return [];
    let endpoint = serverUrl;
    try {
      const target = await this.validateUserServerTarget(serverUrl);
      endpoint = `${target.url}/Library/VirtualFolders`;
      const response = await axios.get(endpoint, {
        headers: this.getHeaders(apiKey),
        timeout: 5000,
        maxRedirects: 2,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });

      const folders = Array.isArray(response.data) ? response.data : [];
      return folders.map((f: any) => ({
        id: String(f.ItemId || f.Name || ''),
        key: String(f.ItemId || f.Name || ''),
        title: f.Name || 'Untitled',
        type: f.CollectionType || 'mixed',
        path: Array.isArray(f.Locations) && f.Locations.length > 0 ? f.Locations[0] : '',
        monitored: false,
      }));
    } catch (error: any) {
      this.logger.warn(`Could not query ${endpoint}: ${error.message}`);
      return [];
    }
  }

  /**
   * GET /Users: list of the server's local users, so the connection modal can
   * offer a dropdown instead of asking the user to type the exact name of their
   * Jellyfin account (needed to route plays when the server is shared). Not
   * fatal if it fails: the frontend falls back to a free text field.
   */
  async fetchUsers(serverUrl: string, apiKey: string): Promise<JellyfinUserOption[]> {
    if (!serverUrl || !apiKey) return [];
    try {
      const target = await this.validateUserServerTarget(serverUrl);
      const response = await axios.get(`${target.url}/Users`, {
        headers: this.getHeaders(apiKey),
        timeout: 5000,
        maxRedirects: 2,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });
      const users = Array.isArray(response.data) ? response.data : [];
      return users
        .map((u: any) => ({ id: String(u.Id || ''), name: String(u.Name || '').trim() }))
        .filter((u) => u.name);
    } catch (error: any) {
      this.logger.warn(`Could not list Jellyfin users (is the API key not an administrator's?): ${error.message}`);
      return [];
    }
  }

  /**
   * Test the connection and discover libraries and users in a single call:
   * it is what the modal consumes before saving anything.
   */
  async testConnection(serverUrl: string, apiKey: string) {
    if (!serverUrl || !apiKey || apiKey.length > 512) {
      throw new BadRequestException('The Jellyfin server URL and API key are required.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string; version?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch {
      throw new BadRequestException('Could not connect to the Jellyfin server. Check the URL and the API key.');
    }

    const [libraries, users] = await Promise.all([
      this.fetchLibraries(cleanUrl, apiKey),
      this.fetchUsers(cleanUrl, apiKey),
    ]);

    return {
      success: true,
      url: cleanUrl,
      serverName: info.serverName,
      version: info.version,
      librariesCount: libraries.length,
      libraries,
      users,
    };
  }

  /**
   * Connect a Jellyfin server: URL + API key (Jellyfin has no Plex.tv-style PIN
   * flow, everything is local to the server). The API key is encrypted with the
   * same EncryptionService Plex uses, not a new scheme.
   */
  async connect(userId: string, serverUrl: string, apiKey: string, serverName?: string, jellyfinUsername?: string) {
    if (!apiKey || apiKey.length > 512) throw new BadRequestException('Invalid Jellyfin API key.');
    if (!serverUrl) throw new BadRequestException('The Jellyfin server URL is required.');

    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch {
      throw new BadRequestException('Could not connect to the Jellyfin server. Check the URL and the API key.');
    }

    const libraries = await this.fetchLibraries(cleanUrl, apiKey);

    let initialMonitored: string[] = [];
    if (libraries.length > 0) {
      const animeLibs = libraries.filter((lib) =>
        lib.title.toLowerCase().includes('anime') || lib.title.toLowerCase().includes('animaci'),
      );
      initialMonitored = animeLibs.length > 0 ? animeLibs.map((l) => l.title) : libraries.map((l) => l.title);
    }

    const encryptedApiKey = this.encryptionService.encrypt(apiKey);
    const finalServerName = serverName || info.serverName || 'Jellyfin Media Server';

    // If the user does not pick or retype the local user when relinking, the
    // stored one is kept instead of cleared (unlike Plex, there is no way to
    // detect it again automatically here).
    const existing = await this.prisma.jellyfinConnection.findUnique({ where: { userId } });
    const cleanUsername = (jellyfinUsername || '').trim() || existing?.jellyfinUsername || null;

    const conn = await this.prisma.jellyfinConnection.upsert({
      where: { userId },
      update: {
        encryptedApiKey,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        jellyfinUsername: cleanUsername,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        encryptedApiKey,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        jellyfinUsername: cleanUsername,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
    });

    return {
      ...conn,
      availableLibraries: libraries.map((lib) => ({
        ...lib,
        monitored: initialMonitored.includes(lib.title),
      })),
    };
  }

  /**
   * Real libraries with a short cache: same pattern and TTL as
   * PlexService.getLibrariesCached (see that file for the reasoning).
   */
  private static readonly LIBRARIES_CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly librariesCache = new Map<string, { libs: JellyfinLibraryItem[]; ts: number }>();

  async getLibrariesCached(userId: string): Promise<JellyfinLibraryItem[]> {
    const cached = this.librariesCache.get(userId);
    if (cached && Date.now() - cached.ts < JellyfinService.LIBRARIES_CACHE_TTL_MS) {
      return cached.libs;
    }
    try {
      return await this.getLibraries(userId);
    } catch (err: any) {
      this.logger.warn(`Could not get the Jellyfin libraries for ${userId}: ${err.message}`);
      return [];
    }
  }

  async getLibraries(userId: string): Promise<JellyfinLibraryItem[]> {
    const conn = await this.prisma.jellyfinConnection.findUnique({ where: { userId } });
    if (!conn || !conn.isConnected || !conn.encryptedApiKey || !conn.serverUrl) {
      return [];
    }

    const apiKey = this.encryptionService.decrypt(conn.encryptedApiKey);
    const libraries = await this.fetchLibraries(conn.serverUrl, apiKey);
    const monitored = conn.monitoredLibraries || [];
    const result = libraries.map((lib) => ({
      ...lib,
      monitored: monitored.includes(lib.title) || monitored.includes(lib.id) || monitored.includes(lib.key),
    }));

    this.librariesCache.set(userId, { libs: result, ts: Date.now() });
    return result;
  }

  async updateMonitoredLibraries(userId: string, monitoredLibraries: string[]) {
    return this.prisma.jellyfinConnection.update({
      where: { userId },
      data: { monitoredLibraries, lastSyncAt: new Date() },
    });
  }

  async disconnect(userId: string) {
    return this.prisma.jellyfinConnection.update({
      where: { userId },
      data: {
        isConnected: false,
        encryptedApiKey: null,
        serverName: null,
        serverUrl: null,
        jellyfinUsername: null,
        monitoredLibraries: [],
        lastSyncAt: null,
      },
    });
  }

  async getWebhookInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { webhookToken: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    let baseUrl = this.configService.get<string>('FRONTEND_URL') ||
                  this.configService.get<string>('PUBLIC_URL') ||
                  this.configService.get<string>('APP_URL');

    if (!baseUrl) {
      const publicSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'SYSTEM_PUBLIC_URL' },
      });
      if (publicSetting?.value) {
        baseUrl = publicSetting.value;
      }
    }

    if (baseUrl) {
      baseUrl = baseUrl.replace(/\/+$/, '');
    }

    const localIp = lanAddress();

    const port = this.configService.get<number>('PORT') || 4000;
    const lanWebhookUrl = `http://${localIp}:${port}/api/jellyfin/webhook/${user.webhookToken}`;
    const localhostWebhookUrl = `http://localhost:${port}/api/jellyfin/webhook/${user.webhookToken}`;
    const publicWebhookUrl = baseUrl ? `${baseUrl}/api/jellyfin/webhook/${user.webhookToken}` : null;

    return {
      webhookToken: user.webhookToken,
      webhookUrl: publicWebhookUrl || lanWebhookUrl,
      publicWebhookUrl,
      lanWebhookUrl,
      localhostWebhookUrl,
      instructions: 'Paste this URL into Jellyfin\'s "Webhook" plugin (Dashboard > Plugins > Webhook).',
    };
  }

  async recordPing(clientIp: string) {
    await recordActivity({
      data: {
        level: 'INFO',
        service: 'JELLYFIN_WEBHOOK',
        message: `Test ping received on the Jellyfin webhook from IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai Jellyfin webhook listener is ACTIVE and RECEIVING traffic on the local network.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * Receiver for events from Jellyfin's "Webhook" plugin. The token check
   * (format + existence) was already done by the controller, as with Plex.
   */
  async handleWebhook(webhookToken: string, payload: any, clientIp = '127.0.0.1') {
    const webhookOwner = await this.prisma.user.findUnique({
      where: { webhookToken },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        blacklist: true,
      },
    });

    if (!webhookOwner) {
      this.logger.warn(`Webhook ignored: unrecognized webhook token (${webhookToken}) from IP ${clientIp}`);
      await recordActivity({
        data: {
          level: 'WARN',
          service: 'JELLYFIN_WEBHOOK',
          message: `Webhook rejected: invalid token from IP ${clientIp}`,
          details: { webhookToken, clientIp },
        },
      });
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    const normalized = this.normalizeJellyfinPayload(payload);

    // The official "Webhook" plugin does not expose the library name as a
    // template variable (tested live against 10.11.11 / plugin 21.0.0.0:
    // {{LibraryName}} always arrives empty, it is not a real plugin variable).
    // It is resolved separately against Jellyfin's own API using the ItemId,
    // which does travel in the template. This also covers the watcher: its
    // synthetic payload re-enters through this same method with the same ItemId.
    const conn = webhookOwner.jellyfinConnection;
    if (!normalized.librarySectionTitle && payload?.ItemId && conn?.serverUrl && conn?.encryptedApiKey) {
      try {
        const apiKey = this.encryptionService.decrypt(conn.encryptedApiKey);
        normalized.librarySectionTitle = await this.resolveLibraryName(conn.serverUrl, apiKey, String(payload.ItemId));
      } catch (e: any) {
        this.logger.warn(`Could not resolve the library of item ${payload.ItemId}: ${e.message}`);
      }
    }

    return this.scrobblePipelineService.processScrobbleEvent(webhookOwner, normalized, clientIp);
  }

  /**
   * Resolves the name of the library (CollectionFolder) an item belongs to,
   * via /Items/{id}/Ancestors. Not critical: if it fails or there is no
   * CollectionFolder ancestor, an empty string is returned and the monitored
   * libraries filter in processScrobbleEvent is skipped.
   */
  private async resolveLibraryName(serverUrl: string, apiKey: string, itemId: string): Promise<string> {
    try {
      const target = await this.validateUserServerTarget(serverUrl);
      const response = await axios.get(`${target.url}/Items/${encodeURIComponent(itemId)}/Ancestors`, {
        headers: this.getHeaders(apiKey),
        timeout: 4000,
        maxRedirects: 2,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });
      const ancestors = Array.isArray(response.data) ? response.data : [];
      const library = ancestors.find((a: any) => a?.Type === 'CollectionFolder');
      return library?.Name || '';
    } catch (error: any) {
      this.logger.warn(`Could not query /Items/${itemId}/Ancestors: ${error.message}`);
      return '';
    }
  }

  /**
   * Jellyfin adapter -> common intermediate shape. The official "Webhook"
   * plugin sends a Handlebars template the user may have edited or broken by
   * hand, so nothing here assumes a field exists or has the right type:
   * everything is coerced with safe defaults, like normalizePlexPayload in
   * plex-webhook.service.ts.
   */
  private normalizeJellyfinPayload(payload: any): NormalizedScrobbleEvent {
    const p = payload && typeof payload === 'object' ? payload : {};

    const notificationType = String(p.NotificationType || '');
    // Jellyfin has no "percentage watched" field: the template requests
    // PlaybackPositionTicks/RunTimeTicks (100 ns ticks) and it is computed here,
    // just as Plex sends viewOffset/duration in ms.
    const TICKS_PER_MS = 10000;
    const positionTicks = Number(p.PlaybackPositionTicks || 0);
    const runtimeTicks = Number(p.RunTimeTicks || 0);

    // Handlebars escapes the template's values: undo it before anything compares titles.
    const seriesName = decodeHtmlEntities(String(p.SeriesName || '').trim());
    const itemName = decodeHtmlEntities(String(p.Name || '').trim());

    // PlaybackStop ~ Plex media.stop; PlaybackProgress ~ media.pause (both
    // already trigger a scrobble if they pass the threshold in
    // processScrobbleEvent). Any other type (PlaybackStart, ItemAdded...) matches
    // no scrobble branch and is ignored, just as Plex ignores
    // media.play.
    const eventMap: Record<string, string> = {
      PlaybackStop: 'media.stop',
      PlaybackProgress: 'media.pause',
      PlaybackStart: 'media.play',
    };

    return {
      source: 'JELLYFIN',
      event: eventMap[notificationType] || notificationType || 'raw',
      showTitle: seriesName || itemName || 'Untitled',
      librarySectionTitle: decodeHtmlEntities(String(p.LibraryName || '').trim()),
      episodeNumber: Number(p.EpisodeNumber || 1),
      seasonNumber: Number(p.SeasonNumber || 1),
      viewOffsetMs: Math.max(0, Math.round(positionTicks / TICKS_PER_MS)),
      durationMs: Math.max(1, Math.round(runtimeTicks / TICKS_PER_MS)),
      // No rating sync via webhook: Jellyfin does not expose a 1-10 rating
      // equivalent to Plex's in the playback context.
      rating: null,
      accountUsername: decodeHtmlEntities(String(p.NotificationUsername || '').trim()),
      serverTitle: p.ServerName ? decodeHtmlEntities(String(p.ServerName)) : undefined,
      hasPayload: Boolean(seriesName || itemName || p.ItemType),
      rawPayload: payload,
    };
  }
}
