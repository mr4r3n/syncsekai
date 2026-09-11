import { Controller, Post, Get, Put, Body, Param, UseGuards, Query, Req, Logger, UseInterceptors, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PlexService } from './plex.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/plex')
export class PlexController {
  private readonly logger = new Logger(PlexController.name);

  constructor(private plexService: PlexService) {}

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
    return this.plexService.getWebhookInfo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: any) {
    return this.plexService.disconnect(user.id);
  }

  /**
   * Endpoint de Test de Conectividad para verificar que el webhook es accesible en la red local
   */
  @Get('webhook/ping')
  async pingWebhookGet(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.plexService.recordPing(clientIp);
  }

  @Post('webhook/ping')
  async pingWebhookPost(@Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return this.plexService.recordPing(clientIp);
  }

  /**
   * Endpoint de Webhook público de Plex con soporte para multipart/form-data (Plex Media Server oficial)
   * Procesamiento 100% asíncrono y no bloqueante para evitar timeouts en Plex Media Server.
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
      throw new UnauthorizedException('Webhook no válido.');
    }
    if (!(await this.plexService.hasWebhookToken(webhookToken))) {
      throw new UnauthorizedException('Webhook no válido.');
    }
    let payload = body;
    // Plex PMS envía los datos en multipart con el campo 'payload' en string JSON
    if (typeof body?.payload === 'string') {
      try {
        payload = JSON.parse(body.payload);
      } catch (e) {
        throw new BadRequestException('Payload de webhook no válido.');
      }
    }

    const clientIp = req.ip || req.socket?.remoteAddress || 'desconocida';
    this.logger.log(`[PLEX_INCOMING_WEBHOOK] Evento: ${payload?.event || 'raw'}, IP: ${clientIp}`);

    // Desacoplar procesamiento pesado (AniList/MAL API, portadas, Discord) al bucle asíncrono
    setImmediate(() => {
      this.plexService
        .handleWebhook(webhookToken, payload, clientIp)
        .catch((err) => {
          this.logger.error(`[ASYNC_WEBHOOK_ERROR] Error en procesamiento asíncrono de webhook: ${err.message}`, err.stack);
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
