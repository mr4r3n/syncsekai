import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { PlexService, NormalizedScrobbleEvent } from '../plex/plex.service';
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
  type: string; // CollectionType de Emby: 'tvshows' | 'movies' | 'mixed' | ...
  path?: string;
  monitored: boolean;
}

export interface EmbyUserOption {
  id: string;
  name: string;
}

/**
 * Adaptador de Emby. Solo este archivo (y emby-watcher.service.ts, para el
 * respaldo de sesiones) saben leer la API/el webhook de Emby. Todo lo genérico
 * (reparto de usuario compartido, umbral, sync con trackers, etc.) vive en
 * PlexService.processScrobbleEvent(), reutilizado tal cual.
 *
 * IMPORTANTE (a diferencia de Plex y Jellyfin): la notificación nativa
 * "Webhooks" de Emby requiere una suscripción Emby Premiere -- no es gratis
 * como el plugin de Jellyfin. Por eso aquí el watcher de sesiones (ver
 * emby-watcher.service.ts) es el camino PRINCIPAL, no un simple respaldo: es
 * el único que funciona para el 100% de los usuarios de Emby, tengan o no
 * Premiere. El webhook queda como camino opcional para quien sí tenga
 * Premiere. El formato exacto de su payload no se ha verificado contra un
 * servidor con Premiere; normalizeEmbyPayload() es defensivo y documenta esa
 * limitación.
 */
@Injectable()
export class EmbyService {
  private readonly logger = new Logger(EmbyService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    private plexService: PlexService,
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
   * GET /System/Info — misma ruta que Jellyfin (Emby es de donde salió el
   * fork), confirmado contra Emby 4.9.5.0.
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
   * GET /Library/VirtualFolders — misma ruta y misma forma de respuesta que
   * Jellyfin, confirmado en vivo.
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
        title: f.Name || 'Sin título',
        type: f.CollectionType || 'mixed',
        path: Array.isArray(f.Locations) && f.Locations.length > 0 ? f.Locations[0] : '',
        monitored: false,
      }));
    } catch (error: any) {
      this.logger.warn(`No se pudo consultar ${endpoint}: ${error.message}`);
      return [];
    }
  }

  /**
   * GET /Users — igual que Jellyfin. Si falla (API key sin permisos de
   * administrador), el frontend cae a un campo de texto libre.
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
      this.logger.warn(`No se pudo listar usuarios de Emby (¿la API key no es de administrador?): ${error.message}`);
      return [];
    }
  }

  async testConnection(serverUrl: string, apiKey: string) {
    if (!serverUrl || !apiKey || apiKey.length > 512) {
      throw new BadRequestException('Se requiere URL del servidor y API key de Emby.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string; version?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('No se pudo conectar con el servidor Emby. Revisa la URL y la API key.');
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
   * Conectar servidor Emby: URL + API key. Igual que Jellyfin, Emby no tiene
   * un flujo de PIN como Plex.tv.
   */
  async connect(userId: string, serverUrl: string, apiKey: string, serverName?: string, embyUsername?: string) {
    if (!apiKey || apiKey.length > 512) throw new BadRequestException('API key de Emby no válida.');
    if (!serverUrl) throw new BadRequestException('URL del servidor Emby requerida.');

    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('No se pudo conectar con el servidor Emby. Revisa la URL y la API key.');
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
      this.logger.warn(`No se pudieron obtener las librerías de Emby para ${userId}: ${err.message}`);
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
    if (!user) throw new NotFoundException('Usuario no encontrado.');

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
      instructions: 'Requiere Emby Premiere. Pégala en Panel > Notificaciones > Webhooks (Añadir).',
    };
  }

  async recordPing(clientIp: string) {
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'EMBY_WEBHOOK',
        message: `Test Ping recibido exitosamente en el Webhook de Emby desde IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai Emby Webhook Listener ACTIVO y RECIBIENDO tráfico en la red local.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * Receptor de la notificación nativa "Webhooks" de Emby (requiere Premiere).
   * La validación del token (formato + existencia) ya la hizo el controller.
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
      this.logger.warn(`Webhook ignorado: token de webhook no reconocido (${webhookToken}) desde IP ${clientIp}`);
      await this.prisma.auditLog.create({
        data: {
          level: 'WARN',
          service: 'EMBY_WEBHOOK',
          message: `Webhook rechazado: Token no válido desde IP ${clientIp}`,
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
        this.logger.warn(`No se pudo resolver la biblioteca del ítem ${payload.ItemId}: ${e.message}`);
      }
    }

    return this.plexService.processScrobbleEvent(webhookOwner, normalized, clientIp);
  }

  /**
   * Resuelve el nombre de biblioteca vía /Items/{id}/Ancestors. A diferencia
   * de Jellyfin (ancestro `Type: "CollectionFolder"`), en Emby el ancestro
   * de biblioteca llega como `Type: "Folder"` -- y su
   * `Name` es el nombre físico de la carpeta, no necesariamente el nombre
   * visible que se le puso a la biblioteca en el panel. Aun así es mejor que
   * nada; si falla, cadena vacía (mismo comportamiento no crítico de siempre).
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
      this.logger.warn(`No se pudo consultar /Items/${itemId}/Ancestors: ${error.message}`);
      return '';
    }
  }

  /**
   * Adaptador Emby -> forma intermedia común.
   *
   * ADVERTENCIA: la notificación "Webhooks" de Emby exige Emby Premiere y no
   * se ha verificado contra un servidor real. Los nombres de campo de abajo (`ItemType`, `Name`, `SeriesName`,
   * `SeasonNumber`, `EpisodeNumber`, `PlaybackPositionTicks`, `RunTimeTicks`,
   * `NotificationUsername`, `ServerName`) siguen la MISMA convención que ya
   * se usa para Jellyfin (mismo linaje de API; `/Sessions` devuelve esa misma
   * forma), pero el formato real que
   * genera la notificación de Emby (que usa el motor de plantillas Jinja, no
   * Handlebars) NO se ha verificado contra un Emby con Premiere activo.
   * Quien tenga una cuenta Premiere real debe confirmarlo y ajustar esta
   * función si los nombres de campo difieren. Mientras tanto, el camino
   * verificado y recomendado es el watcher de sesiones (emby-watcher.service.ts),
   * que no depende de Premiere ni de este formato.
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
      showTitle: seriesName || itemName || 'Sin Título',
      librarySectionTitle: String(p.LibraryName || '').trim(),
      episodeNumber: Number(p.EpisodeNumber || p.IndexNumber || 1),
      seasonNumber: Number(p.SeasonNumber || p.ParentIndexNumber || 1),
      viewOffsetMs: Math.max(0, Math.round(positionTicks / TICKS_PER_MS)),
      durationMs: Math.max(1, Math.round(runtimeTicks / TICKS_PER_MS)),
      // Sin sync de rating vía webhook, igual que Jellyfin.
      rating: null,
      accountUsername: String(p.NotificationUsername || p.Username || p.username || '').trim(),
      serverTitle: p.ServerName ? String(p.ServerName) : undefined,
      hasPayload: Boolean(seriesName || itemName || p.ItemType),
      rawPayload: payload,
    };
  }
}
