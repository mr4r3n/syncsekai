/**
 * Check that the backup covers the whole schema.
 *
 *     npx ts-node -T scripts/check-backup-coverage.ts
 *
 * A new model that is not added to `backup.service.ts` (backup) and to
 * `backup-restore.service.ts` (restore) silently stops being saved. This
 * script compares the models in `schema.prisma` with what the services read
 * and write. If you add a model, include it in the backup or put it in
 * INTENTIONALLY_NOT_BACKED_UP with the reason.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Models that are NOT backed up on purpose. The reason is part of the list. */
const INTENTIONALLY_NOT_BACKED_UP: Record<string, string> = {
  Session: 'Open sessions. Restoring them would revalidate sessions unrelated to the moment of the backup.',
};

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const read = (file: string) =>
  fs.readFileSync(path.join(root, 'src', 'modules', 'admin', file), 'utf8');
const service = read('backup.service.ts');
const restoreSource = read('backup-restore.service.ts');

const models = [...schema.matchAll(/^model\s+([A-Za-z]+)\s*\{/gm)].map((m) => m[1]);
assert.ok(models.length > 10, 'the schema models were not read');

const lowerFirst = (m: string) => m[0].toLowerCase() + m.slice(1);
const backedUp = new Set([...service.matchAll(/prisma\.([a-zA-Z]+)\.findMany/g)].map((m) => m[1]));
const restored = new Set(
  [...restoreSource.matchAll(/prisma\.([a-zA-Z]+)\.(?:upsert|createMany|create)\b/g)].map((m) => m[1]),
);

const missingFromBackup: string[] = [];
const missingFromRestore: string[] = [];

for (const model of models) {
  const key = lowerFirst(model);
  if (INTENTIONALLY_NOT_BACKED_UP[model]) continue;
  if (!backedUp.has(key)) missingFromBackup.push(model);
  else if (!restored.has(key)) missingFromRestore.push(model);
}

assert.deepEqual(
  missingFromBackup,
  [],
  `these models are not backed up: ${missingFromBackup.join(', ')}.\n` +
    'Add them to backup.service.ts, or to INTENTIONALLY_NOT_BACKED_UP in this file with the reason.',
);

assert.deepEqual(
  missingFromRestore,
  [],
  `these models are backed up but not restored: ${missingFromRestore.join(', ')}.\n` +
    'A backup that saves something and does not restore it is worse than not saving it: it gives no warning.',
);

console.log(
  `backup coverage: OK (${models.length} models, ` +
    `${Object.keys(INTENTIONALLY_NOT_BACKED_UP).length} excluded on purpose)`,
);
