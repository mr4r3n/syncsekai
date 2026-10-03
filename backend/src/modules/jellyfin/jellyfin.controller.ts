import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JellyfinService } from './jellyfin.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlexWebhookService } from '../plex/plex-webhook.service';
import { requestIp } from '../../common/security/client-ip';

@Controller('api/jellyfin')
export class JellyfinController {
  private readonly logger = new Logger(JellyfinController.name);

  constructor(
    private jellyfinService: JellyfinService,
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
    return this.jellyfinService.testConnection(serverUrl, apiKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  async connect(
    @CurrentUser() user: any,
    @Body('serverUrl') serverUrl: string,
    @Body('apiKey') apiKey: string,
    @Body('serverName') serverName?: string,
    @Body('jellyfinUsername') jellyfinUsername?: string,
  ) {
    return this.jellyfinService.connect(user.id, serverUrl, apiKey, serverName, jellyfinUsername);
  }

  @UseGuards(JwtAuthGuard)
  @Get('libraries')
  async getLibraries(@CurrentUser() user: any) {
    return this.jellyfinService.getLibraries(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('libraries')
  async updateLibraries(
    @CurrentUser() user: any,
    @Body('monitoredLibraries') monitoredLibraries: string[],
  ) {
    return this.jellyfinService.updateMonitoredLibraries(user.id, monitoredLibraries);
  }

  @UseGuards(JwtAuthGuard)
  @Get('webhook-info')
  async getWebhookInfo(@CurrentUser() user: any) {
    return this.jellyfinService.getWebhookInfo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.jellyfinService.disconnect(user.id);
  }

  /**
   * Connectivity test endpoint, like Plex's, to check from the panel itself
   * that the webhook is reachable on the local network.
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.jellyfinService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = requestIp(req);
    return this.jellyfinService.recordPing(clientIp);
  }

  /**
   * Public webhook for Jellyfin's official "Webhook" plugin. Same token scheme
   * (whk_live_...) and same format + existence check as the Plex webhook.
   * Unlike Plex, the plugin sends plain JSON (no multipart), so
   * AnyFilesInterceptor is not needed, but it must still defend against a
   * user having broken the Handlebars template or set the wrong Content-Type in
   * the plugin settings.
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
    // If the plugin's Content-Type is not application/json, Express does not
    // parse it and it may arrive as a string (or the user sent a badly escaped
    // template): the payload is never assumed to be well formed.
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
    this.logger.log(`[JELLYFIN_INCOMING_WEBHOOK] Event: ${payload?.NotificationType || 'raw'}, IP: ${clientIp}`);

    // Move heavy processing (AniList/MAL API, covers, Discord) off the request, to the event loop
    setImmediate(() => {
      this.jellyfinService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Async Jellyfin webhook processing error: ${err.message}`, err.stack);
        });
    });

    return {
      received: true,
      status: 'ACCEPTED',
      event: payload?.NotificationType || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
