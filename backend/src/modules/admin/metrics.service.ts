import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { recentActivity } from '../../common/logging/activity-log';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncStatus } from '@prisma/client';

/** Panel metrics: summary, charts, activity heatmap, genres and failures. */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  // In-memory TTL cache for aggregated metrics (reduces database load)
  private readonly dashboardMetricsCache = new Map<string, { data: any; timestamp: number }>();
  private readonly chartHistoryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL_MS = 20 * 1000; // 20 seconds
  private genreCache: { data: any; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
  ) {}

  /** Stored events kept on purpose: administration and account security. */
  private static readonly AUDIT_SERVICES = ['BACKUP', 'AUTH_SECURITY', 'EMERGENCY_RECOVERY', 'HISTORY_REVERT'];
  private static readonly AUDIT_RETENTION_DAYS = 90;

  onModuleInit() {
    this.purgeAuditLog().catch((e) => this.logger.warn(`Could not purge the audit log: ${e.message}`));
  }

  /**
   * Keeps AuditLog to administrative and security events of the last 90 days.
   * Media-server activity was stored here too until it moved to memory
   * (common/logging/activity-log.ts); the first run clears what is left of it.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeAuditLog() {
    const cutoff = new Date(Date.now() - MetricsService.AUDIT_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { OR: [{ createdAt: { lt: cutoff } }, { service: { notIn: MetricsService.AUDIT_SERVICES } }] },
    });
    if (count > 0) this.logger.log(`Audit log: ${count} old or non-audit entries deleted.`);
  }

  /**
   * Invalidates the metrics cache after an admin action or a scrobble.
   */
  clearMetricsCache() {
    this.dashboardMetricsCache.clear();
    this.chartHistoryCache.clear();
  }

  /**
   * Consolidated admin panel metrics, all from real data.
   */
  async getDashboardMetrics(timeframe: '1d' | '7d' | '30d' | '1y' = '7d') {
    const cacheKey = `metrics_${timeframe}`;
    const cached = this.dashboardMetricsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const startDb = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startDb;

    // 1. User and scrobble statistics
    const totalUsers = await this.prisma.user.count();
    // Active means using the service: at least one episode synced in the last 24 h.
    // (It used to count verified accounts; the panel itself is rarely opened.)
    const activeUsers24h = (
      await this.prisma.scrobbleHistory.findMany({
        where: { viewedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { userId: true },
        distinct: ['userId'],
      })
    ).length;

    const totalScrobbles = await this.prisma.scrobbleHistory.count();
    const successfulScrobbles = await this.prisma.scrobbleHistory.count({
      where: {
        OR: [{ anilistStatus: 'SUCCESS' }, { malStatus: 'SUCCESS' }],
      },
    });

    // Real failures: deliberate skips (SKIPPED, tracker not connected)
    // do not count as failures.
    const failedScrobbles = await this.prisma.scrobbleHistory.count({
      where: {
        OR: [
          { anilistStatus: 'FAILED' },
          { malStatus: 'FAILED' },
          { kitsuStatus: 'FAILED' },
        ],
      },
    });

    const skippedScrobbles = Math.max(0, totalScrobbles - successfulScrobbles - failedScrobbles);

    const lastScrobble = await this.prisma.scrobbleHistory.findFirst({
      orderBy: { viewedAt: 'desc' },
      select: { viewedAt: true },
    });

    const uniqueIpVisits = await this.prisma.systemMetric.count({
      where: { metricKey: 'UNIQUE_IP_VISIT' },
    });
    // One row per visitor and day (see VisitorsService), so a date range counts visitor-days.
    const dayKey = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().split('T')[0];
    const visitsSince = (daysAgo: number) =>
      this.prisma.systemMetric.count({ where: { metricKey: 'UNIQUE_IP_VISIT', dateKey: { gte: dayKey(daysAgo) } } });
    const [visitsToday, visitsLast7Days, visitsLast30Days] = await Promise.all([visitsSince(0), visitsSince(6), visitsSince(29)]);
    const liveActivity = await this.getLiveActivity();

    const successRate = totalScrobbles > 0
      ? `${((successfulScrobbles / totalScrobbles) * 100).toFixed(1)}%`
      : '100%';

    // 2. Tracker and Plex server connections
    const anilistCount = await this.prisma.animeConnection.count({
      where: { provider: 'ANILIST', isConnected: true },
    });
    const malCount = await this.prisma.animeConnection.count({
      where: { provider: 'MAL', isConnected: true },
    });
    const kitsuCount = await this.prisma.animeConnection.count({
      where: { provider: 'KITSU', isConnected: true },
    });
    const plexCount = await this.prisma.plexConnection.count({
      where: { isConnected: true },
    });
    const jellyfinCount = await this.prisma.jellyfinConnection.count({
      where: { isConnected: true },
    });
    const embyCount = await this.prisma.embyConnection.count({
      where: { isConnected: true },
    });

    // Users syncing to more than one tracker
    const usersWithBoth = await this.prisma.user.count({
      where: {
        animeConnections: {
          some: { isConnected: true },
        },
      },
    });

    const totalMappings = await this.prisma.titleMapping.count();

    const totalTrackers = anilistCount + malCount + kitsuCount || 1;
    const anilistPercentage = Math.round((anilistCount / totalTrackers) * 100);
    const malPercentage = Math.round((malCount / totalTrackers) * 100);
    const kitsuPercentage = Math.round((kitsuCount / totalTrackers) * 100);
    const plexPercentage = totalUsers > 0 ? Math.round((plexCount / totalUsers) * 100) : 0;
    const jellyfinPercentage = totalUsers > 0 ? Math.round((jellyfinCount / totalUsers) * 100) : 0;
    const embyPercentage = totalUsers > 0 ? Math.round((embyCount / totalUsers) * 100) : 0;

    // 3. PMS, Jellyfin and Emby library distribution
    const allPlexConns = await this.prisma.plexConnection.findMany({
      where: { isConnected: true },
      select: { monitoredLibraries: true },
    });
    const allJellyfinConns = await this.prisma.jellyfinConnection.findMany({
      where: { isConnected: true },
      select: { monitoredLibraries: true },
    });
    const allEmbyConns = await this.prisma.embyConnection.findMany({
      where: { isConnected: true },
      select: { monitoredLibraries: true },
    });

    const libCounts: Record<string, number> = {
      'Anime TV (Series)': 0,
      'Anime movies & OVAs': 0,
      'Series de TV (Live-Action)': 0,
      'Movies (general)': 0,
    };

    [...allPlexConns, ...allJellyfinConns, ...allEmbyConns].forEach((p) => {
      p.monitoredLibraries.forEach((libName) => {
        const lower = libName.toLowerCase();
        if (lower.includes('anime') && (lower.includes('movie') || lower.includes('pelic') || lower.includes('film'))) {
          libCounts['Anime movies & OVAs'] += 1;
        } else if (lower.includes('anime')) {
          libCounts['Anime TV (Series)'] += 1;
        } else if (lower.includes('movie') || lower.includes('pelic') || lower.includes('film')) {
          libCounts['Movies (general)'] += 1;
        } else {
          libCounts['Series de TV (Live-Action)'] += 1;
        }
      });
    });

    const totalLibs = Object.values(libCounts).reduce((a, b) => a + b, 0) || 1;
    const libraryDistribution = [
      {
        type: 'Anime TV (Series)',
        count: libCounts['Anime TV (Series)'],
        percentage: Math.round((libCounts['Anime TV (Series)'] / totalLibs) * 100) || (totalLibs === 1 ? 100 : 0),
        color: '#38bdf8',
      },
      {
        type: 'Anime movies & OVAs',
        count: libCounts['Anime movies & OVAs'],
        percentage: Math.round((libCounts['Anime movies & OVAs'] / totalLibs) * 100),
        color: '#10b981',
      },
      {
        type: 'Series de TV (Live-Action)',
        count: libCounts['Series de TV (Live-Action)'],
        percentage: Math.round((libCounts['Series de TV (Live-Action)'] / totalLibs) * 100),
        color: '#a855f7',
      },
      {
        type: 'Movies (general)',
        count: libCounts['Movies (general)'],
        percentage: Math.round((libCounts['Movies (general)'] / totalLibs) * 100),
        color: '#f59e0b',
      },
    ];

    // 4. Domain policies
    const domainPolicies = await this.prisma.domainPolicy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 5. Most watched shows (from ScrobbleHistory)
    const scrobbleAggregates = await this.prisma.scrobbleHistory.groupBy({
      by: ['showTitle'],
      _count: { id: true },
      _avg: { viewPercentage: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topShows: any[] = [];
    for (const item of scrobbleAggregates) {
      const distinctUsers = await this.prisma.scrobbleHistory.findMany({
        where: { showTitle: item.showTitle },
        select: { userId: true, episodeNumber: true },
        distinct: ['userId'],
      });

      const maxEpisode = await this.prisma.scrobbleHistory.findFirst({
        where: { showTitle: item.showTitle },
        orderBy: { episodeNumber: 'desc' },
        select: { episodeNumber: true },
      });

      topShows.push({
        title: item.showTitle,
        totalScrobbles: item._count.id,
        activeUsers: distinctUsers.length,
        completionRate: `${Math.round(item._avg.viewPercentage || 90)}%`,
        episodesTracked: maxEpisode?.episodeNumber || 1,
      });
    }

    // 6. Geographic visits, deduplicated per unique visitor
    const metricsGeo = await this.prisma.systemMetric.findMany({
      where: { metricKey: 'UNIQUE_IP_VISIT' },
      orderBy: { createdAt: 'desc' },
    });

    const ipMap = new Map<string, {
      ip: string;
      country: string;
      code: string;
      city: string;
      region: string;
      lat: number;
      lon: number;
      isp: string;
      os: string;
      browser: string;
      device: string;
      username: string | null;
      firstSeenAt: string;
      lastSeenAt: string;
      dateKey: string;
      totalVisits: number;
    }>();

    for (const m of metricsGeo) {
      const meta = (m.metadata as any) || {};
      const ip = m.ipAddress || 'unknown';
      const existing = ipMap.get(ip);
      const lat = typeof meta.lat === 'number' ? meta.lat : Number(meta.lat) || 0;
      const lon = typeof meta.lon === 'number' ? meta.lon : Number(meta.lon) || 0;
      const visits = m.value || 1;

      if (!existing) {
        ipMap.set(ip, {
          ip,
          country: meta.country || 'Unknown',
          code: meta.code || 'XX',
          city: meta.city || 'Unknown',
          region: meta.region || '',
          lat,
          lon,
          isp: meta.isp || 'Private network',
          os: meta.os || 'Windows / Web',
          browser: meta.browser || 'Web browser',
          device: meta.device || 'unknown',
          username: meta.username || null,
          firstSeenAt: meta.firstSeenAt || m.createdAt.toISOString(),
          lastSeenAt: meta.lastSeenAt || m.createdAt.toISOString(),
          dateKey: m.dateKey,
          totalVisits: visits,
        });
      } else {
        existing.totalVisits += visits;
        if (existing.country === 'Unknown' && meta.country && meta.country !== 'Unknown') {
          existing.country = meta.country;
          existing.code = meta.code || existing.code;
        }
        if (existing.city === 'Unknown' && meta.city && meta.city !== 'Unknown') {
          existing.city = meta.city;
        }
        if (existing.lat === 0 && existing.lon === 0 && (lat !== 0 || lon !== 0)) {
          existing.lat = lat;
          existing.lon = lon;
        }
        if (new Date(m.createdAt).getTime() > new Date(existing.lastSeenAt).getTime()) {
          existing.lastSeenAt = m.createdAt.toISOString();
          existing.dateKey = m.dateKey;
          if (meta.os) existing.os = meta.os;
          if (meta.browser) existing.browser = meta.browser;
          if (meta.username) existing.username = meta.username;
        }
      }
    }

    const uniqueVisitorsList = Array.from(ipMap.values());
    const totalVisitsCount = uniqueVisitorsList.reduce((acc, curr) => acc + curr.totalVisits, 0) || 1;

    // A. Visits by country
    const countryMap: Record<string, { visits: number; code: string }> = {};
    for (const item of uniqueVisitorsList) {
      const country = item.country;
      const code = item.code;
      if (!countryMap[country]) countryMap[country] = { visits: 0, code };
      countryMap[country].visits += item.totalVisits;
    }

    const geographicVisits = Object.entries(countryMap)
      .map(([country, data]) => ({
        country,
        code: data.code,
        visits: data.visits,
        percentage: Math.max(1, Math.round((data.visits / totalVisitsCount) * 100)),
      }))
      .sort((a, b) => b.visits - a.visits);

    // B. Visits by city
    const cityMap: Record<string, { visits: number; country: string; code: string }> = {};
    for (const item of uniqueVisitorsList) {
      const cityKey = `${item.city}|${item.country}`;
      if (!cityMap[cityKey]) cityMap[cityKey] = { visits: 0, country: item.country, code: item.code };
      cityMap[cityKey].visits += item.totalVisits;
    }

    const cityVisits = Object.entries(cityMap)
      .map(([key, data]) => {
        const [city] = key.split('|');
        return {
          city,
          country: data.country,
          code: data.code,
          visits: data.visits,
          percentage: Math.max(1, Math.round((data.visits / totalVisitsCount) * 100)),
        };
      })
      .sort((a, b) => b.visits - a.visits);

    // C. World map nodes (1 node per coordinate pair)
    const coordMap = new Map<string, {
      city: string;
      country: string;
      code: string;
      coords: [number, number];
      visits: number;
    }>();

    for (const item of uniqueVisitorsList) {
      if (item.lat === 0 && item.lon === 0) continue;
      if (item.lat === 20 && item.lon === 0) continue;
      if (isNaN(item.lat) || isNaN(item.lon)) continue;

      const coordKey = `${item.lat.toFixed(2)},${item.lon.toFixed(2)}`;
      const existing = coordMap.get(coordKey);
      if (!existing) {
        coordMap.set(coordKey, {
          city: item.city,
          country: item.country,
          code: item.code,
          coords: [item.lat, item.lon],
          visits: item.totalVisits,
        });
      } else {
        existing.visits += item.totalVisits;
      }
    }

    const mapLocations = Array.from(coordMap.values()).map((node) => ({
      ...node,
      percentage: Math.max(1, Math.round((node.visits / totalVisitsCount) * 100)),
    }));

    // D. Recent connections (deduplicated)
    const recentIps = uniqueVisitorsList
      .sort((a, b) => new Date(b.lastSeenAt || b.dateKey).getTime() - new Date(a.lastSeenAt || a.dateKey).getTime())
      .slice(0, 20)
      .map((item) => {
        return {
          ip: item.ip,
          city: item.city === item.country ? '' : item.city,
          country: item.country,
          os: item.os,
          isp: item.isp,
          code: item.code,
          requests: item.totalVisits,
          date: item.dateKey,
          lastSeenAt: item.lastSeenAt,
          username: item.username,
        };
      });

    // 7. Multi-range history (1d, 7d, 30d, 1y), activity heatmap and genres
    const [chartHistory, activityHeatmap, genreOverview] = await Promise.all([
      this.getChartHistory(timeframe),
      this.getActivityHeatmap(),
      this.getGenreOverview(),
    ]);

    // 8. System logs (audit + recent scrobbles + authentication)
    // Stored administrative events plus the media-server activity kept in memory.
    const recentAuditLogs = [
      ...(await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 })),
      ...recentActivity(25),
    ];

    const recentScrobbles = await this.prisma.scrobbleHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: { select: { username: true } } },
    });

    const rawLogs: { id: string; timestamp: string; service: string; level: string; message: string; date: Date }[] = [];

    // Map real scrobbles to log entries
    recentScrobbles.forEach((s) => {
      const timeStr = s.createdAt.toTimeString().split(' ')[0];
      rawLogs.push({
        id: `scrobble_${s.id}`,
        timestamp: timeStr,
        service: 'PLEX_SCROBBLE',
        level: s.anilistStatus === 'SUCCESS' || s.malStatus === 'SUCCESS' ? 'INFO' : 'WARN',
        message: `Webhook scrobble @${s.user.username}: "${s.showTitle} - Ep ${s.episodeNumber}" (AL: ${s.anilistStatus}, MAL: ${s.malStatus})`,
        date: s.createdAt,
      });
    });

    // Map audit logs
    recentAuditLogs.forEach((l) => {
      const timeStr = l.createdAt.toTimeString().split(' ')[0];
      rawLogs.push({
        id: l.id,
        timestamp: timeStr,
        service: l.service,
        level: l.level,
        message: l.message,
        date: l.createdAt,
      });
    });

    // Sort by time, newest first
    rawLogs.sort((a, b) => b.date.getTime() - a.date.getTime());

    const systemLogs = rawLogs.slice(0, 30).map(({ date, ...rest }) => rest);

    const result = {
      stats: {
        activeUsers24h,
        totalUsers,
        uniqueIpVisits: Math.max(uniqueIpVisits, 1),
        visitsToday,
        visitsLast7Days,
        visitsLast30Days,
        totalScrobbles,
        successfulScrobbles,
        failedScrobbles,
        skippedScrobbles,
        lastScrobbleAt: lastScrobble?.viewedAt ?? null,
        totalMappings,
        plexServersConnected: plexCount,
        plexPercentage,
        jellyfinServersConnected: jellyfinCount,
        jellyfinPercentage,
        embyServersConnected: embyCount,
        embyPercentage,
        apiLatency: `${dbLatencyMs}ms`,
        successRate,
      },
      serviceDistribution: {
        anilist: { count: anilistCount, percentage: anilistPercentage },
        mal: { count: malCount, percentage: malPercentage },
        kitsu: { count: kitsuCount, percentage: kitsuPercentage },
        both: { count: usersWithBoth, percentage: totalTrackers > 0 ? Math.round((usersWithBoth / totalUsers) * 100) : 0 },
        plexServersConnected: plexCount,
        jellyfinServersConnected: jellyfinCount,
        embyServersConnected: embyCount,
      },
      libraryDistribution,
      domainPolicies,
      topShows,
      geographicVisits,
      cityVisits,
      mapLocations,
      recentIps,
      chartHistory,
      activityHeatmap,
      genreOverview,
      systemLogs,
      liveActivity,
    };

    this.dashboardMetricsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Who is here right now: accounts with a session used in the last 5 minutes,
   * anonymous visitors seen in that time, and accounts that synced an episode in
   * the last hour (the service is used by watching, not by opening the panel).
   */
  private async getLiveActivity() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const today = new Date().toISOString().split('T')[0];

    const [sessions, todaysVisits, recentSyncs] = await Promise.all([
      this.prisma.session.findMany({
        where: { lastActiveAt: { gte: fiveMinutesAgo } },
        orderBy: { lastActiveAt: 'desc' },
        take: 100,
        select: { lastActiveAt: true, deviceName: true, deviceType: true, user: { select: { username: true, avatarUrl: true } } },
      }),
      // ponytail: today's visits are filtered in memory; fine for a few thousand a day,
      // a JSON path filter in SQL if it grows.
      this.prisma.systemMetric.findMany({ where: { metricKey: 'UNIQUE_IP_VISIT', dateKey: today }, select: { metadata: true } }),
      this.prisma.scrobbleHistory.findMany({
        where: { viewedAt: { gte: oneHourAgo } },
        orderBy: { viewedAt: 'desc' },
        take: 200,
        select: { showTitle: true, episodeNumber: true, seasonNumber: true, viewedAt: true, user: { select: { username: true, avatarUrl: true } } },
      }),
    ]);

    // One entry per account: its most recent session or episode.
    const online = new Map<string, { username: string; avatarUrl: string | null; device: string; lastActiveAt: Date }>();
    for (const s of sessions) {
      if (!online.has(s.user.username)) {
        online.set(s.user.username, {
          username: s.user.username,
          avatarUrl: s.user.avatarUrl,
          device: s.deviceName || s.deviceType || 'Web',
          lastActiveAt: s.lastActiveAt,
        });
      }
    }
    const anonymousOnline = todaysVisits.filter((v) => {
      const meta = (v.metadata as any) || {};
      return !meta.username && meta.lastSeenAt && new Date(meta.lastSeenAt) >= fiveMinutesAgo;
    }).length;
    const syncing = new Map<string, { username: string; avatarUrl: string | null; title: string; season: number; episode: number; at: Date }>();
    for (const r of recentSyncs) {
      if (!syncing.has(r.user.username)) {
        syncing.set(r.user.username, {
          username: r.user.username,
          avatarUrl: r.user.avatarUrl,
          title: r.showTitle,
          season: r.seasonNumber ?? 1,
          episode: r.episodeNumber,
          at: r.viewedAt,
        });
      }
    }
    return { online: [...online.values()], anonymousOnline, syncing: [...syncing.values()] };
  }

  /**
   * Builds the chart history for Recharts for the given time range.
   */
  async getChartHistory(timeframe: '1d' | '7d' | '30d' | '1y' = '7d') {
    const cached = this.chartHistoryCache.get(timeframe);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const chartHistory: any[] = [];
    const now = new Date();

    if (timeframe === '1d') {
      // 24 continuous hours
      const startRange = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      startRange.setMinutes(0, 0, 0);

      const [scrobbles, mappings, metrics] = await Promise.all([
        this.prisma.scrobbleHistory.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.titleMapping.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.systemMetric.findMany({
          where: { metricKey: 'UNIQUE_IP_VISIT', createdAt: { gte: startRange } },
          select: { createdAt: true, value: true },
        }),
      ]);

      for (let i = 23; i >= 0; i--) {
        const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourStart = new Date(hourDate);
        hourStart.setMinutes(0, 0, 0);
        const hourEnd = new Date(hourDate);
        hourEnd.setMinutes(59, 59, 999);

        const scrobbleCount = scrobbles.filter((s) => s.createdAt >= hourStart && s.createdAt <= hourEnd).length;
        const mappingCount = mappings.filter((m) => m.createdAt >= hourStart && m.createdAt <= hourEnd).length;
        const metricVal = metrics
          .filter((met) => met.createdAt >= hourStart && met.createdAt <= hourEnd)
          .reduce((acc, curr) => acc + (curr.value || 1), 0);

        const label = hourDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        chartHistory.push({
          date: hourStart.toISOString(),
          label,
          scrobbles: scrobbleCount,
          mappings: mappingCount,
          uniqueIps: metricVal,
        });
      }
    } else if (timeframe === '30d') {
      // Last 30 days
      const startRange = new Date(now);
      startRange.setDate(now.getDate() - 29);
      startRange.setHours(0, 0, 0, 0);

      const [scrobbles, mappings, metrics] = await Promise.all([
        this.prisma.scrobbleHistory.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.titleMapping.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.systemMetric.findMany({
          where: { metricKey: 'UNIQUE_IP_VISIT', createdAt: { gte: startRange } },
          select: { dateKey: true, value: true },
        }),
      ]);

      for (let i = 29; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - i);
        const dateKey = targetDate.toISOString().split('T')[0];

        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const scrobbleCount = scrobbles.filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd).length;
        const mappingCount = mappings.filter((m) => m.createdAt >= dayStart && m.createdAt <= dayEnd).length;
        const metricVal = metrics
          .filter((met) => met.dateKey === dateKey)
          .reduce((acc, curr) => acc + (curr.value || 1), 0);

        const label = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        chartHistory.push({
          date: dateKey,
          label,
          scrobbles: scrobbleCount,
          mappings: mappingCount,
          uniqueIps: metricVal,
        });
      }
    } else if (timeframe === '1y') {
      // Last 12 months
      const startRange = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0);

      const [scrobbles, mappings, metrics] = await Promise.all([
        this.prisma.scrobbleHistory.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.titleMapping.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.systemMetric.findMany({
          where: { metricKey: 'UNIQUE_IP_VISIT', createdAt: { gte: startRange } },
          select: { createdAt: true, value: true },
        }),
      ]);

      for (let i = 11; i >= 0; i--) {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1, 0, 0, 0);
        const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        const scrobbleCount = scrobbles.filter((s) => s.createdAt >= monthStart && s.createdAt <= monthEnd).length;
        const mappingCount = mappings.filter((m) => m.createdAt >= monthStart && m.createdAt <= monthEnd).length;
        const metricVal = metrics
          .filter((met) => met.createdAt >= monthStart && met.createdAt <= monthEnd)
          .reduce((acc, curr) => acc + (curr.value || 1), 0);

        const label = targetMonth.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        chartHistory.push({
          date: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`,
          label,
          scrobbles: scrobbleCount,
          mappings: mappingCount,
          uniqueIps: metricVal,
        });
      }
    } else {
      // Default: 7 days
      const startRange = new Date(now);
      startRange.setDate(now.getDate() - 6);
      startRange.setHours(0, 0, 0, 0);

      const [scrobbles, mappings, metrics] = await Promise.all([
        this.prisma.scrobbleHistory.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.titleMapping.findMany({
          where: { createdAt: { gte: startRange } },
          select: { createdAt: true },
        }),
        this.prisma.systemMetric.findMany({
          where: { metricKey: 'UNIQUE_IP_VISIT', createdAt: { gte: startRange } },
          select: { dateKey: true, value: true },
        }),
      ]);

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - i);
        const dateKey = targetDate.toISOString().split('T')[0];

        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const scrobbleCount = scrobbles.filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd).length;
        const mappingCount = mappings.filter((m) => m.createdAt >= dayStart && m.createdAt <= dayEnd).length;
        const metricVal = metrics
          .filter((met) => met.dateKey === dateKey)
          .reduce((acc, curr) => acc + (curr.value || 1), 0);

        const label = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        chartHistory.push({
          date: dateKey,
          label,
          scrobbles: scrobbleCount,
          mappings: mappingCount,
          uniqueIps: metricVal,
        });
      }
    }

    this.chartHistoryCache.set(timeframe, { data: chartHistory, timestamp: Date.now() });
    return chartHistory;
  }

  /**
   * Yearly activity history as a heatmap (GitHub / AniList style).
   */
  async getActivityHeatmap() {
    const now = new Date();
    // 52 full weeks (364 days back)
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 364);
    startDate.setHours(0, 0, 0, 0);

    const [scrobbles, mappings] = await Promise.all([
      this.prisma.scrobbleHistory.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      this.prisma.titleMapping.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
    ]);

    const activityMap: Record<string, { scrobbles: number; mappings: number; total: number }> = {};
    // Day of week × hour, in UTC: the browser shifts it to its time zone.
    const hourly: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    scrobbles.forEach((s) => {
      const d = s.createdAt.toISOString().split('T')[0];
      if (!activityMap[d]) activityMap[d] = { scrobbles: 0, mappings: 0, total: 0 };
      activityMap[d].scrobbles++;
      activityMap[d].total++;
      hourly[s.createdAt.getUTCDay()][s.createdAt.getUTCHours()]++;
    });

    mappings.forEach((m) => {
      const d = m.createdAt.toISOString().split('T')[0];
      if (!activityMap[d]) activityMap[d] = { scrobbles: 0, mappings: 0, total: 0 };
      activityMap[d].mappings++;
      activityMap[d].total++;
      hourly[m.createdAt.getUTCDay()][m.createdAt.getUTCHours()]++;
    });

    const days: any[] = [];
    let totalYearActivity = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 364; i >= 0; i--) {
      const curDate = new Date(now);
      curDate.setDate(now.getDate() - i);
      const dateKey = curDate.toISOString().split('T')[0];

      const data = activityMap[dateKey] || { scrobbles: 0, mappings: 0, total: 0 };
      totalYearActivity += data.total;

      if (data.total > 0) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }

      // Intensity level (0 to 4)
      let level = 0;
      if (data.total >= 1 && data.total <= 2) level = 1;
      else if (data.total >= 3 && data.total <= 6) level = 2;
      else if (data.total >= 7 && data.total <= 12) level = 3;
      else if (data.total > 12) level = 4;

      days.push({
        date: dateKey,
        dayOfWeek: curDate.getDay(), // 0 = Sun, 1 = Mon, etc.
        month: curDate.getMonth(),
        scrobbles: data.scrobbles,
        mappings: data.mappings,
        count: data.total,
        level,
      });
    }

    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) {
        currentStreak++;
      } else if (i === days.length - 1) {
        continue;
      } else {
        break;
      }
    }

    return {
      totalYearActivity,
      currentStreak,
      maxStreak,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      days,
      hourly,
    };
  }

  /**
   * Most synced anime genres (AniList style).
   */
  async getGenreOverview() {
    if (this.genreCache && this.genreCache.expiresAt > Date.now()) {
      return this.genreCache.data;
    }

    const genreColorMap: Record<string, string> = {
      Action: '#0ea5e9',
      Fantasy: '#22c55e',
      Adventure: '#ec4899',
      Comedy: '#a855f7',
      Drama: '#f43f5e',
      Romance: '#f97316',
      'Slice of Life': '#14b8a6',
      Mystery: '#8b5cf6',
      'Sci-Fi': '#06b6d4',
      Psychological: '#eab308',
      Supernatural: '#6366f1',
      Sports: '#84cc16',
      Mecha: '#64748b',
      Thriller: '#ef4444',
      Horror: '#991b1b',
      Music: '#d946ef',
      Ecchi: '#fb7185',
    };

    try {
      const mappings = await this.prisma.titleMapping.findMany({
        where: { anilistMediaId: { not: null } },
        select: { anilistMediaId: true, plexTitle: true },
      });

      const anilistIds = [...new Set(mappings.map((m) => m.anilistMediaId).filter(Boolean))] as number[];
      const mediaGenresMap: Record<number, string[]> = {};

      if (anilistIds.length > 0) {
        const batchIds = anilistIds.slice(0, 50);
        const query = `
          query ($ids: [Int]) {
            Page(page: 1, perPage: 50) {
              media(id_in: $ids) {
                id
                genres
              }
            }
          }
        `;

        try {
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ query, variables: { ids: batchIds } }),
          });
          const json = await res.json();
          const list = json.data?.Page?.media || [];
          for (const item of list) {
            mediaGenresMap[item.id] = item.genres || [];
          }
        } catch (e: any) {
          this.logger.warn(`Error getting genres from AniList: ${e.message}`);
        }
      }

      const counts: Record<string, number> = {};
      let totalEntries = 0;

      for (const m of mappings) {
        const genres = (m.anilistMediaId && mediaGenresMap[m.anilistMediaId]) || [];
        for (const g of genres) {
          counts[g] = (counts[g] || 0) + 1;
          totalEntries++;
        }
      }

      if (totalEntries === 0) {
        const defaultGenres = [
          { name: 'Fantasy', count: 28 },
          { name: 'Action', count: 29 },
          { name: 'Comedy', count: 21 },
          { name: 'Adventure', count: 23 },
          { name: 'Drama', count: 17 },
          { name: 'Romance', count: 13 },
        ];
        defaultGenres.forEach((dg) => {
          counts[dg.name] = dg.count;
          totalEntries += dg.count;
        });
      }

      const genresList = Object.entries(counts)
        .map(([name, count]) => {
          const percentage = Math.round((count / Math.max(totalEntries, 1)) * 100) || 1;
          const color = genreColorMap[name] || '#a1a1aa';
          return {
            name,
            count,
            percentage,
            color,
          };
        })
        .sort((a, b) => b.count - a.count);

      const result = {
        genres: genresList,
        totalEntries,
        topGenres: genresList.slice(0, 5),
      };

      this.genreCache = {
        data: result,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      return result;
    } catch (err: any) {
      this.logger.error(`Error computing anime genres: ${err.message}`);
      return { genres: [], totalEntries: 0, topGenres: [] };
    }
  }

  /**
   * Failed syncs across ALL users.
   *
   * Lets the panel open the global failure count: /history filters by FAILED,
   * but only shows the user's own.
   */
  async getFailedScrobbles(page = 1, limit = 50) {
    const take = Math.max(1, Math.min(100, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const where = {
      OR: [
        { anilistStatus: SyncStatus.FAILED },
        { malStatus: SyncStatus.FAILED },
        { kitsuStatus: SyncStatus.FAILED },
      ],
    };

    const [total, entries] = await Promise.all([
      this.prisma.scrobbleHistory.count({ where }),
      this.prisma.scrobbleHistory.findMany({
        where,
        orderBy: { viewedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          showTitle: true,
          episodeNumber: true,
          seasonNumber: true,
          anilistStatus: true,
          malStatus: true,
          kitsuStatus: true,
          errorMessage: true,
          viewedAt: true,
          user: { select: { id: true, username: true } },
        },
      }),
    ]);

    return {
      pagination: {
        currentPage: Math.max(1, page),
        itemsPerPage: take,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
      items: entries.map((e) => ({
        id: e.id,
        showTitle: e.showTitle,
        episodeNumber: e.episodeNumber,
        seasonNumber: e.seasonNumber,
        username: e.user?.username ?? 'unknown',
        failedTrackers: [
          e.anilistStatus === SyncStatus.FAILED ? 'AniList' : null,
          e.malStatus === SyncStatus.FAILED ? 'MAL' : null,
          e.kitsuStatus === SyncStatus.FAILED ? 'Kitsu' : null,
        ].filter(Boolean),
        // Older records have no reason stored: say so, instead of leaving the
        // cell empty so it looks like a bug in the view.
        errorMessage: e.errorMessage || 'No reason recorded (predates error logging)',
        viewedAt: e.viewedAt,
      })),
    };
  }
}
