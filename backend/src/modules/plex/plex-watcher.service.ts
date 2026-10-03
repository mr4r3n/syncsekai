import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

import axios from 'axios';
import { PlexService, plexDirectHash } from './plex.service';
import { PlexWebhookService } from './plex-webhook.service';
import { recordActivity } from '../../common/logging/activity-log';

/**
 * One Plex server, whatever address reaches it: the plex.direct certificate hash when
 * there is one (the local, public and relay addresses of a server share it), host:port
 * otherwise.
 */
export function serverOf(serverUrl: string): string {
  const hash = plexDirectHash(serverUrl);
  if (hash) return hash;
  try {
    return new URL(serverUrl).host;
  } catch {
    return serverUrl;
  }
}

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
  // ponytail: per-connection state in memory; after a restart each connection looks its
  // server up again on its first poll. A column if it ever needs to survive restarts.
  private readonly failures = new Map<string, number>();
  private readonly lastLookup = new Map<string, number>();
  private readonly serverTokens = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private plexService: PlexService,
    private plexWebhookService: PlexWebhookService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting PMS Live Session Watcher (active playback monitoring on Plex servers)...');
    // Poll every 5 seconds
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

      // ponytail: fixed batches of 5 servers at a time, so one that times out (4 s) holds
      // its batch instead of the whole round. A queue with per-server backoff if there are many.
      const pollable = connections.filter((conn) => conn.serverUrl && conn.encryptedAuthToken);
      for (let i = 0; i < pollable.length; i += 5) {
        await Promise.allSettled(pollable.slice(i, i + 5).map((conn) => this.pollServerSessions(conn)));
      }
    } catch (e: any) {
      this.logger.warn(`PMS polling cycle error: ${e.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  private async pollServerSessions(conn: any) {
    const user = conn.user;
    if (!user) return;

    // The token comes from findServerAccess before anything is sent: the stored one is
    // the account token for PIN links, and a server shared with the user never gets it.
    const token = this.serverTokens.get(conn.id) || (await this.lookUpServer(conn));
    if (!token) return;

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

      this.failures.delete(conn.id);
      const rawSessions: any[] = res.data?.MediaContainer?.Metadata || [];
      const currentKeys = new Set<string>();
      // Plex numbers sessions per server (1, 2, 3…), so the key carries the server too. It is
      // the server and not the connection on purpose: several accounts connected to the same
      // Plex see the same sessions, and sharing the entry is what scrobbles each one once.
      const server = serverOf(conn.serverUrl);

      for (const s of rawSessions) {
        const sessionKey = `${server} ${s.sessionKey || s.ratingKey || `${s.grandparentTitle}_${s.index}`}`;
        currentKeys.add(sessionKey);

        const librarySectionTitle = s.librarySectionTitle || '';
        const monitored = conn.monitoredLibraries || [];
        if (monitored.length > 0 && librarySectionTitle) {
          const isMonitored = monitored.some(
            (m: string) => m.toLowerCase() === librarySectionTitle.toLowerCase(),
          );
          if (!isMonitored) continue;
        }

        const showTitle = s.grandparentTitle || s.title || 'Unknown anime';
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

        // If the session belongs to a shared Plex user:
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
        const stateLabel = playerState === 'playing' ? 'Playing' : playerState === 'paused' ? 'Paused' : playerState;
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

          // Record the start of live playback in AuditLog with the exact minute
          await recordActivity({
            data: {
              level: 'INFO',
              service: 'PLEX_LIVE_TRACKER',
              message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] (${stateLabel})`,
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
          // If the state changed or progress moved more than 20%, update the log
          const stateChanged = tracked.state !== playerState;
          const pctJump = Math.abs(viewPercentage - tracked.lastPercentage) >= 20;

          if (stateChanged || pctJump) {
            await recordActivity({
              data: {
                level: 'INFO',
                service: 'PLEX_LIVE_TRACKER',
                message: `▶ Playing ${userDisplay}: "${showTitle} - Ep ${episodeNumber}" [Min ${timeFormatted} • ${viewPercentage}%] (${stateLabel})`,
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

        // If it passes the threshold (85%) and was not scrobbled in this session:
        if (viewPercentage >= threshold && !tracked.scrobbled) {
          tracked.scrobbled = true;
          this.logger.log(
            `Scrobble threshold reached (${viewPercentage}% >= ${threshold}%) for ${userDisplay} on "${showTitle}" Ep. ${episodeNumber}. Scrobbling...`,
          );

          // Trigger an automatic scrobble
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

          await this.plexWebhookService.handleWebhook(effectiveUser.webhookToken, scrobblePayload, 'PMS_DIRECT_WATCHER');
        }
      }

      // Clear finished sessions from memory
      for (const [key, session] of this.sessionsMap.entries()) {
        if (key.startsWith(`${server} `) && !currentKeys.has(key) && Date.now() - session.lastUpdatedAt > 30000) {
          this.sessionsMap.delete(key);
        }
      }
    } catch {
      // Timeout, network error or a token the server refuses.
      this.noteFailure(conn.id);
    }
  }

  /** Three failed polls in a row: forget the token, so the next poll looks the server up again. */
  private noteFailure(connId: string) {
    const failures = (this.failures.get(connId) || 0) + 1;
    if (failures < 3) {
      this.failures.set(connId, failures);
      return;
    }
    this.failures.delete(connId);
    this.serverTokens.delete(connId);
  }

  /**
   * Where the server is now and which token it takes (PlexService.findServerAccess), at
   * most every 10 minutes per connection. A new address is saved; the token stays in memory.
   */
  private async lookUpServer(conn: any): Promise<string | undefined> {
    if (Date.now() - (this.lastLookup.get(conn.id) || 0) < 10 * 60_000) return undefined;
    this.lastLookup.set(conn.id, Date.now());

    const access = await this.plexService.findServerAccess(conn.serverUrl, conn.encryptedAuthToken).catch(() => null);
    if (!access) return undefined;
    if (access === 'stored-token') {
      try {
        const stored = this.encryptionService.decrypt(conn.encryptedAuthToken);
        this.serverTokens.set(conn.id, stored);
        return stored;
      } catch {
        return undefined;
      }
    }
    this.serverTokens.set(conn.id, access.token);
    if (access.url !== conn.serverUrl) {
      await this.prisma.plexConnection.update({ where: { id: conn.id }, data: { serverUrl: access.url } });
      await recordActivity({
        data: {
          level: 'INFO',
          service: 'PLEX_WATCHER',
          message: `@${conn.user?.username}: the Plex server answers at a new address now (plex.tv); saved.`,
        },
      });
      conn.serverUrl = access.url;
    }
    return access.token;
  }
}
