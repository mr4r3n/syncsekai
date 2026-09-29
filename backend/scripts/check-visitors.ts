/**
 * Check the daily visitor key: one per person and day, and nothing readable back.
 *
 *     npx ts-node -T scripts/check-visitors.ts
 */
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { visitorKey } from '../src/modules/admin/visitors.service';

const today = crypto.randomBytes(32);
const tomorrow = crypto.randomBytes(32);
const chrome = 'Mozilla/5.0 Chrome/140';

// The same anonymous visitor keeps one key through the day…
assert.equal(visitorKey(today, { ip: '203.0.113.7', userAgent: chrome }), visitorKey(today, { ip: '203.0.113.7', userAgent: chrome }));
// …and another person on the same network with another browser is someone else.
assert.notEqual(visitorKey(today, { ip: '203.0.113.7', userAgent: chrome }), visitorKey(today, { ip: '203.0.113.7', userAgent: 'Firefox/130' }));

// A signed-in visitor is the account: a new IP or device does not make a second visit.
assert.equal(
  visitorKey(today, { ip: '203.0.113.7', userAgent: chrome, userId: 'u1' }),
  visitorKey(today, { ip: '198.51.100.9', userAgent: 'Safari/18', userId: 'u1' }),
);
assert.notEqual(visitorKey(today, { ip: '203.0.113.7', userAgent: chrome, userId: 'u1' }), visitorKey(today, { ip: '203.0.113.7', userAgent: chrome }));

// Another day's salt gives another key: yesterday's visitors cannot be matched today.
assert.notEqual(visitorKey(today, { ip: '203.0.113.7', userAgent: chrome }), visitorKey(tomorrow, { ip: '203.0.113.7', userAgent: chrome }));

console.log('visitor keys: OK');
