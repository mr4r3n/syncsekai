/**
 * Check how the catalog spends the trackers' shared request budget.
 *
 *     npx ts-node -T scripts/check-catalog-cache.ts
 *
 * Runs the REAL CatalogService.getCatalog with a fake in-memory Prisma and AniList's
 * answer faked (axios is replaced); it touches neither the database nor the network.
 * - The list is fetched once and served from memory afterwards.
 * - The refresh button does not ask again for a list younger than 10 s.
 * - A newer scrobble of the user makes the next visit fetch the list again.
 * - When AniList is busy, the previous list is served and not asked for again for a minute.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { AnimeProvider } from '@prisma/client';
import { CatalogService } from '../src/modules/catalog/catalog.service';

let anilistCalls = 0;
let busy = false;
(axios as any).post = async (url: string) => {
  assert.ok(url.includes('graphql.anilist.co'), `unexpected request to ${url}`);
  anilistCalls++;
  if (busy) throw Object.assign(new Error('AniList is busy right now. Try again in a minute.'), { code: 'TRACKER_BUSY' });
  return {
    data: {
      data: {
        MediaListCollection: {
          lists: [{ entries: [{ id: 1, progress: 3, status: 'CURRENT', score: 0, media: { id: 10, idMal: 20, title: { romaji: 'Show' }, episodes: 12, coverImage: {} } }] }],
        },
      },
    },
  };
};

const user: any = {
  id: 'u1',
  username: 'alice',
  plexConnection: null,
  animeConnections: [{ provider: AnimeProvider.ANILIST, isConnected: true, encryptedAccessToken: 'x', remoteUserId: '5', remoteUsername: 'alice' }],
  titleMappings: [],
  scrobbleHistory: [],
};
const prisma: any = new Proxy(
  { user: { findUnique: async () => user } },
  { get: (target: any, model: string) => target[model] ?? new Proxy({}, { get: () => async () => [] }) },
);
const covers: any = { downloadAndSaveCover: async () => null, hasLocalCover: () => false, registerAlias: () => {}, canonicalKey: (k: string) => k };
const catalog = new CatalogService(prisma, { decrypt: () => 'token' } as any, {} as any, covers);
const open = (forceRefresh = false) => catalog.getCatalog('u1', { forceRefresh });

async function main() {
  const first: any = await open();
  assert.equal(first.items.length, 1);
  assert.equal(anilistCalls, 1);
  assert.equal(first.staleSince, undefined, 'a list just fetched is not stale');

  await open();
  assert.equal(anilistCalls, 1, 'served from memory');

  await open(true);
  assert.equal(anilistCalls, 1, 'refresh button ignored on a list younger than 10 s');
  catalog.userCache.get('u1_ANILIST')!.timestamp -= 11_000;
  await open(true);
  assert.equal(anilistCalls, 2, 'refresh button asks again after 10 s');

  user.scrobbleHistory = [{ showTitle: 'Show', createdAt: new Date(Date.now() + 1000), viewedAt: new Date() }];
  await open();
  assert.equal(anilistCalls, 3, 'a newer scrobble makes the list be fetched again');

  // 31 minutes later AniList is busy: the previous list, and no new request for a minute.
  catalog.userCache.get('u1_ANILIST')!.timestamp -= 31 * 60_000;
  busy = true;
  const fetchedAt = catalog.userCache.get('u1_ANILIST')!.timestamp;
  const stale: any = await open();
  assert.equal(anilistCalls, 4);
  assert.equal(stale.items.length, 1, 'the previous list is served');
  assert.equal(stale.staleSince, new Date(fetchedAt).toISOString(), 'saying how old it is');
  await open();
  const again: any = await open();
  assert.equal(anilistCalls, 4, 'not asked again while the tracker is busy');
  assert.equal(again.staleSince, stale.staleSince, 'still saying it is old');

  // A minute later AniList answers again: a fresh list, no longer stale.
  catalog.userCache.get('u1_ANILIST')!.retryAfter = Date.now() - 1;
  busy = false;
  const fresh: any = await open();
  assert.equal(anilistCalls, 5);
  assert.equal(fresh.staleSince, undefined, 'fresh again once the tracker answers');

  console.log('OK: the catalog asks the tracker once, refreshes on new scrobbles, and rides out a busy tracker');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
