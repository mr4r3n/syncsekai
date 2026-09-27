import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { anilistCoverUrl } from '../covers/covers.service';
import axios from 'axios';
import { MappingSource } from '@prisma/client';

@Injectable()
export class MappingsService {
  private readonly logger = new Logger(MappingsService.name);

  constructor(
    private prisma: PrismaService,
    private anilistService: AnilistService,
    private kitsuService: KitsuService,
  ) {}

  async getUserMappings(userId: string) {
    const mappings = await this.prisma.titleMapping.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return mappings.map((m) => ({
      ...m,
      coverImage: m.anilistMediaId
        ? anilistCoverUrl(m.anilistMediaId, m.anilistTitle || m.plexTitle)
        : null,
    }));
  }

  async setManualMapping(
    userId: string,
    data: {
      mappingId?: string;
      plexTitle: string;
      plexSeason?: number;
      anilistMediaId: number;
      anilistTitle: string;
      malMediaId?: number;
      malTitle?: string;
      kitsuMediaId?: number;
      kitsuTitle?: string;
      isGlobal?: boolean;
    },
    isAdmin = false,
  ) {
    const season = data.plexSeason !== undefined ? Number(data.plexSeason) : 1;
    const plexTitle = (data.plexTitle || '').trim();

    if (data.mappingId) {
      const existing = await this.prisma.titleMapping.findUnique({
        where: { id: data.mappingId },
      });

      if (!existing) {
        throw new NotFoundException('Mapping not found.');
      }

      // If the mapping is global and the requester is not an admin, they cannot modify the global one.
      // Instead, a private variant is forked for their own account.
      if (existing.isGlobal && !isAdmin) {
        return this.prisma.titleMapping.upsert({
          where: {
            userId_plexTitle_plexSeason: {
              userId,
              plexTitle,
              plexSeason: season,
            },
          },
          update: {
            anilistMediaId: data.anilistMediaId,
            anilistTitle: data.anilistTitle,
            malMediaId: data.malMediaId || null,
            malTitle: data.malTitle || null,
            kitsuMediaId: data.kitsuMediaId || null,
            kitsuTitle: data.kitsuTitle || null,
            isApproved: true,
            isManual: true,
            isGlobal: false,
            source: MappingSource.MANUAL,
            confidenceScore: 1.0,
          },
          create: {
            userId,
            plexTitle,
            plexSeason: season,
            anilistMediaId: data.anilistMediaId,
            anilistTitle: data.anilistTitle,
            malMediaId: data.malMediaId || null,
            malTitle: data.malTitle || null,
            kitsuMediaId: data.kitsuMediaId || null,
            kitsuTitle: data.kitsuTitle || null,
            isApproved: true,
            isManual: true,
            isGlobal: false,
            source: MappingSource.MANUAL,
            confidenceScore: 1.0,
          },
        });
      }

      if (existing.userId !== userId && !isAdmin) {
        throw new ForbiddenException('You do not have permission to modify this mapping.');
      }

      // If the title or season changed, check whether another mapping already has that combination
      if (existing.plexTitle !== plexTitle || existing.plexSeason !== season) {
        const duplicate = await this.prisma.titleMapping.findFirst({
          where: {
            userId: existing.userId,
            plexTitle: { equals: plexTitle, mode: 'insensitive' },
            plexSeason: season,
            NOT: { id: data.mappingId },
          },
        });

        if (duplicate) {
          // If another one already existed for that combination, remove the previous duplicate
          await this.prisma.titleMapping.delete({ where: { id: duplicate.id } });
        }
      }

      return this.prisma.titleMapping.update({
        where: { id: data.mappingId },
        data: {
          plexTitle,
          plexSeason: season,
          anilistMediaId: data.anilistMediaId,
          anilistTitle: data.anilistTitle,
          malMediaId: data.malMediaId || null,
          malTitle: data.malTitle || null,
          kitsuMediaId: data.kitsuMediaId || null,
          kitsuTitle: data.kitsuTitle || null,
          isApproved: true,
          isManual: true,
          source: MappingSource.MANUAL,
          confidenceScore: 1.0,
        },
      });
    }

    return this.prisma.titleMapping.upsert({
      where: {
        userId_plexTitle_plexSeason: {
          userId,
          plexTitle: data.plexTitle,
          plexSeason: data.plexSeason || 1,
        },
      },
      update: {
        anilistMediaId: data.anilistMediaId,
        anilistTitle: data.anilistTitle,
        malMediaId: data.malMediaId || null,
        malTitle: data.malTitle || null,
        kitsuMediaId: data.kitsuMediaId || null,
        kitsuTitle: data.kitsuTitle || null,
        isApproved: true,
        isManual: true,
        source: MappingSource.MANUAL,
        confidenceScore: 1.0,
      },
      create: {
        userId,
        plexTitle: data.plexTitle,
        plexSeason: data.plexSeason || 1,
        anilistMediaId: data.anilistMediaId,
        anilistTitle: data.anilistTitle,
        malMediaId: data.malMediaId || null,
        malTitle: data.malTitle || null,
        kitsuMediaId: data.kitsuMediaId || null,
        kitsuTitle: data.kitsuTitle || null,
        isApproved: true,
        isManual: true,
        source: MappingSource.MANUAL,
        confidenceScore: 1.0,
      },
    });
  }

  async unlinkMapping(userId: string, mappingId: string, isAdmin = false) {
    const existing = await this.prisma.titleMapping.findUnique({
      where: { id: mappingId },
    });
    if (!existing) {
      throw new NotFoundException('Mapping not found.');
    }
    if (existing.isGlobal && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete an official global mapping.');
    }
    if (existing.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this mapping.');
    }
    return this.prisma.titleMapping.delete({
      where: { id: mappingId },
    });
  }

  async approveMapping(userId: string, mappingId: string, isAdmin = false) {
    const existing = await this.prisma.titleMapping.findUnique({
      where: { id: mappingId },
    });
    if (!existing) {
      throw new NotFoundException('Mapping not found.');
    }
    if (existing.isGlobal && !isAdmin) {
      throw new ForbiddenException('Only administrators can manage global mappings.');
    }
    if (existing.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to approve this mapping.');
    }
    return this.prisma.titleMapping.update({
      where: { id: mappingId },
      data: { isApproved: true, confidenceScore: 1.0 },
    });
  }

  async toggleGlobal(userId: string, mappingId: string, isAdmin: boolean) {
    if (!isAdmin) {
      throw new NotFoundException('Only administrators can manage global mappings.');
    }

    const mapping = await this.prisma.titleMapping.findUnique({
      where: { id: mappingId },
    });
    if (!mapping) throw new NotFoundException('Mapping not found.');

    return this.prisma.titleMapping.update({
      where: { id: mappingId },
      data: { isGlobal: !mapping.isGlobal },
    });
  }

  async getAllAdminMappings(isAdmin: boolean) {
    if (!isAdmin) {
      throw new NotFoundException('Access restricted to administrators.');
    }

    const mappings = await this.prisma.titleMapping.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: [{ isGlobal: 'desc' }, { updatedAt: 'desc' }],
    });

    return mappings.map((m) => ({
      ...m,
      coverImage: m.anilistMediaId
        ? anilistCoverUrl(m.anilistMediaId, m.anilistTitle || m.plexTitle)
        : null,
    }));
  }

  async searchRemoteTitles(query: string, seasonNumber = 1) {
    let anilistResults: any[] = [];
    try {
      anilistResults = await this.anilistService.searchAnime(query, seasonNumber);
    } catch (e: any) {
      this.logger.warn(`AniList search error: ${e.message}`);
    }

    if (Array.isArray(anilistResults) && anilistResults.length > 0) {
      return anilistResults.map((item) => ({ ...item, source: 'anilist' }));
    }

    // Fall back to Kitsu if AniList is down, restricted (403) or returned no results
    this.logger.log(`Searching Kitsu as a fallback for "${query}"`);
    try {
      const kitsuItems = await this.kitsuService.searchAnime(query, 10);
      return (kitsuItems || []).map((item) => ({
        id: item.kitsuId,
        kitsuId: item.kitsuId,
        idMal: null,
        title: {
          romaji: item.romajiTitle || item.title,
          english: item.englishTitle || item.title,
          native: item.title,
        },
        format: item.subtype || 'TV',
        episodes: item.episodesTotal,
        status: item.status,
        coverImage: {
          large: item.coverUrl,
          medium: item.coverUrl,
        },
        source: 'kitsu',
      }));
    } catch (err: any) {
      this.logger.error(`Error en fallback de Kitsu: ${err.message}`);
      return [];
    }
  }

  async importMappings(userId: string, items: any[], isAdmin = false) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('The file does not contain a valid list of mappings.');
    }

    let importedCount = 0;
    for (const item of items) {
      if (!item.plexTitle || !item.anilistMediaId) continue;
      const plexTitle = String(item.plexTitle).trim();
      const plexSeason = Number(item.plexSeason) || 1;
      const anilistMediaId = Number(item.anilistMediaId);
      const anilistTitle = item.anilistTitle ? String(item.anilistTitle).trim() : plexTitle;
      const malMediaId = item.malMediaId ? Number(item.malMediaId) : null;
      const malTitle = item.malTitle ? String(item.malTitle).trim() : null;
      const isGlobal = isAdmin && Boolean(item.isGlobal);

      await this.prisma.titleMapping.upsert({
        where: {
          userId_plexTitle_plexSeason: {
            userId,
            plexTitle,
            plexSeason,
          },
        },
        update: {
          anilistMediaId,
          anilistTitle,
          malMediaId,
          malTitle,
          confidenceScore: 1.0,
          isApproved: true,
          isManual: true,
          isGlobal,
          source: MappingSource.IMPORT,
        },
        create: {
          userId,
          plexTitle,
          plexSeason,
          anilistMediaId,
          anilistTitle,
          malMediaId,
          malTitle,
          confidenceScore: 1.0,
          isApproved: true,
          isManual: true,
          isGlobal,
          source: MappingSource.IMPORT,
        },
      });
      importedCount++;
    }

    return {
      success: true,
      message: `Imported ${importedCount} mappings.`,
      importedCount,
    };
  }
}
