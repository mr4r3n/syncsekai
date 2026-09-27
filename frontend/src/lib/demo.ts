/**
 * Demo mode: the real panel, answering from a recorded demo account.
 *
 * /demo turns it on for this tab only (sessionStorage) and opens the panel.
 * While it is on, `request()` in api.ts asks this module instead of the server:
 * the recording (demo-data.json, made against a local instance) holds
 * what the API answered for the demo user, so every page renders exactly as it
 * would for a real account, and a change to the panel shows up in the demo too.
 * Nothing is ever written: any request that is not a GET is refused with a
 * message inviting the visitor to create an account.
 */
const FLAG = 'syncsekai_demo';

/** Pages the demo covers; the sidebar hides the rest while it is on. */
export const DEMO_PAGES = ['/connections', '/catalog', '/history', '/mappings'];

export function isDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function enterDemo() {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    /* storage blocked: the demo simply does not start */
  }
}

export function exitDemo() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* nothing to clear */
  }
}

export const spanish = () => typeof document !== 'undefined' && document.documentElement.lang === 'es';

export const demoReadOnlyMessage = () =>
  spanish()
    ? 'Esto es una demo: crea una cuenta para conectar tu servidor y guardar cambios.'
    : 'This is a demo: create an account to connect your server and save changes.';

const notInDemoMessage = () =>
  spanish() ? 'Esta parte no está en la demo.' : 'This part is not included in the demo.';

/** Parameters that do not change what the recording should answer. */
const IGNORED = new Set(['provider', 'forceRefresh']);

export function normalize(endpoint: string, drop: string[] = []): string {
  const url = new URL(endpoint, 'http://demo');
  const params = [...url.searchParams]
    .filter(([k]) => !IGNORED.has(k) && !drop.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return url.pathname + (params.length ? `?${new URLSearchParams(params)}` : '');
}

const DAY = 86_400_000;

/**
 * The recording is a snapshot: without this, "last sync" would drift to "3 months
 * ago". Activity dates move forward by the time elapsed since it was made. The
 * anime details keep theirs: those are real airing dates.
 */
export function shiftDates(value: unknown, shift: number): unknown {
  const days = Math.round(shift / DAY);
  const text = JSON.stringify(value)
    .replace(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g, (_, iso) =>
      JSON.stringify(new Date(Date.parse(iso) + shift).toISOString()),
    )
    .replace(/"(\d{4}-\d{2}-\d{2})"/g, (_, day) =>
      JSON.stringify(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)),
    );
  return JSON.parse(text);
}

let table: Map<string, unknown> | null = null;
async function recording(): Promise<Map<string, unknown>> {
  if (!table) {
    // Loaded only when the demo is used, so it never weighs on the real panel.
    const { __recordedAt, ...data } = (await import('./demo-data.json')).default as Record<string, unknown>;
    const recordedAt = Date.parse(String(__recordedAt));
    const shift = Number.isFinite(recordedAt) ? Date.now() - recordedAt : 0;
    table = new Map(
      Object.entries(data).map(([k, v]) => [normalize(k), shift && !k.includes('/franchise') ? shiftDates(v, shift) : v]),
    );
  }
  return table;
}

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Listing = { items?: Record<string, unknown>[]; total?: number; page?: number; totalPages?: number; pagination?: Record<string, unknown> };

/**
 * What the recording answers to a GET. Pure (no browser, no import) so that
 * scripts/check-demo.mjs can test it. Returns undefined when it has no answer.
 */
export function answer(table: Map<string, unknown>, endpoint: string): unknown {
  // Searches are filtered here, over every recorded page of that list.
  const search = new URL(endpoint, 'http://demo').searchParams.get('search')?.trim().toLowerCase();
  if (search) {
    const same = normalize(endpoint, ['search', 'page', 'limit']);
    const pages = [...table.entries()].filter(([k]) => normalize(k, ['page', 'limit']) === same).map(([, v]) => v as Listing);
    if (pages.length && pages.every((p) => Array.isArray(p.items))) {
      const seen = new Set<unknown>();
      const items = pages
        .flatMap((p) => p.items!)
        .filter((item) => !seen.has(item.id) && seen.add(item.id))
        .filter((item) =>
          JSON.stringify([item.title, item.romajiTitle, item.showTitle, item.plexTitle, item.anilistTitle]).toLowerCase().includes(search),
        );
      const result = copy(pages[0]);
      result.items = items;
      if ('total' in result) Object.assign(result, { total: items.length, page: 1, totalPages: 1 });
      if (result.pagination) Object.assign(result.pagination, { total: items.length, page: 1, totalPages: 1 });
      return result;
    }
  }

  // Exact request, then the same one with another page size, then the first page.
  for (const drop of [[], ['limit'], ['limit', 'page']]) {
    const key = normalize(endpoint, drop);
    const hit = [...table.keys()].find((k) => normalize(k, drop) === key);
    if (hit) return copy(table.get(hit));
  }
  return undefined;
}

export async function demoResponse(endpoint: string, method = 'GET'): Promise<unknown> {
  if (method.toUpperCase() !== 'GET') throw new Error(demoReadOnlyMessage());
  const result = answer(await recording(), endpoint);
  if (result === undefined) throw new Error(notInDemoMessage());
  return result;
}
