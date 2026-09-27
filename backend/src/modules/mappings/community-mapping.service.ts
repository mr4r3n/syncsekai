import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MappingSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Community mappings: when enough users corrected the same Plex title to the
 * same anime by hand, and nobody corrected it to a different one, that answer
 * is used for everyone else before falling back to the AniList search.
 *
 * Only MANUAL rows are votes. Imports can be someone else's file, and AUTO or
 * COMMUNITY rows would let the system vote for itself.
 */

export const COMMUNITY_SETTINGS = {
  minVotes: { key: 'COMMUNITY_MIN_VOTES', defaultValue: 2, min: 2, max: 50 },
  voterMinAgeDays: { key: 'COMMUNITY_VOTER_MIN_AGE_DAYS', defaultValue: 10, min: 0, max: 365 },
  voterMinActiveDays: { key: 'COMMUNITY_VOTER_MIN_ACTIVE_DAYS', defaultValue: 4, min: 0, max: 365 },
} as const;
type CommunityConfig = Record<keyof typeof COMMUNITY_SETTINGS, number>;

/** JSON array of consensus keys the admin rejected. */
const DISMISSED_KEY = 'COMMUNITY_DISMISSED';
export const SUGGESTION_NOTIFICATION = 'COMMUNITY_SUGGESTION';

export interface Vote {
  userId: string;
  plexTitle: string;
  plexSeason: number | null;
  anilistMediaId: number | null;
  anilistTitle: string | null;
  malMediaId: number | null;
  malTitle: string | null;
  kitsuMediaId: number | null;
  kitsuTitle: string | null;
  updatedAt: Date;
}

export interface Consensus {
  key: string;
  plexTitle: string;
  plexSeason: number;
  anilistMediaId: number;
  anilistTitle: string | null;
  malMediaId: number | null;
  malTitle: string | null;
  kitsuMediaId: number | null;
  kitsuTitle: string | null;
  voters: string[];
}

export const titleKey = (plexTitle: string, plexSeason: number | null) =>
  `${plexTitle.trim().toLowerCase()}|${plexSeason ?? 1}`;

/** The dismissed list stores the answer too, so a new answer is reconsidered. */
export const consensusKey = (c: { plexTitle: string; plexSeason: number | null; anilistMediaId: number }) =>
  `${titleKey(c.plexTitle, c.plexSeason)}|${c.anilistMediaId}`;

/**
 * Votes of ONE title and season, already filtered to eligible voters.
 * Consensus = a single answer, given by at least `minVotes` distinct users.
 */
export function pickConsensus(votes: Vote[], minVotes: number): Consensus | null {
  const answers = new Set(votes.map((v) => v.anilistMediaId));
  if (votes.length === 0 || answers.size !== 1) return null;
  const voters = [...new Set(votes.map((v) => v.userId))];
  if (voters.length < minVotes) return null;
  // The most recent correction carries the freshest MAL/Kitsu ids and titles.
  const latest = votes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  const consensus = {
    plexTitle: latest.plexTitle,
    plexSeason: latest.plexSeason ?? 1,
    anilistMediaId: latest.anilistMediaId!,
    anilistTitle: latest.anilistTitle,
    malMediaId: latest.malMediaId,
    malTitle: latest.malTitle,
    kitsuMediaId: latest.kitsuMediaId,
    kitsuTitle: latest.kitsuTitle,
    voters,
  };
  return { key: consensusKey(consensus), ...consensus };
}

const VOTE_WHERE = { source: MappingSource.MANUAL, isGlobal: false, anilistMediaId: { not: null } } as const;

@Injectable()
export class CommunityMappingService implements OnModuleInit {
  private readonly logger = new Logger(CommunityMappingService.name);
  private leaderboardCache: { at: number; data: unknown } | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Rows created before `source` existed all start as AUTO. The ones marked as
   * manual were corrected in the web (imports were also manual then, and there
   * is no way to tell them apart), so they count as votes. Idempotent: new
   * manual rows are written with their source.
   */
  async onModuleInit() {
    const res = await this.prisma.titleMapping
      .updateMany({ where: { isManual: true, source: MappingSource.AUTO }, data: { source: MappingSource.MANUAL } })
      .catch(() => ({ count: 0 }));
    if (res.count) this.logger.log(`Community mappings: ${res.count} legacy manual mappings marked as MANUAL.`);
  }

  async getConfig(): Promise<CommunityConfig> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: Object.values(COMMUNITY_SETTINGS).map((s) => s.key) } },
    });
    const stored = new Map(rows.map((r) => [r.key, Number(r.value)]));
    const entries = Object.entries(COMMUNITY_SETTINGS).map(([name, s]) => {
      const value = stored.get(s.key);
      return [name, Number.isInteger(value) ? value : s.defaultValue];
    });
    return Object.fromEntries(entries) as CommunityConfig;
  }

  async updateConfig(changes: Partial<Record<keyof CommunityConfig, unknown>>) {
    for (const [name, s] of Object.entries(COMMUNITY_SETTINGS)) {
      const raw = changes?.[name as keyof CommunityConfig];
      if (raw === undefined) continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < s.min || value > s.max) {
        throw new BadRequestException(`${name} must be an integer between ${s.min} and ${s.max}.`);
      }
      await this.prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: String(value), isSecret: false },
        create: { key: s.key, value: String(value), isSecret: false },
      });
    }
    this.leaderboardCache = null;
    return this.getConfig();
  }

  private async getDismissed(): Promise<Set<string>> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: DISMISSED_KEY } });
    try {
      const list = JSON.parse(row?.value || '[]');
      return new Set(Array.isArray(list) ? list.map(String) : []);
    } catch {
      return new Set();
    }
  }

  /**
   * Voters are accounts at least N days old that actually USED the service on
   * M distinct days (days with scrobbles, not logins), still active and allowed
   * to edit mappings. Admins vote like anyone else.
   */
  async eligibleVoters(userIds: string[], config: CommunityConfig): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const createdBefore = new Date(Date.now() - config.voterMinAgeDays * 86_400_000);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT u."id" FROM "User" u
      LEFT JOIN "UserSettings" s ON s."userId" = u."id"
      WHERE u."id" = ANY(${userIds})
        AND u."isActive" = true
        AND u."inactivityLockedAt" IS NULL
        AND u."createdAt" <= ${createdBefore}
        AND COALESCE(s."isSuspended", false) = false
        AND COALESCE(s."canEditMappings", true) = true
        AND (SELECT COUNT(DISTINCT date(h."createdAt")) FROM "ScrobbleHistory" h WHERE h."userId" = u."id")
            >= ${config.voterMinActiveDays}`;
    return new Set(rows.map((r) => r.id));
  }

  /** Consensus for one title, or null. Used by the scrobble pipeline. */
  async findConsensus(plexTitle: string, plexSeason: number): Promise<Consensus | null> {
    const votes = await this.prisma.titleMapping.findMany({
      where: { ...VOTE_WHERE, plexTitle: { equals: plexTitle.trim(), mode: 'insensitive' }, plexSeason },
    });
    if (votes.length === 0) return null;
    const config = await this.getConfig();
    const eligible = await this.eligibleVoters([...new Set(votes.map((v) => v.userId))], config);
    const consensus = pickConsensus(votes.filter((v) => eligible.has(v.userId)), config.minVotes);
    if (!consensus || (await this.getDismissed()).has(consensus.key)) return null;
    return consensus;
  }

  /**
   * Every current consensus, dismissed ones included.
   * ponytail: loads every MANUAL mapping in memory; fine for thousands of rows,
   * past that move the grouping to SQL.
   */
  async listConsensus(config?: CommunityConfig): Promise<(Consensus & { dismissed: boolean })[]> {
    config ??= await this.getConfig();
    const votes = await this.prisma.titleMapping.findMany({ where: VOTE_WHERE });
    const eligible = await this.eligibleVoters([...new Set(votes.map((v) => v.userId))], config);
    const byTitle = new Map<string, Vote[]>();
    for (const v of votes) {
      if (!eligible.has(v.userId)) continue;
      const key = titleKey(v.plexTitle, v.plexSeason);
      byTitle.set(key, [...(byTitle.get(key) || []), v]);
    }
    const dismissed = await this.getDismissed();
    return [...byTitle.values()]
      .map((group) => pickConsensus(group, config.minVotes))
      .filter((c): c is Consensus => c !== null)
      .map((c) => ({ ...c, dismissed: dismissed.has(c.key) }));
  }

  /** Admin view: consensus list with voter names and whether a global mapping already covers it. */
  async getAdminOverview() {
    const config = await this.getConfig();
    const list = await this.listConsensus(config);
    const userIds = [...new Set(list.flatMap((c) => c.voters))];
    const [users, globals] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } }),
      this.prisma.titleMapping.findMany({
        where: { isGlobal: true },
        select: { plexTitle: true, plexSeason: true, anilistMediaId: true },
      }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.username]));
    const globalByTitle = new Map(globals.map((g) => [titleKey(g.plexTitle, g.plexSeason), g.anilistMediaId]));
    return {
      config,
      consensus: list.map(({ voters, ...c }) => ({
        ...c,
        voters: voters.map((id) => names.get(id) || id),
        globalAnilistMediaId: globalByTitle.get(titleKey(c.plexTitle, c.plexSeason)) ?? null,
      })),
    };
  }

  async dismiss(key: string, dismissed = true) {
    if (typeof key !== 'string' || !key.includes('|')) throw new BadRequestException('Invalid consensus key.');
    const list = await this.getDismissed();
    if (dismissed) list.add(key);
    else list.delete(key);
    const value = JSON.stringify([...list]);
    await this.prisma.systemSetting.upsert({
      where: { key: DISMISSED_KEY },
      update: { value },
      create: { key: DISMISSED_KEY, value, isSecret: false },
    });
    this.leaderboardCache = null;
    return { success: true, dismissed };
  }

  /**
   * Turns a consensus into an official global mapping, stored as the admin's
   * own row like any other global mapping.
   */
  async promote(adminId: string, key: string) {
    const consensus = (await this.listConsensus()).find((c) => c.key === key);
    if (!consensus) throw new NotFoundException('That consensus no longer exists.');
    const data = {
      anilistMediaId: consensus.anilistMediaId,
      anilistTitle: consensus.anilistTitle,
      malMediaId: consensus.malMediaId,
      malTitle: consensus.malTitle,
      kitsuMediaId: consensus.kitsuMediaId,
      kitsuTitle: consensus.kitsuTitle,
      confidenceScore: 1.0,
      isApproved: true,
      isManual: true,
      isGlobal: true,
      source: MappingSource.COMMUNITY,
    };
    // Only one global per title: any other global row for it goes back to being
    // its owner's own mapping, as when an admin un-globals it by hand.
    const [, promoted] = await this.prisma.$transaction([
      this.prisma.titleMapping.updateMany({
        where: {
          isGlobal: true,
          plexTitle: { equals: consensus.plexTitle, mode: 'insensitive' },
          plexSeason: consensus.plexSeason,
          NOT: { userId: adminId, plexTitle: consensus.plexTitle },
        },
        data: { isGlobal: false },
      }),
      this.prisma.titleMapping.upsert({
        where: {
          userId_plexTitle_plexSeason: { userId: adminId, plexTitle: consensus.plexTitle, plexSeason: consensus.plexSeason },
        },
        update: data,
        create: { userId: adminId, plexTitle: consensus.plexTitle, plexSeason: consensus.plexSeason, ...data },
      }),
    ]);
    return promoted;
  }

  /** The user accepts the community answer for one of their automatic mappings. */
  async acceptSuggestion(userId: string, mappingId: string) {
    const mapping = await this.prisma.titleMapping.findUnique({ where: { id: mappingId } });
    if (!mapping || mapping.userId !== userId || mapping.isGlobal) throw new NotFoundException('Mapping not found.');
    const consensus = await this.findConsensus(mapping.plexTitle, mapping.plexSeason ?? 1);
    if (!consensus) throw new BadRequestException('There is no community consensus for this title anymore.');

    const updated = await this.prisma.titleMapping.update({
      where: { id: mappingId },
      data: {
        anilistMediaId: consensus.anilistMediaId,
        anilistTitle: consensus.anilistTitle,
        malMediaId: consensus.malMediaId,
        malTitle: consensus.malTitle,
        kitsuMediaId: consensus.kitsuMediaId,
        kitsuTitle: consensus.kitsuTitle,
        confidenceScore: 1.0,
        isApproved: true,
        source: MappingSource.COMMUNITY,
      },
    });
    await this.prisma.notification.updateMany({
      where: { userId, type: SUGGESTION_NOTIFICATION, metadata: { path: ['mappingId'], equals: mappingId }, dismissedAt: null },
      data: { dismissedAt: new Date(), isRead: true },
    });
    this.leaderboardCache = null;
    return updated;
  }

  /**
   * Tells users whose automatic mapping disagrees with a consensus. Once per
   * mapping and answer: a later, different consensus notifies again.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async notifyConflicts() {
    const list = (await this.listConsensus()).filter((c) => !c.dismissed);
    let sent = 0;
    for (const c of list) {
      const conflicts = await this.prisma.titleMapping.findMany({
        where: {
          source: MappingSource.AUTO,
          isGlobal: false,
          plexTitle: { equals: c.plexTitle, mode: 'insensitive' },
          plexSeason: c.plexSeason,
          NOT: { anilistMediaId: c.anilistMediaId },
        },
        select: { id: true, userId: true, plexTitle: true, anilistTitle: true },
      });
      for (const m of conflicts) {
        const already = await this.prisma.notification.findFirst({
          where: {
            userId: m.userId,
            type: SUGGESTION_NOTIFICATION,
            AND: [
              { metadata: { path: ['mappingId'], equals: m.id } },
              { metadata: { path: ['anilistMediaId'], equals: c.anilistMediaId } },
            ],
          },
          select: { id: true },
        });
        if (already) continue;
        await this.prisma.notification.create({
          data: {
            userId: m.userId,
            type: SUGGESTION_NOTIFICATION,
            title: `Community suggestion for "${m.plexTitle}"`,
            message: `${c.voters.length} users mapped it to "${c.anilistTitle}" instead of "${m.anilistTitle}".`,
            metadata: {
              mappingId: m.id,
              plexTitle: m.plexTitle,
              plexSeason: c.plexSeason,
              currentTitle: m.anilistTitle,
              anilistMediaId: c.anilistMediaId,
              anilistTitle: c.anilistTitle,
              votes: c.voters.length,
            },
          },
        });
        sent++;
      }
    }
    if (sent) this.logger.log(`Community mappings: ${sent} suggestions sent.`);
    return { sent };
  }

  /**
   * Opt-in ranking: how many OTHER users got a mapping thanks to each voter
   * (rows the pipeline or a suggestion filled from a consensus they voted in).
   */
  async getLeaderboard(limit = 10) {
    if (this.leaderboardCache && Date.now() - this.leaderboardCache.at < 10 * 60_000) {
      return this.leaderboardCache.data;
    }
    const config = await this.getConfig();
    const [helped, votes] = await Promise.all([
      this.prisma.titleMapping.findMany({
        where: { source: MappingSource.COMMUNITY, isGlobal: false },
        select: { userId: true, plexTitle: true, plexSeason: true, anilistMediaId: true },
      }),
      this.prisma.titleMapping.findMany({
        where: VOTE_WHERE,
        select: { userId: true, plexTitle: true, plexSeason: true, anilistMediaId: true },
      }),
    ]);
    const eligible = await this.eligibleVoters([...new Set(votes.map((v) => v.userId))], config);
    const votersByAnswer = new Map<string, string[]>();
    for (const v of votes) {
      if (!eligible.has(v.userId)) continue;
      const key = consensusKey({ ...v, anilistMediaId: v.anilistMediaId! });
      votersByAnswer.set(key, [...(votersByAnswer.get(key) || []), v.userId]);
    }
    const helpedUsers = new Map<string, Set<string>>();
    for (const h of helped) {
      if (h.anilistMediaId === null) continue;
      for (const voter of votersByAnswer.get(consensusKey({ ...h, anilistMediaId: h.anilistMediaId })) || []) {
        if (voter === h.userId) continue;
        helpedUsers.set(voter, (helpedUsers.get(voter) || new Set()).add(h.userId));
      }
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...helpedUsers.keys()] }, settings: { showInLeaderboard: true } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const data = users
      .map((u) => ({ username: u.username, avatarUrl: u.avatarUrl, helpedUsers: helpedUsers.get(u.id)!.size }))
      .sort((a, b) => b.helpedUsers - a.helpedUsers)
      .slice(0, limit);
    this.leaderboardCache = { at: Date.now(), data };
    return data;
  }
}
