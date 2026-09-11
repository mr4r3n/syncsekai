import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { CoversService } from '../covers/covers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SyncStatus, Prisma } from '@prisma/client';
import * as os from 'os';
import axios from 'axios';
import {
  validateOutboundTarget,
  type ValidatedNetworkTarget,
} from '../../common/security/network-target';

export interface PlexPinResponse {
  id: number;
  code: string;
  authUrl: string;
  expiresIn: number;
}

export interface PlexLibraryItem {
  id: string;
  key: string;
  title: string;
  type: string; // 'show' | 'movie' | 'artist' | 'photo'
  path?: string;
  agent?: string;
  scanner?: string;
  language?: string;
  monitored: boolean;
}

// Forma intermedia común entre fuentes (Plex, Jellyfin, la que venga después).
// Cada fuente sabe traducir SU payload a esto; a partir de aquí nadie sabe que
// Plex o Jellyfin existen. Ver processScrobbleEvent() más abajo.
export type ScrobbleSource = 'PLEX' | 'JELLYFIN' | 'EMBY';

export interface NormalizedScrobbleEvent {
  source: ScrobbleSource;
  event: string; // 'media.play' | 'media.pause' | 'media.resume' | 'media.stop' | 'media.scrobble' | 'media.rate' | otro sin traducción
  showTitle: string;
  librarySectionTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  viewOffsetMs: number;
  durationMs: number;
  rating?: number | string | null;
  accountUsername: string; // usuario que reprodujo, tal como lo reporta la fuente
  serverTitle?: string;
  hasPayload: boolean; // false si la fuente no trajo datos usables del ítem (Plex: sin Metadata)
  rawPayload: any; // se guarda tal cual en ScrobbleHistory.payloadSnapshot para depurar
}

export interface PlexServerResource {
  name: string;
  clientIdentifier: string;
  accessToken: string;
  owned: boolean;
  connections: Array<{
    protocol: string;
    address: string;
    port: number;
    uri: string;
    local: boolean;
    relay: boolean;
    IPv6: boolean;
  }>;
}

class AsyncKeyedLock {
  private activeLocks = new Map<string, Promise<any>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.activeLocks.get(key) || Promise.resolve();
    let nextResolve: () => void;
    const nextLock = new Promise<void>((resolve) => {
      nextResolve = resolve;
    });

    this.activeLocks.set(key, nextLock);

    try {
      await currentLock;
      return await fn();
    } finally {
      if (this.activeLocks.get(key) === nextLock) {
        this.activeLocks.delete(key);
      }
      nextResolve!();
    }
  }
}

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);
  private readonly scrobbleLock = new AsyncKeyedLock();
  private readonly clientIdentifier: string;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private coversService: CoversService,
    private notificationsService: NotificationsService,
  ) {
    this.clientIdentifier = this.configService.get<string>('PLEX_CLIENT_IDENTIFIER') || 'SyncSekai-App-2026-v1';
  }

  private getPlexHeaders(token?: string, clientId?: string) {
    const headers: Record<string, string> = {
      'X-Plex-Product': 'SyncSekai',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Client-Identifier': clientId || this.clientIdentifier,
      'X-Plex-Platform': 'Web',
      'X-Plex-Device': 'Browser',
      'X-Plex-Device-Name': 'SyncSekai Web App',
      Accept: 'application/json',
    };
    if (token) {
      headers['X-Plex-Token'] = token;
    }
    return headers;
  }

  async validateUserServerTarget(serverUrl: string): Promise<ValidatedNetworkTarget> {
    const rawPorts = this.configService.get<string>('PLEX_ALLOWED_PORTS');
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

    const allowPublic = this.configService.get<string>('PLEX_ALLOW_PUBLIC_URLS') !== 'false';

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
   * 1. Solicitar PIN oficial a Plex.tv para autenticación OAuth sin contraseña
   */
  async requestPin(): Promise<PlexPinResponse> {
    try {
      const response = await axios.post(
        'https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: this.getPlexHeaders(),
          timeout: 7000,
        },
      );

      const { id, code, expires_in } = response.data;
      const authUrl = `https://app.plex.tv/auth#?clientID=${encodeURIComponent(
        this.clientIdentifier,
      )}&code=${encodeURIComponent(code)}&context%5Bdevice%5D%5Bproduct%5D=SyncSekai`;

      return {
        id,
        code,
        authUrl,
        expiresIn: expires_in || 900,
      };
    } catch (error: any) {
      this.logger.error('Error solicitando PIN a Plex.tv', error.message);
      throw new BadRequestException('No se pudo conectar con Plex.tv para generar el PIN de autorización.');
    }
  }

  /**
   * 2. Verificar si el usuario ya aprobó el PIN en Plex.tv y descubrir sus servidores
   */
  async verifyPin(
    userId: string,
    pinId: number,
    clientIdentifier?: string,
  ): Promise<{
    verified: boolean;
    serverName?: string;
    serverUrl?: string;
    plexUsername?: string;
    libraries?: PlexLibraryItem[];
    serversCount?: number;
  }> {
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: this.getPlexHeaders(undefined, clientIdentifier),
        timeout: 5000,
      });

      const authToken = response.data?.authToken;
      if (!authToken) {
        return { verified: false };
      }

      // Obtener perfil del usuario desde Plex.tv
      let plexUsername = 'PlexUser';
      try {
        const userRes = await axios.get('https://plex.tv/api/v2/user', {
          headers: this.getPlexHeaders(authToken, clientIdentifier),
          timeout: 5000,
        });
        plexUsername = userRes.data?.username || userRes.data?.email || plexUsername;
      } catch (e: any) {
        this.logger.warn(`No se pudo obtener el nombre de usuario de Plex: ${e.message}`);
      }

      // Descubrir servidores y librerías reales
      const discovery = await this.discoverAndQueryPrimaryServer(authToken);

      const encryptedAuthToken = this.encryptionService.encrypt(authToken);
      const serverName = discovery.serverName || `${plexUsername}'s Media Server`;
      const serverUrl = discovery.serverUrl || 'http://localhost:32400';
      const discoveredLibraries = discovery.libraries || [];

      // Seleccionar automáticamente librerías relacionadas con anime o series por defecto
      let initialMonitored: string[] = [];
      if (discoveredLibraries.length > 0) {
        const animeLibs = discoveredLibraries.filter((lib) =>
          lib.title.toLowerCase().includes('anime') || lib.title.toLowerCase().includes('animaci'),
        );
        if (animeLibs.length > 0) {
          initialMonitored = animeLibs.map((l) => l.title);
        } else {
          initialMonitored = discoveredLibraries
            .filter((lib) => lib.type === 'show' || lib.type === 'movie')
            .map((l) => l.title);
        }
      }

      await this.prisma.plexConnection.upsert({
        where: { userId },
        update: {
          encryptedAuthToken,
          plexUsername,
          serverName,
          serverUrl,
          monitoredLibraries: initialMonitored,
          isConnected: true,
          lastSyncAt: new Date(),
        },
        create: {
          userId,
          encryptedAuthToken,
          plexUsername,
          serverName,
          serverUrl,
          monitoredLibraries: initialMonitored,
          isConnected: true,
          lastSyncAt: new Date(),
        },
      });

      const librariesWithStatus = discoveredLibraries.map((lib) => ({
        ...lib,
        monitored: initialMonitored.includes(lib.title) || initialMonitored.includes(lib.id),
      }));

      return {
        verified: true,
        serverName,
        serverUrl,
        plexUsername,
        libraries: librariesWithStatus,
        serversCount: discovery.totalServers,
      };
    } catch (error: any) {
      this.logger.warn(`Plex PIN ${pinId} verificación fallida o pendiente: ${error.message}`);
      return { verified: false };
    }
  }

  /**
   * 3. Consultar servidores disponibles en la cuenta Plex del usuario
   */
  async getResources(token: string): Promise<PlexServerResource[]> {
    try {
      const res = await axios.get(
        'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1',
        {
          headers: this.getPlexHeaders(token),
          timeout: 6000,
        },
      );

      const resources = Array.isArray(res.data) ? res.data : [];
      const servers: PlexServerResource[] = [];

      for (const r of resources) {
        const provides = String(r.provides || '');
        if (provides.includes('server')) {
          servers.push({
            name: r.name || 'Plex Media Server',
            clientIdentifier: r.clientIdentifier,
            accessToken: r.accessToken || token,
            owned: !!r.owned,
            connections: Array.isArray(r.connections)
              ? r.connections.map((c: any) => ({
                  protocol: c.protocol,
                  address: c.address,
                  port: Number(c.port),
                  uri: c.uri,
                  local: Boolean(c.local),
                  relay: Boolean(c.relay),
                  IPv6: Boolean(c.IPv6),
                }))
              : [],
          });
        }
      }

      return servers;
    } catch (e: any) {
      this.logger.warn(`Error consultando recursos en Plex.tv: ${e.message}`);
      return [];
    }
  }

  /**
   * 4. Consultar secciones/categorías reales directamente de un Plex Media Server (/library/sections)
   */
  async fetchLibrariesFromPMS(serverUrl: string, token: string): Promise<PlexLibraryItem[]> {
    if (!serverUrl || !token) return [];

    let endpoint = serverUrl;

    try {
      const target = await this.validateUserServerTarget(serverUrl);
      endpoint = `${target.url}/library/sections`;
      const response = await axios.get(endpoint, {
        headers: this.getPlexHeaders(token),
        timeout: 3000,
        maxRedirects: 2,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });

      const container = response.data?.MediaContainer;
      if (!container) return [];

      let directory = container.Directory || [];
      if (!Array.isArray(directory)) {
        directory = [directory];
      }

      return directory.map((dir: any) => {
        let path = '';
        if (Array.isArray(dir.Location) && dir.Location.length > 0) {
          path = dir.Location[0]?.path || '';
        } else if (dir.Location?.path) {
          path = dir.Location.path;
        }

        return {
          id: String(dir.key || dir.id),
          key: String(dir.key || dir.id),
          title: dir.title || 'Sin Título',
          type: dir.type || 'show',
          path,
          agent: dir.agent,
          scanner: dir.scanner,
          language: dir.language,
          monitored: false,
        };
      });
    } catch (error: any) {
      this.logger.warn(`No se pudo consultar ${endpoint}: ${error.message}`);
      return [];
    }
  }

  /**
   * 5. Descubrir servidores y consultar las categorías del servidor primario accesible
   */
  private async discoverAndQueryPrimaryServer(
    token: string,
  ): Promise<{
    serverName?: string;
    serverUrl?: string;
    libraries: PlexLibraryItem[];
    totalServers: number;
  }> {
    const servers = await this.getResources(token);
    if (servers.length === 0) {
      return {
        libraries: [],
        totalServers: 0,
      };
    }

    // Aislamiento estricto: Si el usuario tiene servidores propios, NUNCA asignar un servidor compartido
    const ownedServers = servers.filter((s) => s.owned);
    const candidateServers = ownedServers.length > 0 ? ownedServers : servers;

    for (const server of candidateServers) {
      const serverToken = server.accessToken || token;
      // Probar conexiones ordenadas (priorizar https directos y locales)
      const sortedConns = [...(server.connections || [])].sort((a, b) => {
        if (a.protocol === 'https' && b.protocol !== 'https') return -1;
        if (a.protocol !== 'https' && b.protocol === 'https') return 1;
        if (a.local && !b.local) return -1;
        if (!a.local && b.local) return 1;
        if (!a.relay && b.relay) return -1;
        return 0;
      });

      const testUris = Array.from(new Set(sortedConns.map((c) => c.uri).filter(Boolean)));

      if (testUris.length > 0) {
        // Probar todas las conexiones en paralelo para respuesta instantánea (<2s)
        const results = await Promise.allSettled(
          testUris.map(async (uri) => {
            const libs = await this.fetchLibrariesFromPMS(uri, serverToken);
            return { uri, libs };
          }),
        );

        for (const res of results) {
          if (res.status === 'fulfilled' && res.value.libs && res.value.libs.length > 0) {
            return {
              serverName: server.name,
              serverUrl: res.value.uri,
              libraries: res.value.libs,
              totalServers: servers.length,
            };
          }
        }
      }
    }

    // Si el servidor propio no respondió directamente a las peticiones HTTP del backend,
    // aún así asignamos el servidor propio del usuario con su primera URL para que no quede
    // vinculado a bibliotecas ajenas ni al servidor del administrador.
    const defaultServer = candidateServers[0];
    const defaultUri = defaultServer?.connections?.[0]?.uri || 'http://localhost:32400';

    return {
      serverName: defaultServer?.name || 'Plex Media Server',
      serverUrl: defaultUri,
      libraries: [],
      totalServers: servers.length,
    };
  }

  /**
   * 6. Conectar Plex mediante token manual directo y URL personalizada
   */
  async connectManualToken(userId: string, token: string, serverUrl?: string, serverName?: string) {
    if (!token || token.length > 512) throw new BadRequestException('Token de Plex no válido.');
    if (!serverUrl) throw new BadRequestException('URL del servidor Plex requerida.');

    let plexUsername = 'PlexUser';
    try {
      const userRes = await axios.get('https://plex.tv/api/v2/user', {
        headers: this.getPlexHeaders(token),
        timeout: 4000,
      });
      plexUsername = userRes.data?.username || userRes.data?.email || plexUsername;
    } catch (e) {
      this.logger.warn('Validación contra Plex.tv omitida para token directo.');
    }

    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const realLibraries = await this.fetchLibrariesFromPMS(cleanUrl, token);

    let initialMonitored: string[] = [];
    if (realLibraries.length > 0) {
      const animeLibs = realLibraries.filter((lib) =>
        lib.title.toLowerCase().includes('anime') || lib.title.toLowerCase().includes('animaci'),
      );
      initialMonitored = animeLibs.length > 0 ? animeLibs.map((l) => l.title) : realLibraries.map((l) => l.title);
    }

    const encryptedAuthToken = this.encryptionService.encrypt(token);
    const finalServerName = serverName || `${plexUsername}'s Media Server`;

    const conn = await this.prisma.plexConnection.upsert({
      where: { userId },
      update: {
        encryptedAuthToken,
        plexUsername,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        encryptedAuthToken,
        plexUsername,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
    });

    return {
      ...conn,
      availableLibraries: realLibraries.map((lib) => ({
        ...lib,
        monitored: initialMonitored.includes(lib.title) || initialMonitored.includes(lib.id),
      })),
    };
  }

  /**
   * 7. Obtener lista de librerías/categorías reales del servidor Plex del usuario
   */
  /**
   * Librerías reales con caché corta, para consumidores que se invocan a menudo.
   *
   * El hub de conexiones lo pide en cada carga del panel (incluido el Sidebar), y
   * consultar el PMS cada vez añadiría hasta 3 segundos por página. El botón
   * "Refrescar" sigue usando getLibraries(), que consulta en vivo y actualiza esta
   * caché, de modo que el usuario siempre tiene una vía para forzar el dato.
   *
   * Caché en memoria del proceso. Se pierde al reiniciar y no se comparte
   * entre réplicas; si el backend se escala, esto pasa a Redis, que ya está en el stack.
   */
  private static readonly LIBRARIES_CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly librariesCache = new Map<string, { libs: PlexLibraryItem[]; ts: number }>();

  async getLibrariesCached(userId: string): Promise<PlexLibraryItem[]> {
    const cached = this.librariesCache.get(userId);
    if (cached && Date.now() - cached.ts < PlexService.LIBRARIES_CACHE_TTL_MS) {
      return cached.libs;
    }
    try {
      return await this.getLibraries(userId);
    } catch (err: any) {
      this.logger.warn(`No se pudieron obtener las librerías de Plex para ${userId}: ${err.message}`);
      // Nunca inventar datos: si Plex no responde, la lista va vacía y la interfaz
      // ofrece el botón de refrescar.
      return [];
    }
  }

  async getLibraries(userId: string): Promise<PlexLibraryItem[]> {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.isConnected || !conn.encryptedAuthToken) {
      return [];
    }

    const token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    let libraries: PlexLibraryItem[] = [];

    if (conn.serverUrl) {
      libraries = await this.fetchLibrariesFromPMS(conn.serverUrl, token);
    }

    if (libraries.length === 0) {
      const discovery = await this.discoverAndQueryPrimaryServer(token);
      if (discovery.libraries.length > 0) {
        libraries = discovery.libraries;
        if (discovery.serverUrl && discovery.serverUrl !== conn.serverUrl) {
          await this.prisma.plexConnection.update({
            where: { userId },
            data: { serverUrl: discovery.serverUrl, serverName: discovery.serverName || conn.serverName },
          });
        }
      }
    }

    const monitored = conn.monitoredLibraries || [];
    const result = libraries.map((lib) => ({
      ...lib,
      monitored: monitored.includes(lib.title) || monitored.includes(lib.id) || monitored.includes(lib.key),
    }));

    // Refrescar la caché que consume el hub, para que pulsar "Refrescar" también
    // actualice lo que se ve al recargar la página.
    this.librariesCache.set(userId, { libs: result, ts: Date.now() });
    return result;
  }

  /**
   * 8. Actualizar selección de librerías monitoreadas
   */
  async updateMonitoredLibraries(userId: string, monitoredLibraries: string[]) {
    return this.prisma.plexConnection.update({
      where: { userId },
      data: {
        monitoredLibraries,
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * 9. Probar conexión y obtener categorías de un PMS específico
   */
  async testConnection(serverUrl: string, token: string) {
    if (!serverUrl || !token || token.length > 512) {
      throw new BadRequestException('Se requiere URL del servidor y token de autenticación.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const libraries = await this.fetchLibrariesFromPMS(cleanUrl, token);
    return {
      success: libraries.length > 0,
      url: cleanUrl,
      librariesCount: libraries.length,
      libraries,
    };
  }

  /**
   * 10. Obtener lista de servidores disponibles de la cuenta
   */
  async getUserServers(userId: string) {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.encryptedAuthToken) {
      return [];
    }
    const token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    return this.getResources(token);
  }

  /**
   * 11. Cambiar servidor activo
   */
  async selectServer(userId: string, serverName: string, serverUrl: string) {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.encryptedAuthToken) {
      throw new NotFoundException('Conexión de Plex no encontrada.');
    }

    const token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const libraries = await this.fetchLibrariesFromPMS(cleanUrl, token);

    await this.prisma.plexConnection.update({
      where: { userId },
      data: {
        serverName,
        serverUrl: cleanUrl,
        lastSyncAt: new Date(),
      },
    });

    return {
      serverName,
      serverUrl: cleanUrl,
      libraries,
    };
  }

  /**
   * 12. Obtener URL privada de webhook para el usuario (con soporte para LAN y Localhost)
   */
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
    const lanWebhookUrl = `http://${localIp}:${port}/api/plex/webhook/${user.webhookToken}`;
    const localhostWebhookUrl = `http://localhost:${port}/api/plex/webhook/${user.webhookToken}`;
    const publicWebhookUrl = baseUrl ? `${baseUrl}/api/plex/webhook/${user.webhookToken}` : null;

    return {
      webhookToken: user.webhookToken,
      webhookUrl: publicWebhookUrl || lanWebhookUrl,
      publicWebhookUrl,
      lanWebhookUrl,
      localhostWebhookUrl,
      instructions: 'Configura este webhook en Ajustes > Webhooks dentro de tu servidor de Plex Pass.',
    };
  }

  /**
   * 13. Desconectar Plex
   */
  async disconnect(userId: string) {
    return this.prisma.plexConnection.update({
      where: { userId },
      data: {
        isConnected: false,
        encryptedAuthToken: null,
        serverName: null,
        serverUrl: null,
        plexUsername: null,
        monitoredLibraries: [],
        lastSyncAt: null,
      },
    });
  }

  /**
   * Registrar ping de prueba de conectividad de webhook
   */
  async recordPing(clientIp: string) {
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'PLEX_WEBHOOK',
        message: `Test Ping recibido exitosamente en el Webhook desde IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai Webhook Listener ACTIVO y RECIBIENDO tráfico en la red local.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * 14. Receptor de eventos de Webhook de Plex Media Server
   *
   * Solo esta función (y normalizePlexPayload) saben leer el JSON de Plex.
   * Todo lo demás vive en processScrobbleEvent(), que ya no sabe que Plex existe
   * y que Jellyfin reutiliza tal cual (ver jellyfin.service.ts).
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
          service: 'PLEX_WEBHOOK',
          message: `Webhook rechazado: Token no válido desde IP ${clientIp}`,
          details: { webhookToken, clientIp },
        },
      });
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    return this.processScrobbleEvent(webhookOwner, this.normalizePlexPayload(payload), clientIp);
  }

  /**
   * Adaptador Plex -> forma intermedia común (NormalizedScrobbleEvent).
   */
  private normalizePlexPayload(payload: any): NormalizedScrobbleEvent {
    const metadata = payload?.Metadata;
    return {
      source: 'PLEX',
      event: payload?.event || 'raw',
      showTitle: metadata?.grandparentTitle || metadata?.title || 'Sin Título',
      librarySectionTitle: metadata?.librarySectionTitle || '',
      episodeNumber: Number(metadata?.index || 1),
      seasonNumber: Number(metadata?.parentIndex || 1),
      viewOffsetMs: Number(metadata?.viewOffset || 0),
      durationMs: Number(metadata?.duration || 1),
      rating: metadata?.userRating ? metadata.userRating : payload?.rating,
      accountUsername: (payload?.Account?.title || '').trim(),
      serverTitle: payload?.Server?.title,
      hasPayload: Boolean(metadata),
      rawPayload: payload,
    };
  }

  /**
   * Tubería genérica de scrobble: reparto de usuario compartido, librerías
   * monitoreadas, umbral de completado, lista negra, deduplicación, mapeo de
   * títulos, sincronización con los 3 trackers, historial y auditoría.
   *
   * No sabe que Plex ni Jellyfin existen: solo conoce NormalizedScrobbleEvent.
   *
   * Vive en PlexService por ser el primer origen; Jellyfin y Emby la reutilizan
   * inyectando este servicio. Candidata a un módulo `scrobble` propio.
   */
  async processScrobbleEvent(webhookOwner: any, evt: NormalizedScrobbleEvent, clientIp = '127.0.0.1') {
    const source = evt.source;
    const showTitle = evt.showTitle;
    const librarySectionTitle = evt.librarySectionTitle;
    const episodeNumber = evt.episodeNumber;
    const seasonNumber = evt.seasonNumber;
    const viewOffset = evt.viewOffsetMs;
    const duration = evt.durationMs;
    const viewPercentage = Math.min(100, Math.round((viewOffset / duration) * 100)) || 0;
    const rating = evt.rating;
    const accountTitle = evt.accountUsername;
    const ownerConnectionUsername = (this.getConnectionUsername(webhookOwner, source) || webhookOwner.username || '').trim();

    let user = webhookOwner;
    let isSharedUser = false;

    // Si la reproducción proviene de un usuario compartido del servidor de origen
    // (Plex: cuenta de Plex.tv distinta al dueño del webhook; Jellyfin: usuario
    // local del servidor distinto al vinculado a esta cuenta):
    if (accountTitle && ownerConnectionUsername && accountTitle.toLowerCase() !== ownerConnectionUsername.toLowerCase()) {
      isSharedUser = true;
      const matchedUser = await this.findUserByConnectionUsername(source, accountTitle, webhookOwner);

      if (matchedUser) {
        user = matchedUser;
      } else {
        this.logger.debug(
          `Evento ${source} ignorado: Reproducción de usuario no registrado (@${accountTitle}) en "${showTitle}".`,
        );
        await this.prisma.auditLog.create({
          data: {
            level: 'INFO',
            service: `${source}_WEBHOOK`,
            message: `Evento ignorado: Usuario @${accountTitle} no tiene cuenta vinculada en SyncSekai en "${showTitle} - Ep ${episodeNumber}"`,
            details: {
              accountTitle,
              serverOwner: webhookOwner.username,
              showTitle,
              episodeNumber,
              librarySectionTitle,
              isRegistered: false,
            },
          },
        });
        return {
          received: true,
          ignored: true,
          reason: `UNREGISTERED_${source}_USER`,
          accountTitle,
        };
      }
    }

    if (!user.isActive || user.settings?.isSuspended) {
      this.logger.warn(`Webhook rechazado: Usuario "${user.username}" inactivo o suspendido.`);
      await this.prisma.auditLog.create({
        data: {
          level: 'WARN',
          service: `${source}_WEBHOOK`,
          message: `Webhook rechazado: Cuenta de usuario "${user.username}" inactiva o suspendida`,
          details: { clientIp, userId: user.id },
        },
      });
      return { ignored: true, reason: 'USER_SUSPENDED' };
    }

    if (user.settings && !user.settings.canScrobble && user.role !== 'ADMIN') {
      this.logger.warn(`Webhook rechazado: Usuario "${user.username}" sin permiso de scrobble automático.`);
      await this.prisma.auditLog.create({
        data: {
          level: 'WARN',
          service: `${source}_WEBHOOK`,
          message: `Webhook rechazado: Usuario "${user.username}" sin permiso de Scrobble`,
          details: { clientIp, userId: user.id },
        },
      });
      return { ignored: true, reason: 'SCROBBLE_PERMISSION_DISABLED' };
    }

    const event = evt.event;
    const currentMinutes = Math.floor(viewOffset / 60000);
    const currentSeconds = Math.floor((viewOffset % 60000) / 1000);
    const totalMinutes = Math.floor(duration / 60000);
    const totalSeconds = Math.floor((duration % 60000) / 1000);
    const timeFormatted = duration > 0
      ? `${currentMinutes}:${currentSeconds < 10 ? '0' : ''}${currentSeconds} / ${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`
      : `${viewPercentage}%`;
    const eventLabel =
      event === 'media.play'
        ? '▶ Reproduciendo'
        : event === 'media.pause'
        ? '⏸ En pausa'
        : event === 'media.resume'
        ? '▶ Reanudado'
        : event === 'media.stop'
        ? '⏹ Detenido'
        : event === 'media.scrobble'
        ? '✔ Scrobble'
        : event;

    const originLabel = source === 'JELLYFIN' ? 'Jellyfin' : source === 'EMBY' ? 'Emby' : 'Plex';
    const userDisplayLabel = isSharedUser
      ? `@${user.username} (${originLabel}: @${accountTitle})`
      : `@${user.username}`;

    // Registrar en AuditLog en tiempo real para que aparezca inmediatamente en la Consola de Logs con minuto exacto
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: `${source}_WEBHOOK`,
        message: `${eventLabel} ${userDisplayLabel}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] [Librería: "${librarySectionTitle || 'N/A'}"]`,
        details: {
          event,
          clientIp,
          showTitle,
          librarySectionTitle,
          episodeNumber,
          viewPercentage,
          timeFormatted,
          server: evt.serverTitle,
          accountTitle,
          matchedUsername: user.username,
        },
      },
    });

    if (!evt.hasPayload) {
      return { received: true, ignored: true, reason: 'NO_METADATA' };
    }

    // Comprobar librerías monitoreadas:
    // Si la reproducción proviene de un servidor compartido (ej: servidor del Admin), combinar las librerías
    // monitoreadas del anfitrión con las del usuario para que nunca se pierda un scrobble al ver en bibliotecas compartidas.
    const userMonitored = this.getConnectionMonitoredLibraries(user, source);
    const serverMonitored = this.getConnectionMonitoredLibraries(webhookOwner, source);
    const combinedMonitored = isSharedUser
      ? Array.from(new Set([...userMonitored, ...serverMonitored]))
      : (userMonitored.length > 0 ? userMonitored : serverMonitored);

    if (combinedMonitored.length > 0 && librarySectionTitle) {
      const isMonitored = combinedMonitored.some((m) => m.toLowerCase() === librarySectionTitle.toLowerCase());

      if (!isMonitored) {
        this.logger.debug(`Evento ${originLabel} ignorado: librería "${librarySectionTitle}" no está monitoreada.`);
        await this.prisma.auditLog.create({
          data: {
            level: 'WARN',
            service: `${source}_WEBHOOK`,
            message: `Evento ignorado para ${userDisplayLabel}: Librería "${librarySectionTitle}" no coincide con las librerías monitoreadas (${combinedMonitored.join(', ')})`,
          },
        });
        return { ignored: true, reason: 'LIBRARY_NOT_MONITORED' };
      }
    }

    const threshold = user.settings?.completionPercentage ?? 85;
    const isScrobbleEvent =
      event === 'media.scrobble' ||
      (event === 'media.stop' && viewPercentage >= threshold) ||
      (event === 'media.pause' && viewPercentage >= threshold);

    if (!isScrobbleEvent && event !== 'media.rate') {
      return { received: true, processed: false, reason: `EVENT_${event}_PROGRESS_${viewPercentage}_THRESHOLD_${threshold}` };
    }

    const isBlacklisted = user.blacklist.some((b) =>
      showTitle.toLowerCase().includes(b.titlePattern.toLowerCase()),
    );
    if (isBlacklisted) {
      return {
        processed: false,
        status: 'IGNORED_BLACKLIST',
        message: `El título "${showTitle}" está en la lista de prohibidos.`,
      };
    }

    const lockKey = `${user.id}:${(showTitle || '').trim().toLowerCase()}:${seasonNumber || 1}:${episodeNumber}`;
    return this.scrobbleLock.acquire(lockKey, async () => {
      // 0. Deduplicación inteligente: evitar scrobbles duplicados si ya existe una entrada idéntica reciente (últimas 2 horas)
      const recentDuplicate = await this.prisma.scrobbleHistory.findFirst({
        where: {
          userId: user.id,
          showTitle: { equals: showTitle, mode: 'insensitive' },
          seasonNumber: seasonNumber || 1,
          episodeNumber,
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentDuplicate) {
        const consolidatedPercentage = Math.max(recentDuplicate.viewPercentage, Math.max(viewPercentage, threshold));
        const updatedEntry = await this.prisma.scrobbleHistory.update({
          where: { id: recentDuplicate.id },
          data: {
            viewPercentage: consolidatedPercentage,
            payloadSnapshot: evt.rawPayload as any,
          },
        });

        this.logger.log(
          `Scrobble duplicado omitido y consolidado para @${user.username}: "${showTitle}" Ep. ${episodeNumber} (${consolidatedPercentage}%)`,
        );

        return {
          processed: true,
          status: 'SCROBBLE_DEDUPLICATED',
          message: `Scrobble consolidado al ${consolidatedPercentage}%.`,
          historyEntry: updatedEntry,
        };
      }

      // 1. Mapeo de Título (TitleMapping) por Título y Temporada específica
      let mapping = await this.prisma.titleMapping.findFirst({
        where: {
          userId: user.id,
          plexTitle: { equals: showTitle, mode: 'insensitive' },
          plexSeason: seasonNumber || 1,
        },
      });

      if (!mapping) {
        // Buscar si existe un mapeo global oficial del sistema creado por administradores
        mapping = await this.prisma.titleMapping.findFirst({
          where: {
            isGlobal: true,
            plexTitle: { equals: showTitle, mode: 'insensitive' },
            plexSeason: seasonNumber || 1,
          },
        });
        if (mapping) {
          this.logger.log(
            `Mapeo global oficial aplicado para "${showTitle}" (Temporada ${seasonNumber || 1}) -> AniList Media ID ${mapping.anilistMediaId}`,
          );
        }
      }

      let anilistMediaId = mapping?.anilistMediaId;
      let anilistTitle = mapping?.anilistTitle;
      let malMediaId = mapping?.malMediaId;

      const blockedGenres: string[] = user.settings?.blockedGenres || [];

      if (!mapping) {
        try {
          const searchResults = await this.anilistService.searchAnime(showTitle, seasonNumber || 1);
          if (searchResults && searchResults.length > 0) {
            const match = searchResults[0];

            // Validar si el anime encontrado coincide con algún género bloqueado
            if (blockedGenres.length > 0 && Array.isArray(match.genres)) {
              const matchedBlockedGenre = match.genres.find((g: string) =>
                blockedGenres.some((bg) => bg.toLowerCase() === g.toLowerCase()),
              );
              if (matchedBlockedGenre) {
                this.logger.warn(`Scrobble descartado por género excluido ("${matchedBlockedGenre}") para "${showTitle}"`);
                return {
                  processed: false,
                  status: 'IGNORED_BLACKLIST_GENRE',
                  message: `El anime "${showTitle}" coincide con el género excluido "${matchedBlockedGenre}".`,
                };
              }
            }

            anilistMediaId = match.id;
            anilistTitle = match.title?.romaji || match.title?.english || match.title?.native;
            malMediaId = match.idMal || null;

            mapping = await this.prisma.titleMapping.create({
              data: {
                userId: user.id,
                plexTitle: showTitle,
                plexSeason: seasonNumber || 1,
                anilistMediaId,
                anilistTitle,
                malMediaId,
                malTitle: anilistTitle,
                confidenceScore: 0.95,
                isApproved: user.settings?.autoApproveMappings ?? true,
                isManual: false,
              },
            });
            this.logger.log(`Auto-mapping generado: "${showTitle}" (Temporada ${seasonNumber || 1}) -> AniList Media ID ${anilistMediaId} ("${anilistTitle}")`);
          }
        } catch (err: any) {
          this.logger.warn(`No se pudo resolver auto-mapping para "${showTitle}" (Temporada ${seasonNumber || 1}): ${err.message}`);
        }
      }

      // Si el mapeo no está aprobado por el usuario, retener la sincronización remota
      const isMappingPendingApproval = Boolean(mapping && !mapping.isApproved);

      let anilistSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let malSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let kitsuSyncStatus: SyncStatus = SyncStatus.SKIPPED;
      let syncErrorMessage: string | null = isMappingPendingApproval
        ? 'Mapeo pendiente de aprobación por el usuario.'
        : null;

      const preferredTracker = user.settings?.preferredTracker || 'BOTH';

      // 2. Sincronización Real con AniList vía GraphQL Mutation (solo si el mapeo está aprobado)
      const canSyncAnilist = !isMappingPendingApproval &&
                             (user.settings?.canSyncAnilist ?? true) && 
                             (user.settings?.canScrobble ?? true) && 
                             (preferredTracker === 'BOTH' || preferredTracker === 'ANILIST');
      if (canSyncAnilist && anilistMediaId) {
        try {
          const ratingVal = user.settings?.syncRatings ? (rating ? Number(rating) : undefined) : undefined;
          const anilistRes = await this.anilistService.updateProgress(
            user.id,
            anilistMediaId,
            episodeNumber,
            'CURRENT',
            ratingVal,
          );

          if (anilistRes.success) {
            anilistSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`AniList sincronizado con éxito para @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else {
            anilistSyncStatus = SyncStatus.FAILED;
            syncErrorMessage = `AniList error: ${anilistRes.error || anilistRes.reason}`;
          }
        } catch (err: any) {
          anilistSyncStatus = SyncStatus.FAILED;
          syncErrorMessage = `AniList error: ${err.message}`;
        }
      }

      // 3. Sincronización con MyAnimeList si está habilitado (solo si el mapeo está aprobado)
      const canSyncMal = !isMappingPendingApproval &&
                         (user.settings?.canSyncMal ?? true) && 
                         (user.settings?.canScrobble ?? true) && 
                         (preferredTracker === 'BOTH' || preferredTracker === 'MAL');

      let effectiveMalId = malMediaId;
      if (canSyncMal && !effectiveMalId && anilistMediaId) {
        try {
          const alRes = await axios.post(
            'https://graphql.anilist.co',
            {
              query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
              variables: { id: anilistMediaId },
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
          );
          const resolvedMalId = alRes.data?.data?.Media?.idMal;
          if (resolvedMalId) {
            effectiveMalId = resolvedMalId;
            await this.prisma.titleMapping.updateMany({
              where: { anilistMediaId, malMediaId: null },
              data: { malMediaId: resolvedMalId },
            }).catch(() => {});
          }
        } catch (e: any) {
          this.logger.warn(`No se pudo resolver idMal desde AniList para ID ${anilistMediaId}: ${e.message}`);
        }
      }

      if (canSyncMal && effectiveMalId) {
        try {
          const malRes = await this.malService.updateProgress(
            user.id,
            effectiveMalId,
            episodeNumber,
            'watching',
            user.settings?.syncRatings ? (rating ? Number(rating) : undefined) : undefined,
          );
          if (malRes.success) {
            malSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`MyAnimeList sincronizado con éxito para @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else if (malRes.reason !== 'MyAnimeList no está conectado.') {
            malSyncStatus = SyncStatus.FAILED;
            if (!syncErrorMessage) syncErrorMessage = `MAL error: ${malRes.error || malRes.reason}`;
          }
        } catch (err: any) {
          malSyncStatus = SyncStatus.FAILED;
          if (!syncErrorMessage) syncErrorMessage = `MAL error: ${err.message}`;
        }
      }

      // 3.5 Sincronización con Kitsu si está conectado (solo si el mapeo está aprobado)
      const canSyncKitsu = !isMappingPendingApproval &&
                           (user.settings?.canSyncKitsu ?? true) && 
                           (user.settings?.canScrobble ?? true) &&
                           (preferredTracker === 'BOTH' || preferredTracker === 'KITSU');
      let kitsuMediaId = mapping?.kitsuMediaId;

      if (canSyncKitsu && !kitsuMediaId) {
        try {
          const kitsuResults = await this.kitsuService.searchAnime(showTitle, 1);
          if (kitsuResults && kitsuResults.length > 0) {
            kitsuMediaId = kitsuResults[0].kitsuId;
            if (mapping) {
              await this.prisma.titleMapping.update({
                where: { id: mapping.id },
                data: { kitsuMediaId, kitsuTitle: kitsuResults[0].title },
              }).catch(() => {});
            }
          }
        } catch (e: any) {
          this.logger.warn(`No se pudo resolver ID de Kitsu para "${showTitle}": ${e.message}`);
        }
      }

      if (canSyncKitsu && kitsuMediaId) {
        try {
          const ratingTwenty = rating ? Math.round(Number(rating) * 2) : undefined;
          const kitsuRes = await this.kitsuService.updateProgress(
            user.id,
            kitsuMediaId,
            episodeNumber,
            'current',
            ratingTwenty,
          );
          if (kitsuRes.success) {
            kitsuSyncStatus = SyncStatus.SUCCESS;
            this.logger.log(`Kitsu sincronizado con éxito para @${user.username}: "${showTitle}" Ep. ${episodeNumber}`);
          } else if (kitsuRes.message !== 'Kitsu no está conectado para este usuario.') {
            kitsuSyncStatus = SyncStatus.FAILED;
            if (!syncErrorMessage) syncErrorMessage = `Kitsu error: ${kitsuRes.message}`;
          }
        } catch (err: any) {
          kitsuSyncStatus = SyncStatus.FAILED;
          if (!syncErrorMessage) syncErrorMessage = `Kitsu error: ${err.message}`;
        }
      }

      // 4. Registrar en ScrobbleHistory
      const historyEntry = await this.prisma.scrobbleHistory.create({
        data: {
          userId: user.id,
          showTitle,
          episodeNumber,
          seasonNumber,
          viewPercentage: Math.max(viewPercentage, threshold),
          rating: rating ? Number(rating) : null,
          anilistStatus: anilistSyncStatus,
          malStatus: malSyncStatus,
          kitsuStatus: kitsuSyncStatus,
          source,
          serverName: evt.serverTitle || null,
          libraryName: librarySectionTitle || null,
          errorMessage: syncErrorMessage,
          viewedAt: new Date(),
          payloadSnapshot: evt.rawPayload as any,
        },
      });

      // 4.5 Pre-cachear inmediatamente la portada en disco para que el historial nunca la muestre rota
      this.coversService.getOrFetchCover(showTitle, anilistMediaId).catch(() => {});

      if (isMappingPendingApproval) {
        await this.prisma.auditLog.create({
          data: {
            level: 'WARN',
            service: `${source}_SCROBBLE`,
            message: `Scrobble retenido para @${user.username}: El mapeo para "${showTitle}" (Temporada ${seasonNumber || 1}) está pendiente de aprobación.`,
            details: {
              userId: user.id,
              showTitle,
              seasonNumber,
              episodeNumber,
              mappingId: mapping?.id,
            },
          },
        });

        this.notificationsService.notifyUnmappedAnime(user, {
          showTitle,
          seasonNumber,
          episodeNumber,
          viewPercentage,
          frontendUrl: process.env.FRONTEND_URL,
          source,
        }).catch((e) => this.logger.warn(`Error al emitir notificación: ${e.message}`));

        await this.touchLastSync(user.id, source);

        return {
          processed: true,
          status: 'MAPPING_PENDING_APPROVAL',
          historyEntry,
          message: `Scrobble registrado localmente pero no sincronizado: el mapeo para "${showTitle}" requiere aprobación manual.`,
        };
      }

      // 4.6 Si el anime no se sincronizó (ningún tracker exitoso) o no tenía mapeo, notificar al usuario (In-App y Discord)
      const isAnySynced = anilistSyncStatus === SyncStatus.SUCCESS || malSyncStatus === SyncStatus.SUCCESS || kitsuSyncStatus === SyncStatus.SUCCESS;
      if (!mapping || !isAnySynced) {
        this.notificationsService.notifyUnmappedAnime(user, {
          showTitle,
          seasonNumber,
          episodeNumber,
          viewPercentage,
          frontendUrl: process.env.FRONTEND_URL,
          source,
        }).catch((e) => this.logger.warn(`Error al emitir notificación: ${e.message}`));
      }

      // 5. Actualizar última sincronización de la conexión de origen (si existe)
      await this.touchLastSync(user.id, source);

      // 6. Registrar en AuditLog para Consola de Logs Admin
      await this.prisma.auditLog.create({
        data: {
          level: anilistSyncStatus === SyncStatus.SUCCESS ? 'INFO' : 'WARN',
          service: `${source}_SCROBBLE`,
          message: `Webhook scrobble @${user.username}: "${showTitle} - Ep ${episodeNumber}" (AniList: ${anilistSyncStatus}, MAL: ${malSyncStatus})`,
          details: {
            showTitle,
            episodeNumber,
            anilistMediaId,
            anilistStatus: anilistSyncStatus,
            malStatus: malSyncStatus,
          },
        },
      });

      return {
        processed: true,
        status: 'SCROBBLED_SUCCESS',
        historyEntry,
        anilistSyncStatus,
        malSyncStatus,
        message: `Scrobble registrado: "${showTitle}" Ep. ${episodeNumber} -> AniList: ${anilistSyncStatus}`,
      };
    });
  }

  /**
   * Qué usuario "dueño de conexión" comparar contra la cuenta que reprodujo,
   * según el origen (plexUsername vs jellyfinUsername). Único punto que sabe
   * que cada fuente guarda esto en una tabla de conexión distinta.
   */
  private getConnectionUsername(user: any, source: ScrobbleSource): string {
    if (source === 'JELLYFIN') return user?.jellyfinConnection?.jellyfinUsername || '';
    if (source === 'EMBY') return user?.embyConnection?.embyUsername || '';
    return user?.plexConnection?.plexUsername || '';
  }

  private getConnectionMonitoredLibraries(user: any, source: ScrobbleSource): string[] {
    if (source === 'JELLYFIN') return user?.jellyfinConnection?.monitoredLibraries || [];
    if (source === 'EMBY') return user?.embyConnection?.monitoredLibraries || [];
    return user?.plexConnection?.monitoredLibraries || [];
  }

  // updateMany en vez de update+guard: si el usuario no tiene conexión de ese
  // origen (ya no debería ocurrir en este punto, pero por defensa) no revienta
  // con un P2025, simplemente no actualiza ninguna fila.
  private async touchLastSync(userId: string, source: ScrobbleSource) {
    if (source === 'JELLYFIN') {
      await this.prisma.jellyfinConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    } else if (source === 'EMBY') {
      await this.prisma.embyConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    } else {
      await this.prisma.plexConnection.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
    }
  }

  /**
   * Busca qué cuenta de SyncSekai tiene vinculado, en su conexión del origen dado,
   * el nombre de usuario que reportó la reproducción (reparto entre usuarios
   * compartidos de un mismo servidor de origen).
   * Solo busca entre conexiones activas del mismo servidor. Nunca por username global.
   */
  private async findUserByConnectionUsername(
    source: ScrobbleSource,
    accountUsername: string,
    webhookOwner: any,
  ) {
    const usernameFilter = { equals: accountUsername, mode: 'insensitive' as const };
    let connectionFilter: Prisma.UserWhereInput;

    if (source === 'JELLYFIN') {
      const ownerConn = webhookOwner?.jellyfinConnection;
      connectionFilter = {
        jellyfinConnection: {
          jellyfinUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    } else if (source === 'EMBY') {
      const ownerConn = webhookOwner?.embyConnection;
      connectionFilter = {
        embyConnection: {
          embyUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    } else {
      const ownerConn = webhookOwner?.plexConnection;
      connectionFilter = {
        plexConnection: {
          plexUsername: usernameFilter,
          isConnected: true,
          ...(ownerConn?.serverUrl ? { serverUrl: ownerConn.serverUrl } : {}),
        },
      };
    }

    return this.prisma.user.findFirst({
      where: {
        ...connectionFilter,
        isActive: true,
        settings: { isSuspended: false },
      },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
      },
    });
  }

  async hasWebhookToken(webhookToken: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { webhookToken },
      select: { id: true, isActive: true },
    });
    return Boolean(user?.isActive);
  }
}
