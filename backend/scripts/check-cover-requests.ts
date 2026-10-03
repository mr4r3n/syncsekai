/**
 * Check that the public cover endpoint cannot be used to fill the disk or to make
 * the server hammer AniList, Kitsu and Jikan.
 *
 *     npx ts-node -T scripts/check-cover-requests.ts
 *
 * Exercises the REAL CoversController with the real key and CDN checks of
 * CoversService and fake disk/network methods. It touches neither.
 */
import assert from 'node:assert/strict';
import { CoversController } from '../src/modules/covers/covers.controller';
import { CoversService } from '../src/modules/covers/covers.service';

let downloads = 0;
let lookups = 0;
const service = Object.create(CoversService.prototype) as CoversService;
Object.assign(service, {
  getFilePath: () => null,
  downloadAndSaveCover: async () => { downloads++; return null; },
  fetchAndCacheOnDemand: async () => { lookups++; return null; },
});
const controller = new CoversController(service);

function call(key: string, ip: string, fallback?: string) {
  let location = '';
  const res: any = {
    redirect: (url: string) => { location = url; },
    status: () => ({ send: () => { location = 'status'; } }),
  };
  const req: any = { headers: {}, socket: { remoteAddress: ip } };
  return controller.getCover(key, undefined, fallback, req, res).then(() => location);
}

async function main() {
  const cdn = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg';

  await call('../../etc/passwd', '203.0.113.1', cdn);
  await call('anything_at_all', '203.0.113.1', cdn);
  assert.equal(downloads + lookups, 0, 'keys the app never builds are not downloaded');

  for (let i = 0; i < 150; i++) await call(`al_${i}`, '203.0.113.2', cdn);
  assert.equal(downloads, 150, 'covers not on disk yet are fetched, up to the limit');
  const over = await call('al_999', '203.0.113.2', cdn);
  assert.equal(over, cdn, 'over the limit the browser goes to the CDN itself');
  assert.equal(downloads, 150, 'and the server downloads nothing more');

  await call('al_1000', '203.0.113.3', cdn);
  assert.equal(downloads, 151, 'the limit is per visitor');

  await call('title_0123456789abcdef', '203.0.113.4');
  assert.equal(lookups, 1, 'title keys still resolve on demand');

  console.log('OK: cover requests are limited to real keys and a per-visitor budget');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
