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
 * MAIN integration path for Emby (not just a fallback as in Jellyfin): Emby's
 * native "Webhooks" notification requires a Premiere subscription, so this
 * watcher (polling /Sessions every 5s, like plex-watcher/jellyfin-watcher) is
 * the only method that works for 100% of Emby users, with or without Premiere.
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
    this.logger.log('Starting Emby Live Session Watcher (MAIN integration method, polling /Sessions every 5s)...');
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
      this.logger.warn(`Emby polling cycle error: ${e.message}`);
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
        if (!item) continue; // session with no active playback (just connected)

        const sessionKey = `${conn.id}_${s.Id || 'sess'}`;
        currentKeys.add(sessionKey);

        const showTitle = item.SeriesName || item.Name || 'Unknown anime';
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

        // If the session belongs to a local Emby user other than the linked one:
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
              message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
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
          // If the user moved on to a new episode within the same active player session:
          if (tracked.itemId !== currentItemId) {
            tracked.itemId = currentItemId;
            tracked.showTitle = showTitle;
            tracked.episodeNumber = episodeNumber;
            tracked.seasonNumber = seasonNumber;
            tracked.username = embyUser;
            tracked.lastPercentage = viewPercentage;
            tracked.state = playerState;
            tracked.scrobbled = false; // Reset so the new episode gets scrobbled
            tracked.lastUpdatedAt = Date.now();

            await this.prisma.auditLog.create({
              data: {
                level: 'INFO',
                service: 'EMBY_LIVE_TRACKER',
                message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
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
                  message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
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

        // If it passes the threshold and was not scrobbled in this session:
        if (tracked && viewPercentage >= threshold && !tracked.scrobbled) {
          this.logger.log(
            `Scrobble threshold reached (${viewPercentage}% >= ${threshold}%) for ${userDisplay} on "${showTitle}" Ep. ${episodeNumber}. Scrobbling...`,
          );

          // A payload is rebuilt with the SAME shape Emby's native notification
          // would send (see the comment on
          // emby.service.ts#normalizeEmbyPayload) to re-enter through the same
          // handleWebhook() and not duplicate the normalization logic.
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
            this.logger.error(`Watcher error while reporting the scrobble: ${err.message}`);
          }
        }
      }

      // Clear finished sessions of THIS connection from memory
      for (const [key, session] of this.sessionsMap.entries()) {
        if (session.connId === conn.id && !currentKeys.has(key) && Date.now() - session.lastUpdatedAt > 30000) {
          this.sessionsMap.delete(key);
        }
      }
    } catch (e: any) {
      // Timeout or temporary network problem querying /Sessions
    }
  }
}
