import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * One gate for every request to the anime trackers' APIs (AniList, MyAnimeList, Kitsu,
 * Jikan).
 *
 * They all limit how fast one client may call them, and every user of this server shares
 * that limit: AniList allows 30 requests a minute right now and blocks for a whole minute
 * when it is exceeded. Before the gate, a 429 was simply a failed (lost) sync.
 *
 * - Each API has its own pace: at most N requests in any 60 s, and a minimum gap so the
 *   burst limiters never see a burst.
 * - Requests wait their turn by priority: syncing a watched episode first, then whatever a
 *   user is waiting for, then background work (covers, statistics). Each priority has a
 *   maximum wait; past it the request fails with TrackerBusyError instead of hanging.
 * - A 429 pauses that API for its Retry-After, and syncs are tried again.
 *
 * The priority comes from the flow that starts the work (withTrackerPriority), so the
 * calls themselves stay plain axios calls.
 *
 * ponytail: the counters live in this process. Several backend copies would each spend
 * the whole budget; sharing it needs the counters in the database.
 */

export type TrackerPriority = 'sync' | 'interactive' | 'background';
export type TrackerApi = 'anilist' | 'mal' | 'kitsu' | 'jikan';

export interface ApiPace {
  /** At most `limit` requests in any `windowMs`. */
  limit: number;
  windowMs: number;
  minGapMs: number;
  /** Pause after a 429 that does not say for how long. */
  penaltyMs: number;
}

const API_NAMES: Record<TrackerApi, string> = { anilist: 'AniList', mal: 'MyAnimeList', kitsu: 'Kitsu', jikan: 'Jikan' };

/** API hosts only: the image CDNs (s4.anilist.co, cdn.myanimelist.net, media.kitsu.app) are not limited. */
const HOSTS: Record<string, TrackerApi> = {
  'graphql.anilist.co': 'anilist',
  'anilist.co': 'anilist',
  'api.myanimelist.net': 'mal',
  'myanimelist.net': 'mal',
  'kitsu.io': 'kitsu',
  'kitsu.app': 'kitsu',
  'api.jikan.moe': 'jikan',
};

/**
 * AniList publishes 90/min but answers with X-RateLimit-Limit (30 today); the gate follows
 * that header minus ANILIST_MARGIN, for the other clients behind the same IP. MyAnimeList
 * and Kitsu publish no limit: one request a second is what their clients use. Jikan: 3/s
 * and 60/min.
 */
export const PACE: Record<TrackerApi, ApiPace> = {
  anilist: { limit: 27, windowMs: 60_000, minGapMs: 500, penaltyMs: 60_000 },
  mal: { limit: 60, windowMs: 60_000, minGapMs: 1000, penaltyMs: 30_000 },
  kitsu: { limit: 60, windowMs: 60_000, minGapMs: 1000, penaltyMs: 30_000 },
  jikan: { limit: 50, windowMs: 60_000, minGapMs: 400, penaltyMs: 10_000 },
};
const ANILIST_MARGIN = 3;
/** AniList left with this many requests: wait instead of earning its one-minute block. */
const LOW_REMAINING = 2;
const LOW_REMAINING_PAUSE_MS = 30_000;

const MAX_WAIT_MS: Record<TrackerPriority, number> = { sync: 10 * 60_000, interactive: 10_000, background: 30_000 };
const RANK: Record<TrackerPriority, number> = { sync: 0, interactive: 1, background: 2 };
const SYNC_RETRIES = 3;

export class TrackerBusyError extends Error {
  readonly code = 'TRACKER_BUSY';
  constructor(readonly api: TrackerApi) {
    super(`${API_NAMES[api]} is busy right now. Try again in a minute.`);
  }
}

export function trackerApiOf(url?: string): TrackerApi | null {
  if (!url) return null;
  try {
    return HOSTS[new URL(url).hostname] ?? null;
  } catch {
    return null;
  }
}

interface Waiter {
  rank: number;
  seq: number;
  resolve: () => void;
  timer: NodeJS.Timeout;
}

/** The queue and the counters of one API. */
export class ApiLane {
  private sent: number[] = [];
  private pausedUntil = 0;
  private waiters: Waiter[] = [];
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;

  constructor(
    readonly api: TrackerApi,
    private pace: ApiPace,
  ) {}

  acquire(priority: TrackerPriority, maxWaitMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        rank: RANK[priority],
        seq: this.seq++,
        resolve,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new TrackerBusyError(this.api));
        }, maxWaitMs),
      };
      this.waiters.push(waiter);
      this.pump();
    });
  }

  /** Reads AniList's rate limit headers; the other APIs send none. */
  observe(headers: Record<string, any>) {
    const limit = Number(headers?.['x-ratelimit-limit']);
    if (limit > 0) this.pace = { ...this.pace, limit: Math.max(1, limit - ANILIST_MARGIN) };
    const remaining = headers?.['x-ratelimit-remaining'];
    if (remaining !== undefined && Number(remaining) <= LOW_REMAINING) this.pause(LOW_REMAINING_PAUSE_MS);
  }

  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pump();
  }

  status() {
    const now = Date.now();
    return {
      queued: this.waiters.length,
      pausedForMs: Math.max(0, this.pausedUntil - now),
      limitPerWindow: this.pace.limit,
      sentInWindow: this.sent.filter((t) => t > now - this.pace.windowMs).length,
    };
  }

  /** Milliseconds until the next request may go out (0: now). */
  private delay(now: number): number {
    while (this.sent.length && this.sent[0] <= now - this.pace.windowMs) this.sent.shift();
    const waits = [0, this.pausedUntil - now];
    if (this.sent.length >= this.pace.limit) waits.push(this.sent[0] + this.pace.windowMs - now);
    const last = this.sent[this.sent.length - 1];
    if (last !== undefined) waits.push(last + this.pace.minGapMs - now);
    return Math.max(...waits);
  }

  private pump() {
    if (this.timer) return;
    while (this.waiters.length) {
      const now = Date.now();
      const wait = this.delay(now);
      if (wait > 0) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.pump();
        }, wait);
        return;
      }
      this.waiters.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
      const next = this.waiters.shift()!;
      clearTimeout(next.timer);
      this.sent.push(now);
      next.resolve();
    }
  }
}

const context = new AsyncLocalStorage<{ priority: TrackerPriority; maxWaitMs?: number }>();

/** Runs `work` with every tracker request inside it at this priority. */
export function withTrackerPriority<T>(priority: TrackerPriority, work: () => Promise<T>, maxWaitMs?: number): Promise<T> {
  return context.run({ priority, maxWaitMs }, work);
}

function retryAfterMs(headers: Record<string, any> | undefined): number | null {
  const seconds = Number(headers?.['retry-after']);
  if (seconds > 0) return seconds * 1000;
  const reset = Number(headers?.['x-ratelimit-reset']);
  if (reset > 0) return Math.max(1000, reset * 1000 - Date.now());
  return null;
}

const logger = new Logger('TrackerGate');
let installedLanes: Map<TrackerApi, ApiLane> | null = null;

/** Puts the gate in front of `instance` (the global axios in the app). */
export function installTrackerGate(instance: AxiosInstance = axios, pace: Record<TrackerApi, ApiPace> = PACE) {
  const lanes = new Map((Object.keys(pace) as TrackerApi[]).map((api) => [api, new ApiLane(api, pace[api])]));
  const lane = (api: TrackerApi) => lanes.get(api)!;

  instance.interceptors.request.use(async (config) => {
    const api = trackerApiOf(config.url);
    if (!api) return config;
    const ctx = context.getStore();
    const priority = ctx?.priority ?? 'interactive';
    await lane(api).acquire(priority, ctx?.maxWaitMs ?? MAX_WAIT_MS[priority]);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const api = trackerApiOf(response.config?.url);
      if (api) lane(api).observe(response.headers as any);
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as any;
      const api = trackerApiOf(config?.url);
      if (!api || error.response?.status !== 429) throw error;
      const pauseMs = retryAfterMs(error.response.headers as any) ?? pace[api].penaltyMs;
      lane(api).pause(pauseMs);
      logger.warn(`${API_NAMES[api]} answered 429 (too many requests): paused for ${Math.ceil(pauseMs / 1000)} s.`);
      const priority = context.getStore()?.priority ?? 'interactive';
      config.__trackerRetries = (config.__trackerRetries || 0) + 1;
      if (priority === 'sync' && config.__trackerRetries <= SYNC_RETRIES) return instance.request(config);
      throw error;
    },
  );

  if (instance === axios) installedLanes = lanes;
  return lanes;
}

const latencies = new Map<TrackerApi, { at: number; ms: number }>();

/**
 * Round trip of an API, really measured at most every 5 minutes: it is the same for every
 * user, and each "check connection" click used to spend a request of the shared budget.
 * Includes any wait in the queue, which is also what the user would see.
 */
export async function apiLatency(api: TrackerApi, request: () => Promise<unknown>): Promise<number> {
  const known = latencies.get(api);
  if (known && Date.now() - known.at < 5 * 60_000) return known.ms;
  const t0 = Date.now();
  await request();
  const ms = Date.now() - t0;
  latencies.set(api, { at: Date.now(), ms });
  return ms;
}

/** Queue and pause of each API, for the services panel. */
export function trackerGateStatus(): Partial<Record<TrackerApi, ReturnType<ApiLane['status']>>> {
  return Object.fromEntries([...(installedLanes?.entries() ?? [])].map(([api, l]) => [api, l.status()]));
}
