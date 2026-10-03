import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmbyService } from './emby.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlexWebhookService } from '../plex/plex-webhook.service';
import { requestIp } from '../../common/security/client-ip';

@Controller('api/emby')
export class EmbyController {
  private readonly logger = new Logger(EmbyController.name);

  constructor(
    private embyService: EmbyService,
    // hasWebhookToken is already source-agnostic (it only reads User.webhookToken):
    // it is reused as is instead of duplicated, same whk_live_ token scheme.
    private plexWebhookService: PlexWebhookService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection(
    @Body('serverUrl') serverUrl: string,
    @Body('apiKey') apiKey: string,
  ) {
    return this.embyService.testConnection(serverUrl, apiKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  async connect(
    @CurrentUser() user: any,
    @Body('serverUrl') serverUrl: string,
    @Body('apiKey') apiKey: string,
    @Body('serverName') serverName?: string,
    @Body('embyUsername') embyUsername?: string,
  ) {
    return this.embyService.connect(user.id, serverUrl, apiKey, serverName, embyUsername);
  }

  @UseGuards(JwtAuthGuard)
  @Get('libraries')
  async getLibraries(@CurrentUser() user: any) {
    return this.embyService.getLibraries(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('libraries')
  async updateLibraries(
    @CurrentUser() user: any,
    @Body('monitoredLibraries') monitoredLibraries: string[],
  ) {
    return this.embyService.updateMonitoredLibraries(user.id, monitoredLibraries);
  }

  @UseGuards(JwtAuthGuard)
  @Get('webhook-info')
  async getWebhookInfo(@CurrentUser() user: any) {
    return this.embyService.getWebhookInfo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.embyService.disconnect(user.id);
  }

  /**
   * Connectivity test endpoint, like Plex's and Jellyfin's, to check from the
   * panel itself that the webhook is reachable on the local network (although
   * for Emby without Premiere the recommended path is the watcher).
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.embyService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.embyService.recordPing(clientIp);
  }

  /**
   * Emby's native "Webhooks" webhook (requires Emby Premiere). Same token
   * scheme (whk_live_...) and same format + existence check as Plex/Jellyfin.
   * Not verified live against an Emby with Premiere (see the comment on
   * emby.service.ts#normalizeEmbyPayload); the verified, main path for Emby is
   * the session watcher.
   */
  @Post('webhook/:webhookToken')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        throw new BadRequestException('Invalid webhook payload.');
      }
    }
    if (!payload || typeof payload !== 'object') {
      payload = {};
    }

    const clientIp = requestIp(req);
    this.logger.log(`[EMBY_INCOMING_WEBHOOK] Event: ${payload?.NotificationType || payload?.Event || 'raw'}, IP: ${clientIp}`);

    setImmediate(() => {
      this.embyService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Async Emby webhook processing error: ${err.message}`, err.stack);
        });
    });

    return {
      received: true,
      status: 'ACCEPTED',
      event: payload?.NotificationType || payload?.Event || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
