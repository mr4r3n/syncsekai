/**
 * What a save from the catalog tells the user. "Synced" names only the trackers that
 * confirmed it: before, the toast said synced even when no tracker had been updated.
 */
export type SyncOutcome =
  | { kind: 'synced'; trackers: string }
  | { kind: 'syncing' }
  | { kind: 'local' }
  | { kind: 'failed'; reason: string };

export function syncOutcome(res: any): SyncOutcome {
  // The trackers' queue is busy: the save goes on in the background (backend: catalog-progress.service.ts).
  if (res?.queued) return { kind: 'syncing' };
  const updated: string[] = res?.updatedTrackers || [];
  if (updated.length > 0) return { kind: 'synced', trackers: updated.join(', ') };
  // Nothing updated and still a success: the user has no tracker linked.
  if (res?.success) return { kind: 'local' };
  const r = res?.results || {};
  const reason = [
    r.anilist && !r.anilist.success ? `AniList: ${r.anilist.error || r.anilist.reason || '?'}` : null,
    r.mal && !r.mal.success ? `MyAnimeList: ${r.mal.error || r.mal.reason || '?'}` : null,
    r.kitsu && r.kitsu.success === false ? `Kitsu: ${r.kitsu.error || '?'}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
  return { kind: 'failed', reason: reason || res?.message || '' };
}
