import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { EmbyService } from './emby.service';
import axios from 'axios';

interface TrackedEmbySession {
  sessionKey: string;
  connId: string;
  itemId: string;
  showTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  username: string;
  lastPercentage: number;
  state: string;
  scrobbled: boolean;
  lastUpdatedAt: number;
}

/**
 * Camino PRINCIPAL de integración con Emby (no un simple respaldo como en
 * Jellyfin): la notificación nativa "Webhooks" de Emby exige una suscripción
 * Premiere, así que este watcher (sondeo /Sessions cada 5s, igual que
 * plex-watcher/jellyfin-watcher) es el único método que funciona para el
 * 100% de los usuarios de Emby, tengan o no Premiere.
 */
@Injectable()
export class EmbyWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbyWatcherService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private readonly sessionsMap = new Map<string, TrackedEmbySession>();
  private isPolling = false;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private embyService: EmbyService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando Emby Live Session Watcher (método PRINCIPAL de integración, sondeo /Sessions cada 5s)...');
    this.intervalRef = setInterval(() => this.pollAllServers(), 5000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async pollAllServers() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const connections = await this.prisma.embyConnection.findMany({
        where: {
          isConnected: true,
          encryptedApiKey: { not: null },
          serverUrl: { not: null },
        },
        include: {
          user: {
            include: { settings: true, blacklist: true },
          },
        },
      });

      for (const conn of connections) {
        if (!conn.serverUrl || !conn.encryptedApiKey) continue;
        await this.pollServerSessions(conn);
      }
    } catch (e: any) {
      this.logger.warn(`Error en ciclo de polling de Emby: ${e.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  private async pollServerSessions(conn: any) {
    const user = conn.user;
    if (!user) return;

    let apiKey = '';
    try {
      apiKey = this.encryptionService.decrypt(conn.encryptedApiKey);
    } catch {
      return;
    }

    try {
      const target = await this.embyService.validateUserServerTarget(conn.serverUrl);
      const res = await axios.get(`${target.url}/Sessions`, {
        headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
        timeout: 4000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });

      const rawSessions: any[] = Array.isArray(res.data) ? res.data : [];
      const currentKeys = new Set<string>();

      for (const s of rawSessions) {
        const item = s?.NowPlayingItem;
        if (!item) continue; // sesión sin reproducción activa (solo conectado)

        const sessionKey = `${conn.id}_${s.Id || 'sess'}`;
        currentKeys.add(sessionKey);

        const showTitle = item.SeriesName || item.Name || 'Anime Desconocido';
        const episodeNumber = Number(item.IndexNumber || 1);
        const seasonNumber = Number(item.ParentIndexNumber || 1);
        const positionTicks = Number(s.PlayState?.PositionTicks || 0);
        const runtimeTicks = Number(item.RunTimeTicks || 1);
        const viewPercentage = Math.min(100, Math.round((positionTicks / runtimeTicks) * 100)) || 0;
        const playerState = s.PlayState?.IsPaused ? 'paused' : 'playing';
        const embyUser = (s.UserName || '').trim();
        const targetEmbyUser = (conn.embyUsername || user.username || '').trim();

        let effectiveUser = user;
        let isSharedUser = false;

        // Si la sesión pertenece a un usuario local de Emby distinto al vinculado:
        if (embyUser && targetEmbyUser && embyUser.toLowerCase() !== targetEmbyUser.toLowerCase()) {
          isSharedUser = true;
          const matchedUser = await this.prisma.user.findFirst({
            where: {
              embyConnection: {
                embyUsername: { equals: embyUser, mode: 'insensitive' },
                isConnected: true,
                ...(conn.serverUrl ? { serverUrl: conn.serverUrl } : {}),
              },
              isActive: true,
              settings: { isSuspended: false },
            },
            include: {
              settings: true,
              embyConnection: true,
              blacklist: true,
            },
          });
          if (!matchedUser) continue;
          effectiveUser = matchedUser;
        }

        const threshold = effectiveUser.settings?.completionPercentage ?? 85;
        const userDisplay = isSharedUser
          ? `@${effectiveUser.username} (Emby: @${embyUser})`
          : `@${effectiveUser.username}`;

        let tracked = this.sessionsMap.get(sessionKey);
        const currentItemId = String(item.Id || `${item.SeriesName}_${episodeNumber}`);

        if (!tracked) {
          const newSession: TrackedEmbySession = {
            sessionKey,
            connId: conn.id,
            itemId: currentItemId,
            showTitle,
            episodeNumber,
            seasonNumber,
            username: embyUser,
            lastPercentage: viewPercentage,
            state: playerState,
            scrobbled: false,
            lastUpdatedAt: Date.now(),
          };
          tracked = newSession;
          this.sessionsMap.set(sessionKey, tracked);

          await this.prisma.auditLog.create({
            data: {
              level: 'INFO',
              service: 'EMBY_LIVE_TRACKER',
              message: `▶ En reproducción ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
              details: {
                server: conn.serverName,
                showTitle,
                episodeNumber,
                viewPercentage,
                player: s.Client,
                device: s.DeviceName,
                embyUser,
                matchedUser: effectiveUser.username,
              },
            },
          });
        } else {
          // Si el usuario avanzó a un episodio nuevo dentro de la misma sesión activa del reproductor:
          if (tracked.itemId !== currentItemId) {
            tracked.itemId = currentItemId;
            tracked.showTitle = showTitle;
            tracked.episodeNumber = episodeNumber;
            tracked.seasonNumber = seasonNumber;
            tracked.username = embyUser;
            tracked.lastPercentage = viewPercentage;
            tracked.state = playerState;
            tracked.scrobbled = false; // Resetear para que el nuevo episodio sea scrobbleado
            tracked.lastUpdatedAt = Date.now();

            await this.prisma.auditLog.create({
              data: {
                level: 'INFO',
                service: 'EMBY_LIVE_TRACKER',
                message: `▶ En reproducción ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
                details: {
                  server: conn.serverName,
                  showTitle,
                  episodeNumber,
                  viewPercentage,
                  player: s.Client,
                  device: s.DeviceName,
                  embyUser,
                  matchedUser: effectiveUser.username,
                },
              },
            });
          } else {
            const stateChanged = tracked.state !== playerState;
            const pctJump = Math.abs(viewPercentage - tracked.lastPercentage) >= 20;

            if (stateChanged || pctJump) {
              await this.prisma.auditLog.create({
                data: {
                  level: 'INFO',
                  service: 'EMBY_LIVE_TRACKER',
                  message: `▶ En reproducción ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
                  details: {
                    server: conn.serverName,
                    showTitle,
                    episodeNumber,
                    viewPercentage,
                    embyUser,
                    matchedUser: effectiveUser.username,
                  },
                },
              });
            }

            tracked.lastPercentage = viewPercentage;
            tracked.state = playerState;
            tracked.lastUpdatedAt = Date.now();
          }
        }

        // Si supera el umbral y no ha sido scrobbleado en esta sesión:
        if (tracked && viewPercentage >= threshold && !tracked.scrobbled) {
          this.logger.log(
            `Umbral de scrobble alcanzado (${viewPercentage}% >= ${threshold}%) para ${userDisplay} en "${showTitle}" Ep. ${episodeNumber}. Ejecutando scrobble...`,
          );

          // Se rearma un payload con la MISMA forma que mandaría la
          // notificación nativa de Emby (ver comentario en
          // emby.service.ts#normalizeEmbyPayload) para reentrar por el mismo
          // handleWebhook() y no duplicar la lógica de normalización.
          const scrobblePayload = {
            NotificationType: 'PlaybackStop',
            ServerName: conn.serverName || 'Emby Media Server',
            NotificationUsername: embyUser || effectiveUser.username,
            ItemType: item.Type || 'Episode',
            ItemId: item.Id,
            LibraryName: item.LibraryName || '',
            Name: item.Name,
            SeriesName: item.SeriesName,
            SeasonNumber: seasonNumber,
            EpisodeNumber: episodeNumber,
            PlaybackPositionTicks: positionTicks,
            RunTimeTicks: runtimeTicks,
          };

          try {
            const scrobbleRes = await this.embyService.handleWebhook(
              effectiveUser.webhookToken,
              scrobblePayload,
              'EMBY_SESSIONS_WATCHER',
            );
            if (!(scrobbleRes as any)?.ignored) {
              tracked.scrobbled = true;
            }
          } catch (err: any) {
            this.logger.error(`Error en watcher al reportar scrobble: ${err.message}`);
          }
        }
      }

      // Limpiar sesiones finalizadas de ESTA conexión de la memoria
      for (const [key, session] of this.sessionsMap.entries()) {
        if (session.connId === conn.id && !currentKeys.has(key) && Date.now() - session.lastUpdatedAt > 30000) {
          this.sessionsMap.delete(key);
        }
      }
    } catch (e: any) {
      // Timeout o problema de red temporal consultando /Sessions
    }
  }
}
