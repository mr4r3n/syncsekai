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
      return res.status(400).send('Parámetros de portada no válidos');
    }
    const safeKey = this.coversService.getSafeKey(key);
    let filePath = this.coversService.getFilePath(safeKey);

    // Si ya existe el archivo en disco, servirlo de inmediato
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

    // Si nos pasaron la URL remota directa como fallback (ej: CDN oficial de AniList o Kitsu)
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
      // Si la descarga en local tarda o falla, redirigir directamente al CDN oficial original
      return res.redirect(fallbackUrl);
    }

    // Si no vino fallback, intentar resolverlo bajo demanda (Kitsu -> AniList -> Jikan)
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

    // Redirección segura final
    return res.redirect('https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg');
  }
}
