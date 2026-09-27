import { Controller, Get, Post, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 30;
    return this.notificationsService.getUserNotifications(userId, limitNum);
  }

  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '25', 10) || 25));
    return this.notificationsService.getHistory(userId, pageNum, limitNum);
  }

  @Patch(':id/dismiss')
  async dismiss(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.dismiss(userId, id);
  }

  @Post('dismiss-all')
  async dismissAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.dismissAll(userId);
  }

  @Delete()
  async deleteAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.deleteAll(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(userId, id);
  }

  @Post('test-discord')
  async testDiscord(@CurrentUser('id') userId: string) {
    return this.notificationsService.sendTestDiscordMessage(userId);
  }
}
