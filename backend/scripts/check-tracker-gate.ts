/**
 * Check the gate in front of the trackers' APIs (src/common/http/tracker-gate.ts).
 *
 *     npx ts-node -T scripts/check-tracker-gate.ts
 *
 * Uses its own axios instance whose "server" is a function (adapter), with a fast pace,
 * so it touches no network and runs in about two seconds.
 * - No more than `limit` requests per window, with the minimum gap between them.
 * - Waiting requests go out by priority: sync, then interactive, then background.
 * - Past its maximum wait a request fails with TrackerBusyError.
 * - A 429 pauses the API for its Retry-After; a sync is sent again, an interactive one is not.
 * - AniList's X-RateLimit headers set the pace and pause it when few requests remain.
 * - Other hosts (media servers, image CDNs) are not touched.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { installTrackerGate, withTrackerPriority, TrackerBusyError, ApiPace, TrackerApi } from '../src/common/http/tracker-gate';

const fast: ApiPace = { limit: 3, windowMs: 400, minGapMs: 20, penaltyMs: 300 };
const pace: Record<TrackerApi, ApiPace> = { anilist: fast, mal: fast, kitsu: fast, jikan: fast };

type Answer = { status: number; headers?: Record<string, string> };
let answer: (url: string) => Answer = () => ({ status: 200 });
const hits: Array<{ url: string; at: number }> = [];
const http = axios.create({
  adapter: async (config) => {
    hits.push({ url: config.url!, at: Date.now() });
    const { status, headers = {} } = answer(config.url!);
    const response = { data: {}, status, statusText: String(status), headers, config, request: {} };
    if (status >= 400) throw new axios.AxiosError('fail', String(status), config, {}, response as any);
    return response as any;
  },
});
const lanes = installTrackerGate(http, pace);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Pace: 6 requests with a limit of 3 per 400 ms -> the 4th waits for the window.
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 6 }, (_, i) => http.get(`https://graphql.anilist.co/?n=${i}`)));
  const at = hits.map((h) => h.at - t0);
  assert.ok(at[1] - at[0] >= 15 && at[2] - at[1] >= 15, `minimum gap between requests (${at})`);
  assert.ok(at[3] >= 380, `the 4th waits for the window (${at})`);

  // Priorities: queued while the API is paused, released in priority order.
  hits.length = 0;
  lanes.get('anilist')!.pause(150);
  const order: string[] = [];
  const queued = (priority: 'sync' | 'interactive' | 'background', name: string) =>
    withTrackerPriority(priority, () => http.get(`https://graphql.anilist.co/?${name}`).then(() => order.push(name)));
  await Promise.all([queued('background', 'bg'), queued('interactive', 'ui'), queued('sync', 'sync')]);
  assert.deepEqual(order, ['sync', 'ui', 'bg'], 'sync first, then the user, then background');

  // Maximum wait: during a long pause an interactive request gives up.
  await sleep(450);
  lanes.get('mal')!.pause(2000);
  await assert.rejects(
    withTrackerPriority('interactive', () => http.get('https://api.myanimelist.net/v2/x'), 100),
    (e: any) => e instanceof TrackerBusyError && /MyAnimeList is busy/.test(e.message),
  );

  // 429 with Retry-After: a sync waits and is sent again; an interactive request fails.
  let kitsuCalls = 0;
  answer = (url) => (url.includes('kitsu') && ++kitsuCalls === 1 ? { status: 429, headers: { 'retry-after': '0.2' } } : { status: 200 });
  const r0 = Date.now();
  const synced = await withTrackerPriority('sync', () => http.get('https://kitsu.io/api/edge/library-entries'));
  assert.equal(synced.status, 200);
  assert.equal(kitsuCalls, 2, 'the sync was sent again');
  assert.ok(Date.now() - r0 >= 180, 'after the Retry-After');
  kitsuCalls = 0;
  await sleep(450);
  await assert.rejects(http.get('https://kitsu.io/api/edge/anime'), (e: any) => e.response?.status === 429, 'interactive: not sent again');
  assert.equal(kitsuCalls, 1);
  answer = () => ({ status: 200 });

  // AniList headers: the limit follows X-RateLimit-Limit minus the margin; few left -> pause.
  await sleep(450);
  answer = () => ({ status: 200, headers: { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '9' } });
  await http.get('https://graphql.anilist.co/');
  assert.equal(lanes.get('anilist')!.status().limitPerWindow, 7);
  answer = () => ({ status: 200, headers: { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '1' } });
  await http.get('https://graphql.anilist.co/');
  assert.ok(lanes.get('anilist')!.status().pausedForMs > 20_000, 'one request left: paused instead of earning a block');
  answer = () => ({ status: 200 });

  // Other hosts go straight through, even with AniList paused.
  const o0 = Date.now();
  await http.get('https://s4.anilist.co/file/cover.jpg');
  await http.get('http://media.example:8096/Sessions');
  assert.ok(Date.now() - o0 < 100, 'CDNs and media servers are not gated');

  console.log('OK: tracker APIs are paced, prioritised, bounded in wait, and back off on 429');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
