import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { MalService } from '../mal/mal.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { CoversService, anilistCoverUrl } from '../covers/covers.service';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    private prisma: PrismaService,
    private anilistService: AnilistService,
    private malService: MalService,
    private kitsuService: KitsuService,
    private coversService: CoversService,
  ) {}

  async getUserHistory(
    userId: string,
    page: number = 1,
    limit: number = 30,
    search: string = '',
  ) {
    const validPage = Math.max(1, Number(page) || 1);
    const validLimit = Math.min(100, Math.max(5, Number(limit) || 30));
    const skip = (validPage - 1) * validLimit;

    const whereClause: any = { userId };
    if (search && search.trim()) {
      whereClause.showTitle = { contains: search.trim(), mode: 'insensitive' };
    }

    const [total, history, mappings, plexConn, jellyfinConn] = await Promise.all([
      this.prisma.scrobbleHistory.count({ where: whereClause }),
      this.prisma.scrobbleHistory.findMany({
        where: whereClause,
        orderBy: { viewedAt: 'desc' },
        skip,
        take: validLimit,
      }),
      this.prisma.titleMapping.findMany({
        where: { userId },
      }),
      this.prisma.plexConnection.findUnique({
        where: { userId },
        select: { monitoredLibraries: true, serverName: true },
      }),
      this.prisma.jellyfinConnection.findUnique({
        where: { userId },
        select: { monitoredLibraries: true, serverName: true },
      }),
    ]);

    const mappingMap = new Map<string, any>();
    for (const m of mappings) {
      mappingMap.set(`${m.plexTitle.toLowerCase().trim()}_${m.plexSeason || 1}`, m);
      if (!mappingMap.has(m.plexTitle.toLowerCase().trim())) {
        mappingMap.set(m.plexTitle.toLowerCase().trim(), m);
      }
    }

    const defaultLibrary = plexConn?.monitoredLibraries?.[0] || jellyfinConn?.monitoredLibraries?.[0] || 'Library';
    const defaultServerName = plexConn?.serverName || jellyfinConn?.serverName || 'Media server';

    // Hydrate covers using CoversService (cached on server disk)
    const items = await Promise.all(
      history.map(async (entry) => {
        const snap: any = entry.payloadSnapshot || {};
        const metadata: any = snap.Metadata || {};
        const season = entry.seasonNumber || 1;
        const mapping =
          mappingMap.get(`${entry.showTitle.toLowerCase().trim()}_${season}`) ||
          mappingMap.get(entry.showTitle.toLowerCase().trim());
        const anilistMediaId = mapping?.anilistMediaId || null;
        const isMapped = Boolean(anilistMediaId || mapping?.malMediaId || mapping?.kitsuMediaId);

        // Obtain local cached cover or fetch and save on server disk
        let coverImage: string | null = null;
        if (anilistMediaId) {
          coverImage = anilistCoverUrl(anilistMediaId, entry.showTitle);
          if (!this.coversService.hasLocalCover(`al_${anilistMediaId}`)) {
            this.coversService.getOrFetchCover(entry.showTitle, anilistMediaId).catch(() => {});
          }
        } else {
          const titleKey = this.coversService.getTitleKey(entry.showTitle);
          coverImage =
            this.coversService.getLocalCoverUrl(titleKey) ||
            `/api/covers/${titleKey}?title=${encodeURIComponent(entry.showTitle)}`;
          if (!this.coversService.hasLocalCover(titleKey)) {
            this.coversService.getOrFetchCover(entry.showTitle, null).catch(() => {});
          }
        }

        const entrySource = entry.source || (snap.NotificationType || snap.ItemType ? 'JELLYFIN' : 'PLEX');
        const entryServer = entry.serverName || snap.Server?.title || snap.ServerName || defaultServerName;
        const entryLibrary = entry.libraryName || metadata.librarySectionTitle || snap.LibraryName || snap.librarySectionTitle || defaultLibrary;
        const episodeTitle = metadata.title || snap.Name || null;

        return {
          id: entry.id,
          showTitle: entry.showTitle,
          episodeNumber: entry.episodeNumber,
          seasonNumber: entry.seasonNumber || 1,
          viewPercentage: entry.viewPercentage,
          rating: entry.rating,
          source: entrySource,
          serverName: entryServer,
          librarySectionTitle: entryLibrary,
          anilistStatus: entry.anilistStatus,
          malStatus: entry.malStatus,
          kitsuStatus: entry.kitsuStatus,
          errorMessage: entry.errorMessage,
          viewedAt: entry.viewedAt,
          createdAt: entry.createdAt,
          episodeTitle,
          coverImage,
          anilistMediaId,
          anilistTitle: mapping?.anilistTitle || entry.showTitle,
          isMapped,
        };
      }),
    );

    const totalPages = Math.ceil(total / validLimit) || 1;

    return {
      items,
      total,
      page: validPage,
      totalPages,
      limit: validLimit,
    };
  }

  async deleteAndRevert(userId: string, historyId: string) {
    const entry = await this.prisma.scrobbleHistory.findFirst({
      where: { id: historyId, userId },
    });

    if (!entry) throw new NotFoundException('History entry not found.');

    // 1. Robust title mapping (multi-level: user -> user any season -> global -> AniList search)
    let mapping = await this.prisma.titleMapping.findFirst({
      where: {
        userId,
        plexTitle: { equals: entry.showTitle, mode: 'insensitive' },
        plexSeason: entry.seasonNumber || 1,
      },
    });

    if (!mapping) {
      mapping = await this.prisma.titleMapping.findFirst({
        where: {
          userId,
          plexTitle: { equals: entry.showTitle, mode: 'insensitive' },
        },
      });
    }

    if (!mapping) {
      mapping = await this.prisma.titleMapping.findFirst({
        where: {
          isGlobal: true,
          plexTitle: { equals: entry.showTitle, mode: 'insensitive' },
          plexSeason: entry.seasonNumber || 1,
        },
      });
    }

    if (!mapping) {
      mapping = await this.prisma.titleMapping.findFirst({
        where: {
          isGlobal: true,
          plexTitle: { equals: entry.showTitle, mode: 'insensitive' },
        },
      });
    }

    let anilistMediaId = mapping?.anilistMediaId || null;
    let malMediaId = mapping?.malMediaId || null;

    // Fallback: with no stored mapping, resolve the id by searching AniList
    if (!anilistMediaId) {
      try {
        const searchResults = await this.anilistService.searchAnime(entry.showTitle, entry.seasonNumber || 1);
        if (searchResults && searchResults.length > 0) {
          const match = searchResults[0];
          anilistMediaId = match.id;
          malMediaId = match.idMal || null;
        }
      } catch (e: any) {
        this.logger.warn(`Could not resolve the AniList ID to revert "${entry.showTitle}": ${e.message}`);
      }
    }

    // 2. Work out which episode to revert to on AniList and MAL
    // Highest episode the user still has in the remaining history (excluding the one being deleted)
    const remainingHistory = await this.prisma.scrobbleHistory.findFirst({
      where: {
        userId,
        showTitle: { equals: entry.showTitle, mode: 'insensitive' },
        seasonNumber: entry.seasonNumber || 1,
        id: { not: entry.id },
      },
      orderBy: { episodeNumber: 'desc' },
    });

    let targetEpisode = 0;
    if (remainingHistory) {
      targetEpisode = remainingHistory.episodeNumber;
    } else {
      targetEpisode = Math.max(0, entry.episodeNumber - 1);
    }

    const revertErrors: string[] = [];

    // 3. Revert on AniList
    if (anilistMediaId) {
      try {
        if (targetEpisode === 0) {
          const alRes = await this.anilistService.deleteMediaListEntry(userId, anilistMediaId);
          if (!alRes?.success && alRes?.reason) {
            this.logger.warn(`AniList deleteMediaListEntry result: ${alRes.reason}`);
          }
        } else {
          const alRes = await this.anilistService.updateProgress(
            userId,
            anilistMediaId,
            targetEpisode,
            'CURRENT',
          );
          if (!alRes?.success && alRes?.error) {
            revertErrors.push(`AniList: ${alRes.error || alRes.reason}`);
          } else {
            // Delete any feed post ("Watched episode X") created by the revert update
            await this.anilistService.deleteRecentActivityForMedia(userId, anilistMediaId).catch(() => {});
          }
        }
        this.logger.log(`AniList revert done for @${userId}: "${entry.showTitle}" (ID ${anilistMediaId}) -> Ep. ${targetEpisode}`);
      } catch (e: any) {
        this.logger.error(`Error reverting AniList for "${entry.showTitle}": ${e.message}`);
        revertErrors.push(`AniList: ${e.message}`);
      }
    }

    // 4. Revert on MyAnimeList
    if (malMediaId) {
      try {
        if (targetEpisode === 0) {
          const malRes = await this.malService.deleteListEntry(userId, malMediaId);
          if (!malRes?.success && malRes?.error) {
            revertErrors.push(`MAL: ${malRes.error}`);
          }
        } else {
          const malRes = await this.malService.updateProgress(
            userId,
            malMediaId,
            targetEpisode,
            'watching',
          );
          if (!malRes?.success && malRes?.error) {
            revertErrors.push(`MAL: ${malRes.error}`);
          }
        }
        this.logger.log(`MAL revert done for @${userId}: "${entry.showTitle}" (MAL ID ${malMediaId}) -> Ep. ${targetEpisode}`);
      } catch (e: any) {
        this.logger.error(`Error reverting MAL for "${entry.showTitle}": ${e.message}`);
        revertErrors.push(`MAL: ${e.message}`);
      }
    }

    // 4.5 Revert on Kitsu
    const kitsuMediaId = mapping?.kitsuMediaId;
    if (kitsuMediaId) {
      try {
        if (targetEpisode === 0) {
          const kitsuRes = await this.kitsuService.deleteLibraryEntry(userId, kitsuMediaId);
          if (!kitsuRes?.success && kitsuRes?.message !== 'Kitsu is not connected for this user.') {
            revertErrors.push(`Kitsu: ${kitsuRes.message}`);
          }
        } else {
          const kitsuRes = await this.kitsuService.updateProgress(
            userId,
            kitsuMediaId,
            targetEpisode,
            'current',
            undefined,
            true,
          );
          if (!kitsuRes?.success && kitsuRes?.message !== 'Kitsu is not connected for this user.') {
            revertErrors.push(`Kitsu: ${kitsuRes.message}`);
          }
        }
        this.logger.log(`Kitsu revert done for @${userId}: "${entry.showTitle}" (Kitsu ID ${kitsuMediaId}) -> Ep. ${targetEpisode}`);
      } catch (e: any) {
        this.logger.error(`Error reverting Kitsu for "${entry.showTitle}": ${e.message}`);
        revertErrors.push(`Kitsu: ${e.message}`);
      }
    }

    // 5. Delete the local history entry ONLY if no tracker returned an error
    if (revertErrors.length > 0) {
      this.logger.warn(
        `Local history entry (${entry.id}) not deleted because of remote revert errors: ${revertErrors.join(', ')}`,
      );
      return {
        success: false,
        message: `Could not revert on these trackers: ${revertErrors.join(', ')}. The local record was kept.`,
        errors: revertErrors,
      };
    }

    await this.prisma.scrobbleHistory.delete({
      where: { id: entry.id },
    });

    // 6. Record the event in AuditLog
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'HISTORY_REVERT',
        message: `History revert @${userId}: "${entry.showTitle} Ep. ${entry.episodeNumber}" deleted (progress set to Ep. ${targetEpisode})`,
        details: {
          showTitle: entry.showTitle,
          revertedFromEpisode: entry.episodeNumber,
          revertedToEpisode: targetEpisode,
          anilistMediaId,
          malMediaId,
          kitsuMediaId,
          errors: null,
        },
      },
    }).catch(() => {});

    return {
      success: true,
      message: `"${entry.showTitle} Ep. ${entry.episodeNumber}" deleted and reverted to Ep. ${targetEpisode} on your trackers.`,
    };
  }

  /**
   * Real summary of an account's history.
   *
   * Every figure here is counted against the database; with an empty account
   * they are zero or null, never placeholder numbers. What cannot be counted
   * (the real latency of each submission, which is not stored) is not made up:
   * it is not returned.
   */
  async getStatsSummary(userId: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, successful, thisMonth, previousMonth, byTracker, rows] = await Promise.all([
      this.prisma.scrobbleHistory.count({ where: { userId } }),
      this.prisma.scrobbleHistory.count({
        where: {
          userId,
          OR: [
            { anilistStatus: 'SUCCESS' },
            { malStatus: 'SUCCESS' },
            { kitsuStatus: 'SUCCESS' },
          ],
        },
      }),
      this.prisma.scrobbleHistory.count({
        where: { userId, viewedAt: { gte: currentMonthStart } },
      }),
      this.prisma.scrobbleHistory.count({
        where: { userId, viewedAt: { gte: previousMonthStart, lt: currentMonthStart } },
      }),
      Promise.all([
        this.prisma.scrobbleHistory.count({ where: { userId, anilistStatus: 'SUCCESS' } }),
        this.prisma.scrobbleHistory.count({ where: { userId, malStatus: 'SUCCESS' } }),
        this.prisma.scrobbleHistory.count({ where: { userId, kitsuStatus: 'SUCCESS' } }),
      ]),
      this.prisma.scrobbleHistory.findMany({
        where: { userId },
        select: { showTitle: true, seasonNumber: true, episodeNumber: true, viewedAt: true },
      }),
    ]);

    // Distinct episodes: two plays of the same episode are one episode.
    const episodes = new Set(
      rows.map((f) => `${f.showTitle}|${f.seasonNumber ?? 1}|${f.episodeNumber ?? 0}`),
    ).size;

    // Change against last month. Without a previous month there is nothing to compare.
    const monthlyChange =
      previousMonth > 0 ? Math.round(((thisMonth - previousMonth) / previousMonth) * 100) : null;

    const [okAnilist, okMal, okKitsu] = byTracker;
    const trackerSum = okAnilist + okMal + okKitsu;
    const candidates = [
      { name: 'AniList', submissions: okAnilist },
      { name: 'MyAnimeList', submissions: okMal },
      { name: 'Kitsu', submissions: okKitsu },
    ].sort((a, b) => b.submissions - a.submissions);
    const principal =
      trackerSum > 0 && candidates[0].submissions > 0
        ? {
            name: candidates[0].name,
            percentage: Math.round((candidates[0].submissions / trackerSum) * 100),
          }
        : null;

    // Most active slot: the hour with the most plays and the next one.
    let activeSlot: { from: number; to: number } | null = null;
    if (rows.length > 0) {
      const byHour = new Array(24).fill(0);
      for (const f of rows) byHour[new Date(f.viewedAt).getHours()]++;
      let best = 0;
      for (let h = 0; h < 24; h++) {
        const timeWindow = byHour[h] + byHour[(h + 1) % 24];
        if (timeWindow > byHour[best] + byHour[(best + 1) % 24]) best = h;
      }
      if (byHour[best] > 0) activeSlot = { from: best, to: (best + 2) % 24 };
    }

    return {
      total,
      successful,
      // Without submissions there is no rate: null, and the screen shows a dash.
      successRate: total > 0 ? Number(((successful / total) * 100).toFixed(1)) : null,
      episodes,
      thisMonth,
      previousMonth,
      monthlyChange,
      topTracker: principal,
      activeSlot,
    };
  }

  async getViewingHeatmap(userId: string) {
    const scrobbles = await this.prisma.scrobbleHistory.findMany({
      where: { userId },
      select: { viewedAt: true },
      orderBy: { viewedAt: 'asc' },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    const dayCounts = new Map<string, number>();
    for (const s of scrobbles) {
      if (!s.viewedAt) continue;
      const dStr = s.viewedAt.toISOString().slice(0, 10);
      dayCounts.set(dStr, (dayCounts.get(dStr) || 0) + 1);
    }

    let startYear = currentYear;
    let startMonth = Math.max(0, currentMonth - 5);

    if (scrobbles.length > 0) {
      const firstDate = scrobbles[0].viewedAt;
      if (firstDate.getFullYear() < startYear || (firstDate.getFullYear() === startYear && firstDate.getMonth() < startMonth)) {
        startYear = firstDate.getFullYear();
        startMonth = firstDate.getMonth();
      }
    }

    const months: any[] = [];
    let y = startYear;
    let m = startMonth;

    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const isCurrent = y === currentYear && m === currentMonth;
      const daysCount = new Date(y, m + 1, 0).getDate();
      let monthTotal = 0;
      let firstActiveDayInMonth = 1;
      let hasActiveDay = false;

      const days: any[] = [];
      for (let d = 1; d <= daysCount; d++) {
        const mPad = String(m + 1).padStart(2, '0');
        const dPad = String(d).padStart(2, '0');
        const dateStr = `${y}-${mPad}-${dPad}`;

        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const count = dayCounts.get(dateStr) || 0;
        monthTotal += count;

        if (count > 0 && !hasActiveDay) {
          firstActiveDayInMonth = d;
          hasActiveDay = true;
        }

        let tier = 0;
        if (count > 0) {
          if (count <= 2) tier = 1;
          else if (count <= 4) tier = 2;
          else if (count <= 6) tier = 3;
          else tier = 4;
        }

        days.push({
          day: d,
          date: dateStr,
          count,
          tier,
          isToday,
          isFuture,
        });
      }

      months.push({
        year: y,
        month: m,
        totalScrobbles: monthTotal,
        daysCount,
        firstActiveDay: hasActiveDay ? firstActiveDayInMonth : 1,
        isCurrent,
        days,
      });

      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    const activeDates = Array.from(dayCounts.keys()).sort();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of activeDates) {
      const d = new Date(dStr + 'T00:00:00Z');
      if (prevDate) {
        const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      if (tempStreak > bestStreak) bestStreak = tempStreak;
      prevDate = d;
    }

    if (activeDates.length > 0) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const lastActive = activeDates[activeDates.length - 1];
      if (lastActive === todayStr || lastActive === yesterday) {
        currentStreak = tempStreak;
      }
    }

    const earliestRecordDate = scrobbles.length > 0 ? scrobbles[0].viewedAt.toISOString().slice(0, 10) : todayStr;
    const latestRecordDate = todayStr;

    return {
      months,
      totalScrobbles: scrobbles.length,
      currentStreak,
      bestStreak,
      earliestRecordDate,
      latestRecordDate,
    };
  }
}
