import { Controller, Get, Post, Body, Param, Res, HttpCode, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SetupService } from './setup.service';
import { InitializeSetupDto, TestSmtpDto } from './setup.dto';
import { VARIANTES_ICONO_SITIO } from '../../common/security/image-file';

@Controller('api/setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  async getStatus() {
    return this.setupService.getSetupStatus();
  }

  @Get('public-stats')
  async getPublicStats() {
    return this.setupService.getPublicStats();
  }

  @Get('maintenance-status')
  async getMaintenanceStatus() {
    return this.setupService.getMaintenanceStatus();
  }

  @Get('site-settings')
  async getSiteSettings() {
    return this.setupService.getSiteSettings();
  }

  /** Icono subido desde Ajustes del sitio. 404 si no hay: el frontend sirve el de serie. */
  @Get('site-icon/:variant')
  async getSiteIcon(@Param('variant') variant: string, @Res() res: any) {
    const v = VARIANTES_ICONO_SITIO[variant as keyof typeof VARIANTES_ICONO_SITIO];
    if (!v) return res.status(404).send('Variante desconocida');
    const filePath = path.join(process.cwd(), 'uploads', 'site', v.fichero);
    if (!fs.existsSync(filePath)) return res.status(404).send('Sin icono personalizado');
    res.setHeader('Content-Type', v.fichero.endsWith('.png') ? 'image/png' : 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(filePath);
  }

  @Get('site-links')
  async getSiteLinks() {
    return this.setupService.getSiteLinks();
  }

  @Get('site-link-icon/:filename')
  async getSiteLinkIcon(@Param('filename') filename: string, @Res() res: any) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'site-links', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Icono no encontrado');
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }

  @Post('test-smtp')
  @HttpCode(HttpStatus.OK)
  async testSmtp(@Body() dto: TestSmtpDto) {
    return this.setupService.testSmtp(dto);
  }

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  async initialize(@Body() dto: InitializeSetupDto) {
    return this.setupService.initialize(dto);
  }
}
