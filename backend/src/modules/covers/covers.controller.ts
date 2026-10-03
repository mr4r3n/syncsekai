import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CoversService } from './covers.service';
import { requestIp } from '../../common/security/client-ip';
import * as fs from 'fs';

const DEFAULT_COVER = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
// The keys the app builds: tracker ids (al_, mal_, kitsu_ or a bare AniList id) and
// title hashes. Anything else would only create files nobody asks for.
const COVER_KEY = /^(?:(?:al|mal|kitsu)_)?\d{1,10}$|^title_[a-f0-9]{16}$/;

@Controller('api/covers')
export class CoversController {
  constructor(private coversService: CoversService) {}

  // ponytail: per-IP window in process memory for covers that are not on disk yet, the
  // only ones that cost downloads and API lookups. A catalog page asks for up to 100.
  // Lost on restart and not shared between replicas; a shared store if the backend scales.
  private static readonly MISSES_PER_MINUTE = 150;
  private readonly misses = new Map<string, { count: number; startedAt: number }>();

  private allowMiss(ip: string): boolean {
    const now = Date.now();
    const entry = this.misses.get(ip);
    if (!entry || now - entry.startedAt > 60_000) {
      if (this.misses.size > 5000) this.misses.clear();
      this.misses.set(ip, { count: 1, startedAt: now });
      return true;
    }
    return ++entry.count <= CoversController.MISSES_PER_MINUTE;
  }

  @Get(':key')
  @SkipThrottle()
  async getCover(
    @Param('key') key: string,
    @Query('title') titleParam: string | undefined,
    @Query('fallback') fallbackUrl: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!key || key.length > 96 || (titleParam && titleParam.length > 160)) {
      return res.status(400).send('Invalid cover parameters');
    }
    const safeKey = this.coversService.getSafeKey(key);
    if (!COVER_KEY.test(safeKey)) {
      return res.redirect(DEFAULT_COVER);
    }
    let filePath = this.coversService.getFilePath(safeKey);

    // If the file already exists on disk, serve it right away
    if (filePath && fs.existsSync(filePath)) {
      let contentType = 'image/webp';
      if (filePath.endsWith('.png')) contentType = 'image/png';
      else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    const validFallback = fallbackUrl && this.coversService.isAllowedCoverUrl(fallbackUrl) ? fallbackUrl : null;
    // Over the limit, the browser goes to the CDN itself: the image still shows, nothing is downloaded here.
    if (!this.allowMiss(requestIp(req))) {
      return res.redirect(validFallback || DEFAULT_COVER);
    }

    // If the direct remote URL was given as a fallback (e.g. AniList's or Kitsu's official CDN)
    if (fallbackUrl && this.coversService.isAllowedCoverUrl(fallbackUrl)) {
      const savedPath = await this.coversService.downloadAndSaveCover(safeKey, fallbackUrl);
      if (savedPath) {
        const fullLocalPath = this.coversService.getFilePath(safeKey);
        if (fullLocalPath && fs.existsSync(fullLocalPath)) {
          res.set({
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          return fs.createReadStream(fullLocalPath).pipe(res);
        }
      }
      // If the local download is slow or fails, redirect straight to the original official CDN
      return res.redirect(fallbackUrl);
    }

    // Without a fallback, try to resolve it on demand (Kitsu -> AniList -> Jikan)
    filePath = await this.coversService.fetchAndCacheOnDemand(key, titleParam);
    if (filePath && fs.existsSync(filePath)) {
      let contentType = 'image/webp';
      if (filePath.endsWith('.png')) contentType = 'image/png';
      else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Final safe redirect
    return res.redirect(DEFAULT_COVER);
  }
}
