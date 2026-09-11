import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface UnmappedAnimeAlertOptions {
  showTitle: string;
  seasonNumber?: number;
  episodeNumber: number;
  viewPercentage: number;
  frontendUrl?: string;
  coverUrl?: string;
  source?: 'PLEX' | 'JELLYFIN' | 'EMBY' | string;
}

@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);
  private readonly botToken = process.env.DISCORD_BOT_TOKEN || '';
  private readonly defaultFrontendUrl = process.env.FRONTEND_URL || 'https://syncsekai.com';

  /**
   * Enviar alerta de anime no sincronizado al usuario por DM de Discord
   */
  async sendUnmappedAnimeAlert(discordUserId: string, options: UnmappedAnimeAlertOptions) {
    if (!this.botToken || !discordUserId) {
      this.logger.warn('No se puede enviar alerta de Discord: token de bot o discordUserId ausente.');
      return false;
    }

    try {
      const dmChannelId = await this.getOrCreateDmChannel(discordUserId);
      if (!dmChannelId) return false;

      const seasonNum = options.seasonNumber || 1;
      const seasonText = seasonNum > 1 ? `Temporada ${seasonNum}` : 'Temporada 1';
      const baseUrl = (options.frontendUrl || this.defaultFrontendUrl).replace(/\/+$/, '');
      const mappingUrl = `${baseUrl}/mappings?search=${encodeURIComponent(options.showTitle)}&season=${seasonNum}`;
      const serverLabel = options.source === 'JELLYFIN' ? 'Jellyfin' : options.source === 'EMBY' ? 'Emby' : 'Plex';

      const payload = {
        embeds: [
          {
            title: '⚠️ Anime sin sincronizar en SyncSekai',
            description: `Viste **${options.showTitle}** (${seasonText} • Ep. ${options.episodeNumber}) en ${serverLabel} al **${Math.round(options.viewPercentage)}%**, pero no se encontró coincidencia automática en **AniList** o **MyAnimeList**.`,
            color: 0xff634a, // SyncSekai Brand Orange
            thumbnail: options.coverUrl ? { url: options.coverUrl } : undefined,
            fields: [
              {
                name: '💡 Acción recomendada',
                value: 'Añade un mapeo de título en SyncSekai para que este y los próximos episodios se sincronicen de forma automática.',
                inline: false,
              },
            ],
            footer: {
              text: 'SyncSekai Notification Engine • Alertas de Scrobble',
            },
            timestamp: new Date().toISOString(),
          },
        ],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 5, // Link (URL)
                label: '🔗 Mapear Anime en SyncSekai',
                url: mappingUrl,
              },
            ],
          },
        ],
      };

      await axios.post(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, payload, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 6000,
      });

      this.logger.log(`Alerta de Discord enviada con éxito a ID ${discordUserId} para "${options.showTitle}"`);
      return true;
    } catch (e: any) {
      this.logger.warn(`Error al enviar mensaje por Discord a ID ${discordUserId}: ${e.response?.data?.message || e.message}`);
      return false;
    }
  }

  /**
   * Enviar mensaje de prueba al usuario
   */
  async sendTestMessage(discordUserId: string, username: string, frontendUrl?: string) {
    if (!this.botToken || !discordUserId) {
      throw new Error('El bot de Discord no está configurado o no tienes tu cuenta de Discord vinculada.');
    }

    const dmChannelId = await this.getOrCreateDmChannel(discordUserId);
    if (!dmChannelId) {
      throw new Error('No se pudo abrir el canal de mensajes directos (DM) en Discord. Revisa la configuración de privacidad de tu cuenta de Discord.');
    }

    const baseUrl = (frontendUrl || this.defaultFrontendUrl).replace(/\/+$/, '');

    const payload = {
      embeds: [
        {
          title: '🤖 ¡SyncSekai Bot Conectado con Éxito!',
          description: `Hola **${username}**, este es un mensaje de prueba de tu bot de **SyncSekai**.\n\nA partir de ahora, cuando veas un anime en Plex que requiera configuración o cuyo mapeo no se encuentre automáticamente, recibirás una notificación directa aquí con un botón para resolverlo en 1 clic.`,
          color: 0x02a9ff, // Azul cyan
          fields: [
            {
              name: 'Estado de Alertas',
              value: '🟢 **ACTIVO & VINCULADO**',
              inline: true,
            },
            {
              name: 'Plataforma',
              value: 'Discord Direct Messages (DM)',
              inline: true,
            },
          ],
          footer: {
            text: 'SyncSekai Notification Engine • Test de Diagnóstico',
          },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: '🚀 Abrir SyncSekai Dashboard',
              url: baseUrl,
            },
          ],
        },
      ],
    };

    await axios.post(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, payload, {
      headers: {
        Authorization: `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 6000,
    });

    return { success: true, message: 'Mensaje de prueba enviado a tu Discord personal.' };
  }

  /**
   * Obtener o crear canal de DM con el usuario
   */
  private async getOrCreateDmChannel(recipientId: string): Promise<string | null> {
    try {
      const res = await axios.post(
        'https://discord.com/api/v10/users/@me/channels',
        { recipient_id: recipientId },
        {
          headers: {
            Authorization: `Bot ${this.botToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );
      return res.data?.id || null;
    } catch (e: any) {
      this.logger.warn(`No se pudo crear canal DM con Discord ID ${recipientId}: ${e.response?.data?.message || e.message}`);
      return null;
    }
  }
}
