-- A scrobble waiting its turn in the trackers' queue is shown as syncing, never as synced.
ALTER TYPE "SyncStatus" ADD VALUE 'SYNCING';
