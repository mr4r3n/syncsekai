/**
 * Check how the media server watchers schedule their polls (common/watch/poll-schedule.ts).
 *
 *     npx ts-node -T scripts/check-poll-schedule.ts
 *
 * Pure parts with explicit clocks, then the REAL Jellyfin watcher (the Emby one is the
 * same code) with its database and servers faked (axios is replaced).
 * - A busy server is polled again in 5 s, an idle one in 15 s, a failing one later and
 *   later (15 s, 30 s, 1 min… up to 5 min) until it answers.
 * - At most 25 servers at a time, and one failing does not stop the others.
 * - The connections are read once per 30 s, not every round.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { PollSchedule, runPool, POLL_CONCURRENCY } from '../src/common/watch/poll-schedule';
import { CachedValue } from '../src/common/cached-value';
import { JellyfinWatcherService } from '../src/modules/jellyfin/jellyfin-watcher.service';

async function main() {
  // Schedule
  const s = new PollSchedule();
  const t = 1_000_000;
  assert.ok(s.due('a', t), 'a new server is due at once');
  s.record('a', 'playing', t);
  assert.ok(!s.due('a', t + 4_999) && s.due('a', t + 5_000), 'busy: again in 5 s');
  s.record('a', 'idle', t);
  assert.ok(!s.due('a', t + 14_999) && s.due('a', t + 15_000), 'idle: again in 15 s');
  const waits: number[] = [];
  for (let i = 0; i < 7; i++) {
    s.record('b', 'failed', t);
    let wait = 0;
    while (!s.due('b', t + wait)) wait += 1000;
    waits.push(wait / 1000);
  }
  assert.deepEqual(waits, [15, 30, 60, 120, 240, 300, 300], 'failing: 15 s, 30 s, 1 min… up to 5 min');
  s.record('b', 'idle', t);
  assert.ok(s.due('b', t + 15_000), 'one success brings it back to normal');

  // Pool
  let active = 0;
  let peak = 0;
  const done: number[] = [];
  await runPool(Array.from({ length: 100 }, (_, i) => i), POLL_CONCURRENCY, async (i) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    if (i === 3) throw new Error('one server fails');
    done.push(i);
  });
  assert.equal(peak, POLL_CONCURRENCY, 'at most 25 at a time');
  assert.equal(done.length, 99, 'a failure does not stop the others');

  // Cached connections
  let loads = 0;
  const cached = new CachedValue<number>(30_000);
  await cached.get(async () => ++loads);
  await cached.get(async () => ++loads);
  assert.equal(loads, 1, 'read once within 30 s');

  // The real watcher: three servers (busy, idle, down) and two rounds in a row.
  const asked: string[] = [];
  (axios as any).get = async (url: string) => {
    const host = new URL(url).hostname;
    asked.push(host);
    if (host === 'down.example') throw new Error('ETIMEDOUT');
    return { data: host === 'busy.example' ? [{ Id: 's', UserName: 'u', PlayState: { PositionTicks: 10 }, NowPlayingItem: { Id: 'i', SeriesName: 'Show', IndexNumber: 1, RunTimeTicks: 100 } }] : [] };
  };
  let findMany = 0;
  const user = { id: 'u', username: 'u', webhookToken: 'whk_u', settings: { completionPercentage: 85 }, blacklist: [] };
  const conn = (id: string, host: string) => ({ id, serverUrl: `http://${host}:8096`, encryptedApiKey: 'x', jellyfinUsername: 'u', user });
  const watcher: any = new JellyfinWatcherService(
    {
      jellyfinConnection: { findMany: async () => (findMany++, [conn('busy', 'busy.example'), conn('idle', 'idle.example'), conn('down', 'down.example')]) },
      user: { findFirst: async () => null },
    } as any,
    { decrypt: () => 'key' } as any,
    { validateUserServerTarget: async (u: string) => ({ url: u }), handleWebhook: async () => ({}) } as any,
  );
  const before = Date.now();
  await watcher.pollAllServers();
  assert.deepEqual(asked.sort(), ['busy.example', 'down.example', 'idle.example'], 'first round: every server');
  asked.length = 0;
  await watcher.pollAllServers();
  assert.deepEqual(asked, [], 'second round right after: nobody is due yet');
  assert.equal(findMany, 1, 'the connections were read once');
  const next = (id: string) => watcher.schedule.next.get(id) - before;
  assert.ok(next('busy') >= 5_000 && next('busy') < 6_000, 'busy server: 5 s');
  assert.ok(next('idle') >= 15_000 && next('idle') < 16_000, 'idle server: 15 s');
  assert.ok(next('down') >= 15_000 && watcher.schedule.failures.get('down') === 1, 'server down: backing off');

  console.log('OK: busy 5 s, idle 15 s, failing backs off to 5 min; 25 at a time; connections read every 30 s');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
