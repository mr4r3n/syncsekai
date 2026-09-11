import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAnnouncementDto } from './dto/announcement.dto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface BannerPreset {
  id: string;
  name: string;
  category: string; // FESTIVE, PROMO, INFO, CUSTOM
  themePreset: string;
  badgeText?: string | null;
  badgeBgColor?: string;
  badgeTextColor?: string;
  message: string;
  mediaType: string;
  mediaUrl: string | null;
  mediaPosition: string;
  backgroundType: string;
  backgroundValue: string;
  textColor: string;
  effectType: string;
  enableGlobalAtmosphere?: boolean;
  ctaText?: string | null;
  ctaUrl: string;
  ctaTarget: string;
  ctaBgColor: string;
  ctaTextColor: string;
  isClosable: boolean;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads/announcements');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public readonly PRESETS: BannerPreset[] = [
    // -------------------------------------------------------------------------
    // CATEGORÍA: FESTIVAS & TEMPORADAS
    // -------------------------------------------------------------------------
    {
      id: 'christmas',
      name: 'Navidad & Invierno',
      category: 'FESTIVE',
      themePreset: 'CHRISTMAS',
      badgeText: 'FELIZ NAVIDAD',
      badgeBgColor: '#e53935',
      badgeTextColor: '#ffffff',
      message: '¡Celebra las fiestas con tus animes favoritos! Disfruta de la atmósfera navideña.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 50%, #b7094c 100%)',
      textColor: '#f8f9fa',
      effectType: 'SNOWFLAKES',
      enableGlobalAtmosphere: true,
      ctaText: 'Ver Catálogo',
      ctaUrl: '/catalog',
      ctaTarget: '_self',
      ctaBgColor: '#f8f9fa',
      ctaTextColor: '#1b4332',
      isClosable: true,
    },
    {
      id: 'autumn',
      name: 'Otoño Dorado & Hojas',
      category: 'FESTIVE',
      themePreset: 'AUTUMN',
      badgeText: 'OTOÑO',
      badgeBgColor: '#d97706',
      badgeTextColor: '#ffffff',
      message: 'Temporada de estrenos de otoño: Nuevas series simulcast sincronizándose ahora.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #451a03 0%, #9a3412 50%, #b45309 100%)',
      textColor: '#fffbeb',
      effectType: 'AUTUMN_LEAVES',
      enableGlobalAtmosphere: true,
      ctaText: 'Estrenos Otoño',
      ctaUrl: '/catalog',
      ctaTarget: '_self',
      ctaBgColor: '#fef3c7',
      ctaTextColor: '#78350f',
      isClosable: true,
    },
    {
      id: 'valentine',
      name: 'San Valentín',
      category: 'FESTIVE',
      themePreset: 'VALENTINE',
      badgeText: 'SAN VALENTÍN',
      badgeBgColor: '#ff2a6d',
      badgeTextColor: '#ffffff',
      message: '¡Comparte tu pasión por el anime! Sincroniza episodios con tu media naranja.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
      textColor: '#ffffff',
      effectType: 'FLOATING_HEARTS',
      enableGlobalAtmosphere: true,
      ctaText: 'Mis Mapeos',
      ctaUrl: '/mappings',
      ctaTarget: '_self',
      ctaBgColor: '#ffffff',
      ctaTextColor: '#d81159',
      isClosable: true,
    },
    {
      id: 'halloween',
      name: 'Halloween',
      category: 'FESTIVE',
      themePreset: 'HALLOWEEN',
      badgeText: 'HALLOWEEN',
      badgeBgColor: '#ff6b35',
      badgeTextColor: '#1b1b1b',
      message: 'Noche de maratón terrorífico: Descubre las mejores series de suspenso y terror.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #1a0826 0%, #4a154b 50%, #e85d04 100%)',
      textColor: '#f9f9f9',
      effectType: 'SPOOKY_BATS',
      enableGlobalAtmosphere: true,
      ctaText: 'Ver Historial',
      ctaUrl: '/history',
      ctaTarget: '_self',
      ctaBgColor: '#ff6b35',
      ctaTextColor: '#000000',
      isClosable: true,
    },
    {
      id: 'new_year',
      name: 'Año Nuevo',
      category: 'FESTIVE',
      themePreset: 'NEW_YEAR',
      badgeText: '¡FELIZ AÑO!',
      badgeBgColor: '#ffd700',
      badgeTextColor: '#1a1a1a',
      message: '¡Comienza el nuevo año al día con todos tus animes y progreso sincronizado!',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      textColor: '#ffffff',
      effectType: 'FIREWORKS',
      enableGlobalAtmosphere: true,
      ctaText: 'Explorar Estrenos',
      ctaUrl: '/catalog',
      ctaTarget: '_self',
      ctaBgColor: '#ffd700',
      ctaTextColor: '#1a1a1a',
      isClosable: true,
    },

    // -------------------------------------------------------------------------
    // CATEGORÍA: PROMOCIONES & OFERTAS
    // -------------------------------------------------------------------------
    {
      id: 'mee6_promo',
      name: 'Promoción & Descuentos',
      category: 'PROMO',
      themePreset: 'MEE6_PROMO',
      badgeText: '50% OFF',
      badgeBgColor: '#ff4d4f',
      badgeTextColor: '#ffffff',
      message: 'Level Up For Less ... Get 50% off SyncSekai Premium!',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #0ba360 0%, #3cba92 100%)',
      textColor: '#ffffff',
      effectType: 'SPARKLES',
      enableGlobalAtmosphere: false,
      ctaText: 'UPGRADE NOW',
      ctaUrl: '/connections',
      ctaTarget: '_self',
      ctaBgColor: '#ffffff',
      ctaTextColor: '#0ba360',
      isClosable: true,
    },
    {
      id: 'mee6_sky',
      name: 'Cielo Anime',
      category: 'PROMO',
      themePreset: 'MEE6_SKY',
      badgeText: 'NUEVO',
      badgeBgColor: '#ff4d4f',
      badgeTextColor: '#ffffff',
      message: 'Sincronización exacta en tiempo real con AniList & MyAnimeList activa.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)',
      textColor: '#ffffff',
      effectType: 'SPARKLES',
      enableGlobalAtmosphere: false,
      ctaText: 'EXPLORAR HUB',
      ctaUrl: '/connections',
      ctaTarget: '_self',
      ctaBgColor: '#ffffff',
      ctaTextColor: '#0072ff',
      isClosable: true,
    },
    {
      id: 'cyber_neon',
      name: 'Cyberpunk / Neón Eléctrico',
      category: 'PROMO',
      themePreset: 'CYBER_NEON',
      badgeText: 'NEON ENGINE',
      badgeBgColor: '#00f0ff',
      badgeTextColor: '#000000',
      message: 'Motor de Scrobble Plex v2.4 activo con soporte nativo de ultrabaja latencia.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #050505 0%, #001f3f 50%, #00f0ff 100%)',
      textColor: '#ffffff',
      effectType: 'CYBER_GLOW',
      enableGlobalAtmosphere: false,
      ctaText: 'Diagnóstico',
      ctaUrl: '/admin/services',
      ctaTarget: '_self',
      ctaBgColor: '#00f0ff',
      ctaTextColor: '#000000',
      isClosable: true,
    },

    // -------------------------------------------------------------------------
    // CATEGORÍA: INFORMATIVAS & ESTADO
    // -------------------------------------------------------------------------
    {
      id: 'info_notice',
      name: 'Aviso Informativo',
      category: 'INFO',
      themePreset: 'INFO',
      badgeText: 'COMUNICADO',
      badgeBgColor: '#3b82f6',
      badgeTextColor: '#ffffff',
      message: 'Actualización del sistema completada. Todas las integraciones operan con normalidad.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
      textColor: '#e2e8f0',
      effectType: 'NONE',
      enableGlobalAtmosphere: false,
      ctaText: 'Documentación',
      ctaUrl: '/docs',
      ctaTarget: '_self',
      ctaBgColor: '#38bdf8',
      ctaTextColor: '#0f172a',
      isClosable: true,
    },
    {
      id: 'warning_maintenance',
      name: 'Mantenimiento Programado',
      category: 'INFO',
      themePreset: 'WARNING',
      badgeText: 'MANTENIMIENTO',
      badgeBgColor: '#f59e0b',
      badgeTextColor: '#000000',
      message: 'Ventana de mantenimiento programada para optimización y sincronización de índices.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #451a03 0%, #78350f 100%)',
      textColor: '#fef3c7',
      effectType: 'NONE',
      enableGlobalAtmosphere: false,
      ctaText: 'Estado de Nodos',
      ctaUrl: '/admin/services',
      ctaTarget: '_self',
      ctaBgColor: '#fbbf24',
      ctaTextColor: '#451a03',
      isClosable: false,
    },
    {
      id: 'domain_migration_syncsekai',
      name: 'Migración de Dominio a SyncSekai',
      category: 'INFO',
      themePreset: 'INFO',
      badgeText: 'NUEVO DOMINIO',
      badgeBgColor: '#3b82f6',
      badgeTextColor: '#ffffff',
      message: 'Nos estamos mudando a syncsekai.com. Esta web seguirá funcionando aquí durante la transición, pero actualiza la URL de tus webhooks a syncsekai.com antes del plazo indicado para no perder la sincronización cuando completemos el cambio de dominio.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
      textColor: '#e2e8f0',
      effectType: 'NONE',
      enableGlobalAtmosphere: false,
      ctaText: 'Ver guía de Webhooks',
      ctaUrl: '/docs',
      ctaTarget: '_self',
      ctaBgColor: '#38bdf8',
      ctaTextColor: '#0f172a',
      isClosable: true,
    },
    {
      id: 'critical_alert',
      name: 'Alerta Crítica / Incidencia',
      category: 'INFO',
      themePreset: 'CRITICAL',
      badgeText: 'ALERTA CRÍTICA',
      badgeBgColor: '#ef4444',
      badgeTextColor: '#ffffff',
      message: 'Interrupción temporal en la API de metadatos remotos. Estamos investigando la causa.',
      mediaType: 'NONE',
      mediaUrl: null,
      mediaPosition: 'LEFT',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, #450a0a 0%, #7f1d1d 100%)',
      textColor: '#fee2e2',
      effectType: 'NONE',
      enableGlobalAtmosphere: false,
      ctaText: 'Ver Logs',
      ctaUrl: '/admin/logs',
      ctaTarget: '_self',
      ctaBgColor: '#ef4444',
      ctaTextColor: '#ffffff',
      isClosable: true,
    },
  ];

  async getAnnouncementRecord() {
    let announcement = await this.prisma.systemAnnouncement.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!announcement) {
      const defaultPreset = this.PRESETS[0];
      announcement = await this.prisma.systemAnnouncement.create({
        data: {
          isActive: false,
          themePreset: defaultPreset.themePreset,
          badgeText: defaultPreset.badgeText,
          badgeBgColor: defaultPreset.badgeBgColor,
          badgeTextColor: defaultPreset.badgeTextColor,
          message: defaultPreset.message,
          mediaType: defaultPreset.mediaType,
          mediaUrl: defaultPreset.mediaUrl,
          mediaPosition: defaultPreset.mediaPosition,
          backgroundType: defaultPreset.backgroundType,
          backgroundValue: defaultPreset.backgroundValue,
          textColor: defaultPreset.textColor,
          effectType: defaultPreset.effectType,
          ctaText: defaultPreset.ctaText,
          ctaUrl: defaultPreset.ctaUrl,
          ctaTarget: defaultPreset.ctaTarget,
          ctaBgColor: defaultPreset.ctaBgColor,
          ctaTextColor: defaultPreset.ctaTextColor,
          isClosable: defaultPreset.isClosable,
          targetAudience: 'ALL',
          dismissExpiryDays: 7,
        },
      });
    }

    return announcement;
  }

  async getActiveAnnouncement(user?: { role?: string; id?: string }) {
    const record = await this.getAnnouncementRecord();
    if (!record || !record.isActive) {
      return null;
    }

    const now = new Date();
    if (record.startsAt && now < new Date(record.startsAt)) {
      return null;
    }
    if (record.endsAt && now > new Date(record.endsAt)) {
      return null;
    }

    const audience = record.targetAudience || 'ALL';
    const isAuthenticated = Boolean(user && user.id);
    const isAdmin = user?.role === 'ADMIN';

    if (audience === 'ADMIN_ONLY' && !isAdmin) {
      return null;
    }
    if (audience === 'AUTHENTICATED' && !isAuthenticated) {
      return null;
    }
    if (audience === 'GUEST' && isAuthenticated) {
      return null;
    }

    return {
      id: record.id,
      // El frontend (AnnouncementBanner) exige `data.isActive` para pintar el
      // banner; este endpoint ya filtró por !record.isActive más arriba, así
      // que si llegamos aquí SIEMPRE es true — pero como no se incluía en el
      // objeto devuelto, `data.isActive` llegaba `undefined` (falsy) al
      // frontend y el guard `!isPreview && (!data.isActive || isDismissed)`
      // ocultaba cualquier anuncio real activado vía la API pública. Solo el
      // modo preview del admin (que salta ese guard) lo mostraba alguna vez.
      isActive: true,
      category: record.category,
      themePreset: record.themePreset,
      badgeText: record.badgeText,
      badgeBgColor: record.badgeBgColor,
      badgeTextColor: record.badgeTextColor,
      message: record.message,
      mediaType: record.mediaType,
      mediaUrl: record.mediaUrl,
      mediaPosition: record.mediaPosition,
      backgroundType: record.backgroundType,
      backgroundValue: record.backgroundValue,
      textColor: record.textColor,
      effectType: record.effectType,
      enableGlobalAtmosphere: record.enableGlobalAtmosphere !== undefined ? record.enableGlobalAtmosphere : true,
      ctaText: record.ctaText,
      ctaUrl: record.ctaUrl,
      ctaTarget: record.ctaTarget,
      ctaBgColor: record.ctaBgColor,
      ctaTextColor: record.ctaTextColor,
      isClosable: record.isClosable,
      dismissExpiryDays: record.dismissExpiryDays,
      updatedAt: record.updatedAt,
    };
  }

  async getAdminConfig() {
    const record = await this.getAnnouncementRecord();
    const customPresets = await this.prisma.announcementPreset.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return {
      announcement: record,
      presets: this.PRESETS,
      customPresets,
    };
  }

  async saveCustomPreset(dto: any) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('El nombre de la plantilla es obligatorio.');
    }

    const created = await this.prisma.announcementPreset.create({
      data: {
        name: dto.name.trim(),
        category: dto.category || 'CUSTOM',
        themePreset: dto.themePreset || 'CUSTOM',
        badgeText: dto.badgeText || null,
        badgeBgColor: dto.badgeBgColor || '#ff4d4f',
        badgeTextColor: dto.badgeTextColor || '#ffffff',
        message: dto.message || 'Anuncio personalizado',
        mediaType: dto.mediaType || 'NONE',
        mediaUrl: dto.mediaUrl || null,
        mediaPosition: dto.mediaPosition || 'LEFT',
        backgroundType: dto.backgroundType || 'GRADIENT',
        backgroundValue: dto.backgroundValue || 'linear-gradient(90deg, #0ba360 0%, #3cba92 100%)',
        textColor: dto.textColor || '#ffffff',
        effectType: dto.effectType || 'NONE',
        enableGlobalAtmosphere: dto.enableGlobalAtmosphere !== undefined ? dto.enableGlobalAtmosphere : true,
        ctaText: dto.ctaText || null,
        ctaUrl: dto.ctaUrl || null,
        ctaTarget: dto.ctaTarget || '_self',
        ctaBgColor: dto.ctaBgColor || null,
        ctaTextColor: dto.ctaTextColor || null,
        isClosable: dto.isClosable !== undefined ? dto.isClosable : true,
      },
    });

    return {
      success: true,
      message: `Plantilla personalizada "${created.name}" guardada con éxito.`,
      preset: created,
    };
  }

  async deleteCustomPreset(id: string) {
    await this.prisma.announcementPreset.delete({
      where: { id },
    });
    return {
      success: true,
      message: 'Plantilla personalizada eliminada correctamente.',
    };
  }

  async updateAnnouncement(dto: UpdateAnnouncementDto) {
    const record = await this.getAnnouncementRecord();

    const updated = await this.prisma.systemAnnouncement.update({
      where: { id: record.id },
      data: {
        isActive: dto.isActive !== undefined ? dto.isActive : record.isActive,
        category: dto.category || record.category,
        themePreset: dto.themePreset || record.themePreset,
        badgeText: dto.badgeText !== undefined ? dto.badgeText : record.badgeText,
        badgeBgColor: dto.badgeBgColor !== undefined ? dto.badgeBgColor : record.badgeBgColor,
        badgeTextColor: dto.badgeTextColor !== undefined ? dto.badgeTextColor : record.badgeTextColor,
        message: dto.message || record.message,
        mediaType: dto.mediaType !== undefined ? dto.mediaType : record.mediaType,
        mediaUrl: dto.mediaUrl !== undefined ? dto.mediaUrl : record.mediaUrl,
        mediaPosition: dto.mediaPosition || record.mediaPosition,
        backgroundType: dto.backgroundType || record.backgroundType,
        backgroundValue: dto.backgroundValue !== undefined ? dto.backgroundValue : record.backgroundValue,
        textColor: dto.textColor !== undefined ? dto.textColor : record.textColor,
        effectType: dto.effectType || record.effectType,
        enableGlobalAtmosphere:
          dto.enableGlobalAtmosphere !== undefined ? dto.enableGlobalAtmosphere : record.enableGlobalAtmosphere,
        ctaText: dto.ctaText !== undefined ? dto.ctaText : record.ctaText,
        ctaUrl: dto.ctaUrl !== undefined ? dto.ctaUrl : record.ctaUrl,
        ctaTarget: dto.ctaTarget || record.ctaTarget,
        ctaBgColor: dto.ctaBgColor !== undefined ? dto.ctaBgColor : record.ctaBgColor,
        ctaTextColor: dto.ctaTextColor !== undefined ? dto.ctaTextColor : record.ctaTextColor,
        startsAt:
          dto.startsAt === null || dto.startsAt === ''
            ? null
            : dto.startsAt !== undefined
            ? new Date(dto.startsAt)
            : record.startsAt,
        endsAt:
          dto.endsAt === null || dto.endsAt === ''
            ? null
            : dto.endsAt !== undefined
            ? new Date(dto.endsAt)
            : record.endsAt,
        dismissExpiryDays: dto.dismissExpiryDays || record.dismissExpiryDays,
      },
    });

    return {
      success: true,
      message: 'Configuración de alerta actualizada correctamente.',
      announcement: updated,
    };
  }

  async toggleActive(forcedState?: boolean) {
    const record = await this.getAnnouncementRecord();
    const nextState = forcedState !== undefined ? forcedState : !record.isActive;

    const updated = await this.prisma.systemAnnouncement.update({
      where: { id: record.id },
      data: { isActive: nextState },
    });

    return {
      success: true,
      isActive: updated.isActive,
      message: updated.isActive
        ? 'Alerta global activada y visible para los usuarios.'
        : 'Alerta global desactivada.',
      announcement: updated,
    };
  }

  async applyPreset(presetId: string) {
    const normalized = (presetId || '').toLowerCase().trim();
    let preset: any = this.PRESETS.find(
      (p) =>
        p.id.toLowerCase() === normalized ||
        p.themePreset.toLowerCase() === normalized ||
        p.id.replace(/_/g, '') === normalized.replace(/_/g, '')
    );

    if (!preset) {
      // Buscar en base de datos de plantillas personalizadas
      const custom = await this.prisma.announcementPreset.findUnique({
        where: { id: presetId },
      });
      if (custom) {
        preset = custom;
      }
    }

    if (!preset) {
      throw new NotFoundException(`No se encontró la plantilla con id '${presetId}'`);
    }

    const record = await this.getAnnouncementRecord();
    const updated = await this.prisma.systemAnnouncement.update({
      where: { id: record.id },
      data: {
        category: preset.category || 'CUSTOM',
        themePreset: preset.themePreset || 'CUSTOM',
        badgeText: preset.badgeText,
        badgeBgColor: preset.badgeBgColor,
        badgeTextColor: preset.badgeTextColor,
        message: preset.message,
        mediaType: preset.mediaType,
        mediaUrl: preset.mediaUrl,
        mediaPosition: preset.mediaPosition,
        backgroundType: preset.backgroundType,
        backgroundValue: preset.backgroundValue,
        textColor: preset.textColor,
        effectType: preset.effectType,
        enableGlobalAtmosphere:
          preset.enableGlobalAtmosphere !== undefined ? preset.enableGlobalAtmosphere : true,
        ctaText: preset.ctaText,
        ctaUrl: preset.ctaUrl,
        ctaTarget: preset.ctaTarget,
        ctaBgColor: preset.ctaBgColor,
        ctaTextColor: preset.ctaTextColor,
        isClosable: preset.isClosable,
      },
    });

    return {
      success: true,
      message: `Plantilla '${preset.name}' aplicada con éxito.`,
      announcement: updated,
    };
  }

  async saveUploadedMedia(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado o inválido.');
    }

    const isGif = file.mimetype === 'image/gif' || file.originalname.toLowerCase().endsWith('.gif');
    const timestamp = Date.now();
    const ext = isGif ? 'gif' : 'webp';
    const filename = `banner_${timestamp}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    if (isGif) {
      // Guardar GIF animado directamente sin recompresión destructiva
      fs.writeFileSync(filePath, file.buffer);
    } else {
      // Optimizar imágenes a WebP
      await sharp(file.buffer)
        .resize({ width: 1920, height: 240, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(filePath);
    }

    const publicUrl = `/api/announcements/media/${filename}`;
    return publicUrl;
  }

  getMediaFilePath(filename: string): string {
    // Sanitizar nombre de archivo para prevenir Path Traversal
    const safeName = path.basename(filename);
    const fullPath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Archivo multimedia no encontrado.');
    }
    return fullPath;
  }
}
