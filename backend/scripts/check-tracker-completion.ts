/**
 * Check that syncing the last episode marks the anime completed on every tracker.
 *
 *     npx ts-node -T scripts/check-tracker-completion.ts
 *
 * Runs the REAL `updateProgress` of the AniList, MyAnimeList and Kitsu services with
 * the trackers' HTTP answers faked (axios is replaced). It touches neither the
 * database nor the network.
 *
 * The sync always asks for "watching"; the trackers keep the status they are given,
 * so a finished show (Ep. 13/13) stayed in Watching. Only the exact last episode
 * counts: a number past the total (absolute numbering) must not complete a season.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { AnilistService } from '../src/modules/anilist/anilist.service';
import { MalService } from '../src/modules/mal/mal.service';
import { KitsuService } from '../src/modules/kitsu/kitsu.service';

let total: number | null = 13;
let kitsuHasEntry = true;
const calls: Array<{ method: string; url: string; body: any }> = [];
const ax = axios as any;
ax.post = async (url: string, body: any) => {
  calls.push({ method: 'post', url, body });
  if (url.includes('anilist')) {
    return { data: { data: { SaveMediaListEntry: { progress: body.variables.progress, status: body.variables.status, media: { episodes: total } } } } };
  }
  return { data: {} };
};
ax.put = async (url: string, body: any) => {
  calls.push({ method: 'put', url, body: Object.fromEntries(new URLSearchParams(body)) });
  return { data: {} };
};
ax.patch = async (url: string, body: any) => {
  calls.push({ method: 'patch', url, body });
  return { data: {} };
};
ax.get = async (url: string) => {
  calls.push({ method: 'get', url, body: null });
  if (url.includes('myanimelist')) return { data: { num_episodes: total ?? 0 } };
  if (url.includes('/library-entries')) {
    return kitsuHasEntry
      ? { data: { data: [{ id: '77', attributes: { progress: 12 } }], included: [{ attributes: { episodeCount: total } }] } }
      : { data: { data: [] } };
  }
  if (url.includes('/anime/')) return { data: { data: { attributes: { episodeCount: total } } } };
  return { data: {} };
};

const prisma: any = {
  animeConnection: { findUnique: async () => ({ isConnected: true, encryptedAccessToken: 'x', remoteUserId: '5' }) },
};
const enc: any = { decrypt: () => 'token' };
const anilist = new AnilistService(prisma, enc, {} as any);
const mal = new MalService(prisma, enc, {} as any);
const kitsu = new KitsuService(prisma, enc, {} as any);

const statusesSent = (filter: (c: (typeof calls)[number]) => boolean, pick: (c: (typeof calls)[number]) => string) =>
  calls.filter(filter).map(pick);

async function main() {
  // AniList
  calls.length = 0;
  await anilist.updateProgress('u', 1, 12, 'CURRENT');
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.variables.status), ['CURRENT'], 'AniList: Ep. 12/13 stays Watching');
  calls.length = 0;
  await anilist.updateProgress('u', 1, 13, 'CURRENT');
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.variables.status), ['CURRENT', 'COMPLETED'], 'AniList: Ep. 13/13 ends Completed');
  calls.length = 0;
  total = null;
  await anilist.updateProgress('u', 1, 13, 'CURRENT');
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.variables.status), ['CURRENT'], 'AniList: unknown total (airing) stays Watching');
  calls.length = 0;
  total = 13;
  await anilist.updateProgress('u', 1, 13, 'PAUSED');
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.variables.status), ['PAUSED'], 'AniList: another status chosen on purpose is kept');
  calls.length = 0;
  await anilist.updateProgress('u', 1, 27, 'CURRENT');
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.variables.status), ['CURRENT'], 'AniList: a number past the total (absolute numbering) does not complete');

  // MyAnimeList
  calls.length = 0;
  await mal.updateProgress('u', 2, 12);
  await mal.updateProgress('u', 2, 13);
  await mal.updateProgress('u', 2, 27);
  assert.deepEqual(statusesSent((c) => c.method === 'put', (c) => c.body.status), ['watching', 'completed', 'watching'], 'MAL: 12/13 watching, 13/13 completed, 27/13 untouched');

  // Kitsu, with an existing entry and with a new one
  calls.length = 0;
  await kitsu.updateProgress('u', 3, 12);
  await kitsu.updateProgress('u', 3, 13);
  assert.deepEqual(statusesSent((c) => c.method === 'patch', (c) => c.body.data.attributes.status), ['current', 'completed'], 'Kitsu: 12/13 current, 13/13 completed');
  calls.length = 0;
  kitsuHasEntry = false;
  await kitsu.updateProgress('u', 3, 13);
  assert.deepEqual(statusesSent((c) => c.method === 'post', (c) => c.body.data.attributes.status), ['completed'], 'Kitsu: a new entry at the last episode is completed');

  console.log('OK: the last episode marks the anime completed on AniList, MyAnimeList and Kitsu');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
