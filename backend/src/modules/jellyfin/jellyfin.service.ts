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

export interface JellyfinLibraryItem {
  id: string;
  key: string;
  title: string;
  type: string; // CollectionType de Jellyfin: 'tvshows' | 'movies' | 'mixed' | ...
  path?: string;
  monitored: boolean;
}

export interface JellyfinUserOption {
  id: string;
  name: string;
}

/**
 * Adaptador de Jellyfin. Solo este archivo (y jellyfin-watcher.service.ts, para
 * el respaldo de sesiones) saben leer la API/el webhook de Jellyfin. Todo lo
 * genérico (reparto de usuario compartido, umbral, sync con trackers, etc.)
 * vive en PlexService.processScrobbleEvent(), reutilizado tal cual.
 */
@Injectable()
export class JellyfinService {
  private readonly logger = new Logger(JellyfinService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    private plexService: PlexService,
  ) {}

  private getHeaders(apiKey: string) {
    // Jellyfin mantuvo el nombre de cabecera de su origen en Emby por compatibilidad.
    return { 'X-Emby-Token': apiKey, Accept: 'application/json' };
  }

  async validateUserServerTarget(serverUrl: string): Promise<ValidatedNetworkTarget> {
    const rawPorts = this.configService.get<string>('JELLYFIN_ALLOWED_PORTS');
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

    const allowPublic = this.configService.get<string>('JELLYFIN_ALLOW_PUBLIC_URLS') !== 'false';

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
   * GET /System/Info — sirve tanto para probar la conexión como para sugerir
   * un nombre de servidor si el usuario no escribe uno.
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
   * GET /Library/VirtualFolders — requiere una API key con permisos de
   * administrador (igual que /Users). Es el equivalente Jellyfin de
   * /library/sections en Plex.
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
   * GET /Users — lista de usuarios locales del servidor, para que el modal de
   * conexión ofrezca un desplegable en vez de pedirle al usuario que teclee el
   * nombre exacto de su cuenta de Jellyfin (necesario para repartir
   * reproducciones cuando el servidor es compartido). No es fatal si falla: el
   * frontend cae a un campo de texto libre.
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
      this.logger.warn(`No se pudo listar usuarios de Jellyfin (¿la API key no es de administrador?): ${error.message}`);
      return [];
    }
  }

  /**
   * Probar conexión + descubrir librerías y usuarios, todo en una llamada: es
   * lo que consume el modal antes de guardar nada.
   */
  async testConnection(serverUrl: string, apiKey: string) {
    if (!serverUrl || !apiKey || apiKey.length > 512) {
      throw new BadRequestException('Se requiere URL del servidor y API key de Jellyfin.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string; version?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('No se pudo conectar con el servidor Jellyfin. Revisa la URL y la API key.');
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
   * Conectar servidor Jellyfin: URL + API key (Jellyfin no tiene el flujo de
   * PIN de Plex.tv, es todo local al servidor). La API key se cifra con el
   * mismo EncryptionService que usa Plex, no un esquema nuevo.
   */
  async connect(userId: string, serverUrl: string, apiKey: string, serverName?: string, jellyfinUsername?: string) {
    if (!apiKey || apiKey.length > 512) throw new BadRequestException('API key de Jellyfin no válida.');
    if (!serverUrl) throw new BadRequestException('URL del servidor Jellyfin requerida.');

    const cleanUrl = await this.validateUserServerUrl(serverUrl);

    let info: { serverName?: string };
    try {
      info = await this.fetchSystemInfo(cleanUrl, apiKey);
    } catch (error: any) {
      throw new BadRequestException('No se pudo conectar con el servidor Jellyfin. Revisa la URL y la API key.');
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

    // Si el usuario no elige/reescribe el usuario local en un relink, se conserva
    // el que ya tenía guardado en vez de borrarlo (a diferencia de Plex, aquí no
    // hay forma de re-detectarlo automáticamente).
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
   * Librerías reales con caché corta — mismo patrón y mismo TTL que
   * PlexService.getLibrariesCached (ver ese archivo para el porqué).
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
      this.logger.warn(`No se pudieron obtener las librerías de Jellyfin para ${userId}: ${err.message}`);
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
    const lanWebhookUrl = `http://${localIp}:${port}/api/jellyfin/webhook/${user.webhookToken}`;
    const localhostWebhookUrl = `http://localhost:${port}/api/jellyfin/webhook/${user.webhookToken}`;
    const publicWebhookUrl = baseUrl ? `${baseUrl}/api/jellyfin/webhook/${user.webhookToken}` : null;

    return {
      webhookToken: user.webhookToken,
      webhookUrl: publicWebhookUrl || lanWebhookUrl,
      publicWebhookUrl,
      lanWebhookUrl,
      localhostWebhookUrl,
      instructions: 'Pega esta URL en el plugin "Webhook" de Jellyfin (Panel > Complementos > Webhook).',
    };
  }

  async recordPing(clientIp: string) {
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'JELLYFIN_WEBHOOK',
        message: `Test Ping recibido exitosamente en el Webhook de Jellyfin desde IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai Jellyfin Webhook Listener ACTIVO y RECIBIENDO tráfico en la red local.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * Receptor de eventos del plugin "Webhook" de Jellyfin. La validación del
   * token (formato + existencia) ya la hizo el controller, igual que en Plex.
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
      this.logger.warn(`Webhook ignorado: token de webhook no reconocido (${webhookToken}) desde IP ${clientIp}`);
      await this.prisma.auditLog.create({
        data: {
          level: 'WARN',
          service: 'JELLYFIN_WEBHOOK',
          message: `Webhook rechazado: Token no válido desde IP ${clientIp}`,
          details: { webhookToken, clientIp },
        },
      });
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    const normalized = this.normalizeJellyfinPayload(payload);

    // El plugin oficial "Webhook" no expone el nombre de la biblioteca como
    // variable de plantilla (probado en vivo contra 10.11.11 / plugin 21.0.0.0:
    // {{LibraryName}} siempre llega vacío, no es una variable real del plugin).
    // Se resuelve aparte contra la propia API de Jellyfin usando el ItemId, que
    // sí viaja en la plantilla. Cubre también al watcher: su payload sintético
    // reentra por este mismo método con el mismo ItemId.
    const conn = webhookOwner.jellyfinConnection;
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
   * Resuelve el nombre de la biblioteca (CollectionFolder) a la que pertenece un
   * ítem, vía /Items/{id}/Ancestors. No es crítico: si falla o no hay ancestro de
   * tipo CollectionFolder, se devuelve cadena vacía y el filtro de librerías
   * monitoreadas en processScrobbleEvent se salta solo (mismo comportamiento que
   * ya tiene hoy cuando el dato no está disponible).
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
      this.logger.warn(`No se pudo consultar /Items/${itemId}/Ancestors: ${error.message}`);
      return '';
    }
  }

  /**
   * Adaptador Jellyfin -> forma intermedia común. El plugin oficial "Webhook"
   * manda una plantilla Handlebars que el usuario puede haber editado o roto
   * a mano, así que nada aquí asume que el campo existe o tiene el tipo
   * correcto: todo se coacciona con valores por defecto seguros, igual que ya
   * hace normalizePlexPayload en plex.service.ts.
   */
  private normalizeJellyfinPayload(payload: any): NormalizedScrobbleEvent {
    const p = payload && typeof payload === 'object' ? payload : {};

    const notificationType = String(p.NotificationType || '');
    // Jellyfin no tiene un campo de "porcentaje visto": se pide en la plantilla
    // PlaybackPositionTicks/RunTimeTicks (ticks de 100ns) y se calcula aquí,
    // igual que Plex manda viewOffset/duration en ms.
    const TICKS_PER_MS = 10000;
    const positionTicks = Number(p.PlaybackPositionTicks || 0);
    const runtimeTicks = Number(p.RunTimeTicks || 0);

    const seriesName = String(p.SeriesName || '').trim();
    const itemName = String(p.Name || '').trim();

    // PlaybackStop ~ media.stop de Plex; PlaybackProgress ~ media.pause (ambos
    // ya disparan scrobble si superan el umbral en processScrobbleEvent, sin
    // tocar esa lógica). Cualquier otro tipo (PlaybackStart, ItemAdded...) no
    // coincide con ningún branch de scrobble y se ignora igual que Plex ignora
    // media.play.
    const eventMap: Record<string, string> = {
      PlaybackStop: 'media.stop',
      PlaybackProgress: 'media.pause',
      PlaybackStart: 'media.play',
    };

    return {
      source: 'JELLYFIN',
      event: eventMap[notificationType] || notificationType || 'raw',
      showTitle: seriesName || itemName || 'Sin Título',
      librarySectionTitle: String(p.LibraryName || '').trim(),
      episodeNumber: Number(p.EpisodeNumber || 1),
      seasonNumber: Number(p.SeasonNumber || 1),
      viewOffsetMs: Math.max(0, Math.round(positionTicks / TICKS_PER_MS)),
      durationMs: Math.max(1, Math.round(runtimeTicks / TICKS_PER_MS)),
      // Sin sync de rating vía webhook: Jellyfin no expone en el contexto de
      // reproducción una calificación 1-10 equivalente a la de Plex.
      rating: null,
      accountUsername: String(p.NotificationUsername || '').trim(),
      serverTitle: p.ServerName ? String(p.ServerName) : undefined,
      hasPayload: Boolean(seriesName || itemName || p.ItemType),
      rawPayload: payload,
    };
  }
}
