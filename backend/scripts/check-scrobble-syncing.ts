/**
 * Check that the history says "syncing" while a sync waits for the trackers, and "synced"
 * only once each tracker has confirmed it.
 *
 *     npx ts-node -T scripts/check-scrobble-syncing.ts
 *
 * Runs the REAL ScrobblePipelineService and CatalogProgressService with an in-memory Prisma
 * and the trackers faked; it touches neither the database nor the network.
 * - A scrobble is in the history as SYNCING before any tracker answers; each tracker then
 *   ends SUCCESS, FAILED or SKIPPED, never SYNCING.
 * - A shutdown marks the syncs still waiting as interrupted; the same episode played after
 *   the restart sends that row again instead of taking it for an already synced duplicate.
 * - The sweep closes only old rows that no live sync holds.
 * - A catalog save the trackers' queue holds for over 15 s answers "still syncing".
 * - A row still syncing cannot be undone: its queued sync would reach the trackers right after.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { Logger } from '@nestjs/common';
import { AnimeProvider, SyncStatus } from '@prisma/client';
import { ScrobblePipelineService, syncingRows, INTERRUPTED_SYNC } from '../src/modules/plex/scrobble-pipeline.service';
import { CatalogProgressService } from '../src/modules/catalog/catalog-progress.service';
import { HistoryService } from '../src/modules/history/history.service';

Logger.overrideLogger(false);
(axios as any).post = (axios as any).get = async (url: string) => assert.fail(`unexpected request to ${url}`);

// --- In-memory Prisma: only what the two services use. ---
let rows: any[] = [];
let nextId = 1;
const matches = (row: any, where: any) =>
  Object.entries(where).every(([k, c]: [string, any]) => {
    const v = row[k];
    if (c && typeof c === 'object' && !(c instanceof Date)) {
      if ('in' in c) return c.in.includes(v);
      if ('notIn' in c) return !c.notIn.includes(v);
      if ('lt' in c) return v < c.lt;
      if ('gte' in c) return v >= c.gte;
      if ('equals' in c) return String(v).toLowerCase() === String(c.equals).toLowerCase();
    }
    return v === c;
  });
let linked = [AnimeProvider.ANILIST, AnimeProvider.MAL];
const mapping = { id: 'm1', anilistMediaId: 10, malMediaId: 20, kitsuMediaId: null, isApproved: true };
const prisma: any = {
  scrobbleHistory: {
    findFirst: async ({ where }: any) =>
      rows.filter((r) => matches(r, where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    create: async ({ data }: any) => {
      const row = { id: `h${nextId++}`, createdAt: new Date(), ...data };
      rows.push(row);
      return { ...row };
    },
    update: async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id);
      Object.assign(row, data);
      return { ...row };
    },
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
  },
  titleMapping: { findFirst: async () => mapping },
  animeConnection: { findMany: async () => linked.map((provider) => ({ provider })) },
  plexConnection: { updateMany: async () => ({ count: 1 }) },
  $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
};

// --- Trackers: AniList answers when the check says so. ---
let anilistAnswer: () => Promise<any>;
const seenByAnilist: any[] = [];
const anilist: any = {
  updateProgress: () => {
    seenByAnilist.push(rows.map((r) => ({ ...r })));
    return anilistAnswer();
  },
};
const mal: any = { updateProgress: async () => ({ success: false, error: 'boom' }) };
const kitsu: any = {};
const quiet: any = { getOrFetchCover: async () => null, notifyUnmappedAnime: async () => {}, findConsensus: async () => null };
const pipeline = () => new ScrobblePipelineService(prisma, anilist, mal, kitsu, quiet, quiet, quiet);

const user = {
  id: 'u1',
  username: 'alice',
  isActive: true,
  role: 'USER',
  settings: { completionPercentage: 85, canScrobble: true },
  blacklist: [],
  plexConnection: { plexUsername: 'alice', monitoredLibraries: [] },
};
const scrobble = (episodeNumber: number): any => ({
  source: 'PLEX',
  event: 'media.scrobble',
  showTitle: 'Show',
  librarySectionTitle: 'Anime',
  episodeNumber,
  seasonNumber: 1,
  viewOffsetMs: 95,
  durationMs: 100,
  accountUsername: 'alice',
  hasPayload: true,
  rawPayload: {},
});
const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
};
const settle = () => new Promise((r) => setTimeout(r, 20));
const statuses = (r: any) => [r.anilistStatus, r.malStatus, r.kitsuStatus];

async function main() {
  // The catalog's 15 s timer does not keep a process alive (a server has its HTTP socket); this one does.
  const keepAlive = setInterval(() => {}, 1000);
  // 1. Syncing first, then what each tracker answered.
  const answer = deferred();
  anilistAnswer = () => answer.promise;
  const service = pipeline();
  const first = service.processScrobbleEvent(user, scrobble(3));
  const duplicate = service.processScrobbleEvent(user, scrobble(3));
  await settle();
  assert.equal(rows.length, 1);
  assert.deepEqual(statuses(seenByAnilist[0][0]), ['SYNCING', 'SYNCING', 'SKIPPED'], 'in the history as syncing before AniList answers; Kitsu is not linked');
  assert.ok(syncingRows.has(rows[0].id));
  answer.resolve({ success: true });
  const done: any = await first;
  assert.deepEqual(statuses(rows[0]), ['SUCCESS', 'FAILED', 'SKIPPED'], 'each tracker ends with its own answer');
  assert.equal(rows[0].errorMessage, 'MAL error: boom');
  assert.equal(done.historyEntry.anilistStatus, SyncStatus.SUCCESS);
  assert.equal(((await duplicate) as any).status, 'SCROBBLE_DEDUPLICATED', 'the same episode during the sync is consolidated');
  assert.equal(rows.length, 1);
  assert.equal(syncingRows.size, 0);

  // 2. A deploy while AniList has not answered: interrupted at once, not "syncing" for 15 minutes.
  anilistAnswer = () => new Promise(() => {});
  const old = pipeline();
  void old.processScrobbleEvent(user, scrobble(4));
  await settle();
  const cut = rows.find((r) => r.episodeNumber === 4);
  assert.deepEqual(statuses(cut), ['SYNCING', 'SYNCING', 'SKIPPED']);
  const realNow = Date.now;
  const shutdown = old.beforeApplicationShutdown();
  Date.now = () => realNow() + 9_000; // past the 8 s grace
  await shutdown;
  Date.now = realNow;
  assert.deepEqual(statuses(cut), ['FAILED', 'FAILED', 'SKIPPED'], 'marked as interrupted on shutdown');
  assert.equal(cut.errorMessage, INTERRUPTED_SYNC);

  // 3. After the restart (a new process: nothing syncing in it) the same episode is sent again on that row.
  syncingRows.clear();
  anilistAnswer = async () => ({ success: true });
  const again: any = await pipeline().processScrobbleEvent(user, scrobble(4));
  assert.equal(again.status, 'SCROBBLED_SUCCESS', 'not taken for an already synced duplicate');
  assert.equal(rows.filter((r) => r.episodeNumber === 4).length, 1, 'on the same row');
  assert.deepEqual(statuses(cut), ['SUCCESS', 'FAILED', 'SKIPPED']);
  assert.equal(cut.errorMessage, 'MAL error: boom');

  // 4. A row another sync of this process holds (a catalog save) is still on its way: consolidated.
  const live = await prisma.scrobbleHistory.create({ data: { userId: 'u1', showTitle: 'Show', seasonNumber: 1, episodeNumber: 5, viewPercentage: 100, anilistStatus: 'SYNCING', malStatus: 'SKIPPED', kitsuStatus: 'SKIPPED' } });
  syncingRows.add(live.id);
  assert.equal(((await pipeline().processScrobbleEvent(user, scrobble(5))) as any).status, 'SCROBBLE_DEDUPLICATED');
  syncingRows.delete(live.id);

  // 5. The sweep: old and held by nobody -> FAILED; recent, or held by a live sync -> untouched.
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  rows = [
    { id: 'old', createdAt: ago(20), anilistStatus: 'SYNCING', malStatus: 'SUCCESS', kitsuStatus: 'SYNCING' },
    { id: 'held', createdAt: ago(20), anilistStatus: 'SYNCING', malStatus: 'SKIPPED', kitsuStatus: 'SKIPPED' },
    { id: 'recent', createdAt: ago(1), anilistStatus: 'SYNCING', malStatus: 'SKIPPED', kitsuStatus: 'SKIPPED' },
  ];
  syncingRows.add('held');
  await pipeline().closeInterruptedSyncs();
  assert.deepEqual(statuses(rows[0]), ['FAILED', 'SUCCESS', 'FAILED']);
  assert.equal(rows[0].errorMessage, INTERRUPTED_SYNC);
  assert.deepEqual(statuses(rows[1]), ['SYNCING', 'SKIPPED', 'SKIPPED'], 'a live sync is left alone');
  assert.deepEqual(statuses(rows[2]), ['SYNCING', 'SKIPPED', 'SKIPPED'], 'a recent one is left alone');
  syncingRows.clear();

  // 6. Catalog: a save the queue holds answers "still syncing" after 15 s and finishes behind.
  rows = [];
  prisma.user = {
    findUnique: async () => ({
      ...user,
      settings: {},
      animeConnections: linked.map((provider) => ({ provider, isConnected: true })),
      titleMappings: [mapping],
    }),
  };
  const catalogAnswer = deferred();
  anilistAnswer = () => catalogAnswer.promise;
  const catalog = new CatalogProgressService(prisma, anilist, mal, kitsu, { invalidateUserCache: () => {} } as any);
  const realTimeout = global.setTimeout;
  (global as any).setTimeout = (fn: () => void, ms: number) => realTimeout(fn, ms === 15_000 ? 30 : ms); // 15 s -> 30 ms
  const res: any = await catalog.updateProgressAndRating('u1', { anilistMediaId: 10, malMediaId: 20, progress: 7, showTitle: 'Show' });
  global.setTimeout = realTimeout;
  assert.equal(res.queued, true, 'answers "still syncing", neither synced nor failed');
  assert.deepEqual(res.updatedTrackers, []);
  assert.deepEqual(statuses(rows[0]), ['SYNCING', 'SYNCING', 'SKIPPED']);
  assert.ok(syncingRows.has(rows[0].id));
  catalogAnswer.resolve({ success: true });
  await settle();
  assert.deepEqual(statuses(rows[0]), ['SUCCESS', 'FAILED', 'SKIPPED'], 'the history gets what each tracker answered');
  assert.equal(syncingRows.size, 0);

  // 7. No undo while still syncing; nothing reaches a tracker.
  rows[0].anilistStatus = SyncStatus.SYNCING;
  prisma.scrobbleHistory.findFirst = async () => rows[0];
  const history = new HistoryService(prisma, {} as any, {} as any, {} as any, {} as any);
  await assert.rejects(history.deleteAndRevert('u1', rows[0].id), { status: 409 });

  clearInterval(keepAlive);
  console.log('OK: syncing until each tracker answers, interrupted syncs are marked and sent again, slow catalog saves say so');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
