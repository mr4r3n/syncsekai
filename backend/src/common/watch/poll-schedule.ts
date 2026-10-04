/**
 * When the media server watchers (Plex, Jellyfin, Emby) poll each server.
 *
 * They used to poll every server every 5 s, in fixed groups of 5 and reloading every
 * connection from the database each time: with hundreds of servers a round took longer
 * than 5 s, and a server down for days cost as much as a busy one.
 */

export type PollResult = 'playing' | 'idle' | 'failed';

export const POLL_PLAYING_MS = 5_000;
export const POLL_IDLE_MS = 15_000;
export const POLL_MAX_BACKOFF_MS = 5 * 60_000;
/** Servers polled at the same time; each one frees its slot as soon as it answers. */
export const POLL_CONCURRENCY = 25;
/** How long the list of connections is reused before reading it again. */
export const CONNECTIONS_TTL_MS = 30_000;

/**
 * Next poll of each server: soon while something plays (the scrobble threshold must not be
 * missed), less often when idle, and further apart after each failure (15 s, 30 s, 1 min…
 * up to 5 min) until one succeeds.
 */
export class PollSchedule {
  private next = new Map<string, number>();
  private failures = new Map<string, number>();

  due(id: string, now = Date.now()): boolean {
    return (this.next.get(id) ?? 0) <= now;
  }

  record(id: string, result: PollResult, now = Date.now()) {
    if (result === 'failed') {
      const n = (this.failures.get(id) ?? 0) + 1;
      this.failures.set(id, n);
      this.next.set(id, now + Math.min(POLL_MAX_BACKOFF_MS, POLL_IDLE_MS * 2 ** (n - 1)));
      return;
    }
    this.failures.delete(id);
    this.next.set(id, now + (result === 'playing' ? POLL_PLAYING_MS : POLL_IDLE_MS));
  }
}

/** Runs `work` over `items` with at most `concurrency` at a time. Errors stay inside each item. */
export async function runPool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
