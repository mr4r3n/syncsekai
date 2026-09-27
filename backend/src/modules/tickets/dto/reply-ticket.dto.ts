import { IsString, IsNotEmpty, MaxLength, MinLength, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'The message cannot be empty.' })
  @MinLength(1, { message: 'The message must be at least 1 character long.' })
  @MaxLength(5000, { message: 'The message cannot exceed 5000 characters.' })
  content: string;

  @IsBoolean()
  @IsOptional()
  isInternalNote?: boolean = false;

  @IsEnum(TicketStatus, { message: 'Invalid ticket status.' })
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
