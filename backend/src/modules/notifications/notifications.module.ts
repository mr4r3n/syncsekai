import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DiscordNotificationService } from './discord-notification.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DiscordNotificationService],
  exports: [NotificationsService, DiscordNotificationService],
})
export class NotificationsModule {}
