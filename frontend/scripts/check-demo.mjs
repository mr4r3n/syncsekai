/**
 * Checks what /demo answers from the recording (src/lib/demo.ts):
 *
 *     node --experimental-strip-types scripts/check-demo.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, shiftDates, answer, demoResponse } from '../src/lib/demo.ts';

const { __recordedAt, ...data } = JSON.parse(fs.readFileSync(new URL('../src/lib/demo-data.json', import.meta.url), 'utf8'));
const table = new Map(Object.entries(data).map(([k, v]) => [normalize(k), v]));

// Recorded requests resolve, whatever the provider or page size.
assert.ok(answer(table, '/api/auth/me'));
assert.equal(answer(table, '/api/catalog/user?provider=JELLYFIN&limit=12&page=1').items.length, 20);
assert.equal(answer(table, '/api/history?page=2&limit=30').page, 2);

// Searches filter the recorded list and fix its totals.
const found = answer(table, '/api/catalog/user?page=1&limit=32&provider=LOCAL&search=FRIEREN');
assert.equal(found.items.length, 1);
assert.match(JSON.stringify(found.items[0]), /Frieren/);
assert.equal(answer(table, '/api/catalog/user?page=1&limit=32&search=zzzz').items.length, 0);

// No announcement is recorded: it would be the local instance's.
assert.equal(answer(table, '/api/announcements/active'), null);

// Anything else is not in the demo, and nothing is ever written.
assert.equal(answer(table, '/api/admin/users'), undefined);
await assert.rejects(demoResponse('/api/catalog/favorites', 'POST'), /demo/);

// Dates move forward; the answers are copies, so the recording stays intact.
assert.deepEqual(shiftDates({ at: '2026-01-01T10:00:00.000Z', day: '2026-01-01', n: 5 }, 2 * 86_400_000),
  { at: '2026-01-03T10:00:00.000Z', day: '2026-01-03', n: 5 });
answer(table, '/api/auth/me').mutated = true;
assert.equal(answer(table, '/api/auth/me').mutated, undefined);

console.log('demo: ok');
