/**
 * Avatars offered to users who do not want to upload their own photo.
 *
 * The live list is stored in SystemSetting['PRESET_AVATARS'] as a JSON array
 * of paths, so it can be extended from the admin panel without touching the
 * code or the database. While that key does not exist yet, the eight that ship
 * with the frontend are used, so the feature does not start empty.
 *
 * Only two path shapes are accepted:
 *   /avatars/<id>.svg                  the ones shipped in frontend/public
 *   /api/auth/avatar/preset/<file>     the ones uploaded from the panel
 *
 * It is a closed list, not a free field. If the client could send any string,
 * `avatarUrl` would become a user-chosen URL embedded in the <img> of everyone
 * who views that profile: a free third-party tracking beacon and, with a
 * `javascript:`, something far worse.
 */

export const DEFAULT_AVATARS_KEY = 'PRESET_AVATARS';

/** The ones served as static files from frontend/public/avatars. */
export const BUILT_IN_AVATARS: readonly string[] = [
  '/avatars/luna.svg',
  '/avatars/sakura.svg',
  '/avatars/ola.svg',
  '/avatars/torii.svg',
  '/avatars/gato.svg',
  '/avatars/estrella.svg',
  '/avatars/casete.svg',
  '/avatars/brote.svg',
];

/** Folder, inside uploads/, where uploaded ones land. */
export const UPLOADED_PRESETS_DIR = 'avatars-preset';

const BUILT_IN = /^\/avatars\/[a-z0-9-]{1,40}\.svg$/;
const UPLOADED = /^\/api\/auth\/avatar\/preset\/[A-Za-z0-9_-]{1,60}\.webp$/;

/**
 * Does this string have the shape of a default avatar path?
 *
 * This is the shape check, not the membership check: looking right does not
 * mean it is in the list. Before storing it, it must also appear in the live
 * list.
 */
export function looksLikeAvatarPath(value: unknown): value is string {
  return typeof value === 'string' && (BUILT_IN.test(value) || UPLOADED.test(value));
}

/** Extracts the file name from an uploaded preset path, or null. */
export function uploadedPresetFile(urlPath: string): string | null {
  if (!UPLOADED.test(urlPath)) return null;
  return urlPath.slice(urlPath.lastIndexOf('/') + 1);
}
