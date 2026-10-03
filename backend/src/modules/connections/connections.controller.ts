import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { WebhookSimulatorService } from './webhook-simulator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from '../auth/dto/auth.dto';

@Controller('api/connections')
export class ConnectionsController {
  constructor(
    private connectionsService: ConnectionsService,
    private webhookSimulatorService: WebhookSimulatorService,
  ) {}

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
    @Body() data: UpdateSettingsDto,
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
    return this.webhookSimulatorService.simulateWebhookEvent(user.id, payload);
  }
}
