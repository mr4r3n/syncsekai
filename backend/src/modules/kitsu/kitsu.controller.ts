import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { KitsuService } from './kitsu.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/kitsu')
@UseGuards(JwtAuthGuard)
export class KitsuController {
  constructor(private kitsuService: KitsuService) {}

  @Get('oauth-url')
  async getOAuthUrl() {
    return this.kitsuService.getOAuthUrl();
  }

  @Post('oauth/callback')
  async handleCallback(
    @CurrentUser() user: any,
    @Body('code') code: string,
  ) {
    if (!code) {
      throw new BadRequestException('Se requiere el código de autorización.');
    }
    return this.kitsuService.handleOAuthCallback(user.id, code);
  }

  @Post('connect-credentials')
  async connectCredentials(
    @CurrentUser() user: any,
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    if (!username || !password) {
      throw new BadRequestException('Se requiere usuario/correo y contraseña.');
    }
    return this.kitsuService.connectWithCredentials(user.id, username, password);
  }

  @Post('connect-token')
  async connectToken(
    @CurrentUser() user: any,
    @Body('accessToken') accessToken: string,
  ) {
    if (!accessToken) {
      throw new BadRequestException('Se requiere el token de acceso.');
    }
    return this.kitsuService.connectWithToken(user.id, accessToken);
  }

  @Get('search')
  async searchAnime(@Query('query') query: string) {
    return this.kitsuService.searchAnime(query || '');
  }

  @Post('ping')
  async ping(@CurrentUser() user: any) {
    return this.kitsuService.pingConnection(user.id);
  }

  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.kitsuService.disconnect(user.id);
  }
}
