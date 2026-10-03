import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto, ReplyTicketDto, TicketQueryDto } from './dto';
import { Role, TicketCategory, TicketPriority, TicketStatus, Prisma } from '@prisma/client';
import { TicketNotificationsService } from './ticket-notifications.service';

/** Support tickets from the user's side, and attachments. */
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'tickets');

  constructor(
    private prisma: PrismaService,
    private ticketNotificationsService: TicketNotificationsService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Attachments are uploaded before the ticket or reply that carries them exists, so
   * one that is never sent stays on disk with nothing pointing at it. Once a day,
   * those older than a day go.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOrphanAttachments(): Promise<number> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const attachments = await this.prisma.ticketAttachment.findMany({ select: { fileUrl: true } });
    const inUse = new Set(attachments.map((a) => path.basename(a.fileUrl)));
    let removed = 0;
    for (const name of fs.readdirSync(this.uploadDir)) {
      if (!name.startsWith('ticket_') || inUse.has(name)) continue;
      const file = path.join(this.uploadDir, name);
      if (fs.statSync(file).mtimeMs < cutoff) {
        fs.unlinkSync(file);
        removed++;
      }
    }
    if (removed > 0) this.logger.log(`Removed ${removed} ticket attachments that were never sent.`);
    return removed;
  }

  /**
   * Saves an optimized attachment.
   */
  async saveAttachmentFile(file: Express.Multer.File): Promise<{ fileName: string; fileSize: number; mimeType: string; fileUrl: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Missing or invalid file.');
    }

    const timestamp = Date.now();
    // The endpoint serving attachments is public: the file name is the only
    // credential. Math.random() is not cryptographic and its internal state can
    // be rebuilt by observing outputs, so real random bytes are needed here.
    const randomStr = crypto.randomBytes(16).toString('hex');
    const isGif = file.mimetype === 'image/gif' || file.originalname.toLowerCase().endsWith('.gif');
    const ext = isGif ? 'gif' : 'webp';
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `ticket_${timestamp}_${randomStr}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    if (isGif) {
      fs.writeFileSync(filePath, file.buffer);
    } else {
      await sharp(file.buffer)
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filePath);
    }

    const fileUrl = `/api/tickets/attachments/${filename}`;
    return {
      fileName: safeOriginalName,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileUrl,
    };
  }

  /**
   * Returns the safe local path of an attachment.
   */
  getAttachmentPath(filename: string): string {
    const safeName = path.basename(filename);
    const fullPath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Attachment not found.');
    }
    return fullPath;
  }

  /**
   * Creates a new support ticket from the user.
   */
  async createTicket(userId: string, dto: CreateTicketDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Create the ticket and its first message in one transaction
    const ticket = await this.prisma.$transaction(async (tx) => {
      const createdTicket = await tx.ticket.create({
        data: {
          userId,
          subject: dto.subject.trim(),
          category: dto.category || TicketCategory.TECHNICAL,
          priority: dto.priority || TicketPriority.NORMAL,
          status: TicketStatus.OPEN,
          lastReplyAt: new Date(),
        },
      });

      const firstMessage = await tx.ticketMessage.create({
        data: {
          ticketId: createdTicket.id,
          senderId: userId,
          isStaff: user.role === Role.ADMIN,
          isInternalNote: false,
          content: dto.message.trim(),
        },
      });

      if (dto.attachments && dto.attachments.length > 0) {
        for (const att of dto.attachments) {
          await tx.ticketAttachment.create({
            data: {
              ticketId: createdTicket.id,
              messageId: firstMessage.id,
              fileName: att.fileName,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
              fileUrl: att.fileUrl,
            },
          });
        }
      }

      return tx.ticket.findUnique({
        where: { id: createdTicket.id },
        include: {
          user: {
            select: { id: true, username: true, email: true, avatarUrl: true, role: true },
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
    });

    // Notify every administrator
    this.ticketNotificationsService.notifyAdminsNewTicket(ticket, user.username).catch((err) =>
      this.logger.error(`Error sending new ticket notifications: ${err.message}`),
    );

    return ticket;
  }

  /**
   * Lists the current user's tickets, with filters.
   */
  async listUserTickets(userId: string, query: TicketQueryDto) {
    const { status, category, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {
      userId,
    };

    if (status && status !== 'ALL') {
      where.status = status as TicketStatus;
    }

    if (category && category !== 'ALL') {
      where.category = category as TicketCategory;
    }

    if (search && search.trim()) {
      const term = search.trim();
      const num = parseInt(term.replace(/[^0-9]/g, ''), 10);
      where.OR = [
        { subject: { contains: term, mode: 'insensitive' } },
        ...(isNaN(num) ? [] : [{ ticketNumber: num }]),
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: { lastReplyAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              messages: {
                where: { isInternalNote: false },
              },
            },
          },
          assignedAdmin: {
            select: { id: true, username: true, avatarUrl: true },
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
   * Returns a ticket's detail for the user (internal notes filtered out).
   */
  async getUserTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
      include: {
        user: {
          select: { id: true, username: true, email: true, avatarUrl: true, role: true },
        },
        assignedAdmin: {
          select: { id: true, username: true, avatarUrl: true },
        },
        messages: {
          where: { isInternalNote: false },
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
      throw new NotFoundException('Ticket not found, or you do not have permission to see it.');
    }

    return ticket;
  }

  /**
   * Adds a reply from the user.
   */
  async replyUserTicket(userId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    // If the ticket was closed or resolved, it is reopened as IN_PROGRESS or OPEN
    let newStatus = ticket.status;
    if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.WAITING_USER) {
      newStatus = TicketStatus.OPEN;
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.ticketMessage.create({
        data: {
          ticketId,
          senderId: userId,
          isStaff: false,
          isInternalNote: false,
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

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          lastReplyAt: new Date(),
          closedAt: newStatus === TicketStatus.CLOSED ? ticket.closedAt : null,
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

    // Notify the administrators of the new reply
    this.ticketNotificationsService.notifyAdminsUserReply(ticket, dto.content.trim()).catch((err) =>
      this.logger.error(`Error notifying of the user's reply: ${err.message}`),
    );

    return message;
  }

  /**
   * Closes a ticket from the user's side.
   */
  async closeUserTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }
}
