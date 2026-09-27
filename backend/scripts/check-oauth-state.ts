/**
 * Check that the OAuth state is bound to the browser that started the flow.
 *
 *     npx ts-node -T scripts/check-oauth-state.ts
 *
 * Exercises the REAL `createOAuthState` and `consumeOAuthState` methods of
 * OAuthStateService, with a fake in-memory Prisma. It touches neither the
 * database nor the network.
 *
 * Without the transaction secret, a valid callback presented in another browser
 * would create there the session of whoever started the flow.
 */
import assert from 'node:assert/strict';
import { OAuthStateService } from '../src/modules/auth/oauth-state.service';

/** Minimal Prisma: only the single-use table the state uses. */
function fakePrisma() {
  const rows = new Map<string, string>();
  return {
    systemSetting: {
      create: async ({ data }: any) => {
        rows.set(data.key, data.value);
        return data;
      },
      deleteMany: async ({ where }: any) => {
        if (typeof where.key === 'object') return { count: 0 }; // cleanup by age
        const actual = rows.get(where.key);
        if (actual !== undefined && actual === where.value) {
          rows.delete(where.key);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    _rows: rows,
  };
}

function buildService() {
  // Instantiated without the constructor: these two methods only use
  // configService and prisma, and building the whole service would drag half the
  // application into a check that does not need it.
  const svc: any = Object.create(OAuthStateService.prototype);
  svc.configService = { get: (k: string) => (k === 'OAUTH_STATE_SECRET' ? 'test-secret-used-only-by-this-oauth-check' : '') };
  svc.prisma = fakePrisma();
  return svc;
}

async function rejects(fn: () => Promise<unknown>, message: string) {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert.equal(failed, true, message);
}

async function main() {
  // 1. The happy path: same browser, same secret.
  {
    const svc = buildService();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    const r = await svc.consumeOAuthState(state, 'google', txSecret);
    assert.equal(r.intent, 'login');
    assert.equal(r.returnTo, '/connections');
  }

  // 2. What this guards: a valid state, a different browser.
  {
    const svc = buildService();
    const { state } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await rejects(
      () => svc.consumeOAuthState(state, 'google', ''),
      'a callback without the transaction cookie must be rejected',
    );
    await rejects(
      () => svc.consumeOAuthState(state, 'google', 'f'.repeat(64)),
      'a callback with another secret must be rejected',
    );
  }

  // 3. And that rejection must NOT spend the state: if it did, presenting the
  //    callback somewhere else would be enough to cancel the legitimate
  //    sign-in. That is why the browser is checked BEFORE consuming.
  {
    const svc = buildService();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'discord',
      intent: 'login',
    });
    await rejects(() => svc.consumeOAuthState(state, 'discord', ''), 'no cookie, rejected');
    const r = await svc.consumeOAuthState(state, 'discord', txSecret);
    assert.equal(r.intent, 'login', 'the legitimate browser can still use its state');
  }

  // 4. Single use, even with the right secret.
  {
    const svc = buildService();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await svc.consumeOAuthState(state, 'google', txSecret);
    await rejects(
      () => svc.consumeOAuthState(state, 'google', txSecret),
      'a used state cannot be valid again',
    );
  }

  // 5. The existing checks still hold.
  {
    const svc = buildService();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await rejects(
      () => svc.consumeOAuthState(state, 'discord', txSecret),
      'a Google state is not valid for the Discord callback',
    );

    const broken = Buffer.from(
      JSON.stringify({
        data: JSON.stringify({
          returnTo: '/connections',
          userId: '',
          provider: 'google',
          intent: 'login',
          ts: Date.now(),
          nonce: 'a'.repeat(64),
          txHash: 'b'.repeat(64),
        }),
        sig: 'c'.repeat(64),
      }),
    ).toString('base64url');
    await rejects(
      () => svc.consumeOAuthState(broken, 'google', txSecret),
      'a forged signature must be rejected',
    );
  }

  // 6. Linking: the userId still travels signed, bound to the same browser.
  {
    const svc = buildService();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/settings/security',
      userId: 'user-123',
      provider: 'discord',
      intent: 'link',
    });
    await rejects(
      () => svc.consumeOAuthState(state, 'discord', 'f'.repeat(64)),
      'linking from another browser must be rejected',
    );
    const r = await svc.consumeOAuthState(state, 'discord', txSecret);
    assert.equal(r.intent, 'link');
    assert.equal(r.userId, 'user-123');
  }

  console.log('OAuth state bound to the browser: OK');
}

main().catch((e) => {
  console.error('FAILED:', e?.message || e);
  process.exit(1);
});
