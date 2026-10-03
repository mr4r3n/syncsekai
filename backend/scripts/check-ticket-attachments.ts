/**
 * Check that the daily cleanup only removes ticket attachments nobody sent.
 *
 *     npx ts-node -T scripts/check-ticket-attachments.ts
 *
 * Runs the REAL `purgeOrphanAttachments` of TicketsService in a temporary folder with
 * a fake Prisma. It deletes files, so a mistake here would lose users' screenshots.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TicketsService } from '../src/modules/tickets/tickets.service';

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tickets-'));
  const cwd = process.cwd();
  process.chdir(tmp);
  try {
    const prisma: any = {
      ticketAttachment: { findMany: async () => [{ fileUrl: '/api/tickets/attachments/ticket_1_sent.webp' }] },
    };
    const service = new TicketsService(prisma, {} as any);
    const dir = path.join(tmp, 'uploads', 'tickets');
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    for (const name of ['ticket_1_sent.webp', 'ticket_2_orphan.webp', 'ticket_3_recent.webp', 'notes.txt']) {
      fs.writeFileSync(path.join(dir, name), 'x');
      if (name !== 'ticket_3_recent.webp') fs.utimesSync(path.join(dir, name), old, old);
    }

    assert.equal(await service.purgeOrphanAttachments(), 1);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['notes.txt', 'ticket_1_sent.webp', 'ticket_3_recent.webp'],
      'only the old attachment no message points at is removed');
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('OK: only old, unsent ticket attachments are removed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
