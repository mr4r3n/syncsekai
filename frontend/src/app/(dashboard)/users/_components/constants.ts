/**
 * Six services an account can link.
 *
 * Color derives from brand variables rather than standalone hex values: hardcoded
 * in two places they had drifted, making Jellyfin blue in desktop table
 * and purple on mobile card.
 */
const USER_SERVICES = [
  { id: 'plex', short: 'PLEX', name: 'Plex', color: '--brand-plex' },
  { id: 'jellyfin', short: 'JF', name: 'Jellyfin', color: '--brand-jellyfin' },
  { id: 'emby', short: 'EM', name: 'Emby', color: '--brand-emby' },
  { id: 'anilist', short: 'AL', name: 'AniList', color: '--brand-anilist' },
  { id: 'mal', short: 'MAL', name: 'MyAnimeList', color: '--brand-mal' },
  { id: 'kitsu', short: 'KT', name: 'Kitsu', color: '--brand-kitsu' },
] as const;

/** Six account permissions, in rendering order. */
const USER_PERMISSIONS = [
  { field: 'canScrobble', key: 'users.permScrobble' },
  { field: 'canAccessCatalog', key: 'users.catalogueAccess' },
  { field: 'canEditMappings', key: 'users.mappingsEditing' },
  { field: 'canSyncAnilist', key: 'users.permSyncAnilist' },
  { field: 'canSyncMal', key: 'users.permSyncMal' },
  { field: 'canSyncKitsu', key: 'users.permSyncKitsu' },
] as const;

export { USER_SERVICES, USER_PERMISSIONS };
