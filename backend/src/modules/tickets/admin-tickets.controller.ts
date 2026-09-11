import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ReplyTicketDto, UpdateTicketDto, TicketQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('api/admin/tickets')
@UseGuards(JwtAuthGuard)
export class AdminTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  private checkAdmin(user: any) {
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('Acceso restringido únicamente a Administradores.');
    }
  }

  @Get('stats')
  async getTicketStats(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.ticketsService.getTicketStats();
  }

  @Get()
  async listAdminTickets(
    @CurrentUser() user: any,
    @Query() query: TicketQueryDto,
  ) {
    this.checkAdmin(user);
    return this.ticketsService.listAdminTickets(query);
  }

  @Get(':id')
  async getAdminTicket(
    @CurrentUser() user: any,
    @Param('id') ticketId: string,
  ) {
    this.checkAdmin(user);
    return this.ticketsService.getAdminTicket(ticketId);
  }

  @Post(':id/reply')
  async replyAdminTicket(
    @CurrentUser() user: any,
    @Param('id') ticketId: string,
    @Body() dto: ReplyTicketDto,
  ) {
    this.checkAdmin(user);
    return this.ticketsService.replyAdminTicket(user.id, ticketId, dto);
  }

  @Patch(':id/status')
  async updateTicketStatus(
    @CurrentUser() user: any,
    @Param('id') ticketId: string,
    @Body() dto: UpdateTicketDto,
  ) {
    this.checkAdmin(user);
    return this.ticketsService.updateTicketStatus(ticketId, dto);
  }

  @Delete(':id')
  async deleteTicket(
    @CurrentUser() user: any,
    @Param('id') ticketId: string,
  ) {
    this.checkAdmin(user);
    return this.ticketsService.deleteTicket(ticketId);
  }
}
