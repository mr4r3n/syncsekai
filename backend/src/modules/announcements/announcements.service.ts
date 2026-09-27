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
import { ANNOUNCEMENT_PRESETS } from './announcement-presets';

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

  public readonly PRESETS = ANNOUNCEMENT_PRESETS;

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
      // The frontend (AnnouncementBanner) requires `data.isActive` to render the
      // banner; this endpoint already filtered by !record.isActive above, so it is
      // ALWAYS true here, but it must be included in the returned object:
      // otherwise `data.isActive` reaches the frontend as `undefined` (falsy)
      // and the guard `!isPreview && (!data.isActive || isDismissed)` hides
      // every real announcement enabled through the public API. Only the admin
      // preview mode (which skips that guard) would show it.
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
      throw new BadRequestException('The template name is required.');
    }

    const created = await this.prisma.announcementPreset.create({
      data: {
        name: dto.name.trim(),
        category: dto.category || 'CUSTOM',
        themePreset: dto.themePreset || 'CUSTOM',
        badgeText: dto.badgeText || null,
        badgeBgColor: dto.badgeBgColor || '#ff4d4f',
        badgeTextColor: dto.badgeTextColor || '#ffffff',
        message: dto.message || 'Custom announcement',
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
      message: `Custom template "${created.name}" saved.`,
      preset: created,
    };
  }

  async deleteCustomPreset(id: string) {
    await this.prisma.announcementPreset.delete({
      where: { id },
    });
    return {
      success: true,
      message: 'Custom template deleted.',
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
      message: 'Alert settings updated.',
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
        ? 'Global alert enabled and visible to users.'
        : 'Global alert disabled.',
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
      // Look in the custom templates database
      const custom = await this.prisma.announcementPreset.findUnique({
        where: { id: presetId },
      });
      if (custom) {
        preset = custom;
      }
    }

    if (!preset) {
      throw new NotFoundException(`No template found with id '${presetId}'`);
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
      message: `Template '${preset.name}' applied.`,
      announcement: updated,
    };
  }

  async saveUploadedMedia(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Missing or invalid file.');
    }

    const isGif = file.mimetype === 'image/gif' || file.originalname.toLowerCase().endsWith('.gif');
    const timestamp = Date.now();
    const ext = isGif ? 'gif' : 'webp';
    const filename = `banner_${timestamp}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    if (isGif) {
      // Save animated GIFs as is, without destructive recompression
      fs.writeFileSync(filePath, file.buffer);
    } else {
      // Optimize images to WebP
      await sharp(file.buffer)
        .resize({ width: 1920, height: 240, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(filePath);
    }

    const publicUrl = `/api/announcements/media/${filename}`;
    return publicUrl;
  }

  getMediaFilePath(filename: string): string {
    // Sanitize the file name to prevent path traversal
    const safeName = path.basename(filename);
    const fullPath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Media file not found.');
    }
    return fullPath;
  }
}
