/**
 * Check that the Nest container resolves every provider.
 *
 *     npx ts-node -T scripts/check-di.ts
 *
 * `tsc` does not catch an unregistered provider or a dependency missing from a
 * module: that only fails at startup. `NestFactory.create` resolves the whole
 * graph without running `onModuleInit`, so it needs no database. The secrets
 * are placeholders and never leave the process.
 */
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';

const filler = 'x'.repeat(64);
process.env.DATABASE_URL ??= 'postgresql://check:check@127.0.0.1:1/check';
for (const key of ['JWT_SECRET', 'OAUTH_STATE_SECRET', 'SETUP_BOOTSTRAP_TOKEN', 'ENCRYPTION_KEY']) {
  process.env[key] ??= filler;
}

async function main() {
  // require, not import: the variables above must exist before loading the
  // modules, some of which read them on import.
  const { AppModule } = require('../src/app.module');
  const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  const { AdminController } = require('../src/modules/admin/admin.controller');
  assert.ok(app.get(AdminController), 'AdminController not resolved');
  // No close(): it would fire the shutdown hooks, which do touch the database.
  console.log('OK: the container resolves every provider.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
