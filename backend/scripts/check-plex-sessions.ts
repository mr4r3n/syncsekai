/**
 * Check how the Plex watcher reaches servers and scrobbles their playbacks.
 *
 *     npx ts-node -T scripts/check-plex-sessions.ts
 *
 * Runs the REAL `pollServerSessions` of PlexWatcherService and `findServerAccess` of
 * PlexService against fake Plex servers (axios is replaced) and fake plex.tv answers.
 * It touches neither the database nor the network.
 *
 * - The account token (it opens the user's whole Plex account) never reaches a
 *   server: the server's own token from plex.tv does, https only.
 * - Plex numbers sessions per server, so two servers can both have session "1":
 *   both playbacks scrobble. One server reached through different addresses by
 *   several accounts: its playback scrobbles once.
 * - A server whose address stops answering (home IP changed) is looked up again
 *   and its new address saved.
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { PlexWatcherService } from '../src/modules/plex/plex-watcher.service';
import { PlexService } from '../src/modules/plex/plex.service';

const sessionsByHost: Record<string, any[]> = {};
const sent: Array<{ host: string; token: string }> = [];
(axios as any).get = async (url: string, config: any) => {
  const host = new URL(url).host;
  sent.push({ host, token: config?.headers?.['X-Plex-Token'] });
  if (!(host in sessionsByHost)) throw new Error('ETIMEDOUT');
  return { data: { MediaContainer: { Metadata: sessionsByHost[host] } } };
};

const HASH = '0123456789abcdef0123456789abcdef';
const at = (address: string, port: number) => `https://${address}.${HASH}.plex.direct:${port}`;

const scrobbles: string[] = [];
const updates: any[] = [];
const lookups: string[] = [];
// What plex.tv says about a stored URL (stands in for PlexService.findServerAccess).
let resolve: (url: string) => { url: string; token: string } | 'stored-token' | null = (url) =>
  url.includes('.plex.direct') ? { url, token: 'server-token' } : 'stored-token';
const user = (name: string) => ({ id: name, username: name, webhookToken: `whk_${name}`, settings: { completionPercentage: 85 }, blacklist: [] });
const watcher = new PlexWatcherService(
  { user: { findFirst: async () => null }, plexConnection: { update: async (q: any) => { updates.push(q); } } } as any,
  { decrypt: () => 'stored-token-value' } as any,
  {
    validateUserServerTarget: async (url: string) => ({ url }),
    findServerAccess: async (url: string) => { lookups.push(url); return resolve(url); },
  } as any,
  { handleWebhook: (token: string) => webhook(token) } as any,
);
let webhook: (token: string) => Promise<unknown> = async (token) => { scrobbles.push(token); };
const poll = (conn: any) => (watcher as any).pollServerSessions(conn);
const tenMinutesPass = () => (watcher as any).lastLookup.clear();
const playing = (title: string, owner: string) => ({
  sessionKey: '1', grandparentTitle: title, index: 3, parentIndex: 1, viewOffset: 23 * 60000, duration: 24 * 60000,
  type: 'episode', User: { title: owner }, Player: { state: 'playing' },
});
const conn = (id: string, serverUrl: string, name: string) => ({ id, serverUrl, encryptedAuthToken: 'x', plexUsername: name, user: user(name) });

async function main() {
  // Two different servers (typed in by hand), each with its own session "1".
  sessionsByHost['a.example:32400'] = [playing('Show A', 'alice')];
  sessionsByHost['b.example:32400'] = [playing('Show B', 'bob')];
  await poll(conn('a', 'http://a.example:32400', 'alice'));
  await poll(conn('b', 'http://b.example:32400', 'bob'));
  assert.deepEqual(scrobbles.sort(), ['whk_alice', 'whk_bob'], 'same session number on two servers: both scrobble');
  assert.ok(sent.every((s) => s.token === 'stored-token-value'), 'a server typed in by hand gets the token given for it');

  // One server reached by three accounts through its local and relay addresses, polled twice.
  scrobbles.length = 0;
  sent.length = 0;
  sessionsByHost[new URL(at('10-0-0-5', 32400)).host] = [playing('Show C', 'carol')];
  sessionsByHost[new URL(at('45-79-1-2', 8443)).host] = [playing('Show C', 'carol')];
  for (let round = 0; round < 2; round++) {
    await Promise.allSettled([
      poll(conn('c1', at('10-0-0-5', 32400), 'carol')),
      poll(conn('c2', at('45-79-1-2', 8443), 'carol')),
      poll(conn('c3', at('10-0-0-5', 32400), 'carol')),
    ]);
  }
  assert.deepEqual(scrobbles, ['whk_carol'], 'one playback on one server scrobbles once, whatever the address');
  assert.ok(sent.length > 0 && sent.every((s) => s.token === 'server-token'), 'plex.direct servers only ever get the server token');

  // Nothing safe to use (plex.tv down, server unshared): nothing is sent at all.
  sent.length = 0;
  resolve = () => null;
  await poll(conn('e', at('7-7-7-7', 32400), 'erin'));
  assert.equal(sent.length, 0, 'no token is sent when plex.tv cannot vouch for one');

  // The saved address goes dark: after three failures and the 10-minute wait, the new one is saved.
  const oldUrl = at('1-2-3-4', 32400);
  const newUrl = at('5-6-7-8', 32400);
  resolve = (url) => ({ url, token: 'server-token' });
  const dark = conn('d', oldUrl, 'dave');
  await poll(dark);
  await poll(dark);
  await poll(dark);
  lookups.length = 0;
  await poll(dark);
  assert.equal(lookups.length, 0, 'within 10 minutes plex.tv is not asked again');
  tenMinutesPass();
  resolve = () => ({ url: newUrl, token: 'server-token' });
  sessionsByHost[new URL(newUrl).host] = [];
  sent.length = 0;
  await poll(dark);
  assert.deepEqual(updates, [{ where: { id: 'd' }, data: { serverUrl: newUrl } }], 'the new address is saved');
  assert.deepEqual(sent, [{ host: new URL(newUrl).host, token: 'server-token' }], 'and used in the same poll');

  // A sync still waiting for the trackers' rate limits does not hold the poll.
  scrobbles.length = 0;
  resolve = () => 'stored-token';
  webhook = (token) => { scrobbles.push(token); return new Promise(() => {}); };
  sessionsByHost['slow.example:32400'] = [playing('Show S', 'sam')];
  const finished = await Promise.race([
    poll(conn('s', 'http://slow.example:32400', 'sam')).then(() => true),
    new Promise((r) => setTimeout(() => r(false), 2000)),
  ]);
  assert.equal(finished, true, 'the poll finishes while the sync is still waiting');
  assert.deepEqual(scrobbles, ['whk_sam'], 'and the scrobble was handed over');

  // findServerAccess itself.
  const plex = Object.create(PlexService.prototype) as PlexService;
  let resources: any = [];
  const answering = new Set([at('9-9-9-9', 32400), at('45-79-1-2', 8443)]);
  Object.assign(plex, {
    encryptionService: { decrypt: () => 'account-token' },
    loadResources: async () => resources,
    fetchLibrariesFromPMS: async (uri: string, token: string) => (answering.has(uri) && token === 'home-server-token' ? [{ title: 'Anime' }] : []),
  });
  const home = (accessToken: string) => ({ name: 'Home', owned: false, accessToken, connections: [
    { uri: at('45-79-1-2', 8443), relay: true },
    { uri: at('9-9-9-9', 32400).replace('https://', 'http://'), relay: false },
    { uri: at('9-9-9-9', 32400), relay: false },
  ] });
  resources = [{ name: 'Other', accessToken: 'other', connections: [{ uri: 'https://1-1-1-1.ffffffffffffffffffffffffffffffff.plex.direct:32400', relay: false }] }, home('home-server-token')];
  assert.deepEqual(await plex.findServerAccess(oldUrl, 'x'), { url: at('9-9-9-9', 32400), token: 'home-server-token' },
    'the direct https address of the same server, with its own token');
  answering.delete(at('9-9-9-9', 32400));
  assert.equal(((await plex.findServerAccess(oldUrl, 'x')) as any)?.url, at('45-79-1-2', 8443), 'the relay when no direct address answers');
  resources = [home('')];
  assert.equal(await plex.findServerAccess(oldUrl, 'x'), null, 'a shared server with no token of its own gets nothing');
  resources = [];
  assert.equal(await plex.findServerAccess(oldUrl, 'x'), null, 'a server plex.tv does not list');
  resources = 'unavailable';
  assert.equal(await plex.findServerAccess(oldUrl, 'x'), null, 'plex.tv down: nothing');
  resources = 'refused';
  assert.equal(await plex.findServerAccess(oldUrl, 'x'), 'stored-token', 'plex.tv refuses it: not an account token');
  assert.equal(await plex.findServerAccess('http://192.0.2.10:32400', 'x'), 'stored-token', 'a URL typed in by hand');

  await watcher.onModuleDestroy?.();
  console.log('OK: servers get only their own token, each playback scrobbles once, moved servers are found again');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
