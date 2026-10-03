import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { JellyfinService } from './jellyfin.service';
import axios from 'axios';
import { recordActivity } from '../../common/logging/activity-log';

interface TrackedJellyfinSession {
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
 * Webhook fallback, like plex-watcher.service.ts: polls /Sessions every 5s in
 * case Jellyfin's "Webhook" plugin is not installed, was disabled by an update,
 * or the network blocks the server's outbound request to SyncSekai. Without
 * this, Jellyfin would have weaker guarantees than Plex.
 */
@Injectable()
export class JellyfinWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JellyfinWatcherService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private readonly sessionsMap = new Map<string, TrackedJellyfinSession>();
  private isPolling = false;

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private jellyfinService: JellyfinService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting Jellyfin Live Session Watcher (webhook fallback, polling /Sessions every 5s)...');
    this.intervalRef = setInterval(() => void this.pollAllServers(), 5000);
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
      const connections = await this.prisma.jellyfinConnection.findMany({
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

      // ponytail: fixed batches of 5 servers at a time, so one that times out (4 s) holds
      // its batch instead of the whole round. A queue with per-server backoff if there are many.
      const pollable = connections.filter((conn) => conn.serverUrl && conn.encryptedApiKey);
      for (let i = 0; i < pollable.length; i += 5) {
        await Promise.allSettled(pollable.slice(i, i + 5).map((conn) => this.pollServerSessions(conn)));
      }
    } catch (e: any) {
      this.logger.warn(`Jellyfin polling cycle error: ${e.message}`);
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
      const target = await this.jellyfinService.validateUserServerTarget(conn.serverUrl);
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
        const jellyfinUser = (s.UserName || '').trim();
        const targetJellyfinUser = (conn.jellyfinUsername || user.username || '').trim();

        let effectiveUser = user;
        let isSharedUser = false;

        // If the session belongs to a local Jellyfin user other than the linked one:
        if (jellyfinUser && targetJellyfinUser && jellyfinUser.toLowerCase() !== targetJellyfinUser.toLowerCase()) {
          isSharedUser = true;
          const matchedUser = await this.prisma.user.findFirst({
            where: {
              jellyfinConnection: {
                jellyfinUsername: { equals: jellyfinUser, mode: 'insensitive' },
                isConnected: true,
                ...(conn.serverUrl ? { serverUrl: conn.serverUrl } : {}),
              },
              isActive: true,
              settings: { isSuspended: false },
            },
            include: {
              settings: true,
              jellyfinConnection: true,
              blacklist: true,
            },
          });
          if (!matchedUser) continue;
          effectiveUser = matchedUser;
        }

        const threshold = effectiveUser.settings?.completionPercentage ?? 85;
        const userDisplay = isSharedUser
          ? `@${effectiveUser.username} (Jellyfin: @${jellyfinUser})`
          : `@${effectiveUser.username}`;

        let tracked = this.sessionsMap.get(sessionKey);
        const currentItemId = String(item.Id || `${item.SeriesName}_${episodeNumber}`);

        if (!tracked) {
          const newSession: TrackedJellyfinSession = {
            sessionKey,
            connId: conn.id,
            itemId: currentItemId,
            showTitle,
            episodeNumber,
            seasonNumber,
            username: jellyfinUser,
            lastPercentage: viewPercentage,
            state: playerState,
            scrobbled: false,
            lastUpdatedAt: Date.now(),
          };
          tracked = newSession;
          this.sessionsMap.set(sessionKey, tracked);

          await recordActivity({
            data: {
              level: 'INFO',
              service: 'JELLYFIN_LIVE_TRACKER',
              message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
              details: {
                server: conn.serverName,
                showTitle,
                episodeNumber,
                viewPercentage,
                player: s.Client,
                device: s.DeviceName,
                jellyfinUser,
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
            tracked.username = jellyfinUser;
            tracked.lastPercentage = viewPercentage;
            tracked.state = playerState;
            tracked.scrobbled = false; // Reset so the new episode gets scrobbled
            tracked.lastUpdatedAt = Date.now();

            await recordActivity({
              data: {
                level: 'INFO',
                service: 'JELLYFIN_LIVE_TRACKER',
                message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
                details: {
                  server: conn.serverName,
                  showTitle,
                  episodeNumber,
                  viewPercentage,
                  player: s.Client,
                  device: s.DeviceName,
                  jellyfinUser,
                  matchedUser: effectiveUser.username,
                },
              },
            });
          } else {
            const stateChanged = tracked.state !== playerState;
            const pctJump = Math.abs(viewPercentage - tracked.lastPercentage) >= 20;

            if (stateChanged || pctJump) {
              await recordActivity({
                data: {
                  level: 'INFO',
                  service: 'JELLYFIN_LIVE_TRACKER',
                  message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [${viewPercentage}%] (${playerState})`,
                  details: {
                    server: conn.serverName,
                    showTitle,
                    episodeNumber,
                    viewPercentage,
                    jellyfinUser,
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

          // A payload is rebuilt with the SAME shape the Webhook plugin sends
          // (see the template in /docs) to re-enter through the same
          // handleWebhook() and not duplicate the normalization logic.
          const scrobblePayload = {
            NotificationType: 'PlaybackStop',
            ServerName: conn.serverName || 'Jellyfin Media Server',
            NotificationUsername: jellyfinUser || effectiveUser.username,
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
            const scrobbleRes = await this.jellyfinService.handleWebhook(
              effectiveUser.webhookToken,
              scrobblePayload,
              'JELLYFIN_SESSIONS_WATCHER',
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
    } catch {
      // Timeout or temporary network problem querying /Sessions
    }
  }
}
