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
   * Obtener notificaciones del usuario con contador de no leídas
   */
  /** La campana: lo que el usuario no ha quitado todavía. */
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

  /** El historial completo, quitadas incluidas, paginado. */
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

  /** Quitar de la campana sin borrar: queda en el historial. */
  async dismiss(userId: string, notificationId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, dismissedAt: null },
      data: { dismissedAt: new Date(), isRead: true },
    });
    if (res.count === 0) throw new NotFoundException('Notificación no encontrada.');
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
   * Obtener solo el contador de no leídas (para polling ligero del navbar)
   */
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Marcar notificación individual como leída
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true, message: 'Todas las notificaciones han sido marcadas como leídas.' };
  }

  /**
   * Eliminar una notificación
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada.');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true, message: 'Notificación eliminada.' };
  }

  /**
   * Disparar notificación de anime no mapeado / no sincronizado
   */
  async notifyUnmappedAnime(
    user: any,
    options: UnmappedAnimeAlertOptions,
  ) {
    const settings = user.settings;
    const seasonNum = options.seasonNumber || 1;
    const seasonText = seasonNum > 1 ? ` (Season ${seasonNum})` : '';

    // 1. Notificación Web In-App (si el usuario la tiene habilitada)
    const isWebEnabled = settings ? settings.webNotifications ?? true : true;
    if (isWebEnabled) {
      try {
        // Evitar duplicar exactamente la misma notificación no leída en los últimos 10 minutos
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
        this.logger.warn(`Error al registrar notificación web in-app: ${e.message}`);
      }
    }

    // 2. Notificación por Discord DM (si el usuario la tiene habilitada y tiene discordId)
    const isDiscordEnabled = settings ? settings.discordNotifications ?? true : true;
    if (isDiscordEnabled && user.discordId) {
      this.discordNotificationService.sendUnmappedAnimeAlert(user.discordId, options).catch((e) => {
        this.logger.warn(`Error al enviar DM por Discord: ${e.message}`);
      });
    }
  }

  /**
   * Enviar mensaje de prueba a Discord
   */
  async sendTestDiscordMessage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.discordId) {
      throw new Error('No tienes ninguna cuenta de Discord vinculada. Inicia sesión con Discord o vincúlala en tu perfil.');
    }

    return this.discordNotificationService.sendTestMessage(user.discordId, user.username);
  }
}
