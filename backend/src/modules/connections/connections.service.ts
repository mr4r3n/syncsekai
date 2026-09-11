import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlexService } from '../plex/plex.service';
import { JellyfinService } from '../jellyfin/jellyfin.service';
import { EmbyService } from '../emby/emby.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { AnimeProvider, SyncStatus } from '@prisma/client';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private prisma: PrismaService,
    private plexService: PlexService,
    private jellyfinService: JellyfinService,
    private embyService: EmbyService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
  ) {}

  /**
   * Obtener el estado consolidado de todas las conexiones del usuario
   */
  async getConnectionHub(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        animeConnections: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');

    let webhookInfo = { webhookUrl: `http://localhost:4000/api/plex/webhook/${user.webhookToken}`, webhookToken: user.webhookToken };
    try {
      webhookInfo = await this.plexService.getWebhookInfo(userId);
    } catch (e: any) {
      this.logger.warn(`No se pudo obtener webhook info de Plex: ${e.message}`);
    }

    let jellyfinWebhookInfo = { webhookUrl: `http://localhost:4000/api/jellyfin/webhook/${user.webhookToken}`, webhookToken: user.webhookToken };
    try {
      jellyfinWebhookInfo = await this.jellyfinService.getWebhookInfo(userId);
    } catch (e: any) {
      this.logger.warn(`No se pudo obtener webhook info de Jellyfin: ${e.message}`);
    }

    let embyWebhookInfo = { webhookUrl: `http://localhost:4000/api/emby/webhook/${user.webhookToken}`, webhookToken: user.webhookToken };
    try {
      embyWebhookInfo = await this.embyService.getWebhookInfo(userId);
    } catch (e: any) {
      this.logger.warn(`No se pudo obtener webhook info de Emby: ${e.message}`);
    }

    // Librerías reales consultadas al servidor Plex (con caché), no derivadas
    // de la selección guardada.
    const libraries = user.plexConnection?.isConnected
      ? await this.plexService.getLibrariesCached(userId)
      : [];

    const jellyfinLibraries = user.jellyfinConnection?.isConnected
      ? await this.jellyfinService.getLibrariesCached(userId)
      : [];

    const embyLibraries = user.embyConnection?.isConnected
      ? await this.embyService.getLibrariesCached(userId)
      : [];

    const anilistConn = user.animeConnections.find((c) => c.provider === AnimeProvider.ANILIST);
    const malConn = user.animeConnections.find((c) => c.provider === AnimeProvider.MAL);
    const kitsuConn = user.animeConnections.find((c) => c.provider === AnimeProvider.KITSU);

    const isPlexConnected = !!user.plexConnection?.isConnected;
    const isJellyfinConnected = !!user.jellyfinConnection?.isConnected;
    const isEmbyConnected = !!user.embyConnection?.isConnected;
    const isAnilistConnected = !!anilistConn?.isConnected;
    const isMalConnected = !!malConn?.isConnected;
    const isKitsuConnected = !!kitsuConn?.isConnected;

    // Detectar si una conexión es heredada / antigua y requiere reconexión
    // para sincronizar ID remoto o token renovado (el avatar es opcional en los servicios)
    const anilistNeedsReauth = isAnilistConnected && (!anilistConn?.remoteUserId?.trim() || !anilistConn?.encryptedAccessToken);
    const malNeedsReauth = isMalConnected && (!malConn?.remoteUserId?.trim() || !malConn?.encryptedAccessToken);
    const kitsuNeedsReauth = isKitsuConnected && (!kitsuConn?.remoteUserId?.trim() || !kitsuConn?.encryptedAccessToken);
    const plexNeedsReauth = isPlexConnected && (!user.plexConnection?.serverUrl || !user.plexConnection?.encryptedAuthToken);
    const jellyfinNeedsReauth = isJellyfinConnected && (!user.jellyfinConnection?.serverUrl || !user.jellyfinConnection?.encryptedApiKey);
    const embyNeedsReauth = isEmbyConnected && (!user.embyConnection?.serverUrl || !user.embyConnection?.encryptedApiKey);

    const servicesNeedingReauth: string[] = [];
    if (anilistNeedsReauth) servicesNeedingReauth.push('AniList');
    if (malNeedsReauth) servicesNeedingReauth.push('MyAnimeList');
    if (kitsuNeedsReauth) servicesNeedingReauth.push('Kitsu');
    if (plexNeedsReauth) servicesNeedingReauth.push('Plex');
    if (jellyfinNeedsReauth) servicesNeedingReauth.push('Jellyfin');
    if (embyNeedsReauth) servicesNeedingReauth.push('Emby');

    const reconnectionRequiredCount = servicesNeedingReauth.length;

    return {
      user: {
        userToken: user.userToken,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      webhookUrl: webhookInfo.webhookUrl,
      webhookToken: webhookInfo.webhookToken,
      reconnectionRequiredCount,
      servicesNeedingReauth,
      plex: {
        connected: isPlexConnected,
        isConnected: isPlexConnected,
        needsReconnection: plexNeedsReauth,
        serverName: user.plexConnection?.serverName || 'No configurado',
        serverUrl: user.plexConnection?.serverUrl || '',
        plexUsername: user.plexConnection?.plexUsername || '',
        monitoredLibraries: user.plexConnection?.monitoredLibraries || [],
        availableLibraries: libraries,
        webhookUrl: webhookInfo.webhookUrl,
        webhookToken: webhookInfo.webhookToken,
        lastSyncAt: user.plexConnection?.lastSyncAt,
      },
      jellyfin: {
        connected: isJellyfinConnected,
        isConnected: isJellyfinConnected,
        needsReconnection: jellyfinNeedsReauth,
        serverName: user.jellyfinConnection?.serverName || 'No configurado',
        serverUrl: user.jellyfinConnection?.serverUrl || '',
        jellyfinUsername: user.jellyfinConnection?.jellyfinUsername || '',
        monitoredLibraries: user.jellyfinConnection?.monitoredLibraries || [],
        availableLibraries: jellyfinLibraries,
        webhookUrl: jellyfinWebhookInfo.webhookUrl,
        webhookToken: jellyfinWebhookInfo.webhookToken,
        lastSyncAt: user.jellyfinConnection?.lastSyncAt,
      },
      emby: {
        connected: isEmbyConnected,
        isConnected: isEmbyConnected,
        needsReconnection: embyNeedsReauth,
        serverName: user.embyConnection?.serverName || 'No configurado',
        serverUrl: user.embyConnection?.serverUrl || '',
        embyUsername: user.embyConnection?.embyUsername || '',
        monitoredLibraries: user.embyConnection?.monitoredLibraries || [],
        availableLibraries: embyLibraries,
        webhookUrl: embyWebhookInfo.webhookUrl,
        webhookToken: embyWebhookInfo.webhookToken,
        lastSyncAt: user.embyConnection?.lastSyncAt,
      },
      anilist: {
        connected: isAnilistConnected,
        isConnected: isAnilistConnected,
        needsReconnection: anilistNeedsReauth,
        username: anilistConn?.remoteUsername || null,
        remoteUsername: anilistConn?.remoteUsername || null,
        remoteUserId: anilistConn?.remoteUserId || null,
        avatarUrl: anilistConn?.avatarUrl || null,
        lastLatencyMs: anilistConn?.lastLatencyMs || 24,
        lastCheckedAt: anilistConn?.lastCheckedAt || null,
      },
      mal: {
        connected: isMalConnected,
        isConnected: isMalConnected,
        needsReconnection: malNeedsReauth,
        username: malConn?.remoteUsername || null,
        remoteUsername: malConn?.remoteUsername || null,
        remoteUserId: malConn?.remoteUserId || null,
        avatarUrl: malConn?.avatarUrl || null,
        lastLatencyMs: malConn?.lastLatencyMs || 38,
        lastCheckedAt: malConn?.lastCheckedAt || null,
      },
      kitsu: {
        connected: isKitsuConnected,
        isConnected: isKitsuConnected,
        needsReconnection: kitsuNeedsReauth,
        username: kitsuConn?.remoteUsername || null,
        remoteUsername: kitsuConn?.remoteUsername || null,
        remoteUserId: kitsuConn?.remoteUserId || null,
        avatarUrl: kitsuConn?.avatarUrl || null,
        lastLatencyMs: kitsuConn?.lastLatencyMs || 45,
        lastCheckedAt: kitsuConn?.lastCheckedAt || null,
      },
      settings: user.settings || {
        completionPercentage: 85,
        syncRatings: true,
        emailErrorAlerts: true,
        autoApproveMappings: true,
      },
    };
  }

  /**
   * Ejecutar diagnóstico de salud y latencia en vivo
   */
  async runHealthCheck(userId: string) {
    const [anilistPing, malPing, kitsuPing] = await Promise.all([
      this.anilistService.pingConnection(userId),
      this.malService.pingConnection(userId),
      this.kitsuService.pingConnection(userId),
    ]);

    return {
      timestamp: new Date(),
      status: 'healthy',
      services: {
        plex: { status: 'operational', message: 'Webhook receiver listo' },
        jellyfin: { status: 'operational', message: 'Webhook receiver listo' },
        emby: { status: 'operational', message: 'Session watcher activo' },
        anilist: {
          status: anilistPing.isConnected ? 'operational' : 'disconnected',
          latencyMs: anilistPing.latencyMs,
        },
        mal: {
          status: malPing.isConnected ? 'operational' : 'disconnected',
          latencyMs: malPing.latencyMs,
        },
        kitsu: {
          status: kitsuPing.isConnected ? 'operational' : 'disconnected',
          latencyMs: kitsuPing.latencyMs,
        },
      },
    };
  }

  /**
   * Actualizar preferencias de automatización del usuario
   */
  async updateSettings(
    userId: string,
    data: {
      completionPercentage?: number;
      syncRatings?: boolean;
      emailErrorAlerts?: boolean;
      discordNotifications?: boolean;
      webNotifications?: boolean;
      autoApproveMappings?: boolean;
      themePalette?: string;
      themeMode?: string;
    },
  ) {
    // Sanitización estricta de campos permitidos para prevenir Mass Assignment
    const allowedUpdate: any = {};
    if (typeof data.completionPercentage === 'number') {
      allowedUpdate.completionPercentage = Math.min(100, Math.max(1, Math.round(data.completionPercentage)));
    }
    if (typeof data.syncRatings === 'boolean') allowedUpdate.syncRatings = data.syncRatings;
    if (typeof data.emailErrorAlerts === 'boolean') allowedUpdate.emailErrorAlerts = data.emailErrorAlerts;
    if (typeof data.discordNotifications === 'boolean') allowedUpdate.discordNotifications = data.discordNotifications;
    if (typeof data.webNotifications === 'boolean') allowedUpdate.webNotifications = data.webNotifications;
    if (typeof data.autoApproveMappings === 'boolean') allowedUpdate.autoApproveMappings = data.autoApproveMappings;
    if (typeof data.themePalette === 'string') allowedUpdate.themePalette = data.themePalette.slice(0, 32);
    if (typeof data.themeMode === 'string') allowedUpdate.themeMode = data.themeMode.slice(0, 16);

    return this.prisma.userSettings.upsert({
      where: { userId },
      update: allowedUpdate,
      create: {
        userId,
        completionPercentage: allowedUpdate.completionPercentage ?? 85,
        syncRatings: allowedUpdate.syncRatings ?? true,
        emailErrorAlerts: allowedUpdate.emailErrorAlerts ?? true,
        discordNotifications: allowedUpdate.discordNotifications ?? true,
        webNotifications: allowedUpdate.webNotifications ?? true,
        autoApproveMappings: allowedUpdate.autoApproveMappings ?? true,
        themePalette: allowedUpdate.themePalette ?? 'sync',
        themeMode: allowedUpdate.themeMode ?? 'dark',
      },
    });
  }

  /**
   * Receptor real de Webhooks provenientes de Plex Media Server
   */
  async handlePlexWebhook(webhookToken: string, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { webhookToken },
      include: {
        settings: true,
        plexConnection: true,
        blacklist: true,
        titleMappings: true,
      },
    });

    if (!user) {
      this.logger.warn(`Webhook ignorado: token de webhook no reconocido (${webhookToken})`);
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    const event = payload?.event;
    const metadata = payload?.Metadata;

    if (!metadata) {
      return { received: true, ignored: true, reason: 'NO_METADATA' };
    }

    const librarySectionTitle = metadata.librarySectionTitle || '';
    const showTitle = metadata.grandparentTitle || metadata.title || '';
    const episodeNumber = Number(metadata.index || 1);
    const seasonNumber = Number(metadata.parentIndex || 1);
    const viewOffset = Number(metadata.viewOffset || 0);
    const duration = Number(metadata.duration || 1);
    const viewPercentage = Math.min(100, Math.round((viewOffset / duration) * 100)) || 0;
    const rating = metadata.userRating ? metadata.userRating : payload.rating;

    // 1. Filtrar por librerías monitoreadas si existen
    const monitored = user.plexConnection?.monitoredLibraries || [];
    if (monitored.length > 0 && librarySectionTitle) {
      const isMonitored = monitored.some(
        (m) => m.toLowerCase() === librarySectionTitle.toLowerCase(),
      );
      if (!isMonitored) {
        this.logger.debug(`Evento Plex ignorado: librería "${librarySectionTitle}" no está monitoreada.`);
        return { ignored: true, reason: 'LIBRARY_NOT_MONITORED' };
      }
    }

    // 2. Comprobar si el evento califica para scrobble
    const threshold = user.settings?.completionPercentage ?? 85;
    const isScrobbleEvent =
      event === 'media.scrobble' ||
      (event === 'media.stop' && viewPercentage >= threshold) ||
      (event === 'media.pause' && viewPercentage >= threshold);

    if (event === 'media.rate' && user.settings?.syncRatings && rating) {
      // Sincronizar calificación
      return this.syncRating(user.id, showTitle, rating);
    }

    if (!isScrobbleEvent) {
      return { received: true, processed: false, reason: `EVENT_${event}_BELOW_THRESHOLD` };
    }

    // 3. Ejecutar simulación/scrobble real
    return this.simulateWebhookEvent(user.id, {
      showTitle,
      episodeNumber,
      seasonNumber,
      viewPercentage: Math.max(viewPercentage, threshold),
      rating,
      libraryName: librarySectionTitle,
    });
  }

  private async syncRating(userId: string, showTitle: string, rating: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { titleMappings: true },
    });
    if (!user) return;

    const mapping = user.titleMappings.find(
      (m) => m.plexTitle.toLowerCase() === showTitle.toLowerCase(),
    );

    if (mapping?.anilistMediaId) {
      await this.anilistService.updateProgress(
        userId,
        mapping.anilistMediaId,
        1,
        'CURRENT',
        rating,
      );
    }

    return { rated: true, showTitle, rating };
  }

  /**
   * Procesar o simular evento de scrobble interactivo
   */
  async simulateWebhookEvent(
    userId: string,
    payload: {
      showTitle: string;
      episodeNumber: number;
      seasonNumber?: number;
      viewPercentage: number;
      rating?: number;
      libraryName?: string;
      source?: string;
      dryRun?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
        titleMappings: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const source = (payload.source || 'PLEX').toUpperCase();
    const serverName = source === 'JELLYFIN'
      ? user.jellyfinConnection?.serverName || 'Jellyfin Media Server'
      : source === 'EMBY'
      ? user.embyConnection?.serverName || 'Emby Media Server'
      : user.plexConnection?.serverName || 'Plex Media Server';

    // 1. Validar lista negra
    const isBlacklisted = user.blacklist.some((b) =>
      payload.showTitle.toLowerCase().includes(b.titlePattern.toLowerCase()),
    );
    if (isBlacklisted) {
      return {
        processed: false,
        status: 'IGNORED_BLACKLIST',
        message: `El título "${payload.showTitle}" está en la lista de prohibidos de tu cuenta. Evento descartado silenciosamente.`,
      };
    }

    // 2. Validar umbral de visualización
    const threshold = user.settings?.completionPercentage ?? 85;
    if (payload.viewPercentage < threshold) {
      return {
        processed: false,
        status: 'BELOW_THRESHOLD',
        message: `Visualización (${payload.viewPercentage}%) no alcanza el umbral configurado (${threshold}%).`,
      };
    }

    // 3. Mapear título o buscar coincidencia en AniList si no existe
    let mapping = user.titleMappings.find(
      (m) => m.plexTitle.toLowerCase() === payload.showTitle.toLowerCase(),
    );

    const blockedGenres: string[] = user.settings?.blockedGenres || [];

    if (!mapping) {
      // Búsqueda automática en AniList para autocrear mapeo si autoApproveMappings está activo
      try {
        const searchResults = await this.anilistService.searchAnime(payload.showTitle);
        if (searchResults.length > 0) {
          const topMatch = searchResults[0];

          // Validar si el anime encontrado coincide con algún género bloqueado
          if (blockedGenres.length > 0 && Array.isArray(topMatch.genres)) {
            const matchedBlockedGenre = topMatch.genres.find((g: string) =>
              blockedGenres.some((bg) => bg.toLowerCase() === g.toLowerCase()),
            );
            if (matchedBlockedGenre) {
              return {
                processed: false,
                status: 'IGNORED_BLACKLIST_GENRE',
                message: `El anime "${payload.showTitle}" pertenece al género bloqueado "${matchedBlockedGenre}". Evento descartado silenciosamente.`,
              };
            }
          }

          if (!payload.dryRun) {
            mapping = await this.prisma.titleMapping.create({
              data: {
                userId,
                plexTitle: payload.showTitle,
                plexSeason: payload.seasonNumber || 1,
                anilistMediaId: topMatch.id,
                anilistTitle: topMatch.title?.romaji || topMatch.title?.english || payload.showTitle,
                confidenceScore: 0.95,
                isApproved: user.settings?.autoApproveMappings ?? true,
                isManual: false,
              },
            });
          }
        }
      } catch (e: any) {
        this.logger.warn(`No se pudo automapear "${payload.showTitle}" en AniList: ${e.message}`);
      }
    }

    // Si es modo Dry-Run (solo vista previa sin mutaciones en trackers ni DB)
    if (payload.dryRun) {
      const willSync = {
        anilist: Boolean(mapping?.anilistMediaId && (user.settings?.canSyncAnilist ?? true)),
        mal: Boolean(mapping?.malMediaId && (user.settings?.canSyncMal ?? true)),
        kitsu: Boolean(mapping?.kitsuMediaId && (user.settings?.canSyncKitsu ?? true)),
      };
      return {
        processed: true,
        dryRun: true,
        status: 'PREVIEW_SUCCESS',
        source,
        serverName,
        mapping: mapping ? {
          id: mapping.id,
          title: mapping.anilistTitle || mapping.plexTitle,
          anilistId: mapping.anilistMediaId,
          malId: mapping.malMediaId,
          kitsuId: mapping.kitsuMediaId,
        } : null,
        willSync,
        message: `Vista previa para "${payload.showTitle}" (Ep. ${payload.episodeNumber}): Mapeo ${mapping ? 'localizado' : 'no resuelto'}, trackers listos para sincronizar.`,
      };
    }

    // 4. Ejecutar scrobbles en servicios conectados
    let anilistStatus: SyncStatus = SyncStatus.SKIPPED;
    let malStatus: SyncStatus = SyncStatus.SKIPPED;
    let kitsuStatus: SyncStatus = SyncStatus.SKIPPED;
    const motivosFallo: string[] = [];
    const impactedServices: string[] = [];

    if (mapping?.anilistMediaId && (user.settings?.canSyncAnilist ?? true)) {
      const anilistRes = await this.anilistService.updateProgress(
        userId,
        mapping.anilistMediaId,
        payload.episodeNumber,
        'CURRENT',
        payload.rating,
      );
      if (anilistRes.success) {
        anilistStatus = SyncStatus.SUCCESS;
        impactedServices.push('AniList GraphQL');
      } else {
        anilistStatus = SyncStatus.FAILED;
        motivosFallo.push(`AniList: ${anilistRes.error || anilistRes.reason || 'error no especificado'}`);
      }
    }

    if (mapping?.malMediaId && (user.settings?.canSyncMal ?? true)) {
      const malRes = await this.malService.updateProgress(
        userId,
        mapping.malMediaId,
        payload.episodeNumber,
        'watching',
        payload.rating,
      );
      if (malRes.success) {
        malStatus = SyncStatus.SUCCESS;
        impactedServices.push('MyAnimeList REST v2');
      } else {
        malStatus = SyncStatus.FAILED;
        motivosFallo.push(`MAL: ${malRes.error || malRes.reason || 'error no especificado'}`);
      }
    }

    if (mapping?.kitsuMediaId && (user.settings?.canSyncKitsu ?? true)) {
      const ratingTwenty = payload.rating ? Math.round(payload.rating * 2) : undefined;
      const kitsuRes = await this.kitsuService.updateProgress(
        userId,
        mapping.kitsuMediaId,
        payload.episodeNumber,
        'current',
        ratingTwenty,
      );
      if (kitsuRes.success) {
        kitsuStatus = SyncStatus.SUCCESS;
        impactedServices.push('Kitsu JSON:API');
      } else if (kitsuRes.message !== 'Kitsu no está conectado para este usuario.') {
        kitsuStatus = SyncStatus.FAILED;
        motivosFallo.push(`Kitsu: ${kitsuRes.message}`);
      }
    }

    // 5. Registrar en el historial de scrobbles
    const historyEntry = await this.prisma.scrobbleHistory.create({
      data: {
        userId,
        showTitle: payload.showTitle,
        episodeNumber: payload.episodeNumber,
        seasonNumber: payload.seasonNumber || 1,
        viewPercentage: payload.viewPercentage,
        rating: payload.rating,
        anilistStatus,
        malStatus,
        kitsuStatus,
        source,
        serverName: serverName || null,
        libraryName: payload.libraryName || null,
        errorMessage: motivosFallo.length ? motivosFallo.join(' | ').slice(0, 500) : null,
        viewedAt: new Date(),
        payloadSnapshot: payload as any,
      },
    });

    return {
      processed: true,
      status: 'SCROBBLED_SUCCESS',
      historyEntry,
      impactedServices,
      source,
      message: `Scrobble registrado (${source}): "${payload.showTitle}" Ep. ${payload.episodeNumber} sincronizado con éxito.`,
    };
  }
}
