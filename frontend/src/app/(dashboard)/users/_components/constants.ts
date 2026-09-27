/**
 * Los seis servicios que puede tener vinculados una cuenta.
 *
 * El color sale de las variables de marca y no de un hex suelto: escritas a
 * mano en dos sitios ya se habian separado, y Jellyfin salia azul en la tabla
 * de escritorio y morado en la tarjeta de movil.
 */
const SERVICIOS_USUARIO = [
  { id: 'plex', corto: 'PLEX', nombre: 'Plex', color: '--brand-plex' },
  { id: 'jellyfin', corto: 'JF', nombre: 'Jellyfin', color: '--brand-jellyfin' },
  { id: 'emby', corto: 'EM', nombre: 'Emby', color: '--brand-emby' },
  { id: 'anilist', corto: 'AL', nombre: 'AniList', color: '--brand-anilist' },
  { id: 'mal', corto: 'MAL', nombre: 'MyAnimeList', color: '--brand-mal' },
  { id: 'kitsu', corto: 'KT', nombre: 'Kitsu', color: '--brand-kitsu' },
] as const;

/** Los seis permisos de cuenta, en el orden en que se pintan. */
const PERMISOS_USUARIO = [
  { campo: 'canScrobble', clave: 'users.permScrobble' },
  { campo: 'canAccessCatalog', clave: 'users.catalogueAccess' },
  { campo: 'canEditMappings', clave: 'users.mappingsEditing' },
  { campo: 'canSyncAnilist', clave: 'users.permSyncAnilist' },
  { campo: 'canSyncMal', clave: 'users.permSyncMal' },
  { campo: 'canSyncKitsu', clave: 'users.permSyncKitsu' },
] as const;

export { SERVICIOS_USUARIO, PERMISOS_USUARIO };
