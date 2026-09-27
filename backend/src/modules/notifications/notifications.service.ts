import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscordNotificationService, UnmappedAnimeAlertOptions } from './discord-notification.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private discordNotificationService: DiscordNotificationService,
  ) {}

  /**
   * Returns the user's notifications with the unread count.
   */
  /** The bell: what the user has not dismissed yet. */
  async getUserNotifications(userId: string, limit = 30) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, dismissedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /** The full history, dismissed ones included, paginated. */
  async getHistory(userId: string, page = 1, limit = 25) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total, page, limit };
  }

  /** Removes from the bell without deleting: it stays in the history. */
  async dismiss(userId: string, notificationId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, dismissedAt: null },
      data: { dismissedAt: new Date(), isRead: true },
    });
    if (res.count === 0) throw new NotFoundException('Notification not found.');
    return { success: true };
  }

  async dismissAll(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, dismissedAt: null },
      data: { dismissedAt: new Date(), isRead: true },
    });
    return { success: true };
  }

  async deleteAll(userId: string) {
    const res = await this.prisma.notification.deleteMany({ where: { userId } });
    return { success: true, deletedCount: res.count };
  }

  /**
   * Returns only the unread count (for lightweight navbar polling).
   */
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Marks every notification as read.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true, message: 'All notifications marked as read.' };
  }

  /**
   * Deletes a notification.
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true, message: 'Notification deleted.' };
  }

  /**
   * Sends the notification for an unmapped or unsynced anime.
   */
  async notifyUnmappedAnime(
    user: any,
    options: UnmappedAnimeAlertOptions,
  ) {
    const settings = user.settings;
    const seasonNum = options.seasonNumber || 1;
    const seasonText = seasonNum > 1 ? ` (Season ${seasonNum})` : '';

    // 1. In-app web notification (if the user has it enabled)
    const isWebEnabled = settings ? settings.webNotifications ?? true : true;
    if (isWebEnabled) {
      try {
        // Do not repeat the exact same unread notification within the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: 'UNMAPPED_ANIME',
            createdAt: { gte: tenMinutesAgo },
            metadata: {
              path: ['showTitle'],
              equals: options.showTitle,
            },
          },
        });

        if (!existing) {
          const serverName = options.source === 'JELLYFIN' ? 'Jellyfin' : options.source === 'EMBY' ? 'Emby' : 'Plex';
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              title: `Sync skipped: ${options.showTitle}${seasonText}`,
              message: `You watched episode ${options.episodeNumber} on ${serverName}, but no automatic match was found on your trackers. Open it to create the mapping.`,
              type: 'UNMAPPED_ANIME',
              metadata: {
                showTitle: options.showTitle,
                seasonNumber: seasonNum,
                episodeNumber: options.episodeNumber,
                viewPercentage: options.viewPercentage,
                source: options.source || 'PLEX',
              },
            },
          });
        }
      } catch (e: any) {
        this.logger.warn(`Error recording the in-app web notification: ${e.message}`);
      }
    }

    // 2. Discord DM notification (if the user has it enabled and has a discordId)
    const isDiscordEnabled = settings ? settings.discordNotifications ?? true : true;
    if (isDiscordEnabled && user.discordId) {
      this.discordNotificationService.sendUnmappedAnimeAlert(user.discordId, options).catch((e) => {
        this.logger.warn(`Error sending the Discord DM: ${e.message}`);
      });
    }
  }

  /**
   * Sends a test message to Discord.
   */
  async sendTestDiscordMessage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.discordId) {
      throw new Error('You have no linked Discord account. Sign in with Discord or link it in your profile.');
    }

    return this.discordNotificationService.sendTestMessage(user.discordId, user.username);
  }
}
