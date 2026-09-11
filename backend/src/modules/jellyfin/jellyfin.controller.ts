import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JellyfinService } from './jellyfin.service';
import { PlexService } from '../plex/plex.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/jellyfin')
export class JellyfinController {
  private readonly logger = new Logger(JellyfinController.name);

  constructor(
    private jellyfinService: JellyfinService,
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
   * Endpoint de Test de Conectividad, igual que el de Plex, para verificar que
   * el webhook es accesible en la red local desde el propio panel.
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.jellyfinService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.jellyfinService.recordPing(clientIp);
  }

  /**
   * Webhook público del plugin oficial "Webhook" de Jellyfin. Mismo esquema de
   * token (whk_live_...) y misma validación de formato + existencia que el
   * webhook de Plex. A diferencia de Plex, el plugin manda JSON puro (sin
   * multipart), así que no hace falta AnyFilesInterceptor — pero sí defenderse
   * de que el usuario haya roto la plantilla Handlebars o dejado mal puesto el
   * Content-Type en la configuración del plugin.
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
    // Si el Content-Type del plugin no es application/json, Express no lo
    // parsea y puede llegar como string (o el usuario mandó la plantilla mal
    // escapada): nunca se asume que el payload viene bien formado.
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
    this.logger.log(`[JELLYFIN_INCOMING_WEBHOOK] Evento: ${payload?.NotificationType || 'raw'}, IP: ${clientIp}`);

    // Desacoplar procesamiento pesado (AniList/MAL API, portadas, Discord) al bucle asíncrono
    setImmediate(() => {
      this.jellyfinService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Error en procesamiento asíncrono de webhook Jellyfin: ${err.message}`, err.stack);
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
