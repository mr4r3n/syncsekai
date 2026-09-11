import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnilistService } from '../anilist/anilist.service';
import { KitsuService } from '../kitsu/kitsu.service';
import { urlPortadaAnilist } from '../covers/covers.service';
import axios from 'axios';

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

    /*
     * Aquí había una precarga de portadas contra AniList. Guardaba las URL en un
     * Map que no leía nadie: la respuesta siempre ha devuelto `/api/covers/...`,
     * que resuelve por su cuenta. Era una petición bloqueante en cada carga de la
     * página cuyo resultado se tiraba.
     */
    return mappings.map((m) => ({
      ...m,
      coverImage: m.anilistMediaId
        ? urlPortadaAnilist(m.anilistMediaId, m.anilistTitle || m.plexTitle)
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
        throw new NotFoundException('Mapeo no encontrado.');
      }

      // S03: Si el mapeo es global y el solicitante no es admin, no puede modificar el global.
      // En su lugar, se bifurca creando una variante privada para su propia cuenta.
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
            confidenceScore: 1.0,
          },
        });
      }

      if (existing.userId !== userId && !isAdmin) {
        throw new ForbiddenException('No tienes permiso para modificar este mapeo.');
      }

      // Si cambió el título o temporada, verificar si ya existe otro mapeo con esa combinación
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
          // Si ya existía otro para esa combinación, eliminamos el duplicado previo
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
        confidenceScore: 1.0,
      },
    });
  }

  async unlinkMapping(userId: string, mappingId: string, isAdmin = false) {
    const existing = await this.prisma.titleMapping.findUnique({
      where: { id: mappingId },
    });
    if (!existing) {
      throw new NotFoundException('Mapeo no encontrado.');
    }
    if (existing.isGlobal && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para eliminar un mapeo global oficial.');
    }
    if (existing.userId !== userId && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para eliminar este mapeo.');
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
      throw new NotFoundException('Mapeo no encontrado.');
    }
    if (existing.isGlobal && !isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden gestionar mapeos globales.');
    }
    if (existing.userId !== userId && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para aprobar este mapeo.');
    }
    return this.prisma.titleMapping.update({
      where: { id: mappingId },
      data: { isApproved: true, confidenceScore: 1.0 },
    });
  }

  async toggleGlobal(userId: string, mappingId: string, isAdmin: boolean) {
    if (!isAdmin) {
      throw new NotFoundException('Solo los administradores pueden gestionar mapeos globales.');
    }

    const mapping = await this.prisma.titleMapping.findUnique({
      where: { id: mappingId },
    });
    if (!mapping) throw new NotFoundException('Mapeo no encontrado.');

    return this.prisma.titleMapping.update({
      where: { id: mappingId },
      data: { isGlobal: !mapping.isGlobal },
    });
  }

  async getAllAdminMappings(isAdmin: boolean) {
    if (!isAdmin) {
      throw new NotFoundException('Acceso restringido a administradores.');
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

    // La misma precarga inútil que en getUserMappings, copiada. Ver el comentario allí.
    return mappings.map((m) => ({
      ...m,
      coverImage: m.anilistMediaId
        ? urlPortadaAnilist(m.anilistMediaId, m.anilistTitle || m.plexTitle)
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

    // Fallback a Kitsu si AniList está inactivo, restringido (403) o no devolvió resultados
    this.logger.log(`Buscando en Kitsu como fallback para "${query}"`);
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
      throw new BadRequestException('El archivo no contiene un listado válido de mapeos.');
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
        },
      });
      importedCount++;
    }

    return {
      success: true,
      message: `Se importaron ${importedCount} mapeos exitosamente.`,
      importedCount,
    };
  }
}
