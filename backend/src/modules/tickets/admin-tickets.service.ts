import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReplyTicketDto, UpdateTicketDto, TicketQueryDto } from './dto';
import { TicketCategory, TicketPriority, TicketStatus, Prisma } from '@prisma/client';
import { TicketNotificationsService } from './ticket-notifications.service';

/** Ticket management from the panel: inbox, replies, status, assignment and statistics. */
@Injectable()
export class AdminTicketsService {
  private readonly logger = new Logger(AdminTicketsService.name);

  constructor(
    private prisma: PrismaService,
    private ticketNotificationsService: TicketNotificationsService,
  ) {}

  /**
   * Lists every ticket in the system for the admin panel.
   */
  async listAdminTickets(query: TicketQueryDto) {
    const { status, category, priority, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status as TicketStatus;
    }

    if (category && category !== 'ALL') {
      where.category = category as TicketCategory;
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority as TicketPriority;
    }

    if (search && search.trim()) {
      const term = search.trim();
      const num = parseInt(term.replace(/[^0-9]/g, ''), 10);
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        { user: { username: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        ...(isNaN(num) ? [] : [{ ticketNumber: num }]),
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { lastReplyAt: 'desc' }],
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, email: true, avatarUrl: true, role: true },
          },
          assignedAdmin: {
            select: { id: true, username: true, avatarUrl: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Returns a ticket's full detail for staff (internal notes included).
   */
  async getAdminTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
            settings: true,
          },
        },
        assignedAdmin: {
          select: { id: true, username: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, username: true, avatarUrl: true, role: true },
            },
            attachments: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    return ticket;
  }

  /**
   * Replies as staff or adds a confidential internal note.
   */
  async replyAdminTicket(adminId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    const isInternal = Boolean(dto.isInternalNote);
    const newStatus = dto.status || (isInternal ? ticket.status : TicketStatus.WAITING_USER);

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.ticketMessage.create({
        data: {
          ticketId,
          senderId: adminId,
          isStaff: true,
          isInternalNote: isInternal,
          content: dto.content.trim(),
        },
      });

      if (dto.attachments && dto.attachments.length > 0) {
        for (const att of dto.attachments) {
          await tx.ticketAttachment.create({
            data: {
              ticketId,
              messageId: createdMessage.id,
              fileName: att.fileName,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              fileUrl: att.fileUrl,
            },
          });
        }
      }

      // If it is not an internal note, update the last reply and the status
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          lastReplyAt: isInternal ? ticket.lastReplyAt : new Date(),
          closedAt: newStatus === TicketStatus.CLOSED ? new Date() : (newStatus === TicketStatus.RESOLVED ? new Date() : null),
        },
      });

      return tx.ticketMessage.findUnique({
        where: { id: createdMessage.id },
        include: {
          sender: {
            select: { id: true, username: true, avatarUrl: true, role: true },
          },
          attachments: true,
        },
      });
    });

    // If it is a public reply to the user, notify them
    if (!isInternal) {
      this.ticketNotificationsService.notifyUserStaffReply(ticket.userId, ticket, dto.content.trim()).catch((err) =>
        this.logger.error(`Error notifying the user of the reply: ${err.message}`),
      );
    }

    return message;
  }

  /**
   * Updates a ticket's status, priority or category.
   */
  async updateTicketStatus(ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    const data: Prisma.TicketUpdateInput = {};

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === TicketStatus.CLOSED || dto.status === TicketStatus.RESOLVED) {
        data.closedAt = new Date();
      } else {
        data.closedAt = null;
      }
    }

    if (dto.priority) {
      data.priority = dto.priority;
    }

    if (dto.category) {
      data.category = dto.category;
    }

    if (dto.assignedAdminId !== undefined) {
      data.assignedAdmin = dto.assignedAdminId
        ? { connect: { id: dto.assignedAdminId } }
        : { disconnect: true };
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        user: { select: { id: true, username: true, email: true } },
        assignedAdmin: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Assigns a ticket to a specific administrator.
   */
  async assignTicket(ticketId: string, assignedAdminId: string | null) {
    return this.updateTicketStatus(ticketId, { assignedAdminId });
  }

  /**
   * Deletes a ticket permanently.
   */
  async deleteTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    await this.prisma.ticket.delete({
      where: { id: ticketId },
    });

    return { success: true, message: 'Ticket deleted.' };
  }

  /**
   * Global ticket metrics and KPIs for the dashboard.
   */
  async getTicketStats() {
    const [
      total,
      open,
      waitingUser,
      inProgress,
      resolved,
      closed,
      urgent,
      todayResolved,
      byCategory,
    ] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.ticket.count({ where: { status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.WAITING_USER } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.IN_PROGRESS } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.RESOLVED } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.CLOSED } }),
      this.prisma.ticket.count({
        where: {
          priority: TicketPriority.URGENT,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
      this.prisma.ticket.count({
        where: {
          status: TicketStatus.RESOLVED,
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.ticket.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
    ]);

    return {
      total,
      open,
      waitingUser,
      inProgress,
      resolved,
      closed,
      pendingStaff: open + inProgress,
      urgent,
      todayResolved,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    };
  }
}
