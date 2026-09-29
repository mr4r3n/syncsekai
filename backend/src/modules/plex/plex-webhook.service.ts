import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { ScrobblePipelineService, NormalizedScrobbleEvent } from './scrobble-pipeline.service';
import { recordActivity } from '../../common/logging/activity-log';

/** Plex webhook: setup data, pings and event reception. */
@Injectable()
export class PlexWebhookService {
  private readonly logger = new Logger(PlexWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private scrobblePipelineService: ScrobblePipelineService,
  ) {}

  /**
   * Returns the user's private webhook URL (with LAN and localhost support).
   */
  async getWebhookInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { webhookToken: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    let baseUrl = this.configService.get<string>('FRONTEND_URL') ||
                  this.configService.get<string>('PUBLIC_URL') ||
                  this.configService.get<string>('APP_URL');

    if (!baseUrl) {
      const publicSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'SYSTEM_PUBLIC_URL' },
      });
      if (publicSetting?.value) {
        baseUrl = publicSetting.value;
      }
    }

    if (baseUrl) {
      baseUrl = baseUrl.replace(/\/+$/, '');
    }

    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.')) {
          localIp = net.address;
          break;
        }
      }
    }

    const port = this.configService.get<number>('PORT') || 4000;
    const lanWebhookUrl = `http://${localIp}:${port}/api/plex/webhook/${user.webhookToken}`;
    const localhostWebhookUrl = `http://localhost:${port}/api/plex/webhook/${user.webhookToken}`;
    const publicWebhookUrl = baseUrl ? `${baseUrl}/api/plex/webhook/${user.webhookToken}` : null;

    return {
      webhookToken: user.webhookToken,
      webhookUrl: publicWebhookUrl || lanWebhookUrl,
      publicWebhookUrl,
      lanWebhookUrl,
      localhostWebhookUrl,
      instructions: 'Set up this webhook in Settings > Webhooks on your Plex Pass server.',
    };
  }

  /**
   * Records a webhook connectivity test ping.
   */
  async recordPing(clientIp: string) {
    await recordActivity({
      data: {
        level: 'INFO',
        service: 'PLEX_WEBHOOK',
        message: `Test ping received on the webhook from IP ${clientIp}`,
        details: { clientIp, timestamp: new Date() },
      },
    });

    return {
      status: 'OK',
      message: 'SyncSekai webhook listener is ACTIVE and RECEIVING traffic on the local network.',
      clientIp,
      timestamp: new Date(),
    };
  }

  /**
   * Receiver for Plex Media Server webhook events.
   *
   * Only this function (and normalizePlexPayload) knows how to read Plex JSON.
   * Everything else lives in processScrobbleEvent(), which does not know Plex
   * exists and which Jellyfin and Emby reuse as is.
   */
  async handleWebhook(webhookToken: string, payload: any, clientIp = '127.0.0.1') {
    const webhookOwner = await this.prisma.user.findUnique({
      where: { webhookToken },
      include: {
        settings: true,
        plexConnection: true,
        jellyfinConnection: true,
        embyConnection: true,
        blacklist: true,
      },
    });

    if (!webhookOwner) {
      this.logger.warn(`Webhook ignored: unrecognized webhook token (${webhookToken}) from IP ${clientIp}`);
      await recordActivity({
        data: {
          level: 'WARN',
          service: 'PLEX_WEBHOOK',
          message: `Webhook rejected: invalid token from IP ${clientIp}`,
          details: { webhookToken, clientIp },
        },
      });
      return { ignored: true, reason: 'INVALID_TOKEN' };
    }

    return this.scrobblePipelineService.processScrobbleEvent(webhookOwner, this.normalizePlexPayload(payload), clientIp);
  }

  /**
   * Plex adapter -> common intermediate shape (NormalizedScrobbleEvent).
   */
  private normalizePlexPayload(payload: any): NormalizedScrobbleEvent {
    const metadata = payload?.Metadata;
    return {
      source: 'PLEX',
      event: payload?.event || 'raw',
      showTitle: metadata?.grandparentTitle || metadata?.title || 'Untitled',
      librarySectionTitle: metadata?.librarySectionTitle || '',
      episodeNumber: Number(metadata?.index || 1),
      seasonNumber: Number(metadata?.parentIndex || 1),
      viewOffsetMs: Number(metadata?.viewOffset || 0),
      durationMs: Number(metadata?.duration || 1),
      rating: metadata?.userRating ? metadata.userRating : payload?.rating,
      accountUsername: (payload?.Account?.title || '').trim(),
      serverTitle: payload?.Server?.title,
      hasPayload: Boolean(metadata),
      rawPayload: payload,
    };
  }

  async hasWebhookToken(webhookToken: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { webhookToken },
      select: { id: true, isActive: true },
    });
    return Boolean(user?.isActive);
  }
}
