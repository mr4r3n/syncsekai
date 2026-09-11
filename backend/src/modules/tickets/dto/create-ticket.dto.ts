import { IsString, IsNotEmpty, MaxLength, MinLength, IsEnum, IsOptional } from 'class-validator';
import { TicketCategory, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'El asunto del ticket no puede estar vacío.' })
  @MinLength(3, { message: 'El asunto debe tener al menos 3 caracteres.' })
  @MaxLength(150, { message: 'El asunto no puede exceder 150 caracteres.' })
  subject: string;

  @IsEnum(TicketCategory, { message: 'Categoría de ticket inválida.' })
  @IsOptional()
  category?: TicketCategory = TicketCategory.TECHNICAL;

  @IsEnum(TicketPriority, { message: 'Prioridad de ticket inválida.' })
  @IsOptional()
  priority?: TicketPriority = TicketPriority.NORMAL;

  @IsString()
  @IsNotEmpty({ message: 'El mensaje descriptivo es obligatorio.' })
  @MinLength(5, { message: 'El mensaje debe tener al menos 5 caracteres.' })
  @MaxLength(5000, { message: 'El mensaje no puede exceder 5000 caracteres.' })
  message: string;

  @IsOptional()
  attachments?: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
  }>;
}
