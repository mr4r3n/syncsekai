import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import * as fs from 'fs';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, ReplyTicketDto, TicketQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('attachments/:filename')
  async getAttachment(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.ticketsService.getAttachmentPath(filename);

    let contentType = 'image/webp';
    if (filePath.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (filePath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    }

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Post('upload-attachment')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpe?g|webp|gif)$/i)) {
          return cb(new BadRequestException('Only images are allowed (PNG, JPG, JPEG, WEBP, GIF).'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAttachment(
    @CurrentUser('id') _userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    const attachment = await this.ticketsService.saveAttachmentFile(file);
    return {
      success: true,
      attachment,
      message: 'File attached.',
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.createTicket(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listUserTickets(
    @CurrentUser('id') userId: string,
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.listUserTickets(userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserTicket(
    @CurrentUser('id') userId: string,
    @Param('id') ticketId: string,
  ) {
    return this.ticketsService.getUserTicket(userId, ticketId);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard)
  async replyUserTicket(
    @CurrentUser('id') userId: string,
    @Param('id') ticketId: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ticketsService.replyUserTicket(userId, ticketId, dto);
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard)
  async closeUserTicket(
    @CurrentUser('id') userId: string,
    @Param('id') ticketId: string,
  ) {
    return this.ticketsService.closeUserTicket(userId, ticketId);
  }
}
