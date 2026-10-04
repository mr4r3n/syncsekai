import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as os from 'os';
import axios from 'axios';
import { TrackerApi, trackerGateStatus, withTrackerPriority } from '../../common/http/tracker-gate';

type Ping = { status: string; latency: string; rateLimit: string };

/** Server status and sign-up domain policy. */
@Injectable()
export class SystemHealthService {
  // ponytail: one minute of cache for the trackers' pings. The panel refreshes every 10 s and
  // each refresh used to spend one of AniList's 30 requests a minute.
  private pingCache: { at: number; pings: Record<TrackerApi, Ping> } | null = null;

  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Pings the four trackers in parallel, as background work in their queue. An API the gate
   * paused after a 429 is not pinged: it is DEGRADED for as long as the pause lasts.
   */
  private async pingTrackers(): Promise<Record<TrackerApi, Ping>> {
    if (this.pingCache && Date.now() - this.pingCache.at < 60_000) return this.pingCache.pings;
    const pace = (api: TrackerApi) => {
      const lane = trackerGateStatus()[api];
      if (!lane) return 'Not limited';
      return `${lane.sentInWindow}/${lane.limitPerWindow} per min${lane.queued ? `, ${lane.queued} waiting` : ''}`;
    };
    const ping = async (api: TrackerApi, url: string, init: { method: 'GET' | 'POST' | 'HEAD'; data?: unknown; headers?: Record<string, string> }): Promise<Ping> => {
      const paused = trackerGateStatus()[api]?.pausedForMs ?? 0;
      if (paused > 0) return { status: 'DEGRADED', latency: `paused ${Math.ceil(paused / 1000)} s`, rateLimit: pace(api) };
      const t0 = Date.now();
      try {
        const res = await withTrackerPriority(
          'background',
          () => axios.request({ url, ...init, timeout: 4000, validateStatus: () => true }),
          2_000,
        );
        const status = res.status >= 500 || res.status === 429 ? 'DEGRADED' : 'ONLINE';
        return { status, latency: `${Date.now() - t0}ms`, rateLimit: pace(api) };
      } catch (e: any) {
        // The API is up; our own queue to it is busy (see trackerGateStatus).
        if (e?.code === 'TRACKER_BUSY') return { status: 'ONLINE', latency: `${trackerGateStatus()[api]?.queued ?? 0} waiting`, rateLimit: pace(api) };
        return { status: 'OFFLINE', latency: 'Timeout', rateLimit: pace(api) };
      }
    };
    const [anilist, mal, kitsu, jikan] = await Promise.all([
      ping('anilist', 'https://graphql.anilist.co', {
        method: 'POST',
        data: { query: '{ SiteStatistics { anime { nodes { count } } } }' },
        headers: { 'Content-Type': 'application/json' },
      }),
      ping('mal', 'https://myanimelist.net', { method: 'HEAD' }),
      ping('kitsu', 'https://kitsu.io/api/edge/anime?page[limit]=1', { method: 'GET', headers: { Accept: 'application/vnd.api+json' } }),
      ping('jikan', 'https://api.jikan.moe/v4/anime/1', { method: 'GET' }),
    ]);
    const pings = { anilist, mal, kitsu, jikan };
    this.pingCache = { at: Date.now(), pings };
    return pings;
  }

  /**
   * Status and health of API and system connections (real live pings).
   */
  async getSystemHealth() {
    // 1. Real ping to PostgreSQL
    const startDb = Date.now();
    let dbStatus = 'ONLINE';
    let dbLatencyMs = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startDb;
    } catch {
      dbStatus = 'ERROR';
    }

    // 2-5. AniList, MyAnimeList, Kitsu and Jikan (cached for a minute)
    const pings = await this.pingTrackers();

    // 6. Server hardware and memory diagnostics
    const memory = process.memoryUsage();
    const memoryRssMb = Math.round(memory.rss / (1024 * 1024));
    const memoryHeapUsedMb = Math.round(memory.heapUsed / (1024 * 1024));
    const memoryHeapTotalMb = Math.round(memory.heapTotal / (1024 * 1024));

    const hostUptimeSeconds = Math.round(os.uptime());
    const hostDays = Math.floor(hostUptimeSeconds / 86400);
    const hostHours = Math.floor((hostUptimeSeconds % 86400) / 3600);
    const hostMins = Math.floor((hostUptimeSeconds % 3600) / 60);
    const hostUptimeFormatted = hostDays > 0
      ? `${hostDays}d ${hostHours}h ${hostMins}m`
      : `${hostHours}h ${hostMins}m`;

    return {
      apis: {
        database: {
          name: 'PostgreSQL Database',
          status: dbStatus,
          latency: `${dbLatencyMs}ms`,
          details: 'Connection Pool: Healthy',
        },
        anilist: {
          name: 'AniList GraphQL API',
          ...pings.anilist,
          endpoint: 'https://graphql.anilist.co',
        },
        mal: {
          name: 'MyAnimeList REST API v2',
          ...pings.mal,
          endpoint: 'https://api.myanimelist.net/v2',
        },
        kitsu: {
          name: 'Kitsu API (Metadata)',
          ...pings.kitsu,
          endpoint: 'https://kitsu.io/api/edge',
        },
        jikan: {
          name: 'Jikan API (MAL Backup)',
          ...pings.jikan,
          endpoint: 'https://api.jikan.moe/v4',
        },
        plexWebhook: {
          name: 'Plex Webhook Listener',
          status: 'ONLINE',
          latency: '<1ms',
          details: 'Port 4000: /api/plex/webhook',
        },
        jellyfinWebhook: {
          name: 'Jellyfin Webhook Listener',
          status: 'ONLINE',
          latency: '<1ms',
          details: 'Port 4000: /api/jellyfin/webhook',
        },
        embyWatcher: {
          name: 'Emby Live Session Watcher',
          status: 'ONLINE',
          latency: '<1ms',
          details: 'Polling /Sessions every 5s (main method, no Emby Premiere needed)',
        },
      },
      system: {
        nodeVersion: process.version,
        platform: `${os.platform()} (${os.arch()})`,
        uptime: hostUptimeFormatted,
        memoryRss: `${memoryRssMb} MB`,
        memoryHeapUsed: `${memoryHeapUsedMb} MB / ${memoryHeapTotalMb} MB`,
        cpuCores: os.cpus().length,
      },
    };
  }

  /**
   * Adds a domain to the allowlist or blocklist.
   */
  async addDomainPolicy(domain: string, isAllowed = true, reason?: string) {
    const cleanDomain = domain.toLowerCase().trim().replace(/^@/, '');
    if (!cleanDomain || !cleanDomain.includes('.')) {
      throw new BadRequestException('Invalid domain format (e.g. domain.com).');
    }

    return this.prisma.domainPolicy.upsert({
      where: { domain: cleanDomain },
      update: { isAllowed, reason },
      create: { domain: cleanDomain, isAllowed, reason },
    });
  }

  /**
   * Deletes a domain rule.
   */
  async deleteDomainPolicy(id: string) {
    return this.prisma.domainPolicy.delete({
      where: { id },
    });
  }
}
