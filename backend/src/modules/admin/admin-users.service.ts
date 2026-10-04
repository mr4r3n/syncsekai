import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { assertValidUsername } from '../../common/text/username';

export type UsersSort = 'createdAt' | 'username' | 'lastActiveAt' | 'status' | 'role';
export interface UsersPageQuery {
  page: number;
  limit: number;
  search: string;
  role: 'ALL' | 'ADMIN' | 'USER';
  status: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW';
  sort: UsersSort;
  asc: boolean;
}

/** Query string of the users list, clamped to known values (page >= 1, 1..100 per page). */
export function parseUsersQuery(q: Record<string, string | undefined>): UsersPageQuery {
  const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    page: Math.max(1, parseInt(q.page || '1', 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(q.limit || '10', 10) || 10)),
    search: (q.search || '').trim().slice(0, 100),
    role: pick(q.role, ['ALL', 'ADMIN', 'USER'] as const, 'ALL'),
    status: pick(q.status, ['ALL', 'ACTIVE', 'SUSPENDED', 'NEW'] as const, 'ALL'),
    sort: pick(q.sort, ['createdAt', 'username', 'lastActiveAt', 'status', 'role'] as const, 'createdAt'),
    asc: q.asc === 'true',
  };
}

/** What each sort orders by; a closed list, so no user text ever reaches the ORDER BY. */
const USERS_ORDER: Record<UsersSort, Prisma.Sql> = {
  createdAt: Prisma.sql`u."createdAt"`,
  username: Prisma.sql`lower(u.username)`,
  lastActiveAt: Prisma.sql`COALESCE(ls.last, to_timestamp(0))`,
  status: Prisma.sql`(CASE WHEN COALESCE(st."isSuspended", false) THEN 1 ELSE 0 END)`,
  role: Prisma.sql`(CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END)`,
};

/** User management from the panel: listing, permissions and deletion. */
@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * One page of users with their permissions, connections and metrics, plus the counts the
   * header shows. Filtered, sorted and cut by the database: the page used to receive every
   * user and do it in the browser.
   */
  async getUsersPage(q: UsersPageQuery) {
    const { ids, total, counts } = await this.findUserPage(q);
    const found = await this.prisma.user.findMany({
      where: { id: { in: ids } },
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
    });
    const byId = new Map(found.map((u) => [u.id, u]));
    const users = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

    const items = users.map((u) => ({
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
    return { items, total, page: q.page, limit: q.limit, counts };
  }

  /**
   * Ids of the users on the page, in order, and the counts. Raw SQL because one sort is by
   * the most recent session, which Prisma cannot order by. Every value is a parameter and
   * the sort column comes from USERS_ORDER.
   */
  private async findUserPage(q: UsersPageQuery) {
    const like = `%${q.search}%`;
    const suspended = Prisma.sql`COALESCE(st."isSuspended", false)`;
    const isNew = Prisma.sql`u."createdAt" > now() - interval '7 days'`;
    const from = Prisma.sql`
      FROM "User" u
      LEFT JOIN "UserSettings" st ON st."userId" = u.id
      LEFT JOIN LATERAL (SELECT MAX(s."lastActiveAt") AS last FROM "Session" s WHERE s."userId" = u.id) ls ON true`;
    const where = Prisma.sql`
      WHERE (${q.search} = '' OR u.username ILIKE ${like} OR u.email ILIKE ${like})
        AND (${q.role} = 'ALL' OR u.role::text = ${q.role})
        AND (${q.status} = 'ALL'
          OR (${q.status} = 'ACTIVE' AND NOT ${suspended})
          OR (${q.status} = 'SUSPENDED' AND ${suspended})
          OR (${q.status} = 'NEW' AND ${isNew}))`;
    const dir = q.asc ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const [rows, [{ total }], [c]] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id ${from} ${where}
        ORDER BY ${USERS_ORDER[q.sort]} ${dir}, lower(u.username) ${dir}, u.id ${dir}
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total ${from} ${where}`,
      this.prisma.$queryRaw<{ all: bigint; admins: bigint; active: bigint; suspended: bigint; new: bigint }[]>`
        SELECT COUNT(*) AS all,
               COUNT(*) FILTER (WHERE u.role = 'ADMIN') AS admins,
               COUNT(*) FILTER (WHERE NOT ${suspended}) AS active,
               COUNT(*) FILTER (WHERE ${suspended}) AS suspended,
               COUNT(*) FILTER (WHERE ${isNew}) AS new
        FROM "User" u LEFT JOIN "UserSettings" st ON st."userId" = u.id`,
    ]);
    return {
      ids: rows.map((r) => r.id),
      total: Number(total),
      counts: { all: Number(c.all), admins: Number(c.admins), active: Number(c.active), suspended: Number(c.suspended), new: Number(c.new) },
    };
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

    // The body has no DTO: an unknown role or a taken name used to reach Prisma and come back as a 500.
    if (payload.role !== undefined && !Object.values(Role).includes(payload.role)) {
      throw new BadRequestException('Unknown role.');
    }
    if (payload.username !== undefined && payload.username.trim() !== user.username) {
      assertValidUsername(payload.username.trim());
      const nameTaken = await this.prisma.user.findFirst({
        where: { username: { equals: payload.username.trim(), mode: 'insensitive' }, NOT: { id: userId } },
      });
      if (nameTaken) {
        throw new BadRequestException('The username is already used by another account.');
      }
    }

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

    // A new password or a cleared 2FA is how an admin locks out whoever took over the
    // account: their open sessions must end too, not only future sign-ins.
    if (payload.newPassword || payload.reset2Fa) {
      await this.prisma.session.deleteMany({ where: { userId } });
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
