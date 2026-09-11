import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Res,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { BackupService } from './backup.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { isClientAllowedForAdmin } from '../../common/security/network-target';

@Controller('api/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private backupService: BackupService,
    private authService: AuthService,
  ) {}

  private checkAdmin(user: any, req?: any) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Acceso restringido únicamente a Administradores.');
    }
    if (req) {
      const netCheck = isClientAllowedForAdmin(req);
      if (!netCheck.allowed) {
        throw new ForbiddenException(netCheck.reason || 'Acceso restringido a la red interna privada.');
      }
    }
  }

  /*
   * Credenciales del sistema: rotación desde el panel.
   *
   * `checkAdmin(user, req)` aplica ademas la restriccion de red que ya existe
   * para el resto del panel.
   */
  @Get('credentials')
  async getCredentials(@CurrentUser() user: any, @Req() req: any) {
    this.checkAdmin(user, req);
    return this.adminService.getSystemCredentials();
  }

  @Put('credentials')
  async updateCredentials(
    @CurrentUser() user: any,
    @Req() req: any,
    @Body() body: { currentPassword?: string; changes?: Record<string, string> },
  ) {
    this.checkAdmin(user, req);
    return this.adminService.updateSystemCredentials(
      user.id,
      body?.currentPassword || '',
      body?.changes || {},
    );
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: any,
    @Req() req: any,
    @Query('timeframe') timeframe?: string,
  ) {
    this.checkAdmin(user);
    const clientIp = String(req.ip || req.socket?.remoteAddress || '127.0.0.1')
      .replace('::ffff:', '')
      .trim();

    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined;
    return this.adminService.getDashboardMetrics(clientIp, (timeframe as any) || '7d', userAgent, user.username);
  }

  @Get('chart')
  async getChart(
    @CurrentUser() user: any,
    @Query('timeframe') timeframe?: string,
  ) {
    this.checkAdmin(user);
    return this.adminService.getChartHistory((timeframe as any) || '7d');
  }

  @Get('activity-heatmap')
  async getActivityHeatmap(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getActivityHeatmap();
  }

  @Get('failed-scrobbles')
  async getFailedScrobbles(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkAdmin(user);
    return this.adminService.getFailedScrobbles(
      page ? parseInt(page, 10) || 1 : 1,
      limit ? parseInt(limit, 10) || 50 : 50,
    );
  }

  @Get('genres')
  async getGenreOverview(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getGenreOverview();
  }

  @Delete('metrics/geo')
  async resetGeoMetrics(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.resetGeoMetrics();
  }

  @Get('users')
  async getUsers(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getUsersList();
  }

  @Patch('users/:id/permissions')
  async updateUserPermissions(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: {
      username?: string;
      email?: string;
      role?: Role;
      isActive?: boolean;
      newPassword?: string;
      reset2Fa?: boolean;
      canScrobble?: boolean;
      canAccessCatalog?: boolean;
      canEditMappings?: boolean;
      canSyncAnilist?: boolean;
      canSyncMal?: boolean;
      isSuspended?: boolean;
    },
  ) {
    this.checkAdmin(user);
    return this.adminService.updateUserPermissions(id, body);
  }

  @Delete('users/:id')
  async deleteUser(@CurrentUser() user: any, @Param('id') id: string) {
    this.checkAdmin(user);
    return this.adminService.deleteUser(id);
  }

  @Get('system-health')
  async getSystemHealth(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getSystemHealth();
  }

  @Post('domains')
  async addDomain(
    @CurrentUser() user: any,
    @Body('domain') domain: string,
    @Body('isAllowed') isAllowed?: boolean,
    @Body('reason') reason?: string,
  ) {
    this.checkAdmin(user);
    return this.adminService.addDomainPolicy(domain, isAllowed ?? true, reason);
  }

  @Delete('domains/:id')
  async deleteDomain(@CurrentUser() user: any, @Param('id') id: string) {
    this.checkAdmin(user);
    return this.adminService.deleteDomainPolicy(id);
  }

  // ==========================================
  // BACKUPS & PROGRAMACIÓN
  // ==========================================

  @Get('backups')
  async getBackups(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.backupService.getBackupsList();
  }

  @Post('backups/create')
  async createBackup(
    @CurrentUser() user: any,
    @Body('type') type?: 'DATABASE' | 'FULL_SYSTEM',
  ) {
    this.checkAdmin(user);
    return this.backupService.createBackup(type || 'DATABASE', 'MANUAL');
  }

  @Get('backups/:filename/download')
  async downloadBackup(
    @CurrentUser() user: any,
    @Param('filename') filename: string,
    @Res() res: any,
  ) {
    this.checkAdmin(user);
    const filePath = this.backupService.getBackupFilePath(filename);
    return res.download(filePath, filename);
  }

  @Delete('backups/:filename')
  async deleteBackup(
    @CurrentUser() user: any,
    @Param('filename') filename: string,
  ) {
    this.checkAdmin(user);
    return this.backupService.deleteBackup(filename);
  }

  @Post('backups/restore')
  async restoreBackup(
    @CurrentUser() user: any,
    @Body('filename') filename: string,
  ) {
    this.checkAdmin(user);
    if (!filename) {
      throw new BadRequestException('Se requiere especificar el nombre del archivo de copia de seguridad.');
    }
    return this.backupService.restoreBackup(filename);
  }

  @Post('backups/upload-restore')
  @UseInterceptors(FileInterceptor('backupFile', {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  }))
  async uploadAndRestoreBackup(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.checkAdmin(user);
    if (!file || !file.buffer) {
      throw new BadRequestException('No se adjuntó ningún archivo de copia de seguridad.');
    }
    return this.backupService.restoreBackup(file.buffer);
  }

  @Post('backups/schedule')
  async saveBackupSchedule(
    @CurrentUser() user: any,
    @Body()
    body: {
      enabled: boolean;
      frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
      time: string;
      includeMedia: boolean;
      retentionCount: number;
    },
  ) {
    this.checkAdmin(user);
    return this.backupService.saveScheduleConfig(body);
  }

  @Get('media')
  async getMedia(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getMediaList();
  }

  @Delete('media/:filename')
  async deleteMedia(@CurrentUser() user: any, @Param('filename') filename: string) {
    this.checkAdmin(user);
    return this.adminService.deleteMediaFile(filename);
  }

  @Post('media/purge')
  async purgeMedia(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.purgeCoversCache();
  }

  @Post('media/purge-orphans')
  async purgeOrphanMedia(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.purgeOrphanCovers();
  }

  @Post('media/refresh/:filename')
  async refreshMedia(@CurrentUser() user: any, @Param('filename') filename: string) {
    this.checkAdmin(user);
    return this.adminService.refreshCover(filename);
  }

  @Get('preset-avatars')
  async getPresetAvatars(@CurrentUser() user: any, @Req() req: any) {
    this.checkAdmin(user, req);
    return { avatars: await this.authService.listarAvataresPredeterminados() };
  }

  @Post('preset-avatars')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async addPresetAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.checkAdmin(user, req);
    const subido = file || req.file;
    if (!subido) {
      throw new BadRequestException('Debes adjuntar un archivo de imagen válido.');
    }
    return { avatars: await this.authService.anadirAvatarPredeterminado(subido.buffer) };
  }

  @Delete('preset-avatars')
  async removePresetAvatar(
    @CurrentUser() user: any,
    @Body() body: { avatar?: string },
    @Req() req: any,
  ) {
    this.checkAdmin(user, req);
    return { avatars: await this.authService.quitarAvatarPredeterminado(body?.avatar) };
  }

  // ENLACES DEL PIE (redes sociales y sitios recomendados)
  @Get('site-links/providers')
  async getSiteLinkProviders(@CurrentUser() user: any, @Req() req: any) {
    this.checkAdmin(user, req);
    return { providers: this.adminService.listarRedesSociales() };
  }

  @Get('site-links')
  async getSiteLinks(@CurrentUser() user: any, @Req() req: any) {
    this.checkAdmin(user, req);
    return { links: await this.adminService.listarEnlaces() };
  }

  @Post('site-links')
  async createSiteLink(@CurrentUser() user: any, @Body() body: any, @Req() req: any) {
    this.checkAdmin(user, req);
    return { links: await this.adminService.crearEnlace(body) };
  }

  @Patch('site-links/:id')
  async updateSiteLink(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    this.checkAdmin(user, req);
    return { links: await this.adminService.actualizarEnlace(id, body) };
  }

  @Delete('site-links/:id')
  async deleteSiteLink(@CurrentUser() user: any, @Param('id') id: string, @Req() req: any) {
    this.checkAdmin(user, req);
    return { links: await this.adminService.borrarEnlace(id) };
  }

  @Post('site-links/:id/icon')
  @UseInterceptors(FileInterceptor('icon', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadSiteLinkIcon(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.checkAdmin(user, req);
    const subido = file || req.file;
    if (!subido) {
      throw new BadRequestException('Debes adjuntar un archivo de imagen válido.');
    }
    return { links: await this.adminService.subirLogoEnlace(id, subido.buffer) };
  }

  @Get('maintenance')
  async getMaintenance(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminService.getMaintenanceStatus();
  }

  @Post('maintenance')
  async setMaintenance(
    @CurrentUser() user: any,
    @Body() body: { enabled: boolean; message?: string; estimatedEnd?: string },
  ) {
    this.checkAdmin(user);
    return this.adminService.setMaintenanceStatus(body.enabled, body.message, body.estimatedEnd);
  }
}
