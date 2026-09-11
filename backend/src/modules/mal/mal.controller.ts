import { Controller, Post, Get, Body, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { MalService } from './mal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/mal')
export class MalController {
  constructor(private malService: MalService) {}

  @UseGuards(JwtAuthGuard)
  @Get('oauth-url')
  async getOAuthUrl(@CurrentUser() user: any) {
    if (user.settings && !user.settings.canSyncMal && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con MyAnimeList.');
    }
    return this.malService.getOAuthUrl();
  }

  @UseGuards(JwtAuthGuard)
  @Post('oauth/callback')
  async handleOAuthCallback(
    @CurrentUser() user: any,
    @Body('code') code: string,
    @Body('codeVerifier') codeVerifier: string,
  ) {
    if (user.settings && !user.settings.canSyncMal && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con MyAnimeList.');
    }
    return this.malService.handleOAuthCallback(user.id, code, codeVerifier);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect-token')
  async connectToken(@CurrentUser() user: any, @Body('token') token: string) {
    if (user.settings && !user.settings.canSyncMal && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con MyAnimeList.');
    }
    return this.malService.connectToken(user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ping')
  async ping(@CurrentUser() user: any) {
    if (user.settings && !user.settings.canSyncMal && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para sincronizar con MyAnimeList.');
    }
    return this.malService.pingConnection(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.malService.disconnect(user.id);
  }
}
