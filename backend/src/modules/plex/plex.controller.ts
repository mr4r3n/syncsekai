import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, Logger, UseInterceptors, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlexService } from './plex.service';
import { PlexWebhookService } from './plex-webhook.service';
import { requestIp } from '../../common/security/client-ip';

@Controller('api/plex')
export class PlexController {
  private readonly logger = new Logger(PlexController.name);

  constructor(
    private plexService: PlexService,
    private plexWebhookService: PlexWebhookService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('pin')
  async requestPin() {
    return this.plexService.requestPin();
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-pin')
  async verifyPin(
    @CurrentUser() user: any,
    @Body('pinId') pinId: number,
    @Body('clientIdentifier') clientIdentifier?: string,
  ) {
    return this.plexService.verifyPin(user.id, pinId, clientIdentifier);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect-manual')
  async connectManual(
    @CurrentUser() user: any,
    @Body('token') token: string,
    @Body('serverUrl') serverUrl?: string,
    @Body('serverName') serverName?: string,
  ) {
    return this.plexService.connectManualToken(user.id, token, serverUrl, serverName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('servers')
  async getServers(@CurrentUser() user: any) {
    return this.plexService.getUserServers(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-server')
  async selectServer(
    @CurrentUser() user: any,
    @Body('serverName') serverName: string,
    @Body('serverUrl') serverUrl: string,
  ) {
    return this.plexService.selectServer(user.id, serverName, serverUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection(
    @Body('serverUrl') serverUrl: string,
    @Body('token') token: string,
  ) {
    return this.plexService.testConnection(serverUrl, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('libraries')
  async getLibraries(@CurrentUser() user: any) {
    return this.plexService.getLibraries(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('libraries')
  async updateLibraries(
    @CurrentUser() user: any,
    @Body('monitoredLibraries') monitoredLibraries: string[],
  ) {
    return this.plexService.updateMonitoredLibraries(user.id, monitoredLibraries);
  }

  @UseGuards(JwtAuthGuard)
  @Get('webhook-info')
  async getWebhookInfo(@CurrentUser() user: any) {
    return this.plexWebhookService.getWebhookInfo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.plexService.disconnect(user.id);
  }

  /**
   * Connectivity test endpoint, to check the webhook is reachable on the local network.
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.plexWebhookService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.plexWebhookService.recordPing(clientIp);
  }

  /**
   * Public Plex webhook endpoint with multipart/form-data support (official Plex Media Server).
   * Processing is fully asynchronous and non-blocking to avoid timeouts in Plex Media Server.
   */
  @Post('webhook/:webhookToken')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(AnyFilesInterceptor({
    limits: {
      fileSize: 256 * 1024,
      fieldSize: 256 * 1024,
      files: 1,
      fields: 4,
      parts: 5,
    },
  }))
  async handleWebhook(
    @Param('webhookToken') webhookToken: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!/^whk_live_[a-f0-9]{16,64}$/.test(webhookToken)) {
      throw new UnauthorizedException('Invalid webhook.');
    }
    if (!(await this.plexWebhookService.hasWebhookToken(webhookToken))) {
      throw new UnauthorizedException('Invalid webhook.');
    }
    let payload = body;
    // Plex PMS sends the data as multipart, with the 'payload' field as a JSON string
    if (typeof body?.payload === 'string') {
      try {
        payload = JSON.parse(body.payload);
      } catch {
        throw new BadRequestException('Invalid webhook payload.');
      }
    }

    const clientIp = requestIp(req);
    this.logger.log(`[PLEX_INCOMING_WEBHOOK] Event: ${payload?.event || 'raw'}, IP: ${clientIp}`);

    // Move heavy processing (AniList/MAL API, covers, Discord) off the request, to the event loop
    setImmediate(() => {
      this.plexWebhookService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Async webhook processing error: ${err.message}`, err.stack);
        });
    });

    return {
      received: true,
      status: 'ACCEPTED',
      event: payload?.event || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
