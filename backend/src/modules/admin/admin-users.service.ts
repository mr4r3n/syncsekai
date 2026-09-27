import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/** User management from the panel: listing, permissions and deletion. */
@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Lists every user with their permissions, connections and metrics.
   */
  async getUsersList() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        twoFactorEnabled: true,
        twoFactorType: true,
        createdAt: true,
        inactivityLockedAt: true,
        settings: {
          select: {
            canScrobble: true,
            canAccessCatalog: true,
            canEditMappings: true,
            canSyncAnilist: true,
            canSyncMal: true,
            canSyncKitsu: true,
            isSuspended: true,
            completionPercentage: true,
            preferredTracker: true,
          },
        },
        plexConnection: {
          select: {
            isConnected: true,
            serverName: true,
            monitoredLibraries: true,
          },
        },
        jellyfinConnection: {
          select: {
            isConnected: true,
            serverName: true,
            monitoredLibraries: true,
          },
        },
        embyConnection: {
          select: {
            isConnected: true,
            serverName: true,
            monitoredLibraries: true,
          },
        },
        animeConnections: {
          select: {
            provider: true,
            isConnected: true,
            remoteUsername: true,
            lastLatencyMs: true,
          },
        },
        _count: {
          select: {
            scrobbleHistory: true,
            titleMappings: true,
          },
        },
        // Only the most recent session: it answers "when did they last sign in?".
        sessions: { select: { lastActiveAt: true }, orderBy: { lastActiveAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      isActive: u.isActive,
      avatarUrl: u.avatarUrl,
      twoFactorEnabled: u.twoFactorEnabled,
      twoFactorType: u.twoFactorType,
      createdAt: u.createdAt,
      lastActiveAt: u.sessions[0]?.lastActiveAt ?? null,
      inactivityLockedAt: u.inactivityLockedAt,
      totalScrobbles: u._count.scrobbleHistory,
      totalMappings: u._count.titleMappings,
      permissions: {
        canScrobble: u.settings?.canScrobble ?? true,
        canAccessCatalog: u.settings?.canAccessCatalog ?? true,
        canEditMappings: u.settings?.canEditMappings ?? true,
        canSyncAnilist: u.settings?.canSyncAnilist ?? true,
        canSyncMal: u.settings?.canSyncMal ?? true,
        canSyncKitsu: u.settings?.canSyncKitsu ?? true,
        isSuspended: u.settings?.isSuspended ?? false,
      },
      connections: {
        plex: u.plexConnection?.isConnected ?? false,
        plexServer: u.plexConnection?.serverName ?? null,
        jellyfin: u.jellyfinConnection?.isConnected ?? false,
        jellyfinServer: u.jellyfinConnection?.serverName ?? null,
        emby: u.embyConnection?.isConnected ?? false,
        embyServer: u.embyConnection?.serverName ?? null,
        anilist: u.animeConnections.find((c) => c.provider === 'ANILIST')?.isConnected ?? false,
        anilistUser: u.animeConnections.find((c) => c.provider === 'ANILIST')?.remoteUsername ?? null,
        mal: u.animeConnections.find((c) => c.provider === 'MAL')?.isConnected ?? false,
        malUser: u.animeConnections.find((c) => c.provider === 'MAL')?.remoteUsername ?? null,
        kitsu: u.animeConnections.find((c) => c.provider === 'KITSU')?.isConnected ?? false,
        kitsuUser: u.animeConnections.find((c) => c.provider === 'KITSU')?.remoteUsername ?? null,
      },
    }));
  }

  /**
   * Updates a user (profile data, password, 2FA, lock and permissions).
   */
  /**
   * An administrator cannot remove their own role, access or account, and no
   * change may leave the installation without an active administrator: the
   * setup wizard is sealed and there would be no way to recover the panel from
   * the application.
   */
  private async ensureAdminRemains(
    actorId: string,
    target: { id: string; role: Role; isActive: boolean; settings?: { isSuspended: boolean } | null },
    change: { role?: Role; isActive?: boolean; isSuspended?: boolean; deleting?: boolean },
  ) {
    const losesAdmin =
      target.role === 'ADMIN' &&
      (change.deleting ||
        (change.role !== undefined && change.role !== 'ADMIN') ||
        change.isActive === false ||
        change.isSuspended === true);
    if (!losesAdmin) return;

    if (target.id === actorId) {
      throw new BadRequestException('You cannot remove your own administrator access.');
    }
    const otherAdmins = await this.prisma.user.count({
      where: {
        id: { not: target.id },
        role: 'ADMIN',
        isActive: true,
        OR: [{ settings: null }, { settings: { isSuspended: false } }],
      },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException('This is the only active administrator; it cannot be removed.');
    }
  }

  async updateUserPermissions(
    actorId: string,
    userId: string,
    payload: {
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
      canSyncKitsu?: boolean;
      isSuspended?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.ensureAdminRemains(actorId, user, payload);

    // Check email and username uniqueness if they are being edited
    if (payload.email && payload.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: payload.email.trim().toLowerCase() },
      });
      if (emailExists && emailExists.id !== userId) {
        throw new BadRequestException('The email is already used by another account.');
      }
    }

    const updateData: any = {};
    if (payload.username !== undefined) updateData.username = payload.username.trim();
    if (payload.email !== undefined) updateData.email = payload.email.trim().toLowerCase();
    if (payload.role !== undefined) updateData.role = payload.role;
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

    if (payload.newPassword) {
      if (payload.newPassword.trim().length < 12) {
        throw new BadRequestException('The password must be at least 12 characters long.');
      }
      updateData.passwordHash = await bcrypt.hash(payload.newPassword.trim(), 12);
    }

    if (payload.reset2Fa) {
      updateData.twoFactorEnabled = false;
      updateData.twoFactorType = 'NONE';
      updateData.twoFactorSecret = null;
      updateData.emailOtpCode = null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Update UserSettings
    await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        canScrobble: payload.canScrobble ?? user.settings?.canScrobble ?? true,
        canAccessCatalog: payload.canAccessCatalog ?? user.settings?.canAccessCatalog ?? true,
        canEditMappings: payload.canEditMappings ?? user.settings?.canEditMappings ?? true,
        canSyncAnilist: payload.canSyncAnilist ?? user.settings?.canSyncAnilist ?? true,
        canSyncMal: payload.canSyncMal ?? user.settings?.canSyncMal ?? true,
        canSyncKitsu: payload.canSyncKitsu ?? user.settings?.canSyncKitsu ?? true,
        isSuspended: payload.isSuspended ?? user.settings?.isSuspended ?? false,
      },
      create: {
        userId,
        canScrobble: payload.canScrobble ?? true,
        canAccessCatalog: payload.canAccessCatalog ?? true,
        canEditMappings: payload.canEditMappings ?? true,
        canSyncAnilist: payload.canSyncAnilist ?? true,
        canSyncMal: payload.canSyncMal ?? true,
        canSyncKitsu: payload.canSyncKitsu ?? true,
        isSuspended: payload.isSuspended ?? false,
      },
    });

    return { success: true, message: 'User and permissions updated.' };
  }

  /**
   * Deletes a user.
   */
  async deleteUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { settings: true } });
    if (!user) throw new NotFoundException('User not found.');
    await this.ensureAdminRemains(actorId, user, { deleting: true });

    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true, message: 'User deleted.' };
  }
}
