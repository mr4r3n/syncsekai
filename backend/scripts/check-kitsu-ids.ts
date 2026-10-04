/**
 * Check that the Kitsu entry comes from the MAL/AniList id, not from the title.
 *
 *     npx ts-node -T scripts/check-kitsu-ids.ts
 *
 * Runs the REAL KitsuService.findByExternalIds with Kitsu's answers faked (axios is
 * replaced); it touches neither the database nor the network.
 *
 * Searching by title returns the first season for every sequel, so "Clevatess II"
 * synced on "Clevatess" (season 1).
 */
import assert from 'node:assert/strict';
import axios from 'axios';
import { KitsuService } from '../src/modules/kitsu/kitsu.service';

// Kitsu mappings: MAL 100 -> Kitsu 7 (season 2); AniList 200 -> Kitsu 8; nothing else.
const kitsuMappings: Record<string, { id: string; title: string }> = {
  'myanimelist/anime:100': { id: '7', title: 'Show Season 2' },
  'anilist/anime:200': { id: '8', title: 'Other Show' },
};
const requested: string[] = [];
(axios as any).get = async (url: string) => {
  const site = /filter\[externalSite\]=([^&]+)/.exec(url)?.[1];
  const id = /filter\[externalId\]=(\d+)/.exec(url)?.[1];
  requested.push(`${site}:${id}`);
  const hit = kitsuMappings[`${site}:${id}`];
  return { data: { data: hit ? [{}] : [], included: hit ? [{ type: 'anime', id: hit.id, attributes: { canonicalTitle: hit.title } }] : [] } };
};

async function main() {
  const kitsu = new KitsuService({} as any, {} as any, {} as any);

  assert.deepEqual(await kitsu.findByExternalIds(100, 200), { kitsuId: 7, title: 'Show Season 2' }, 'MAL id first');
  assert.deepEqual(requested, ['myanimelist/anime:100']);

  assert.deepEqual(await kitsu.findByExternalIds(999, 200), { kitsuId: 8, title: 'Other Show' }, 'AniList id when MAL has no mapping');
  assert.equal(await kitsu.findByExternalIds(999, 998), null, 'nothing found: no guess');
  assert.equal(await kitsu.findByExternalIds(null, undefined), null);

  requested.length = 0;
  await kitsu.findByExternalIds(100, null);
  assert.deepEqual(requested, [], 'a found entry is cached');

  console.log('OK: Kitsu entries come from the MAL/AniList id (season-exact), cached, never guessed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
