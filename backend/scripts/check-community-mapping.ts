/**
 * Check the community consensus rule.
 *
 *     npx ts-node -T scripts/check-community-mapping.ts
 *
 * A wrong rule is silent: one stubborn user would push their answer on
 * everyone, or a disagreement would still pick a winner.
 */
import assert from 'node:assert/strict';
import { pickConsensus, consensusKey, titleKey, Vote } from '../src/modules/mappings/community-mapping.service';

const vote = (userId: string, anilistMediaId: number, daysAgo = 0): Vote => ({
  userId,
  plexTitle: 'Frieren',
  plexSeason: 1,
  anilistMediaId,
  anilistTitle: `title-${anilistMediaId}-${userId}`,
  malMediaId: null,
  malTitle: null,
  kitsuMediaId: null,
  kitsuTitle: null,
  updatedAt: new Date(Date.now() - daysAgo * 86_400_000),
});

assert.equal(pickConsensus([], 2), null, 'no votes, no consensus');
assert.equal(pickConsensus([vote('a', 1)], 2), null, 'one user alone is not a consensus');
assert.equal(pickConsensus([vote('a', 1), vote('a', 1)], 2), null, 'the same user twice is still one voter');

const agreed = pickConsensus([vote('a', 1, 3), vote('b', 1, 1)], 2);
assert.ok(agreed, 'two users agreeing must be a consensus');
assert.equal(agreed.anilistMediaId, 1);
assert.deepEqual(agreed.voters.sort(), ['a', 'b']);
assert.equal(agreed.anilistTitle, 'title-1-b', 'the most recent correction must provide the titles');

assert.equal(pickConsensus([vote('a', 1), vote('b', 1), vote('c', 2)], 2), null, 'any disagreement blocks the consensus');
assert.equal(pickConsensus([vote('a', 1), vote('b', 1)], 3), null, 'the threshold must be respected');

assert.equal(titleKey('  FRIEREN ', null), 'frieren|1', 'titles compare trimmed, case-insensitive, season 1 by default');
assert.equal(consensusKey({ plexTitle: 'Frieren', plexSeason: 2, anilistMediaId: 9 }), 'frieren|2|9');

console.log('community mappings: OK (consensus needs distinct voters, agreement and the threshold)');
