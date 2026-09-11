import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @IsEnum(TicketStatus, { message: 'Estado inválido.' })
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketPriority, { message: 'Prioridad inválida.' })
  @IsOptional()
  priority?: TicketPriority;

  @IsEnum(TicketCategory, { message: 'Categoría inválida.' })
  @IsOptional()
  category?: TicketCategory;

  @IsString()
  @IsOptional()
  assignedAdminId?: string | null;
}
