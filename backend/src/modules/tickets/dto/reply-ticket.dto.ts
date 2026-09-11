import { IsString, IsNotEmpty, MaxLength, MinLength, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío.' })
  @MinLength(1, { message: 'El mensaje debe tener al menos 1 caracter.' })
  @MaxLength(5000, { message: 'El mensaje no puede exceder 5000 caracteres.' })
  content: string;

  @IsBoolean()
  @IsOptional()
  isInternalNote?: boolean = false;

  @IsEnum(TicketStatus, { message: 'Estado de ticket inválido.' })
  @IsOptional()
  status?: TicketStatus;

  @IsOptional()
  attachments?: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
  }>;
}
