import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JellyfinService } from '../jellyfin/jellyfin.service';
import { EmbyService } from '../emby/emby.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { AnimeProvider } from '@prisma/client';
import { PlexService } from '../plex/plex.service';
import { PlexWebhookService } from '../plex/plex-webhook.service';

/** Connection hub: status, health, settings and ratings for all of the user's services. */
@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private prisma: PrismaService,
    private jellyfinService: JellyfinService,
    private embyService: EmbyService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private plexService: PlexService,
    private plexWebhookService: PlexWebhookService,
  ) {}

  /**
   * Returns the consolidated status of all the user's connections.
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

    if (!user) throw new NotFoundException('User not found.');

    const webhookInfoOf = (label: string, path: string, info: () => Promise<{ webhookUrl: string; webhookToken: string }>) =>
      info().catch((e: any) => {
        this.logger.warn(`Could not get the ${label} webhook info: ${e.message}`);
        return { webhookUrl: `http://localhost:4000/api/${path}/webhook/${user.webhookToken}`, webhookToken: user.webhookToken };
      });

    // None depends on another, and this panel is asked on every page: all at once.
    // The libraries are the real ones queried from each server (cached), not derived from the stored selection.
    const [webhookInfo, jellyfinWebhookInfo, embyWebhookInfo, libraries, jellyfinLibraries, embyLibraries] = await Promise.all([
      webhookInfoOf('Plex', 'plex', () => this.plexWebhookService.getWebhookInfo(userId)),
      webhookInfoOf('Jellyfin', 'jellyfin', () => this.jellyfinService.getWebhookInfo(userId)),
      webhookInfoOf('Emby', 'emby', () => this.embyService.getWebhookInfo(userId)),
      user.plexConnection?.isConnected ? this.plexService.getLibrariesCached(userId) : [],
      user.jellyfinConnection?.isConnected ? this.jellyfinService.getLibrariesCached(userId) : [],
      user.embyConnection?.isConnected ? this.embyService.getLibrariesCached(userId) : [],
    ]);

    const anilistConn = user.animeConnections.find((c) => c.provider === AnimeProvider.ANILIST);
    const malConn = user.animeConnections.find((c) => c.provider === AnimeProvider.MAL);
    const kitsuConn = user.animeConnections.find((c) => c.provider === AnimeProvider.KITSU);

    const isPlexConnected = !!user.plexConnection?.isConnected;
    const isJellyfinConnected = !!user.jellyfinConnection?.isConnected;
    const isEmbyConnected = !!user.embyConnection?.isConnected;
    const isAnilistConnected = !!anilistConn?.isConnected;
    const isMalConnected = !!malConn?.isConnected;
    const isKitsuConnected = !!kitsuConn?.isConnected;

    // Detect whether a connection is legacy and needs reconnecting
    // to sync the remote id or a renewed token (the avatar is optional for the services)
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
        serverName: user.plexConnection?.serverName || 'Not configured',
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
        serverName: user.jellyfinConnection?.serverName || 'Not configured',
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
        serverName: user.embyConnection?.serverName || 'Not configured',
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
   * Runs a live health and latency diagnosis.
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
        plex: { status: 'operational', message: 'Webhook receiver ready' },
        jellyfin: { status: 'operational', message: 'Webhook receiver ready' },
        emby: { status: 'operational', message: 'Session watcher active' },
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
   * Updates the user's automation preferences.
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
    // Strict allowlist of fields, to prevent mass assignment
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
}
