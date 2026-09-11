import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscordNotificationService } from '../notifications/discord-notification.service';
import {
  CreateTicketDto,
  ReplyTicketDto,
  UpdateTicketDto,
  TicketQueryDto,
} from './dto';
import {
  Role,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'tickets');

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordNotifications: DiscordNotificationService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Guardar archivo adjunto optimizado
   */
  async saveAttachmentFile(file: Express.Multer.File): Promise<{ fileName: string; fileSize: number; mimeType: string; fileUrl: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado o inválido.');
    }

    const timestamp = Date.now();
    // El endpoint que sirve los adjuntos es público: el nombre del fichero es la
    // única credencial. Math.random() no es criptográfico y su estado interno es
    // reconstruible observando salidas, así que aquí hacen falta bytes reales.
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
   * Obtener ruta local segura de archivo adjunto
   */
  getAttachmentPath(filename: string): string {
    const safeName = path.basename(filename);
    const fullPath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Archivo adjunto no encontrado.');
    }
    return fullPath;
  }

  // =========================================================================
  // USER OPERATIONS
  // =========================================================================

  /**
   * Crear un nuevo ticket de soporte por parte del usuario
   */
  async createTicket(userId: string, dto: CreateTicketDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Crear el ticket y el primer mensaje en una transacción
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

    // Notificar a todos los administradores en el sistema
    this.notifyAdminsNewTicket(ticket, user.username).catch((err) =>
      this.logger.error(`Error al enviar notificaciones de nuevo ticket: ${err.message}`),
    );

    return ticket;
  }

  /**
   * Listar tickets del usuario actual con filtros
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
   * Obtener detalle de un ticket para el usuario (filtrando notas internas)
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
      throw new NotFoundException('Ticket no encontrado o no tienes permisos para verlo.');
    }

    return ticket;
  }

  /**
   * Responder a un ticket por parte del usuario
   */
  async replyUserTicket(userId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
    }

    // Si el ticket estaba cerrado o resuelto, se reabre a IN_PROGRESS o OPEN
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

    // Notificar a los administradores de la nueva respuesta
    this.notifyAdminsUserReply(ticket, dto.content.trim()).catch((err) =>
      this.logger.error(`Error al notificar respuesta de usuario: ${err.message}`),
    );

    return message;
  }

  /**
   * Cerrar un ticket por parte del usuario
   */
  async closeUserTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  // =========================================================================
  // ADMIN OPERATIONS
  // =========================================================================

  /**
   * Listar todos los tickets del sistema para el panel de administración
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
   * Obtener detalle completo de un ticket para staff (incluye notas internas)
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
      throw new NotFoundException('Ticket no encontrado.');
    }

    return ticket;
  }

  /**
   * Responder como staff o añadir una nota interna confidencial
   */
  async replyAdminTicket(adminId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
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

      // Si no es nota interna, actualizamos la última respuesta y estado
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

    // Si es respuesta pública para el usuario, enviarle una notificación
    if (!isInternal) {
      this.notifyUserStaffReply(ticket.userId, ticket, dto.content.trim()).catch((err) =>
        this.logger.error(`Error al notificar respuesta al usuario: ${err.message}`),
      );
    }

    return message;
  }

  /**
   * Actualizar estado, prioridad o categoría de un ticket
   */
  async updateTicketStatus(ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
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
   * Asignar ticket a un administrador específico
   */
  async assignTicket(ticketId: string, assignedAdminId: string | null) {
    return this.updateTicketStatus(ticketId, { assignedAdminId });
  }

  /**
   * Eliminar un ticket de forma permanente
   */
  async deleteTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
    }

    await this.prisma.ticket.delete({
      where: { id: ticketId },
    });

    return { success: true, message: 'Ticket eliminado con éxito.' };
  }

  /**
   * Obtener métricas y KPIs globales de tickets para el dashboard
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

  // =========================================================================
  // NOTIFICATION HELPERS
  // =========================================================================

  private async notifyAdminsNewTicket(ticket: any, username: string) {
    // 1. Notificación interna en la web para administradores
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    const notifPromises = admins.map((admin) =>
      this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Nuevo Ticket de Soporte (#${ticket.ticketNumber})`,
          message: `${username} ha abierto un ticket: "${ticket.subject}" [${ticket.category}]`,
          type: 'SYSTEM',
          metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
        },
      }),
    );

    await Promise.allSettled(notifPromises);
  }

  private async notifyAdminsUserReply(ticket: any, messageSnippet: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    const snippet = messageSnippet.length > 80 ? `${messageSnippet.substring(0, 77)}...` : messageSnippet;

    const notifPromises = admins.map((admin) =>
      this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Respuesta en Ticket #${ticket.ticketNumber}`,
          message: `${ticket.user?.username || 'Usuario'}: "${snippet}"`,
          type: 'SYSTEM',
          metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
        },
      }),
    );

    await Promise.allSettled(notifPromises);
  }

  private async notifyUserStaffReply(userId: string, ticket: any, messageSnippet: string) {
    const snippet = messageSnippet.length > 90 ? `${messageSnippet.substring(0, 87)}...` : messageSnippet;
    await this.prisma.notification.create({
      data: {
        userId,
        title: `Respuesta de Soporte en Ticket #${ticket.ticketNumber}`,
        message: `El equipo de SyncSekai ha respondido a tu ticket: "${snippet}"`,
        type: 'SYSTEM',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      },
    });
  }
}
