import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PlexService } from './plex.service';
import axios from 'axios';

interface TrackedSession {
  sessionKey: string;
  showTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  username: string;
  lastPercentage: number;
  state: string;
  scrobbled: boolean;
  lastUpdatedAt: number;
}

@Injectable()
export class PlexWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlexWatcherService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private readonly sessionsMap = new Map<string, TrackedSession>();
  private isPolling = false;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private plexService: PlexService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando PMS Live Session Watcher (Monitoreo activo de reproducciones en servidores Plex)...');
    // Poll cada 5 segundos
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
      const connections = await this.prisma.plexConnection.findMany({
        where: {
          isConnected: true,
          encryptedAuthToken: { not: null },
          serverUrl: { not: null },
        },
        include: {
          user: {
            include: {
              settings: true,
              blacklist: true,
            },
          },
        },
      });

      for (const conn of connections) {
        if (!conn.serverUrl || !conn.encryptedAuthToken) continue;
        await this.pollServerSessions(conn);
      }
    } catch (e: any) {
      this.logger.warn(`Error en ciclo de polling de PMS: ${e.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  private async pollServerSessions(conn: any) {
    const user = conn.user;
    if (!user) return;

    let token = '';
    try {
      token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    } catch {
      return;
    }

    try {
      const target = await this.plexService.validateUserServerTarget(conn.serverUrl);
      const res = await axios.get(`${target.url}/status/sessions`, {
        headers: {
          'X-Plex-Token': token,
          Accept: 'application/json',
        },
        timeout: 4000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });

      const rawSessions: any[] = res.data?.MediaContainer?.Metadata || [];
      const currentKeys = new Set<string>();

      for (const s of rawSessions) {
        const sessionKey = String(s.sessionKey || s.ratingKey || `${s.grandparentTitle}_${s.index}`);
        currentKeys.add(sessionKey);

        const librarySectionTitle = s.librarySectionTitle || '';
        const monitored = conn.monitoredLibraries || [];
        if (monitored.length > 0 && librarySectionTitle) {
          const isMonitored = monitored.some(
            (m: string) => m.toLowerCase() === librarySectionTitle.toLowerCase(),
          );
          if (!isMonitored) continue;
        }

        const showTitle = s.grandparentTitle || s.title || 'Anime Desconocido';
        const episodeNumber = Number(s.index || 1);
        const seasonNumber = Number(s.parentIndex || 1);
        const viewOffset = Number(s.viewOffset || 0);
        const duration = Number(s.duration || 1);
        const viewPercentage = Math.min(100, Math.round((viewOffset / duration) * 100)) || 0;
        const playerState = s.Player?.state || 'playing';
        const plexUser = (s.User?.title || '').trim();
        const targetPlexUser = (conn.plexUsername || user.username || '').trim();

        let effectiveUser = user;
        let isSharedUser = false;

        // Si la sesión pertenece a un usuario compartido de Plex:
        if (plexUser && targetPlexUser && plexUser.toLowerCase() !== targetPlexUser.toLowerCase()) {
          isSharedUser = true;
          const matchedUser = await this.prisma.user.findFirst({
            where: {
              OR: [
                { plexConnection: { plexUsername: { equals: plexUser, mode: 'insensitive' } } },
                { username: { equals: plexUser, mode: 'insensitive' } },
              ],
            },
            include: {
              settings: true,
              plexConnection: true,
              blacklist: true,
            },
          });
          if (!matchedUser) continue;
          effectiveUser = matchedUser;
        }

        const threshold = effectiveUser.settings?.completionPercentage ?? 85;
        const currentMinutes = Math.floor(viewOffset / 60000);
        const currentSeconds = Math.floor((viewOffset % 60000) / 1000);
        const totalMinutes = Math.floor(duration / 60000);
        const totalSeconds = Math.floor((duration % 60000) / 1000);
        const timeFormatted = duration > 0
          ? `${currentMinutes}:${currentSeconds < 10 ? '0' : ''}${currentSeconds} / ${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`
          : `${viewPercentage}%`;
        const stateLabel = playerState === 'playing' ? 'Reproduciendo' : playerState === 'paused' ? 'Pausado' : playerState;
        const userDisplay = isSharedUser ? `@${effectiveUser.username} (Plex: @${plexUser})` : `@${effectiveUser.username}`;

        let tracked = this.sessionsMap.get(sessionKey);

        if (!tracked) {
          tracked = {
            sessionKey,
            showTitle,
            episodeNumber,
            seasonNumber,
            username: plexUser,
            lastPercentage: viewPercentage,
            state: playerState,
            scrobbled: false,
            lastUpdatedAt: Date.now(),
          };
          this.sessionsMap.set(sessionKey, tracked);

          // Registrar inicio de reproducción en vivo en AuditLog con minuto exacto
          await this.prisma.auditLog.create({
            data: {
              level: 'INFO',
              service: 'PLEX_LIVE_TRACKER',
              message: `▶ En reproducción ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] (${stateLabel})`,
              details: {
                server: conn.serverName,
                showTitle,
                episodeNumber,
                viewPercentage,
                timeFormatted,
                player: s.Player?.title,
                device: s.Player?.platform,
                plexUser,
                matchedUser: effectiveUser.username,
              },
            },
          });
        } else {
          // Si cambió el estado o avanzó más de 20%, actualizar log
          const stateChanged = tracked.state !== playerState;
          const pctJump = Math.abs(viewPercentage - tracked.lastPercentage) >= 20;

          if (stateChanged || pctJump) {
            await this.prisma.auditLog.create({
              data: {
                level: 'INFO',
                service: 'PLEX_LIVE_TRACKER',
                message: `▶ En reproducción ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] (${stateLabel})`,
                details: {
                  server: conn.serverName,
                  showTitle,
                  episodeNumber,
                  viewPercentage,
                  timeFormatted,
                  plexUser,
                  matchedUser: effectiveUser.username,
                },
              },
            });
          }

          tracked.lastPercentage = viewPercentage;
          tracked.state = playerState;
          tracked.lastUpdatedAt = Date.now();
        }

        // Si supera el umbral (85%) y no ha sido scrobbleado en esta sesión:
        if (viewPercentage >= threshold && !tracked.scrobbled) {
          tracked.scrobbled = true;
          this.logger.log(
            `Umbral de scrobble alcanzado (${viewPercentage}% >= ${threshold}%) para ${userDisplay} en "${showTitle}" Ep. ${episodeNumber}. Ejecutando scrobble...`,
          );

          // Disparar scrobble automático
          const scrobblePayload = {
            event: 'media.scrobble',
            user: true,
            owner: true,
            Account: {
              title: plexUser || effectiveUser.username,
            },
            rating: s.userRating || s.rating,
            Server: {
              title: conn.serverName || 'Plex Media Server',
            },
            Metadata: {
              librarySectionTitle,
              type: s.type || 'episode',
              grandparentTitle: s.grandparentTitle,
              parentTitle: s.parentTitle,
              title: s.title,
              index: episodeNumber,
              parentIndex: seasonNumber,
              viewOffset,
              duration,
            },
          };

          await this.plexService.handleWebhook(effectiveUser.webhookToken, scrobblePayload, 'PMS_DIRECT_WATCHER');
        }
      }

      // Limpiar sesiones finalizadas de la memoria
      for (const [key, session] of this.sessionsMap.entries()) {
        if (!currentKeys.has(key) && Date.now() - session.lastUpdatedAt > 30000) {
          this.sessionsMap.delete(key);
        }
      }
    } catch (e: any) {
      // PMS session query timeout or temporary network issue
    }
  }
}
