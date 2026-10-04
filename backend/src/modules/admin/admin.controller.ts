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
import { SiteSettingsService } from './site-settings.service';
import { MetricsService } from './metrics.service';
import { AdminUsersService, parseUsersQuery } from './admin-users.service';
import { SystemHealthService } from './system-health.service';
import { VisitorsService } from './visitors.service';
import { AdminMediaService, parseMediaQuery } from './admin-media.service';
import { SiteLinksService } from './site-links.service';
import { BackupService } from './backup.service';
import { BackupRestoreService } from './backup-restore.service';
import { AvatarsService } from '../auth/avatars.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('api/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private siteSettingsService: SiteSettingsService,
    private metricsService: MetricsService,
    private adminUsersService: AdminUsersService,
    private systemHealthService: SystemHealthService,
    private visitorsService: VisitorsService,
    private adminMediaService: AdminMediaService,
    private siteLinksService: SiteLinksService,
    private backupService: BackupService,
    private backupRestoreService: BackupRestoreService,
    private avatarsService: AvatarsService,
  ) {}

  private checkAdmin(user: any) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access restricted to administrators.');
    }
  }

  /*
   * System credentials: rotation from the panel.
   */
  @Get('site-settings')
  async getSiteSettings(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.siteSettingsService.getSiteSettings();
  }

  @Put('site-settings')
  async updateSiteSettings(
    @CurrentUser() user: any,
    @Body() body: { changes?: Record<string, string> },
  ) {
    this.checkAdmin(user);
    return this.siteSettingsService.updateSiteSettings(user.id, body?.changes || {});
  }

  @Post('site-settings/icon')
  @UseInterceptors(FileInterceptor('icon', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadSiteIcon(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    this.checkAdmin(user);
    const uploaded = file || req.file;
    if (!uploaded) throw new BadRequestException('Attach a valid image file.');
    return this.siteSettingsService.uploadSiteIcon(user.id, uploaded.buffer);
  }

  @Delete('site-settings/icon')
  async deleteSiteIcon(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.siteSettingsService.deleteSiteIcon(user.id);
  }

  @Get('credentials')
  async getCredentials(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.siteSettingsService.getSystemCredentials();
  }

  @Put('credentials')
  async updateCredentials(
    @CurrentUser() user: any,
    @Body() body: { currentPassword?: string; changes?: Record<string, string> },
  ) {
    this.checkAdmin(user);
    return this.siteSettingsService.updateSystemCredentials(
      user.id,
      body?.currentPassword || '',
      body?.changes || {},
    );
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: any,
    @Query('timeframe') timeframe?: string,
  ) {
    this.checkAdmin(user);
    return this.metricsService.getDashboardMetrics((timeframe as any) || '7d');
  }

  @Get('chart')
  async getChart(
    @CurrentUser() user: any,
    @Query('timeframe') timeframe?: string,
  ) {
    this.checkAdmin(user);
    return this.metricsService.getChartHistory((timeframe as any) || '7d');
  }

  @Get('activity-heatmap')
  async getActivityHeatmap(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.metricsService.getActivityHeatmap();
  }

  @Get('failed-scrobbles')
  async getFailedScrobbles(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkAdmin(user);
    return this.metricsService.getFailedScrobbles(
      page ? parseInt(page, 10) || 1 : 1,
      limit ? parseInt(limit, 10) || 50 : 50,
    );
  }

  @Get('genres')
  async getGenreOverview(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.metricsService.getGenreOverview();
  }

  @Delete('metrics/geo')
  async resetGeoMetrics(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.visitorsService.resetGeoMetrics();
  }

  @Get('users')
  async getUsers(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    this.checkAdmin(user);
    return this.adminUsersService.getUsersPage(parseUsersQuery(query));
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
    return this.adminUsersService.updateUserPermissions(user.id, id, body);
  }

  @Delete('users/:id')
  async deleteUser(@CurrentUser() user: any, @Param('id') id: string) {
    this.checkAdmin(user);
    return this.adminUsersService.deleteUser(user.id, id);
  }

  @Get('system-health')
  async getSystemHealth(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.systemHealthService.getSystemHealth();
  }

  @Post('domains')
  async addDomain(
    @CurrentUser() user: any,
    @Body('domain') domain: string,
    @Body('isAllowed') isAllowed?: boolean,
    @Body('reason') reason?: string,
  ) {
    this.checkAdmin(user);
    return this.systemHealthService.addDomainPolicy(domain, isAllowed ?? true, reason);
  }

  @Delete('domains/:id')
  async deleteDomain(@CurrentUser() user: any, @Param('id') id: string) {
    this.checkAdmin(user);
    return this.systemHealthService.deleteDomainPolicy(id);
  }

  // ==========================================
  // BACKUPS & SCHEDULE
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

  // POST, not GET: the password travels in the body, never in a URL.
  @Post('backups/:filename/download')
  async downloadBackup(
    @CurrentUser() user: any,
    @Param('filename') filename: string,
    @Body('currentPassword') currentPassword: string,
    @Res() res: any,
  ) {
    this.checkAdmin(user);
    await this.siteSettingsService.confirmAdminPassword(user.id, currentPassword);
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
    @Body('currentPassword') currentPassword: string,
  ) {
    this.checkAdmin(user);
    await this.siteSettingsService.confirmAdminPassword(user.id, currentPassword);
    if (!filename) {
      throw new BadRequestException('The backup file name is required.');
    }
    return this.backupRestoreService.restoreBackup(filename);
  }

  @Post('backups/upload-restore')
  @UseInterceptors(FileInterceptor('backupFile', {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  }))
  async uploadAndRestoreBackup(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('currentPassword') currentPassword: string,
  ) {
    this.checkAdmin(user);
    await this.siteSettingsService.confirmAdminPassword(user.id, currentPassword);
    if (!file || !file.buffer) {
      throw new BadRequestException('No backup file was attached.');
    }
    return this.backupRestoreService.restoreBackup(file.buffer);
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
  async getMedia(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    this.checkAdmin(user);
    return this.adminMediaService.getMediaPage(parseMediaQuery(query));
  }

  @Delete('media/:filename')
  async deleteMedia(@CurrentUser() user: any, @Param('filename') filename: string) {
    this.checkAdmin(user);
    return this.adminMediaService.deleteMediaFile(filename);
  }

  @Post('media/purge')
  async purgeMedia(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminMediaService.purgeCoversCache();
  }

  @Post('media/purge-orphans')
  async purgeOrphanMedia(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.adminMediaService.purgeOrphanCovers();
  }

  @Post('media/refresh/:filename')
  async refreshMedia(@CurrentUser() user: any, @Param('filename') filename: string) {
    this.checkAdmin(user);
    return this.adminMediaService.refreshCover(filename);
  }

  @Get('preset-avatars')
  async getPresetAvatars(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return { avatars: await this.avatarsService.listDefaultAvatars() };
  }

  @Post('preset-avatars')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async addPresetAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.checkAdmin(user);
    const uploaded = file || req.file;
    if (!uploaded) {
      throw new BadRequestException('Attach a valid image file.');
    }
    return { avatars: await this.avatarsService.addDefaultAvatar(uploaded.buffer) };
  }

  @Delete('preset-avatars')
  async removePresetAvatar(
    @CurrentUser() user: any,
    @Body() body: { avatar?: string },
  ) {
    this.checkAdmin(user);
    return { avatars: await this.avatarsService.removeDefaultAvatar(body?.avatar) };
  }

  // FOOTER LINKS (social networks and recommended sites)
  @Get('site-links/providers')
  async getSiteLinkProviders(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return { providers: this.siteLinksService.listSocialNetworks() };
  }

  @Get('site-links')
  async getSiteLinks(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return { links: await this.siteLinksService.listLinks() };
  }

  @Post('site-links')
  async createSiteLink(@CurrentUser() user: any, @Body() body: any) {
    this.checkAdmin(user);
    return { links: await this.siteLinksService.createLink(body) };
  }

  @Patch('site-links/:id')
  async updateSiteLink(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.checkAdmin(user);
    return { links: await this.siteLinksService.updateLink(id, body) };
  }

  @Delete('site-links/:id')
  async deleteSiteLink(@CurrentUser() user: any, @Param('id') id: string) {
    this.checkAdmin(user);
    return { links: await this.siteLinksService.deleteLink(id) };
  }

  @Post('site-links/:id/icon')
  @UseInterceptors(FileInterceptor('icon', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadSiteLinkIcon(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.checkAdmin(user);
    const uploaded = file || req.file;
    if (!uploaded) {
      throw new BadRequestException('Attach a valid image file.');
    }
    return { links: await this.siteLinksService.uploadLinkLogo(id, uploaded.buffer) };
  }

  @Get('maintenance')
  async getMaintenance(@CurrentUser() user: any) {
    this.checkAdmin(user);
    return this.siteSettingsService.getMaintenanceStatus();
  }

  @Post('maintenance')
  async setMaintenance(
    @CurrentUser() user: any,
    @Body() body: { enabled: boolean; message?: string; estimatedEnd?: string },
  ) {
    this.checkAdmin(user);
    return this.siteSettingsService.setMaintenanceStatus(body.enabled, body.message, body.estimatedEnd);
  }
}
