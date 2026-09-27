import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from './catalog.service';

/** List export and import (MAL XML, JSON, CSV). */
@Injectable()
export class AnimeDataTransferService {
  constructor(
    private prisma: PrismaService,
    private catalogService: CatalogService,
  ) {}

  /**
   * Exports the user's anime library and progress in standard formats (MAL XML, JSON, CSV).
   */
  async exportAnimeData(userId: string, format: 'mal_xml' | 'json' | 'csv' = 'mal_xml') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const [scrobbles, favorites, mappings] = await Promise.all([
      this.prisma.scrobbleHistory.findMany({
        where: { userId },
        orderBy: { viewedAt: 'desc' },
      }),
      this.prisma.userFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.titleMapping.findMany({
        where: { userId },
      }),
    ]);

    // Group by showTitle
    const showMap = new Map<string, {
      title: string;
      episodesWatched: number;
      seasonNumber: number;
      viewPercentage: number;
      rating: number;
      status: string;
      malId?: number;
      anilistId?: number;
      updatedAt: Date;
    }>();

    for (const s of scrobbles) {
      const key = s.showTitle.toLowerCase().trim();
      const mapping = mappings.find((m) => m.plexTitle.toLowerCase().trim() === key);
      const existing = showMap.get(key);

      const epNum = Number(s.episodeNumber || 1);
      const watched = existing ? Math.max(existing.episodesWatched, epNum) : epNum;
      const score = Math.round(Number(s.rating || existing?.rating || 0));
      const status = s.viewPercentage >= 85 ? 'Completed' : 'Watching';

      showMap.set(key, {
        title: s.showTitle,
        episodesWatched: watched,
        seasonNumber: s.seasonNumber || 1,
        viewPercentage: s.viewPercentage,
        rating: score,
        status,
        malId: mapping?.malMediaId || undefined,
        anilistId: mapping?.anilistMediaId || undefined,
        updatedAt: s.viewedAt,
      });
    }

    // Add unplayed favorites as 'Plan to Watch'
    for (const f of favorites) {
      const key = f.title.toLowerCase().trim();
      if (!showMap.has(key)) {
        showMap.set(key, {
          title: f.title,
          episodesWatched: 0,
          seasonNumber: 1,
          viewPercentage: 0,
          rating: 0,
          status: 'Plan to Watch',
          updatedAt: f.createdAt,
        });
      }
    }

    const items = Array.from(showMap.values());
    const username = user?.username || 'SyncSekaiUser';

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `plexsync_anime_export_${username}_${Date.now()}.json`,
        content: JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            platform: 'SyncSekai',
            username,
            totalItems: items.length,
            anime: items,
          },
          null,
          2,
        ),
      };
    }

    if (format === 'csv') {
      const rows = [
        ['Title', 'Episodes Watched', 'Season', 'Status', 'Score', 'Last Updated'],
        ...items.map((i) => [
          `"${i.title.replace(/"/g, '""')}"`,
          i.episodesWatched,
          i.seasonNumber,
          `"${i.status}"`,
          i.rating,
          `"${i.updatedAt.toISOString()}"`,
        ]),
      ];
      return {
        contentType: 'text/csv',
        filename: `plexsync_anime_export_${username}_${Date.now()}.csv`,
        content: rows.map((r) => r.join(',')).join('\n'),
      };
    }

    // Default: MAL XML Standard (Universal format supported by MAL, AniList, Kitsu, and Anime-Planet import)
    const watchingCount = items.filter((i) => i.status === 'Watching').length;
    const completedCount = items.filter((i) => i.status === 'Completed').length;
    const plannedCount = items.filter((i) => i.status === 'Plan to Watch').length;

    const animeNodes = items
      .map((i) => {
        return `  <anime>
    <series_animedb_id>${i.malId || 0}</series_animedb_id>
    <series_title><![CDATA[${i.title}]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>${Math.max(i.episodesWatched, 12)}</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>${i.episodesWatched}</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>${i.rating}</my_score>
    <my_status>${i.status}</my_status>
    <my_times_watched>1</my_times_watched>
    <my_tags><![CDATA[Exported from SyncSekai]]></my_tags>
    <update_on_import>1</update_on_import>
  </anime>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!--
  Exported from SyncSekai
  Universal MyAnimeList / AniList / Kitsu XML Import Specification
-->
<myanimelist>
  <myinfo>
    <user_id>1</user_id>
    <user_name>${username}</user_name>
    <user_export_type>1</user_export_type>
    <user_total_anime>${items.length}</user_total_anime>
    <user_total_watching>${watchingCount}</user_total_watching>
    <user_total_completed>${completedCount}</user_total_completed>
    <user_total_onhold>0</user_total_onhold>
    <user_total_dropped>0</user_total_dropped>
    <user_total_plantowatch>${plannedCount}</user_total_plantowatch>
  </myinfo>
${animeNodes}
</myanimelist>`;

    return {
      contentType: 'application/xml',
      filename: `plexsync_mal_export_${username}_${Date.now()}.xml`,
      content: xml,
    };
  }

  /**
   * Imports anime and progress from external export files (MAL XML, AniList JSON, CSV).
   */
  async importAnimeData(userId: string, rawData: string) {
    if (!rawData || !rawData.trim()) {
      throw new BadRequestException('The import file is empty.');
    }

    const trimmed = rawData.trim();
    let importedCount = 0;
    let favoritesCount = 0;

    // Case 1: standard MyAnimeList / Kitsu / AniList XML file
    if (trimmed.startsWith('<?xml') || trimmed.includes('<myanimelist>') || trimmed.includes('<anime>')) {
      const animeBlocks = trimmed.split(/<\/?anime>/).filter((b) => b.includes('<series_title>'));

      for (const block of animeBlocks) {
        const titleMatch = block.match(/<series_title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/series_title>/);
        const epMatch = block.match(/<my_watched_episodes>(\d+)<\/my_watched_episodes>/);
        const scoreMatch = block.match(/<my_score>(\d+)<\/my_score>/);
        const statusMatch = block.match(/<my_status>(.*?)<\/my_status>/);

        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].trim();
          const epWatched = epMatch ? parseInt(epMatch[1], 10) : 1;
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
          const status = statusMatch ? statusMatch[1].trim().toLowerCase() : 'completed';

          if (status === 'plan to watch' || epWatched === 0) {
            await this.prisma.userFavorite.upsert({
              where: {
                userId_animeId: {
                  userId,
                  animeId: String(Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                },
              },
              create: {
                userId,
                animeId: String(Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                title,
                genres: ['Imported'],
              },
              update: {},
            });
            favoritesCount++;
          } else {
            await this.prisma.scrobbleHistory.create({
              data: {
                userId,
                showTitle: title,
                episodeNumber: Math.max(1, epWatched),
                seasonNumber: 1,
                viewPercentage: status === 'completed' ? 100 : 85,
                rating: score > 0 ? score : null,
                viewedAt: new Date(),
              },
            });
            importedCount++;
          }
        }
      }
    }
    // Case 2: JSON file (SyncSekai / AniList / Kitsu)
    else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : parsed.anime || parsed.items || [];

        for (const item of list) {
          const title = item.title || item.name || item.series_title;
          if (!title) continue;

          const epWatched = item.episodesWatched || item.episodeNumber || item.progress || 1;
          const score = item.rating || item.score || null;

          if (item.status === 'PLANNING' || item.status === 'Plan to Watch' || epWatched === 0) {
            await this.prisma.userFavorite.upsert({
              where: {
                userId_animeId: {
                  userId,
                  animeId: String(item.id || Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                },
              },
              create: {
                userId,
                animeId: String(item.id || Math.abs(title.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0))),
                title,
                coverUrl: item.coverUrl || null,
                genres: item.genres || ['Imported'],
              },
              update: {},
            });
            favoritesCount++;
          } else {
            await this.prisma.scrobbleHistory.create({
              data: {
                userId,
                showTitle: title,
                episodeNumber: Math.max(1, Number(epWatched)),
                seasonNumber: Number(item.seasonNumber || item.season || 1),
                viewPercentage: 100,
                rating: score ? Number(score) : null,
                viewedAt: new Date(),
              },
            });
            importedCount++;
          }
        }
      } catch (err: any) {
        throw new BadRequestException('Invalid JSON format: ' + err.message);
      }
    }
    // Case 3: CSV file
    else {
      const lines = trimmed.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2) {
          const title = cols[0];
          const epWatched = parseInt(cols[1], 10) || 1;
          const score = parseInt(cols[4], 10) || null;

          await this.prisma.scrobbleHistory.create({
            data: {
              userId,
              showTitle: title,
              episodeNumber: Math.max(1, epWatched),
              seasonNumber: 1,
              viewPercentage: 100,
              rating: score,
              viewedAt: new Date(),
            },
          });
          importedCount++;
        }
      }
    }

    this.catalogService.invalidateUserCache(userId);

    return {
      success: true,
      importedCount,
      favoritesCount,
      totalProcessed: importedCount + favoritesCount,
      message: `Imported ${importedCount} series into the history and ${favoritesCount} into your favorites/planned list.`,
    };
  }
}
