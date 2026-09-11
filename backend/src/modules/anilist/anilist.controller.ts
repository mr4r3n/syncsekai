import { Controller, Post, Get, Body, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { AnilistService } from './anilist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/anilist')
export class AnilistController {
  constructor(private anilistService: AnilistService) {}

  @UseGuards(JwtAuthGuard)
  @Get('oauth-url')
  async getOAuthUrl(@CurrentUser() user: any) {
    if (user.settings && !user.settings.canSyncAnilist && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con AniList.');
    }
    return this.anilistService.getOAuthUrl(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('oauth/callback')
  async handleOAuthCallback(
    @CurrentUser() user: any,
    @Body('code') code: string,
    @Body('state') state?: string,
  ) {
    if (user.settings && !user.settings.canSyncAnilist && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con AniList.');
    }
    return this.anilistService.handleOAuthCallback(user.id, code, state);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect-token')
  async connectToken(@CurrentUser() user: any, @Body('token') token: string) {
    if (user.settings && !user.settings.canSyncAnilist && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con AniList.');
    }
    return this.anilistService.connectToken(user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchAnime(@Query('q') query: string) {
    return this.anilistService.searchAnime(query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ping')
  async ping(@CurrentUser() user: any) {
    if (user.settings && !user.settings.canSyncAnilist && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con AniList.');
    }
    return this.anilistService.pingConnection(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.anilistService.disconnect(user.id);
  }
}
