/**
 * Check that the cover URL always carries the title hint.
 *
 *     npx ts-node -T scripts/check-covers.ts
 *
 * `/api/covers` resolves in a chain: AniList, Kitsu's external mapping and,
 * last, a title search on Kitsu. The last step needs the title and is the only
 * one that works when AniList does not answer. Without the hint, the cover
 * falls back to the placeholder without any error.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { anilistCoverUrl } from '../src/modules/covers/covers.service';

const url = anilistCoverUrl(50040, 'Super no Ura de Yani Suu Futari');
assert.ok(url.includes('title='), 'the URL has no title hint');
assert.ok(
  url.includes('Super%20no%20Ura'),
  `the title is not URL-encoded: ${url}`,
);
assert.equal(
  anilistCoverUrl(50040),
  '/api/covers/al_50040',
  'without a title there must be no empty title=, which is no hint and breaks the cache',
);

// Look for cover URLs built by hand outside the helper.
const root = path.resolve(__dirname, '..', 'src', 'modules');
const handWritten: string[] = [];

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    // The cover service itself and its controller do handle the raw form.
    if (full.includes(`covers${path.sep}`)) continue;

    const source = fs.readFileSync(full, 'utf8');
    for (const line of source.split('\n')) {
      // `al_` built by hand with no hint on the same line.
      if (/\/api\/covers\/al_/.test(line) && !/title=/.test(line)) {
        handWritten.push(`${path.relative(root, full)}: ${line.trim()}`);
      }
    }
  }
}

walk(root);

assert.deepEqual(
  handWritten,
  [],
  'these lines build the cover URL by hand without the title hint:\n' +
    handWritten.map((l) => `  ${l}`).join('\n') +
    '\nUse anilistCoverUrl(id, title) from covers.service.ts.',
);

console.log('covers: OK (the title hint travels and no URL is built by hand)');
