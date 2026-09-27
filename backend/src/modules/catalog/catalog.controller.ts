import { Controller, Get, Post, Body, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { FranchiseService } from './franchise.service';
import { CatalogProgressService } from './catalog-progress.service';
import { UserLibraryService } from './user-library.service';
import { AnimeDataTransferService } from './anime-data-transfer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('api/catalog')
export class CatalogController {
  constructor(
    private catalogService: CatalogService,
    private franchiseService: FranchiseService,
    private catalogProgressService: CatalogProgressService,
    private userLibraryService: UserLibraryService,
    private animeDataTransferService: AnimeDataTransferService,
  ) {}

  @Get()
  async getPublicCatalog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('provider') provider?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    return this.catalogService.getCatalog(undefined, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 32,
      status,
      search,
      provider: provider as any,
      forceRefresh: forceRefresh === 'true',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('franchise')
  async getFranchise(
    @CurrentUser() user: any,
    @Query('anilistId') rawAnilistId?: string,
    @Query('malId') rawMalId?: string,
    @Query('provider') rawProvider?: string,
  ) {
    if (user.settings && !user.settings.canAccessCatalog && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to access the catalog.');
    }
    const anilistId = rawAnilistId ? Number(rawAnilistId) : undefined;
    const malId = rawMalId ? Number(rawMalId) : undefined;
    if (
      (!anilistId && !malId)
      || (anilistId !== undefined && (!Number.isInteger(anilistId) || anilistId <= 0 || anilistId > 2147483647))
      || (malId !== undefined && (!Number.isInteger(malId) || malId <= 0 || malId > 2147483647))
    ) {
      throw new BadRequestException('A valid AniList or MyAnimeList id is required.');
    }
    const provider = rawProvider === 'MAL' ? 'MAL' : rawProvider === 'KITSU' ? 'KITSU' : 'ANILIST';
    return this.franchiseService.getFranchise(user.id, { anilistId, malId, provider });
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserCatalog(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('provider') provider?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    if (user.settings && !user.settings.canAccessCatalog && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to access the catalog.');
    }

    return this.catalogService.getCatalog(user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 32,
      status,
      search,
      provider: provider as any,
      forceRefresh: forceRefresh === 'true',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-progress')
  async updateProgress(
    @CurrentUser() user: any,
    @Body()
    body: {
      anilistMediaId?: number;
      malMediaId?: number;
      progress?: number;
      score?: number;
      status?: string;
      showTitle?: string;
      seasonNumber?: number;
    },
  ) {
    if (user.settings && !user.settings.canAccessCatalog && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update catalog progress.');
    }

    return this.catalogProgressService.updateProgressAndRating(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getUserStats(@CurrentUser() user: any) {
    return this.userLibraryService.getUserStats(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('favorites/toggle')
  async toggleFavorite(
    @CurrentUser() user: any,
    @Body()
    body: {
      animeId: string;
      title: string;
      coverUrl?: string;
      genres?: string[];
    },
  ) {
    if (!body.animeId || !body.title) {
      throw new BadRequestException('animeId and title are required.');
    }
    return this.userLibraryService.toggleFavorite(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  async getFavorites(@CurrentUser() user: any) {
    return this.userLibraryService.getFavorites(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportData(
    @CurrentUser() user: any,
    @Query('format') format?: 'mal_xml' | 'json' | 'csv',
  ) {
    return this.animeDataTransferService.exportAnimeData(user.id, format || 'mal_xml');
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  async importData(
    @CurrentUser() user: any,
    @Body('data') data: string,
  ) {
    if (!data) {
      throw new BadRequestException('The import file content is required.');
    }
    return this.animeDataTransferService.importAnimeData(user.id, data);
  }
}
