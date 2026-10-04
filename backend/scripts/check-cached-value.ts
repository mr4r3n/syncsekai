/**
 * Check the short server cache used for what every visitor asks (common/cached-value.ts).
 *
 *     npx ts-node -T scripts/check-cached-value.ts
 *
 * - Within its lifetime the value is not loaded again; expired, it is.
 * - Requests arriving together share one load.
 * - A load that fails is not kept: the next request tries again.
 * - clear() after a change: a load that started before it is not kept, so nobody is served
 *   the old value for the whole lifetime.
 */
import assert from 'node:assert/strict';
import { CachedValue } from '../src/common/cached-value';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let loads = 0;
  const cache = new CachedValue<number>(100);
  const load = async () => {
    loads++;
    await sleep(20);
    return loads;
  };

  const together = await Promise.all([cache.get(load), cache.get(load), cache.get(load)]);
  assert.deepEqual(together, [1, 1, 1], 'requests arriving together share one load');
  assert.equal(await cache.get(load), 1, 'within its lifetime: not loaded again');
  await sleep(120);
  assert.equal(await cache.get(load), 2, 'expired: loaded again');

  const failing = new CachedValue<number>(1000);
  await assert.rejects(failing.get(async () => { throw new Error('database down'); }));
  assert.equal(await failing.get(async () => 7), 7, 'a failed load is not kept');

  // A change lands while an older load is still on its way.
  let value = 'old';
  const slow = new CachedValue<string>(10_000);
  const inFlight = slow.get(async () => {
    const read = value;
    await sleep(50);
    return read;
  });
  value = 'new';
  slow.clear();
  assert.equal(await inFlight, 'old', 'the request already waiting gets what it read');
  assert.equal(await slow.get(async () => value), 'new', 'but the next one reads the change, not the stale load');

  console.log('OK: shared loads, lifetime, failures not kept, clear() wins over an older load');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
