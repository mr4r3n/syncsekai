/**
 * Records what the API answers for the demo user; /demo replays it.
 *
 *     SEED_DEMO_PASSWORD=... node scripts/record-demo-data.mjs [http://localhost:4000]
 *
 * Run against the LOCAL test instance after backend/scripts/seed-demo-user.ts.
 * Keys are the endpoints exactly as the panel requests them; lib/demo.ts
 * normalizes them when it looks one up. Fails if the recording contains an IP,
 * an email or a token that is not the demo's own placeholder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.argv[2] || 'http://localhost:4000';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'demo-data.json');
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) throw new Error('Set SEED_DEMO_PASSWORD (the one used by seed-demo-user.ts).');

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
  body: JSON.stringify({ email: 'demo@syncsekai.local', password }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

const data = {};
async function record(endpoint) {
  let res;
  for (let attempt = 0; attempt < 10; attempt++) {
    res = await fetch(API + endpoint, { headers: { cookie, 'User-Agent': UA, 'X-Requested-With': 'SyncSekai' } });
    if (res.status !== 429) break; // franchise lookups are throttled to 10 per minute
    await new Promise((r) => setTimeout(r, 15_000));
  }
  if (!res.ok) throw new Error(`${endpoint}: ${res.status}`);
  data[endpoint] = await res.json();
  return data[endpoint];
}

// Chrome of the panel
for (const e of ['/api/auth/me', '/api/setup/maintenance-status',
  '/api/notifications/unread-count', '/api/notifications?limit=20', '/api/connections/hub']) await record(e);
// No announcement: a recorded one would be the local instance's, shown to every visitor for good.
data['/api/announcements/active'] = null;

// Catalog: every tab (the server filters by status), and the detail of every anime
const all = await record('/api/catalog/user?page=1&limit=32&provider=LOCAL');
for (const status of ['CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED_DROPPED']) {
  await record(`/api/catalog/user?page=1&limit=32&status=${status}&provider=LOCAL`);
}
await record('/api/catalog/stats');
await record('/api/catalog/favorites');
for (const item of all.items || []) {
  const q = new URLSearchParams();
  if (item.anilistId) q.set('anilistId', String(item.anilistId));
  if (item.malId) q.set('malId', String(item.malId));
  q.set('provider', 'LOCAL');
  await record(`/api/catalog/franchise?${q}`);
}

// History: every page, plus its statistics
const first = await record('/api/history?page=1&limit=30');
for (let p = 2; p <= (first.totalPages || 1); p++) await record(`/api/history?page=${p}&limit=30`);
await record('/api/history/stats/summary');
await record('/api/history/stats/heatmap');

await record('/api/mappings');

// The demo servers do not exist, so the backend could not list their libraries:
// these follow the shape plex.service.ts and jellyfin.service.ts return.
const hub = data['/api/connections/hub'];
const library = (key, title, type, path) => ({ id: key, key, title, type, path, monitored: false });
const libraries = {
  plex: [library('1', 'Anime', 'show', '/data/anime'), library('2', 'Movies', 'movie', '/data/movies'), library('3', 'TV Shows', 'show', '/data/tv')],
  jellyfin: [library('a1f3', 'Anime', 'tvshows', '/media/anime'), library('b7c2', 'Anime Movies', 'movies', '/media/anime-movies')],
};
for (const server of Object.keys(libraries)) if (hub[server]) hub[server].availableLibraries = libraries[server];
// lib/demo.ts moves every activity date forward by the time elapsed since now.
data.__recordedAt = new Date().toISOString();

// Placeholders instead of the demo account's real identifiers, wherever they appear
// (the connections hub, for instance, shows the webhook URL with the token in it).
const me = data['/api/auth/me'];
const u = me.user || me;
let text = JSON.stringify(data);
for (const [real, placeholder] of [[u.email, 'hikari@example.com'], [u.userToken, 'usr_live_demo'], [u.webhookToken, 'whk_live_demo']]) {
  if (real) text = text.split(real).join(placeholder);
}
// Recorded locally: the webhook URLs point at the local instance.
text = text.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g, 'https://syncsekai.com');
const leaks = [
  ...text.matchAll(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g),
  ...text.matchAll(/[\w.+-]+@(?!example\.com)[\w-]+\.[\w.]+/g),
  ...text.matchAll(/(usr|whk|ses)_live_(?!demo\b)\w+/g),
  ...text.matchAll(/localhost/g),
].map((m) => m[0]);
if (leaks.length) throw new Error(`the recording contains private data: ${[...new Set(leaks)].join(', ')}`);

fs.writeFileSync(OUT, text);
console.log(`demo data: ${Object.keys(data).length} responses, ${(text.length / 1024).toFixed(0)} KB -> ${path.relative(process.cwd(), OUT)}`);
