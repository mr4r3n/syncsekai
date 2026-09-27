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
   * Sends the unsynced anime alert to the user by Discord DM.
   */
  async sendUnmappedAnimeAlert(discordUserId: string, options: UnmappedAnimeAlertOptions) {
    if (!this.botToken || !discordUserId) {
      this.logger.warn('Cannot send the Discord alert: bot token or discordUserId missing.');
      return false;
    }

    try {
      const dmChannelId = await this.getOrCreateDmChannel(discordUserId);
      if (!dmChannelId) return false;

      const seasonNum = options.seasonNumber || 1;
      const seasonText = seasonNum > 1 ? `Season ${seasonNum}` : 'Season 1';
      const baseUrl = (options.frontendUrl || this.defaultFrontendUrl).replace(/\/+$/, '');
      const mappingUrl = `${baseUrl}/mappings?search=${encodeURIComponent(options.showTitle)}&season=${seasonNum}`;
      const serverLabel = options.source === 'JELLYFIN' ? 'Jellyfin' : options.source === 'EMBY' ? 'Emby' : 'Plex';

      const payload = {
        embeds: [
          {
            title: '⚠️ Anime not synced on SyncSekai',
            description: `You watched **${options.showTitle}** (${seasonText} • Ep. ${options.episodeNumber}) on ${serverLabel} to **${Math.round(options.viewPercentage)}%**, but no automatic match was found on **AniList** or **MyAnimeList**.`,
            color: 0xff634a, // SyncSekai brand orange
            thumbnail: options.coverUrl ? { url: options.coverUrl } : undefined,
            fields: [
              {
                name: '💡 Recommended action',
                value: 'Add a title mapping on SyncSekai so this and future episodes sync automatically.',
                inline: false,
              },
            ],
            footer: {
              text: 'SyncSekai Notification Engine • Scrobble alerts',
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
                label: '🔗 Map this anime on SyncSekai',
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

      this.logger.log(`Discord alert sent to ID ${discordUserId} for "${options.showTitle}"`);
      return true;
    } catch (e: any) {
      this.logger.warn(`Error sending the Discord message to ID ${discordUserId}: ${e.response?.data?.message || e.message}`);
      return false;
    }
  }

  /**
   * Sends a test message to the user.
   */
  async sendTestMessage(discordUserId: string, username: string, frontendUrl?: string) {
    if (!this.botToken || !discordUserId) {
      throw new Error('The Discord bot is not configured, or your Discord account is not linked.');
    }

    const dmChannelId = await this.getOrCreateDmChannel(discordUserId);
    if (!dmChannelId) {
      throw new Error('Could not open the direct message (DM) channel on Discord. Check the privacy settings of your Discord account.');
    }

    const baseUrl = (frontendUrl || this.defaultFrontendUrl).replace(/\/+$/, '');

    const payload = {
      embeds: [
        {
          title: '🤖 SyncSekai bot connected!',
          description: `Hi **${username}**, this is a test message from your **SyncSekai** bot.\n\nFrom now on, when you watch an anime that needs setup or whose mapping is not found automatically, you will get a direct notification here with a button to fix it in one click.`,
          color: 0x02a9ff, // Cyan blue
          fields: [
            {
              name: 'Alert status',
              value: '🟢 **ACTIVE & LINKED**',
              inline: true,
            },
            {
              name: 'Platform',
              value: 'Discord Direct Messages (DM)',
              inline: true,
            },
          ],
          footer: {
            text: 'SyncSekai Notification Engine • Diagnostic test',
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
              label: '🚀 Open the SyncSekai dashboard',
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

    return { success: true, message: 'Test message sent to your personal Discord.' };
  }

  /**
   * Gets or creates the DM channel with the user.
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
      this.logger.warn(`Could not create a DM channel with Discord ID ${recipientId}: ${e.response?.data?.message || e.message}`);
      return null;
    }
  }
}
