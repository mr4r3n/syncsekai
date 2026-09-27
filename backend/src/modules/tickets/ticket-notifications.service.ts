import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

/** Ticket notifications: to admins when a ticket opens or the user replies, and to the user when staff replies. */
@Injectable()
export class TicketNotificationsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async notifyAdminsNewTicket(ticket: any, username: string) {
    // 1. In-app web notification for administrators
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    const notifPromises = admins.map((admin) =>
      this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `New support ticket #${ticket.ticketNumber}`,
          message: `${username} opened a ticket: "${ticket.subject}" [${ticket.category}]`,
          type: 'SYSTEM',
          metadata: { kind: 'ticket-new', ticketId: ticket.id, ticketNumber: ticket.ticketNumber, username, subject: ticket.subject },
        },
      }),
    );

    await Promise.allSettled(notifPromises);
  }

  async notifyAdminsUserReply(ticket: any, messageSnippet: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    const snippet = messageSnippet.length > 80 ? `${messageSnippet.substring(0, 77)}...` : messageSnippet;

    const notifPromises = admins.map((admin) =>
      this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Reply on ticket #${ticket.ticketNumber}`,
          message: `${ticket.user?.username || 'User'}: "${snippet}"`,
          type: 'SYSTEM',
          metadata: { kind: 'ticket-reply', ticketId: ticket.id, ticketNumber: ticket.ticketNumber, username: ticket.user?.username || '', snippet },
        },
      }),
    );

    await Promise.allSettled(notifPromises);
  }

  async notifyUserStaffReply(userId: string, ticket: any, messageSnippet: string) {
    const snippet = messageSnippet.length > 90 ? `${messageSnippet.substring(0, 87)}...` : messageSnippet;
    await this.prisma.notification.create({
      data: {
        userId,
        title: `Support replied on ticket #${ticket.ticketNumber}`,
        message: `The SyncSekai team replied to your ticket: "${snippet}"`,
        type: 'SYSTEM',
        metadata: { kind: 'ticket-support-reply', ticketId: ticket.id, ticketNumber: ticket.ticketNumber, snippet },
      },
    });
  }
}
