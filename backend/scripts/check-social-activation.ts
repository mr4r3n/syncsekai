/**
 * Check what a Google/Discord sign-in does with an existing account of the same email.
 *
 *     npx ts-node -T scripts/check-social-activation.ts
 *
 * Exercises the REAL `handleSocialAuthLogin` of AuthService with a fake Prisma and
 * fake collaborators. It touches neither the database nor the network.
 *
 * - Never activated (activation token pending): the provider verified the email, so
 *   the account is activated and the password whoever registered it chose is removed.
 * - Deactivated by an administrator (no token): it stays closed.
 */
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';

function serviceFor(user: any) {
  const prisma: any = {
    user: {
      findUnique: async () => null,
      findFirst: async () => user,
      update: async ({ data }: any) => Object.assign(user, data),
    },
  };
  const ok = async () => undefined;
  return new AuthService(
    prisma,
    { sign: () => 'jwt' } as any,
    {} as any,
    {} as any,
    { unlockOnSignIn: ok } as any,
    { notifyAdminsOfNewUser: ok, ensureRegistrationOpen: ok, checkDomain: async () => ({ isAllowed: true }) } as any,
    { createSession: async () => 'ses_live_x' } as any,
  );
}

const google = { provider: 'google' as const, providerId: 'g-1', email: 'alice@example.com', username: 'alice', emailVerified: true };

async function main() {
  const pending: any = {
    id: 'u1', username: 'alice', email: 'alice@example.com', role: 'USER', userToken: 'usr_live_x',
    isActive: false, activationToken: 'hash', activationExpiresAt: new Date(), passwordHash: 'squatter-hash',
    settings: {},
  };
  await serviceFor(pending).handleSocialAuthLogin(google);
  assert.equal(pending.isActive, true, 'a pending account is activated by a verified provider email');
  assert.equal(pending.activationToken, null, 'and its activation link stops working');
  assert.equal(pending.passwordHash, null, 'and the password chosen at sign-up is removed');
  assert.equal(pending.googleId, 'g-1', 'and the provider is linked');

  const deactivated: any = {
    id: 'u2', username: 'bob', email: 'alice@example.com', role: 'USER', userToken: 'usr_live_y',
    isActive: false, activationToken: null, passwordHash: 'hash', settings: {},
  };
  await assert.rejects(serviceFor(deactivated).handleSocialAuthLogin(google), /deactivated/);
  assert.equal(deactivated.isActive, false, 'an account an administrator deactivated stays closed');
  assert.equal(deactivated.passwordHash, 'hash');

  console.log('OK: social sign-in activates pending accounts and respects deactivation');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
