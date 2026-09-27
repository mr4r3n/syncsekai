import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CoversService } from './covers.service';
import * as fs from 'fs';

@Controller('api/covers')
export class CoversController {
  constructor(private coversService: CoversService) {}

  @Get(':key')
  @SkipThrottle()
  async getCover(
    @Param('key') key: string,
    @Query('title') titleParam: string | undefined,
    @Query('fallback') fallbackUrl: string | undefined,
    @Res() res: Response,
  ) {
    if (!key || key.length > 96 || (titleParam && titleParam.length > 160)) {
      return res.status(400).send('Invalid cover parameters');
    }
    const safeKey = this.coversService.getSafeKey(key);
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
    return res.redirect('https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg');
  }
}
