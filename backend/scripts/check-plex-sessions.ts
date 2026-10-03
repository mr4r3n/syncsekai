/**
 * Check that the Plex watcher scrobbles each playback exactly once.
 *
 *     npx ts-node -T scripts/check-plex-sessions.ts
 *
 * Runs the REAL `pollServerSessions` of PlexWatcherService against fake Plex
 * servers (axios is replaced) and counts the scrobbles it hands to the webhook
 * pipeline. It touches neither the database nor the network.
 *
 * - Plex numbers sessions per server, so two servers can both have session "1":
 *   both playbacks must scrobble.
 * - Several accounts connected to the same Plex see the same session: it must
 *   scrobble once, not once per account.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { PlexWatcherService } from '../src/modules/plex/plex-watcher.service';

const sessionsByHost: Record<string, any[]> = {};
(axios as any).get = async (url: string) => ({
  data: { MediaContainer: { Metadata: sessionsByHost[new URL(url).host] || [] } },
});

const scrobbles: string[] = [];
const user = (name: string) => ({ id: name, username: name, webhookToken: `whk_${name}`, settings: { completionPercentage: 85 }, blacklist: [] });
const watcher = new PlexWatcherService(
  { user: { findFirst: async () => null } } as any,
  { decrypt: () => 'token' } as any,
  { validateUserServerTarget: async (url: string) => ({ url }) } as any,
  { handleWebhook: async (token: string) => { scrobbles.push(token); } } as any,
);
const poll = (conn: any) => (watcher as any).pollServerSessions(conn);
const playing = (title: string, owner: string) => ({
  sessionKey: '1', grandparentTitle: title, index: 3, parentIndex: 1, viewOffset: 23 * 60000, duration: 24 * 60000,
  type: 'episode', User: { title: owner }, Player: { state: 'playing' },
});

async function main() {
  // Two different servers, each with its own session "1".
  sessionsByHost['a.example:32400'] = [playing('Show A', 'alice')];
  sessionsByHost['b.example:32400'] = [playing('Show B', 'bob')];
  await poll({ serverUrl: 'http://a.example:32400', encryptedAuthToken: 'x', plexUsername: 'alice', user: user('alice') });
  await poll({ serverUrl: 'http://b.example:32400', encryptedAuthToken: 'x', plexUsername: 'bob', user: user('bob') });
  assert.deepEqual(scrobbles.sort(), ['whk_alice', 'whk_bob'], 'same session number on two servers: both scrobble');

  // Three accounts on one server, polled in the same round and again in the next one.
  scrobbles.length = 0;
  sessionsByHost['c.example:32400'] = [playing('Show C', 'carol')];
  const carol = { serverUrl: 'http://c.example:32400', encryptedAuthToken: 'x', plexUsername: 'carol', user: user('carol') };
  for (let round = 0; round < 2; round++) {
    await Promise.allSettled([poll(carol), poll({ ...carol }), poll({ ...carol })]);
  }
  assert.deepEqual(scrobbles, ['whk_carol'], 'one playback on a shared server scrobbles once');

  await watcher.onModuleDestroy?.();
  console.log('OK: each Plex playback scrobbles once, per server');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
