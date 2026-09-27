import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BlacklistService {
  constructor(private prisma: PrismaService) {}

  async getUserBlacklist(userId: string) {
    return this.prisma.blacklistEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addEntry(userId: string, titlePattern: string, reason?: string) {
    if (!titlePattern || !titlePattern.trim()) {
      throw new BadRequestException('The title to block is required.');
    }

    return this.prisma.blacklistEntry.create({
      data: {
        userId,
        titlePattern: titlePattern.trim(),
        reason: reason || 'Manual privacy exclusion',
      },
    });
  }

  async removeEntry(userId: string, id: string) {
    return this.prisma.blacklistEntry.deleteMany({
      where: { id, userId },
    });
  }

  async getBlockedGenres(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    return { blockedGenres: settings?.blockedGenres || [] };
  }

  async updateBlockedGenres(userId: string, genres: string[]) {
    const cleanGenres = Array.isArray(genres) ? genres.map(g => g.trim()).filter(Boolean) : [];
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        blockedGenres: cleanGenres,
      },
      update: {
        blockedGenres: cleanGenres,
      },
    });
    return {
      message: 'Excluded genres updated.',
      blockedGenres: settings.blockedGenres,
    };
  }
}
