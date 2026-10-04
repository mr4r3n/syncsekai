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

// Mappings: one page per tab, as the page asks for it; searching filters the recorded tab;
// the whole list stays for the export.
const mappingsTab = (status, extra = '') => answer(table, `/api/mappings?page=1&limit=25&status=${status}${extra}`);
const everyMapping = answer(table, '/api/mappings');
assert.ok(Array.isArray(everyMapping) && everyMapping.length > 0, 'export: the whole list');
assert.equal(mappingsTab('ALL').total, everyMapping.length);
assert.ok(mappingsTab('APPROVED').items.every((m) => m.isApproved));
assert.ok(mappingsTab('PENDING').items.every((m) => !m.isApproved));
assert.equal(mappingsTab('ALL', '&limit=10').items.length, mappingsTab('ALL').items.length, 'another page size: the recorded page');
const word = everyMapping[0].plexTitle.split(' ')[0];
const searched = mappingsTab('ALL', `&search=${encodeURIComponent(word)}`);
assert.ok(searched.items.length > 0 && searched.items.every((m) => JSON.stringify(m).toLowerCase().includes(word.toLowerCase())));
assert.equal(searched.total, searched.items.length);
assert.equal(searched.counts.all, everyMapping.length, 'the tab counts stay those of the whole list');

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
