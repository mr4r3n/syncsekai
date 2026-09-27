import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { reencodeSquareImage } from '../../common/security/image-file';
import {
  BUILT_IN_AVATARS,
  UPLOADED_PRESETS_DIR,
  DEFAULT_AVATARS_KEY,
  looksLikeAvatarPath,
} from '../../common/security/default-avatars';

/** Avatars: own uploads and the catalog of default avatars. */
@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  // Avatar upload and conversion to WebP
  async uploadAvatar(userId: string, fileBuffer: Buffer): Promise<{ avatarUrl: string; message: string }> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await this.deleteUploadedAvatar(userId);

    const filename = `avatar_${userId}_${Date.now()}.webp`;
    await reencodeSquareImage(fileBuffer, path.join(uploadDir, filename));

    const avatarUrl = `/api/auth/avatar/${filename}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return {
      avatarUrl,
      message: 'Profile picture processed and converted to WebP.',
    };
  }

  /**
   * Deletes the user's uploaded avatar file, if there was one.
   *
   * Called both when uploading a new one and when switching to a default one:
   * in both cases the previous one is no longer referenced and would only take
   * up disk space. It does not touch avatars from Google or Discord, which are
   * not our files, or the default ones, which are shared.
   */
  private async deleteUploadedAvatar(userId: string): Promise<void> {
    try {
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });
      const url = existing?.avatarUrl;
      // The /preset/ in the path tells the user's own avatar from a shared default
      // one: deleting the latter would take it away from everyone using it.
      if (!url || !url.includes('/api/auth/avatar/') || url.includes('/avatar/preset/')) return;

      const previous = path.join(process.cwd(), 'uploads', 'avatars', path.basename(url));
      if (fs.existsSync(previous)) fs.unlinkSync(previous);
    } catch (err: any) {
      this.logger.warn(`Could not delete the previous avatar of ${userId}: ${err.message}`);
    }
  }

  /**
   * Live list of default avatars.
   *
   * Until someone edits the list from the panel it returns the built-in ones,
   * so the feature does not appear empty on a new installation.
   */
  async listDefaultAvatars(): Promise<string[]> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: DEFAULT_AVATARS_KEY },
    });
    if (!row?.value) return [...BUILT_IN_AVATARS];

    try {
      const list = JSON.parse(row.value);
      if (!Array.isArray(list)) throw new Error('not an array');
      // Also filtered on read: if someone edited the row by hand, a malformed path
      // would never get rendered in an <img>.
      return list.filter(looksLikeAvatarPath);
    } catch (err: any) {
      this.logger.warn(`PRESET_AVATARS unreadable, using the built-in ones: ${err.message}`);
      return [...BUILT_IN_AVATARS];
    }
  }

  /** Assigns one of the default avatars to the user. */
  async setAvatarPreset(userId: string, urlPath: unknown): Promise<{ avatarUrl: string; message: string }> {
    if (!looksLikeAvatarPath(urlPath)) {
      throw new BadRequestException('Unrecognized default avatar.');
    }

    // The right shape is not enough: it has to be in the list on offer.
    const available = await this.listDefaultAvatars();
    if (!available.includes(urlPath)) {
      throw new BadRequestException('That default avatar is no longer available.');
    }

    await this.deleteUploadedAvatar(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: urlPath } });

    return { avatarUrl: urlPath, message: 'Avatar updated.' };
  }

  /**
   * Adds a default avatar from an image uploaded by an admin.
   * Returns the updated list.
   */
  async addDefaultAvatar(fileBuffer: Buffer): Promise<string[]> {
    const dir = path.join(process.cwd(), 'uploads', UPLOADED_PRESETS_DIR);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = `preset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    await reencodeSquareImage(fileBuffer, path.join(dir, file));

    const list = await this.listDefaultAvatars();
    list.push(`/api/auth/avatar/preset/${file}`);
    await this.saveAvatarList(list);
    return list;
  }

  /**
   * Removes an avatar from the list. Uploaded ones are deleted from disk; the
   * built-in ones only leave the list, because the file is part of the frontend.
   *
   * Users who had it keep the old path in their profile. That is deliberate:
   * changing a user's avatar without telling them is worse than keeping one that
   * is no longer offered, and for built-in ones the file is still there.
   */
  async removeDefaultAvatar(urlPath: unknown): Promise<string[]> {
    if (!looksLikeAvatarPath(urlPath)) {
      throw new BadRequestException('Unrecognized default avatar.');
    }

    const list = (await this.listDefaultAvatars()).filter((x) => x !== urlPath);
    await this.saveAvatarList(list);

    const file = urlPath.startsWith('/api/') ? path.basename(urlPath) : null;
    if (file) {
      const onDisk = path.join(process.cwd(), 'uploads', UPLOADED_PRESETS_DIR, file);
      try {
        if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
      } catch (err: any) {
        this.logger.warn(`Could not delete preset ${file}: ${err.message}`);
      }
    }

    return list;
  }

  private async saveAvatarList(list: string[]): Promise<void> {
    const value = JSON.stringify(list);
    await this.prisma.systemSetting.upsert({
      where: { key: DEFAULT_AVATARS_KEY },
      update: { value },
      create: { key: DEFAULT_AVATARS_KEY, value },
    });
  }
}
