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

/*
 * Field level: most models are restored with an explicit field list, and a
 * field added to the schema but not to that list is silently lost on restore
 * (it happened with the Kitsu ids of mappings and several user settings).
 * Checked on the `create` side of each upsert; blocks that spread the saved
 * row (`create: row` or `...row`) restore every field and are skipped.
 */
const FIELDS_NOT_RESTORED_ON_PURPOSE: Record<string, string> = {
  updatedAt: 'Set by Prisma on write.',
  'SystemSetting.id': 'Keyed by `key`; a new id changes nothing.',
  'SystemSetting.createdAt': 'Keyed by `key`; not shown anywhere.',
  'DomainPolicy.id': 'Keyed by `domain`.',
  'DomainPolicy.createdAt': 'Keyed by `domain`; not shown anywhere.',
  'UserSettings.id': 'Keyed by `userId`.',
  'UserSettings.createdAt': 'Keyed by `userId`; not shown anywhere.',
  'SystemMetric.id': 'Keyed by metric, IP and day.',
  'SystemMetric.createdAt': 'Keyed by metric, IP and day.',
  'User.pendingEmail': 'An email change in flight: like sessions, it must not come back from an old backup.',
  'User.emailChangeToken': 'An email change in flight.',
  'User.emailChangeExpiresAt': 'An email change in flight.',
  'User.deletionToken': 'An unconfirmed deletion link; the scheduled deletion itself is restored.',
  'User.deletionTokenExpiresAt': 'An unconfirmed deletion link.',
};

const scalarFields = (model: string): string[] => {
  const body = schema.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? '';
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/))
    .filter(([, type]) => type && !models.includes(type.replace(/[?[\]]/g, '')))
    .map(([name]) => name);
};

/** The `{ ... }` object literal that starts at `from` (index of its `{`). */
const objectAt = (text: string, from: number): string => {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(from, i + 1);
  }
  return '';
};

const missingFields: string[] = [];
for (const m of restoreSource.matchAll(/prisma\.([a-zA-Z]+)\.upsert\(\{/g)) {
  const model = m[1][0].toUpperCase() + m[1].slice(1);
  const call = objectAt(restoreSource, m.index! + m[0].length - 1);
  const createAt = call.search(/\bcreate:\s*\{/);
  if (createAt < 0) continue; // `create: row`: the whole saved row
  const create = objectAt(call, call.indexOf('{', createAt));
  if (/\.\.\.[a-zA-Z]+\s*[,}]/.test(create) && !/\.\.\.\(/.test(create)) continue;
  for (const field of scalarFields(model)) {
    if (FIELDS_NOT_RESTORED_ON_PURPOSE[field] || FIELDS_NOT_RESTORED_ON_PURPOSE[`${model}.${field}`]) continue;
    if (!new RegExp(`\\b${field}\\b`).test(create)) missingFields.push(`${model}.${field}`);
  }
}

assert.deepEqual(
  missingFields,
  [],
  `these fields are backed up but not restored: ${missingFields.join(', ')}.\n` +
    'Add them to the restore in backup-restore.service.ts, or to FIELDS_NOT_RESTORED_ON_PURPOSE with the reason.',
);

console.log(
  `backup coverage: OK (${models.length} models, ` +
    `${Object.keys(INTENTIONALLY_NOT_BACKED_UP).length} excluded on purpose, every restored field listed)`,
);
