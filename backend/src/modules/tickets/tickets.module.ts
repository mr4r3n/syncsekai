import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AdminTicketsService } from './admin-tickets.service';
import { TicketNotificationsService } from './ticket-notifications.service';
import { TicketsController } from './tickets.controller';
import { AdminTicketsController } from './admin-tickets.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService, AdminTicketsService, TicketNotificationsService],
  exports: [TicketsService],
})
export class TicketsModule {}
