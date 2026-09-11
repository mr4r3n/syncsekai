import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { AnnouncementsService } from './announcements.service';
import { UpdateAnnouncementDto, CreateCustomPresetDto } from './dto/announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import * as fs from 'fs';

@Controller('api')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  private checkAdmin(user: any) {
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('Acceso restringido únicamente a Administradores.');
    }
  }

  // =========================================================================
  // PUBLIC ENDPOINTS
  // =========================================================================

  @Get('announcements/active')
  @SkipThrottle()
  async getActiveAnnouncement(@Req() req: Request) {
    // Si viene cookie o token de sesión, extraer usuario opcionalmente
    const user = (req as any).user;
    return this.announcementsService.getActiveAnnouncement(user);
  }

  @Get('announcements/media/:filename')
  @SkipThrottle()
  async serveMedia(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!filename || filename.length > 120) {
      throw new BadRequestException('Nombre de archivo inválido.');
    }

    const filePath = this.announcementsService.getMediaFilePath(filename);

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

  // =========================================================================
  // ADMIN STUDIO ENDPOINTS (PROTECTED)
  // =========================================================================

  @Get('admin/announcements')
  @UseGuards(JwtAuthGuard)
  async getAdminAnnouncements(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.announcementsService.getAdminConfig();
  }

  @Put('admin/announcements')
  @UseGuards(JwtAuthGuard)
  async updateAnnouncement(
    @CurrentUser() user: any,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    this.checkAdmin(user);
    return this.announcementsService.updateAnnouncement(dto);
  }

  @Post('admin/announcements/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleAnnouncement(
    @CurrentUser() user: any,
    @Body('isActive') forcedState?: boolean,
  ) {
    this.checkAdmin(user);
    return this.announcementsService.toggleActive(forcedState);
  }

  @Post('admin/announcements/apply-preset/:presetId')
  @UseGuards(JwtAuthGuard)
  async applyPreset(
    @CurrentUser() user: any,
    @Param('presetId') presetId: string,
  ) {
    this.checkAdmin(user);
    return this.announcementsService.applyPreset(presetId);
  }

  @Post('admin/announcements/upload-media')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpe?g|webp|gif)$/i)) {
          return cb(new BadRequestException('Solo se permiten imágenes o GIFs animados (PNG, JPG, WEBP, GIF).'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadMedia(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.checkAdmin(user);
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo.');
    }
    const mediaUrl = await this.announcementsService.saveUploadedMedia(file);
    return {
      success: true,
      mediaUrl,
      message: 'Archivo multimedia subido correctamente.',
    };
  }

  @Post('admin/announcements/custom-presets')
  @UseGuards(JwtAuthGuard)
  async saveCustomPreset(
    @CurrentUser() user: any,
    @Body() dto: CreateCustomPresetDto,
  ) {
    this.checkAdmin(user);
    return this.announcementsService.saveCustomPreset(dto);
  }

  @Delete('admin/announcements/custom-presets/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCustomPreset(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    this.checkAdmin(user);
    return this.announcementsService.deleteCustomPreset(id);
  }
}

