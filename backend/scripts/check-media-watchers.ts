/**
 * Check that the Jellyfin and Emby watchers hand a scrobble over without waiting for it.
 *
 *     npx ts-node -T scripts/check-media-watchers.ts
 *
 * Runs the REAL `pollServerSessions` of both watchers with the server's /Sessions answer
 * faked (axios is replaced); it touches neither the database nor the network.
 *
 * Syncing to the trackers can wait its turn with their rate limits; a watcher that
 * waited for it would stop polling every other server meanwhile.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { JellyfinWatcherService } from '../src/modules/jellyfin/jellyfin-watcher.service';
import { EmbyWatcherService } from '../src/modules/emby/emby-watcher.service';

(axios as any).get = async () => ({
  data: [{
    Id: 'session-1',
    UserName: 'alice',
    PlayState: { PositionTicks: 95, IsPaused: false },
    NowPlayingItem: { Id: 'item-1', Type: 'Episode', SeriesName: 'Show', Name: 'Ep', IndexNumber: 3, ParentIndexNumber: 1, RunTimeTicks: 100 },
  }],
});

const user = { id: 'u1', username: 'alice', webhookToken: 'whk_alice', settings: { completionPercentage: 85 }, blacklist: [] };
const conn = { id: 'c1', serverUrl: 'http://media.example:8096', encryptedApiKey: 'x', jellyfinUsername: 'alice', embyUsername: 'alice', user };
const settle = () => new Promise((r) => setTimeout(r, 50));

async function check(name: string, Watcher: any) {
  const calls: string[] = [];
  let answer: () => Promise<unknown> = () => new Promise(() => {});
  const service = {
    validateUserServerTarget: async (url: string) => ({ url }),
    handleWebhook: (token: string) => { calls.push(token); return answer(); },
  };
  const watcher = new Watcher({ user: { findFirst: async () => null } }, { decrypt: () => 'key' }, service);
  const poll = () => watcher.pollServerSessions(conn);

  const finished = await Promise.race([poll().then(() => true), new Promise((r) => setTimeout(() => r(false), 2000))]);
  assert.equal(finished, true, `${name}: the poll finishes while the sync is still waiting`);
  await poll();
  assert.equal(calls.length, 1, `${name}: a scrobble on its way is not sent twice`);

  // Ignored (e.g. a library that is not monitored): tried again on the next poll, as before.
  calls.length = 0;
  (watcher as any).sessionsMap.clear();
  answer = async () => ({ ignored: true });
  await poll();
  await settle();
  await poll();
  assert.equal(calls.length, 2, `${name}: an ignored scrobble is tried again`);

  // Done: not sent again.
  calls.length = 0;
  (watcher as any).sessionsMap.clear();
  answer = async () => ({ success: true });
  await poll();
  await settle();
  await poll();
  assert.equal(calls.length, 1, `${name}: a finished scrobble is not sent again`);
}

async function main() {
  await check('Jellyfin', JellyfinWatcherService);
  await check('Emby', EmbyWatcherService);
  console.log('OK: Jellyfin and Emby watchers hand scrobbles over without waiting, once each');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
