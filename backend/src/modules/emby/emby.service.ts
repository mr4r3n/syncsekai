import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { ScrobblePipelineService, NormalizedScrobbleEvent } from '../plex/scrobble-pipeline.service';
import * as os from 'os';
import axios from 'axios';
import {
  validateOutboundTarget,
  type ValidatedNetworkTarget,
} from '../../common/security/network-target';

export interface EmbyLibraryItem {
  id: string;
  key: string;
  title: string;
  type: string; // Emby CollectionType: 'tvshows' | 'movies' | 'mixed' | ...
  path?: string;
  monitored: boolean;
}

export interface EmbyUserOption {
  id: string;
  name: string;
}

/**
 * Emby adapter. Only this file (and emby-watcher.service.ts, for the session
 * fallback) knows how to read the Emby API and webhook. Everything generic
 * (shared-user routing, threshold, tracker sync, etc.) lives in
 * ScrobblePipelineService.processScrobbleEvent(), reused as is.
 *
 * IMPORTANT (unlike Plex and Jellyfin): Emby's native "Webhooks" notification
 * requires an Emby Premiere subscription; it is not free like the Jellyfin
 * plugin. That is why the session watcher (see emby-watcher.service.ts) is the
 * MAIN path here, not just a fallback: it is the only one that works for 100%
 * of Emby users, with or without Premiere. The webhook remains an optional path
 * for those who have Premiere. Its exact payload format has not been verified
 * against a server with Premiere; normalizeEmbyPayload() is defensive and
 * documents that limitation.
 */
@Injectable()
export class EmbyService {
  private readonly logger = new Logger(EmbyService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    private scrobblePipelineService: ScrobblePipelineService,
  ) {}

  private getHeaders(apiKey: string) {
    return { 'X-Emby-Token': apiKey, Accept: 'application/json' };
  }

  async validateUserServerTarget(serverUrl: string): Promise<ValidatedNetworkTarget> {
    const rawPorts = this.configService.get<string>('EMBY_ALLOWED_PORTS');
    const configuredPorts = rawPorts
      ? rawPorts
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535)
      : [];

    const allowedPorts =
      configuredPorts.length > 0
        ? [...new Set(configuredPorts)]
        : Array.from({ length: 65535 }, (_, i) => i + 1);

    const allowPublic = this.configService.get<string>('EMBY_ALLOW_PUBLIC_URLS') !== 'false';

    return validateOutboundTarget(serverUrl, {
      allowPrivate: true,
      allowPublic,
      allowedPorts,
    });
  }

  async validateUserServerUrl(serverUrl: string): Promise<string> {
    return (await this.validateUserServerTarget(serverUrl)).url;
  }

  /**
   * GET /System/Info: same route as Jellyfin (Emby is where the fork came
   * from), confirmed against Emby 4.9.5.0.
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
   * GET /Library/VirtualFolders: same route and response shape as Jellyfin,
   * confirmed live.
   */
  async fetchLibraries(serverUrl: string, apiKey: string): Promise<EmbyLibraryItem[]> {
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
   * GET /Users: same as Jellyfin. If it fails (API key without administrator
   * permissions), the frontend falls back to a free text field.
   */
  async fetchUsers(serverUrl: string, apiKey: string): Promise<EmbyUserOption[]> {
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
      this.logger.warn(`Could not list Emby users (is the API key not an administrator's?): ${error.message}`);
      return [];
    }
  }

  async testConnection(serverUrl: string, apiKey: string) {
    if (!serverUrl || !apiKey || apiKey.length > 512) {
      throw new BadRequestException('The Emby server URL and API key are required.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string; version?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('Could not connect to the Emby server. Check the URL and the API key.');
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
   * Connect an Emby server: URL + API key. Like Jellyfin, Emby has no
   * Plex.tv-style PIN flow.
   */
  async connect(userId: string, serverUrl: string, apiKey: string, serverName?: string, embyUsername?: string) {
    if (!apiKey || apiKey.length > 512) throw new BadRequestException('Invalid Emby API key.');
    if (!serverUrl) throw new BadRequestException('The Emby server URL is required.');

    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('Could not connect to the Emby server. Check the URL and the API key.');
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
    const finalServerName = serverName || info.serverName || 'Emby Media Server';

    const existing = await this.prisma.embyConnection.findUnique({ where: { userId } });
    const cleanUsername = (embyUsername || '').trim() || existing?.embyUsername || null;

    const conn = await this.prisma.embyConnection.upsert({
      where: { userId },
      update: {
        encryptedApiKey,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        embyUsername: cleanUsername,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        encryptedApiKey,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        embyUsername: cleanUsername,
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

  private static readonly LIBRARIES_CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly librariesCache = new Map<string, { libs: EmbyLibraryItem[]; ts: number }>();

  async getLibrariesCached(userId: string): Promise<EmbyLibraryItem[]> {
    const cached = this.librariesCache.get(userId);
    if (cached && Date.now() - cached.ts < EmbyService.LIBRARIES_CACHE_TTL_MS) {
      return cached.libs;
    }
    try {
      return await this.getLibraries(userId);
    } catch (err: any) {
      this.logger.warn(`Could not get the Emby libraries for ${userId}: ${err.message}`);
      return [];
    }
  }

  async getLibraries(userId: string): Promise<EmbyLibraryItem[]> {
    const conn = await this.prisma.embyConnection.findUnique({ where: { userId } });
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
    return this.prisma.embyConnection.update({
      where: { userId },
      data: { monitoredLibraries, lastSyncAt: new Date() },
    });
  }

  async disconnect(userId: string) {
    return this.prisma.embyConnection.update({
      where: { userId },
      data: {
        isConnected: false,
        encryptedApiKey: null,
        serverName: null,
        serverUrl: null,
        embyUsername: null,
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

    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.')) {
          localIp = net.address;
          break;
        }
      }
    }

    const port = this.configService.get<number>('PORT') || 4000;
    const lanWebhookUrl = `http://${localIp}:${port}/api/emby/webhook/${user.webhookToken}`;
    const localhostWebhookUrl = `http://localhost:${port}/api/emby/webhook/${user.webhookToken}`;
    const publicWebhookUrl = baseUrl ? `${baseUrl}/api/emby/webhook/${user.webhookToken}` : null;

    return {
      webhookToken: user.webhookToken,
      webhookUrl: publicWebhookUrl || lanWebhookUrl,
      publicWebhookUrl,
      lanWebhookUrl,
      localhostWebhookUrl,
      instructions: 'Requires Emby Premiere. Paste it in Dashboard > Notifications > Webhooks (Add).',
    };
  }

  async recordPing(clientIp: string) {
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'EMBY_WEBHOOK',
        message: `Test ping received on the Emby webhook from IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai Emby webhook listener is ACTIVE and RECEIVING traffic on the local network.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * Receiver for Emby's native "Webhooks" notification (requires Premiere).
   * The token check (format + existence) was already done by the controller.
   */
  async handleWebhook(webhookToken: string, payload: any, clientIp = '127.0.0.1') {
    const webhookOwner = await this.prisma.user.findUnique({
      where: { webhookToken },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
      },
    });

    if (!webhookOwner) {
      this.logger.warn(`Webhook ignored: unrecognized webhook token (${webhookToken}) from IP ${clientIp}`);
      await this.prisma.auditLog.create({
        data: {
          level: 'WARN',
          service: 'EMBY_WEBHOOK',
          message: `Webhook rejected: invalid token from IP ${clientIp}`,
          details: { webhookToken, clientIp },
        },
      });
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    const normalized = this.normalizeEmbyPayload(payload);

    const conn = webhookOwner.embyConnection;
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
   * Resolves the library name via /Items/{id}/Ancestors. Unlike Jellyfin
   * (ancestor `Type: "CollectionFolder"`), in Emby the library ancestor comes
   * as `Type: "Folder"`, and its `Name` is the physical folder name, not
   * necessarily the display name given to the library in the panel. It is
   * still better than nothing; if it fails, an empty string (not critical).
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
      const library = ancestors.find((a: any) => a?.Type === 'Folder' || a?.Type === 'CollectionFolder');
      return library?.Name || '';
    } catch (error: any) {
      this.logger.warn(`Could not query /Items/${itemId}/Ancestors: ${error.message}`);
      return '';
    }
  }

  /**
   * Emby adapter -> common intermediate shape.
   *
   * WARNING: Emby's "Webhooks" notification requires Emby Premiere and has not
   * been verified against a real server. The field names below (`ItemType`,
   * `Name`, `SeriesName`, `SeasonNumber`, `EpisodeNumber`,
   * `PlaybackPositionTicks`, `RunTimeTicks`, `NotificationUsername`,
   * `ServerName`) follow the SAME convention used for Jellyfin (same API lineage;
   * `/Sessions` returns that same shape), but the real format produced by the
   * Emby notification (which uses the Jinja template engine, not Handlebars) has
   * NOT been verified against an Emby with Premiere enabled. Someone with a real
   * Premiere account should confirm it and adjust this function if the field
   * names differ. Meanwhile, the verified and recommended path is the session
   * watcher (emby-watcher.service.ts), which depends on neither Premiere nor
   * this format.
   */
  private normalizeEmbyPayload(payload: any): NormalizedScrobbleEvent {
    const p = payload && typeof payload === 'object' ? payload : {};

    const notificationType = String(p.NotificationType || p.Event || p.event || '');
    const TICKS_PER_MS = 10000;
    const positionTicks = Number(p.PlaybackPositionTicks || p.PositionTicks || 0);
    const runtimeTicks = Number(p.RunTimeTicks || 0);

    const seriesName = String(p.SeriesName || '').trim();
    const itemName = String(p.Name || p.Title || '').trim();

    const eventMap: Record<string, string> = {
      PlaybackStop: 'media.stop',
      PlaybackProgress: 'media.pause',
      PlaybackStart: 'media.play',
      'playback.stop': 'media.stop',
      'playback.pause': 'media.pause',
    };

    return {
      source: 'EMBY',
      event: eventMap[notificationType] || notificationType || 'raw',
      showTitle: seriesName || itemName || 'Untitled',
      librarySectionTitle: String(p.LibraryName || '').trim(),
      episodeNumber: Number(p.EpisodeNumber || p.IndexNumber || 1),
      seasonNumber: Number(p.SeasonNumber || p.ParentIndexNumber || 1),
      viewOffsetMs: Math.max(0, Math.round(positionTicks / TICKS_PER_MS)),
      durationMs: Math.max(1, Math.round(runtimeTicks / TICKS_PER_MS)),
      // No rating sync via webhook, same as Jellyfin.
      rating: null,
      accountUsername: String(p.NotificationUsername || p.Username || p.username || '').trim(),
      serverTitle: p.ServerName ? String(p.ServerName) : undefined,
      hasPayload: Boolean(seriesName || itemName || p.ItemType),
      rawPayload: payload,
    };
  }
}
