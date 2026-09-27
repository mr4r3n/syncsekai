/**
 * Check that titles escaped by Handlebars (Jellyfin webhook) come back as written.
 *
 *     npx ts-node -T scripts/check-html-entities.ts
 */
import assert from 'node:assert/strict';
import { decodeHtmlEntities } from '../src/common/text/decode-html-entities';

assert.equal(decodeHtmlEntities('Fuguu-shoku &quot;Kanteishi&quot; ga Jitsu wa Saikyou Datta'), 'Fuguu-shoku "Kanteishi" ga Jitsu wa Saikyou Datta');
assert.equal(decodeHtmlEntities('JoJo&#x27;s Bizarre Adventure'), "JoJo's Bizarre Adventure");
assert.equal(decodeHtmlEntities('Fate&#x2F;Zero &amp; Re&#x3D;Zero'), 'Fate/Zero & Re=Zero');
// One pass only: an escaped entity stays an entity, as the author wrote it.
assert.equal(decodeHtmlEntities('A &amp;quot; B'), 'A &quot; B');
// Plain text and unknown entities are left alone.
assert.equal(decodeHtmlEntities('Sousou no Frieren'), 'Sousou no Frieren');
assert.equal(decodeHtmlEntities('&hearts; &#1234;'), '&hearts; &#1234;');

console.log('HTML entities in titles: OK');
