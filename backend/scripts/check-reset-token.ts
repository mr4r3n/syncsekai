/**
 * Check that password reset tokens are stored hashed and still work.
 *
 *     npx ts-node -T scripts/check-reset-token.ts
 *
 * Exercises the REAL `forgotPassword` and `resetPassword` of AccountService with a
 * fake in-memory Prisma and a mail service that keeps the email. It touches neither
 * the database nor the network.
 *
 * With the plain token in the database, anyone who reads the database or a backup
 * could reset the password of whoever has a reset pending.
 */
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { AccountService } from '../src/modules/auth/account.service';

async function main() {
  const user: any = {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    isActive: true,
    passwordHash: await bcrypt.hash('old-password-123', 4),
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  };
  let revokedSessions = 0;
  const prisma: any = {
    user: {
      findFirst: async ({ where }: any) =>
        where.email ? (where.email.equals === user.email ? user : null)
          : where.passwordResetToken === user.passwordResetToken ? user : null,
      update: async ({ data }: any) => Object.assign(user, data),
    },
    session: { deleteMany: async () => { revokedSessions++; return { count: 1 }; } },
  };
  const sent: string[] = [];
  const mail: any = {
    getFrontendUrl: async () => 'https://example.com',
    sendEmail: async (_to: string, _subject: string, html: string) => { sent.push(html); return true; },
  };
  const service = new AccountService(prisma, {} as any, {} as any, {} as any, mail);

  await service.forgotPassword({ email: 'Alice@Example.com' } as any);
  const token = /reset-password\/([a-f0-9]{64})/.exec(sent[0])?.[1];
  assert.ok(token, 'the email carries the reset link');
  assert.ok(user.passwordResetToken, 'a token is stored');
  assert.notEqual(user.passwordResetToken, token, 'the stored value is not the token from the email');

  await assert.rejects(
    service.resetPassword({ token: user.passwordResetToken, newPassword: 'new-password-456' } as any),
    'the stored hash is useless as a link',
  );

  await service.resetPassword({ token: ` ${token} `, newPassword: 'new-password-456' } as any);
  assert.ok(await bcrypt.compare('new-password-456', user.passwordHash), 'the password changed');
  assert.equal(user.passwordResetToken, null, 'the token is single-use');
  assert.equal(revokedSessions, 1, 'previous sessions are revoked');

  await assert.rejects(
    service.resetPassword({ token, newPassword: 'another-password-789' } as any),
    'a used link no longer works',
  );

  console.log('OK: reset tokens are stored hashed and work once');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
