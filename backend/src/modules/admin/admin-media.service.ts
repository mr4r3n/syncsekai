import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CoversService } from '../covers/covers.service';
import { AnimeMetadataService } from '../covers/anime-metadata.service';

export interface MediaPageQuery {
  page: number;
  limit: number;
  search: string;
  category: string;
  status: 'ALL' | 'LINKED' | 'ORPHAN';
  sort: string;
}

/** Query string of the media list, clamped (page >= 1, 1..100 per page). */
export function parseMediaQuery(q: Record<string, string | undefined>): MediaPageQuery {
  const status = q.status === 'LINKED' || q.status === 'ORPHAN' ? q.status : 'ALL';
  return {
    page: Math.max(1, parseInt(q.page || '1', 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(q.limit || '32', 10) || 32)),
    search: (q.search || '').trim().toLowerCase().slice(0, 100),
    category: q.category || 'ALL',
    status,
    sort: q.sort || 'RECENT',
  };
}

/** Cover files: listing, deletion, purge and refresh. */
@Injectable()
export class AdminMediaService {
  // ponytail: the enriched list (disk scan + usage counts) is rebuilt at most every 30 s, and
  // at once after any change made here; files written by the covers service meanwhile show up
  // within those 30 s.
  private listCache: { at: number; list: Awaited<ReturnType<AdminMediaService['buildMediaList']>> } | null = null;

  constructor(
    private prisma: PrismaService,
    private coversService: CoversService,
    private animeMetadataService: AnimeMetadataService,
  ) {}

  /**
   * One page of the media library, filtered and sorted as the page used to do in the
   * browser, plus the totals of the whole library.
   */
  async getMediaPage(q: MediaPageQuery) {
    if (!this.listCache || Date.now() - this.listCache.at > 30_000) {
      this.listCache = { at: Date.now(), list: await this.buildMediaList() };
    }
    const { media, ...totals } = this.listCache.list;
    const filtered = media
      .filter((item) => {
        const matchesCategory = q.category === 'ALL' || item.category === q.category;
        const matchesStatus =
          q.status === 'ALL' || (q.status === 'LINKED' && !item.isOrphan) || (q.status === 'ORPHAN' && item.isOrphan);
        if (!matchesCategory || !matchesStatus) return false;
        if (!q.search) return true;
        return (
          item.filename.toLowerCase().includes(q.search) ||
          (item.titleEnglish && item.titleEnglish.toLowerCase().includes(q.search)) ||
          (item.titleRomaji && item.titleRomaji.toLowerCase().includes(q.search)) ||
          (item.plexTitles && item.plexTitles.some((t: string) => t.toLowerCase().includes(q.search))) ||
          (item.anilistId && String(item.anilistId).includes(q.search)) ||
          (item.malId && String(item.malId).includes(q.search))
        );
      })
      .sort((a, b) => {
        const english = (x: any) => x.titleEnglish || x.titleRomaji || x.filename;
        const romaji = (x: any) => x.titleRomaji || x.titleEnglish || x.filename;
        switch (q.sort) {
          case 'RECENT': return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
          case 'OLDEST': return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          case 'TITLE_EN_ASC': return english(a).localeCompare(english(b));
          case 'TITLE_EN_DESC': return english(b).localeCompare(english(a));
          case 'TITLE_ROMAJI_ASC': return romaji(a).localeCompare(romaji(b));
          case 'TITLE_ROMAJI_DESC': return romaji(b).localeCompare(romaji(a));
          case 'SIZE_DESC': return b.sizeBytes - a.sizeBytes;
          case 'SIZE_ASC': return a.sizeBytes - b.sizeBytes;
          default: return 0;
        }
      });
    return {
      ...totals,
      media: filtered.slice((q.page - 1) * q.limit, q.page * q.limit),
      total: filtered.length,
      page: q.page,
      limit: q.limit,
    };
  }

  /**
   * Media management: lists the files cached on the server, enriched with anime metadata.
   */
  private async buildMediaList() {
    const mediaDirs = [
      { dir: path.join(process.cwd(), 'uploads', 'covers'), category: 'Anime covers', urlPrefix: '/api/covers' },
      { dir: path.join(process.cwd(), 'uploads', 'general'), category: 'General', urlPrefix: '/uploads/general' },
    ];

    // 1. Load every mapping, favorite and historical title to cross-reference
    const [allMappings, allHistory, allFavorites] = await Promise.all([
      this.prisma.titleMapping.findMany({
        select: {
          plexTitle: true,
          plexSeason: true,
          anilistMediaId: true,
          anilistTitle: true,
          malMediaId: true,
          malTitle: true,
        },
      }),
      // One row per distinct title with its count: reading every scrobble of every user here
      // grew with the whole history on each visit.
      this.prisma.scrobbleHistory.groupBy({ by: ['showTitle'], _count: { _all: true } }),
      this.prisma.userFavorite.findMany({
        select: {
          animeId: true,
          title: true,
        },
      }),
    ]);

    // Lookup indexes and usage counts
    const anilistUsage = new Map<number, { count: number; plexTitles: Set<string>; mappingTitle?: string; malId?: number }>();
    const malUsage = new Map<number, { count: number; plexTitles: Set<string>; mappingTitle?: string; anilistId?: number }>();
    const titleHashUsage = new Map<string, { count: number; plexTitles: Set<string>; anilistId?: number; mappingTitle?: string; malId?: number }>();
    const favoriteAnimeIds = new Set<string>();

    for (const f of allFavorites) {
      if (f.animeId) {
        favoriteAnimeIds.add(String(f.animeId));
        favoriteAnimeIds.add(String(f.animeId).toLowerCase());
      }
    }

    for (const m of allMappings) {
      const cleanPlex = (m.plexTitle || '').trim();
      const hash = `title_${crypto.createHash('md5').update(cleanPlex.toLowerCase()).digest('hex').slice(0, 16)}`;

      if (m.anilistMediaId) {
        const entry = anilistUsage.get(m.anilistMediaId) || {
          count: 0,
          plexTitles: new Set<string>(),
          mappingTitle: m.anilistTitle || undefined,
          malId: m.malMediaId || undefined,
        };
        entry.count += 1;
        if (cleanPlex) entry.plexTitles.add(cleanPlex);
        anilistUsage.set(m.anilistMediaId, entry);
      }

      if (m.malMediaId) {
        const malEntry = malUsage.get(m.malMediaId) || {
          count: 0,
          plexTitles: new Set<string>(),
          mappingTitle: m.malTitle || m.anilistTitle || undefined,
          anilistId: m.anilistMediaId || undefined,
        };
        malEntry.count += 1;
        if (cleanPlex) malEntry.plexTitles.add(cleanPlex);
        malUsage.set(m.malMediaId, malEntry);
      }

      const hashEntry = titleHashUsage.get(hash) || {
        count: 0,
        plexTitles: new Set<string>(),
        anilistId: m.anilistMediaId || undefined,
        mappingTitle: m.anilistTitle || undefined,
        malId: m.malMediaId || undefined,
      };
      hashEntry.count += 1;
      if (cleanPlex) hashEntry.plexTitles.add(cleanPlex);
      if (m.anilistMediaId && !hashEntry.anilistId) hashEntry.anilistId = m.anilistMediaId;
      titleHashUsage.set(hash, hashEntry);
    }

    for (const h of allHistory) {
      const cleanPlex = (h.showTitle || '').trim();
      const hash = `title_${crypto.createHash('md5').update(cleanPlex.toLowerCase()).digest('hex').slice(0, 16)}`;
      const hashEntry = titleHashUsage.get(hash);
      if (hashEntry) {
        hashEntry.count += h._count._all;
        if (cleanPlex) hashEntry.plexTitles.add(cleanPlex);
      }
    }

    // 2. Collect AniList ids to preload metadata in bulk (English and romaji)
    const neededAnilistIds = new Set<number>();
    const rawFiles: Array<{ file: string; dir: string; category: string; urlPrefix: string; stats: fs.Stats }> = [];

    for (const { dir, category, urlPrefix } of mediaDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const stats = fs.statSync(fullPath);
          // aliases.json lives next to the covers and is not media.
          if (stats.isFile() && /\.(webp|jpe?g|png|gif)$/i.test(file)) {
            rawFiles.push({ file, dir, category, urlPrefix, stats });

            if (category === 'Anime covers') {
              const safeBase = path.parse(file).name;
              if (safeBase.startsWith('al_') || /^\d+$/.test(safeBase)) {
                const id = parseInt(safeBase.replace('al_', ''), 10);
                if (!isNaN(id)) neededAnilistIds.add(id);
              } else if (safeBase.startsWith('title_')) {
                const match = titleHashUsage.get(safeBase);
                if (match?.anilistId) neededAnilistIds.add(match.anilistId);
              }
            }
          }
        } catch {}
      }
    }

    // 3. Titles: whatever is already cached; the rest is requested in the background.
    // Resolving them inline with a cold cache takes minutes and the proxy times
    // out first. The files are returned now; missing titles will appear on the
    // next load.
    const idsAnilist = Array.from(neededAnilistIds);
    const metaMap = this.animeMetadataService.getCachedMetadata(idsAnilist);
    this.animeMetadataService.preloadAnimeMetadata(idsAnilist);

    // 4. Build the final enriched list
    const mediaList: any[] = [];
    let totalSizeBytes = 0;
    let totalLinked = 0;
    let totalOrphans = 0;

    for (const { file, category, urlPrefix, stats } of rawFiles) {
      totalSizeBytes += stats.size;
      const sizeKb = (stats.size / 1024).toFixed(1);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      const formattedSize = stats.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

      const ext = path.extname(file).toLowerCase();
      const mimeType =
        ext === '.webp'
          ? 'image/webp'
          : ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
      const safeBase = path.parse(file).name;
      const url = category === 'Anime covers' ? `/api/covers/${safeBase}` : `${urlPrefix}/${file}`;

      let anilistId: number | null = null;
      let malId: number | null = null;
      let titleEnglish: string | null = null;
      let titleRomaji: string | null = null;
      let plexTitles: string[] = [];
      let usageCount = 0;
      let isOrphan = false;

      if (category === 'Anime covers') {
        if (safeBase.startsWith('al_') || /^\d+$/.test(safeBase)) {
          const id = parseInt(safeBase.replace('al_', ''), 10);
          if (!isNaN(id)) {
            anilistId = id;
            const meta = metaMap.get(id);
            if (meta) {
              titleEnglish = meta.english || null;
              titleRomaji = meta.romaji || null;
              malId = meta.malId || null;
            }
            const usage = anilistUsage.get(id);
            const isFav = favoriteAnimeIds.has(String(id)) || favoriteAnimeIds.has(`al_${id}`);
            usageCount = (usage?.count || 0) + (isFav ? 1 : 0) + 1; // In use as an active library/catalog asset
            if (usage) {
              plexTitles = Array.from(usage.plexTitles);
              if (!titleEnglish && !titleRomaji && usage.mappingTitle) {
                titleRomaji = usage.mappingTitle;
              }
              if (!malId && usage.malId) malId = usage.malId;
            }
            isOrphan = stats.size === 0;
          }
        } else if (safeBase.startsWith('mal_')) {
          const id = parseInt(safeBase.replace('mal_', ''), 10);
          if (!isNaN(id)) {
            malId = id;
            const usage = malUsage.get(id);
            const isFav = favoriteAnimeIds.has(String(id)) || favoriteAnimeIds.has(`mal_${id}`);
            usageCount = (usage?.count || 0) + (isFav ? 1 : 0) + 1; // In use as an active library/catalog asset
            if (usage) {
              plexTitles = Array.from(usage.plexTitles);
              if (usage.mappingTitle) titleRomaji = usage.mappingTitle;
              if (usage.anilistId) anilistId = usage.anilistId;
            }
            isOrphan = stats.size === 0;
          }
        } else if (safeBase.startsWith('kitsu_')) {
          const id = parseInt(safeBase.replace('kitsu_', ''), 10);
          const isFav = favoriteAnimeIds.has(String(id)) || favoriteAnimeIds.has(`kitsu_${id}`);
          usageCount = (isFav ? 1 : 0) + 1; // In use as an active library/catalog asset
          isOrphan = stats.size === 0;
        } else if (safeBase.startsWith('title_')) {
          const usage = titleHashUsage.get(safeBase);
          if (usage) {
            usageCount = usage.count;
            plexTitles = Array.from(usage.plexTitles);
            if (usage.anilistId) {
              anilistId = usage.anilistId;
              const meta = metaMap.get(usage.anilistId);
              if (meta) {
                titleEnglish = meta.english || null;
                titleRomaji = meta.romaji || null;
                malId = meta.malId || null;
              }
            }
            if (!titleRomaji && usage.mappingTitle) {
              titleRomaji = usage.mappingTitle;
            }
            if (!malId && usage.malId) malId = usage.malId;
          }
          isOrphan = usageCount === 0 || stats.size === 0;
        } else {
          isOrphan = stats.size === 0;
        }
      }

      if (category === 'Anime covers') {
        if (isOrphan) totalOrphans++;
        else totalLinked++;
      }

      mediaList.push({
        filename: file,
        category,
        url,
        sizeBytes: stats.size,
        formattedSize,
        mimeType,
        createdAt: stats.birthtime || stats.mtime,
        modifiedAt: stats.mtime,
        anilistId,
        malId,
        titleEnglish,
        titleRomaji,
        plexTitles,
        usageCount,
        isOrphan,
      });
    }

    mediaList.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    const totalSizeFormatted =
      totalSizeBytes > 1024 * 1024 ? `${totalSizeMb} MB` : `${(totalSizeBytes / 1024).toFixed(1)} KB`;

    return {
      media: mediaList,
      totalFiles: mediaList.length,
      totalSizeBytes,
      totalSizeFormatted,
      totalLinked,
      totalOrphans,
    };
  }

  /**
   * Deletes a specific media file.
   */
  async deleteMediaFile(filename: string) {
    this.listCache = null;
    const safeName = path.basename(filename);
    const possiblePaths = [
      path.join(process.cwd(), 'uploads', 'covers', safeName),
      path.join(process.cwd(), 'uploads', 'general', safeName),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        return { success: true, message: `File ${safeName} deleted.` };
      }
    }

    throw new NotFoundException(`File ${safeName} does not exist.`);
  }

  /**
   * Purges the whole cover cache to free storage.
   */
  async purgeCoversCache() {
    this.listCache = null;
    const coversDir = path.join(process.cwd(), 'uploads', 'covers');
    let deletedCount = 0;

    if (fs.existsSync(coversDir)) {
      const files = fs.readdirSync(coversDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(coversDir, file));
          deletedCount++;
        } catch {}
      }
    }

    return {
      success: true,
      message: `Purged ${deletedCount} cover files from the cache.`,
      deletedCount,
    };
  }

  /**
   * Purges only orphan covers (no associated mappings or plays).
   */
  async purgeOrphanCovers() {
    this.listCache = null;
    const listRes = await this.buildMediaList();
    const orphans = listRes.media.filter((m: any) => m.category === 'Anime covers' && m.isOrphan);
    let deletedCount = 0;

    for (const orphan of orphans) {
      const p = path.join(process.cwd(), 'uploads', 'covers', orphan.filename);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          deletedCount++;
        } catch {}
      }
    }

    return {
      success: true,
      message: `Deleted ${deletedCount} orphan covers from the cache.`,
      deletedCount,
    };
  }

  /**
   * Forces a refresh and download of a specific cover.
   */
  async refreshCover(filename: string) {
    this.listCache = null;
    const safeBase = path.parse(filename).name;
    const res = await this.coversService.forceRefreshCover(safeBase);
    if (!res.success) {
      throw new BadRequestException(res.error || 'Could not refresh the cover from the remote server.');
    }
    return {
      success: true,
      message: `Cover ${filename} refreshed with the latest version.`,
      url: res.url,
    };
  }
}
