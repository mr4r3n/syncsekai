import { IsString, IsNotEmpty, MaxLength, MinLength, IsEnum, IsOptional } from 'class-validator';
import { TicketCategory, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'The ticket subject cannot be empty.' })
  @MinLength(3, { message: 'The subject must be at least 3 characters long.' })
  @MaxLength(150, { message: 'The subject cannot exceed 150 characters.' })
  subject: string;

  @IsEnum(TicketCategory, { message: 'Invalid ticket category.' })
  @IsOptional()
  category?: TicketCategory = TicketCategory.TECHNICAL;

  @IsEnum(TicketPriority, { message: 'Invalid ticket priority.' })
  @IsOptional()
  priority?: TicketPriority = TicketPriority.NORMAL;

  @IsString()
  @IsNotEmpty({ message: 'The description is required.' })
  @MinLength(5, { message: 'The message must be at least 5 characters long.' })
  @MaxLength(5000, { message: 'The message cannot exceed 5000 characters.' })
  message: string;

  @IsOptional()
  attachments?: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
  }>;
}
