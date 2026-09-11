import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmbyService } from './emby.service';
import { PlexService } from '../plex/plex.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/emby')
export class EmbyController {
  private readonly logger = new Logger(EmbyController.name);

  constructor(
    private embyService: EmbyService,
    // hasWebhookToken ya es agnóstico de origen (solo mira User.webhookToken):
    // se reutiliza tal cual en vez de duplicarlo, mismo esquema de token whk_live_.
    private plexService: PlexService,
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
   * Endpoint de Test de Conectividad, igual que el de Plex/Jellyfin, para
   * verificar que el webhook es accesible en la red local desde el propio
   * panel (aunque en Emby, sin Premiere, el camino recomendado es el watcher).
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.embyService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.embyService.recordPing(clientIp);
  }

  /**
   * Webhook nativo "Webhooks" de Emby (requiere Emby Premiere). Mismo esquema
   * de token (whk_live_...) y misma validación de formato + existencia que
   * Plex/Jellyfin. No verificado en vivo contra un Emby con Premiere (ver
   * comentario en emby.service.ts#normalizeEmbyPayload) — el camino verificado
   * y principal para Emby es el watcher de sesiones.
   */
  @Post('webhook/:webhookToken')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async handleWebhook(
    @Param('webhookToken') webhookToken: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!/^whk_live_[a-f0-9]{16,64}$/.test(webhookToken)) {
      throw new UnauthorizedException('Webhook no válido.');
    }
    if (!(await this.plexService.hasWebhookToken(webhookToken))) {
      throw new UnauthorizedException('Webhook no válido.');
    }

    let payload = body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        throw new BadRequestException('Payload de webhook no válido.');
      }
    }
    if (!payload || typeof payload !== 'object') {
      payload = {};
    }

    const clientIp = req.ip || req.socket?.remoteAddress || 'desconocida';
    this.logger.log(`[EMBY_INCOMING_WEBHOOK] Evento: ${payload?.NotificationType || payload?.Event || 'raw'}, IP: ${clientIp}`);

    setImmediate(() => {
      this.embyService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Error en procesamiento asíncrono de webhook Emby: ${err.message}`, err.stack);
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
