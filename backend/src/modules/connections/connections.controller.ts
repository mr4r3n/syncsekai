import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/connections')
export class ConnectionsController {
  constructor(private connectionsService: ConnectionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('hub')
  async getConnectionHub(@CurrentUser() user: any) {
    return this.connectionsService.getConnectionHub(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('health-check')
  async runHealthCheck(@CurrentUser() user: any) {
    return this.connectionsService.runHealthCheck(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(
    @CurrentUser() user: any,
    @Body()
    data: {
      completionPercentage?: number;
      syncRatings?: boolean;
      emailErrorAlerts?: boolean;
      discordNotifications?: boolean;
      webNotifications?: boolean;
      autoApproveMappings?: boolean;
      themePalette?: string;
      themeMode?: string;
    },
  ) {
    return this.connectionsService.updateSettings(user.id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('simulate-scrobble')
  async simulateScrobble(
    @CurrentUser() user: any,
    @Body()
    payload: {
      showTitle: string;
      episodeNumber: number;
      seasonNumber?: number;
      viewPercentage: number;
      rating?: number;
      source?: string;
      dryRun?: boolean;
    },
  ) {
    return this.connectionsService.simulateWebhookEvent(user.id, payload);
  }
}
