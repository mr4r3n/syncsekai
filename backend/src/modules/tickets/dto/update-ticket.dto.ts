import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @IsEnum(TicketStatus, { message: 'Invalid status.' })
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketPriority, { message: 'Invalid priority.' })
  @IsOptional()
  priority?: TicketPriority;

  @IsEnum(TicketCategory, { message: 'Invalid category.' })
  @IsOptional()
  category?: TicketCategory;

  @IsString()
  @IsOptional()
  assignedAdminId?: string | null;
}
