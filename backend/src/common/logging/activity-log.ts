/**
 * Recent activity from the media servers (webhooks, live sessions, scrobbles) for
 * the admin console, kept in memory only. It is operational noise nobody needs
 * later, and it says what people watch or listen to, even in libraries SyncSekai
 * ignores: it is not written to the database and is lost on restart by design.
 * Administrative and security events still go to AuditLog (kept 90 days).
 *
 * Takes the same argument as prisma.auditLog.create, so call sites read the same.
 * ponytail: one buffer per process; with several backend replicas each would show its own.
 */
const MAX_ENTRIES = 300;

export interface ActivityEntry {
  id: string;
  level: string;
  service: string;
  message: string;
  createdAt: Date;
}

const entries: ActivityEntry[] = [];
let sequence = 0;

export function recordActivity({ data }: { data: { level?: string; service?: string; message: string; details?: unknown } }): Promise<void> {
  entries.unshift({
    id: `activity-${++sequence}`,
    level: data.level || 'INFO',
    service: data.service || 'SYSTEM',
    message: data.message,
    createdAt: new Date(),
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return Promise.resolve();
}

export const recentActivity = (limit: number): ActivityEntry[] => entries.slice(0, limit);
