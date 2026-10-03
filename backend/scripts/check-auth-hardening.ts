/**
 * Check the sign-in hardening from the web security audit.
 *
 *     npx ts-node -T scripts/check-auth-hardening.ts
 *
 * Runs the REAL code with a fake in-memory Prisma and mail service; it touches
 * neither the database nor the network.
 * - Return paths after social sign-in stay on this site ("/\t/evil.example" is
 *   read by browsers as "//evil.example").
 * - Only fixed error codes travel in the callback URL.
 * - Login answers the same for an unknown email, a Google/Discord-only account and a
 *   wrong password, and a TOTP code cannot be used twice.
 * - Recovery with an emergency code answers the same for every failure and emails
 *   the owner when it works.
 * - Admin sessions end after 24 h without use.
 */
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { generateSecret, generateSync } from 'otplib';
import { safeReturnPath } from '../src/modules/auth/oauth-state.service';
import { oauthErrorCode } from '../src/modules/auth/social-auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { TwoFactorService } from '../src/modules/auth/two-factor.service';
import { SessionsService } from '../src/modules/auth/sessions.service';

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e: any) {
    return e.message;
  }
  throw new Error('expected a rejection');
}

async function main() {
  // Return paths
  for (const bad of ['/\t/evil.example', '/\n/evil.example', '//evil.example', '/\\evil.example', 'https://evil.example', 'evil', undefined]) {
    assert.equal(safeReturnPath(bad), undefined, `rejected: ${JSON.stringify(bad)}`);
  }
  assert.equal(safeReturnPath('/settings/security?tab=2#x'), '/settings/security?tab=2#x');

  // Error codes
  assert.equal(oauthErrorCode(new Error('Your account has been suspended by the administrator.')), 'ACCOUNT_SUSPENDED');
  assert.equal(oauthErrorCode(new Error('This domain requires manual approval by the administrator.')), 'EMAIL_DOMAIN_NOT_ALLOWED');
  assert.equal(oauthErrorCode(new Error('Visit evil.example to unlock your account')), 'SOCIAL_AUTH_FAILED');

  // Login
  const secret = generateSecret();
  const users: Record<string, any> = {
    'pw@example.com': { id: 'pw', email: 'pw@example.com', username: 'pw', role: 'USER', isActive: true, passwordHash: await bcrypt.hash('right-password', 4), twoFactorEnabled: false, animeConnections: [] },
    'social@example.com': { id: 'so', email: 'social@example.com', username: 'so', role: 'USER', isActive: true, passwordHash: null, twoFactorEnabled: false, animeConnections: [] },
    'totp@example.com': { id: 'tp', email: 'totp@example.com', username: 'tp', role: 'USER', isActive: true, passwordHash: await bcrypt.hash('right-password', 4), twoFactorEnabled: true, twoFactorType: 'APP_TOTP', twoFactorSecret: secret, animeConnections: [] },
  };
  const prisma: any = {
    user: { findUnique: async ({ where }: any) => users[where.email] || null },
  };
  const auth = new AuthService(
    prisma,
    { sign: () => 'jwt' } as any,
    { decrypt: (v: string) => v } as any,
    {} as any,
    { unlockOnSignIn: async () => {} } as any,
    {} as any,
    { createSession: async () => 'session' } as any,
  );
  const login = (email: string, password: string, twoFactorCode?: string) =>
    auth.login({ email, password, twoFactorCode } as any);
  const unknown = await rejection(login('nobody@example.com', 'whatever-123'));
  assert.equal(await rejection(login('social@example.com', 'whatever-123')), unknown, 'Google/Discord-only account answers like an unknown one');
  assert.equal(await rejection(login('pw@example.com', 'wrong-password')), unknown, 'wrong password answers like an unknown account');
  assert.equal((await login('pw@example.com', 'right-password') as any).accessToken, 'jwt');

  const code = generateSync({ secret });
  assert.equal((await login('totp@example.com', 'right-password', code) as any).accessToken, 'jwt');
  assert.match(await rejection(login('totp@example.com', 'right-password', code)), /2FA code/, 'the same TOTP code is refused the second time');

  // Recovery with an emergency code
  const owner: any = { id: 'r1', email: 'owner@example.com', username: 'owner', backupCodes: [await bcrypt.hash('ABCD2345', 4)] };
  const mails: Array<{ to: string; subject: string }> = [];
  const twoFactor = new TwoFactorService(
    {
      user: {
        findFirst: async ({ where }: any) => (where.OR.some((c: any) => c.username?.equals === 'owner') ? owner : null),
        update: async () => owner,
      },
      session: { deleteMany: async () => ({ count: 1 }) },
      auditLog: { create: async () => ({}) },
    } as any,
    {} as any,
    { getFrontendUrl: async () => 'https://syncsekai.test', sendEmail: async (to: string, subject: string) => (mails.push({ to, subject }), true) } as any,
  );
  const recover = (identifier: string, backupCode: string) =>
    twoFactor.recoverWithBackupCode({ identifier, backupCode, newPassword: 'a-brand-new-password' });
  assert.equal(await rejection(recover('ghost', 'ABCD2345')), await rejection(recover('owner', 'WXYZ6789')), 'unknown account and wrong code answer the same');
  assert.equal(mails.length, 0);
  await recover('owner', 'ABCD2345');
  assert.deepEqual(mails.map((m) => m.to), ['owner@example.com'], 'the owner is told by email');

  // Admin idle limit
  let lastWhere: any;
  const sessions = new SessionsService({ session: { findFirst: async ({ where }: any) => ((lastWhere = where), {}) } } as any);
  await sessions.validateSessionToken('u', 't');
  assert.equal(lastWhere.lastActiveAt, undefined, 'a user session has no idle limit');
  await sessions.validateSessionToken('u', 't', SessionsService.ADMIN_IDLE_MS);
  const idleCutoff = lastWhere.lastActiveAt.gte.getTime();
  assert.ok(Math.abs(Date.now() - SessionsService.ADMIN_IDLE_MS - idleCutoff) < 5000, 'an admin session must have been used in the last 24 h');

  console.log('OK: return paths, error codes, login answers, TOTP replay, emergency recovery and admin idle limit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
