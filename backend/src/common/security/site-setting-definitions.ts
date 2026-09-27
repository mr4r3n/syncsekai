import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Public site settings edited from the admin panel.
 *
 * A closed list, like the credentials: `SystemSetting` also stores the setup
 * lock and the maintenance mode, and an endpoint accepting any key would be
 * "write whatever you want into the configuration". None of these values is
 * secret; all of them are served to the browser.
 */

export interface SiteSettingDefinition {
  key: string;
  /** Field name in the public response. */
  field: 'siteName' | 'siteTitle' | 'siteDescription' | 'contactEmail' | 'registrationOpen';
  defaultValue: string;
  maxLength: number;
}

export const SITE_SETTINGS: readonly SiteSettingDefinition[] = [
  { key: 'SITE_NAME', field: 'siteName', defaultValue: 'SyncSekai', maxLength: 40 },
  // Google truncates the title around 60 characters and the description around 155.
  { key: 'SITE_TITLE', field: 'siteTitle', defaultValue: 'SyncSekai — Plex, Jellyfin & Emby to AniList, MAL & Kitsu', maxLength: 70 },
  {
    key: 'SITE_DESCRIPTION',
    field: 'siteDescription',
    defaultValue: 'Automatically sync anime from Plex, Jellyfin & Emby to AniList, MyAnimeList (MAL) and Kitsu. No install, works from any device.',
    maxLength: 170,
  },
  { key: 'SITE_CONTACT_EMAIL', field: 'contactEmail', defaultValue: '', maxLength: 120 },
  { key: 'REGISTRATION_OPEN', field: 'registrationOpen', defaultValue: 'true', maxLength: 5 },
] as const;

const BY_KEY = new Map(SITE_SETTINGS.map((a) => [a.key, a]));

export function findSiteSetting(key: string): SiteSettingDefinition | undefined {
  return BY_KEY.get(key);
}

export type PublicSiteSettings = {
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  contactEmail: string;
  registrationOpen: boolean;
  /** Timestamp of the last icon upload, or null when the built-in one is used. */
  iconVersion: string | null;
};

/** Written by the server when the icon is uploaded; not editable by hand. */
export const ICON_VERSION_KEY = 'SITE_ICON_VERSION';

/** Merges stored values with the defaults; an empty value counts as unset. */
export function resolveSiteSettings(stored: Map<string, string>): PublicSiteSettings {
  const value = (a: SiteSettingDefinition) => (stored.get(a.key) || '').trim() || a.defaultValue;
  const byField = Object.fromEntries(SITE_SETTINGS.map((a) => [a.field, value(a)])) as Record<SiteSettingDefinition['field'], string>;
  return {
    siteName: byField.siteName,
    siteTitle: byField.siteTitle,
    siteDescription: byField.siteDescription,
    contactEmail: byField.contactEmail,
    registrationOpen: byField.registrationOpen !== 'false',
    iconVersion: stored.get(ICON_VERSION_KEY) || null,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the reason if the value is invalid; `null` if it is acceptable. */
export function validateSiteSetting(a: SiteSettingDefinition, value: string): string | null {
  if (value.length > a.maxLength) return `${a.key} cannot exceed ${a.maxLength} characters.`;
  if (a.key === 'SITE_CONTACT_EMAIL' && value && !EMAIL_PATTERN.test(value)) return 'The contact email is not valid.';
  if (a.key === 'REGISTRATION_OPEN' && value !== 'true' && value !== 'false') return 'REGISTRATION_OPEN must be true or false.';
  if (/[\r\n<>]/.test(value)) return `${a.key} does not accept line breaks or tags.`;
  return null;
}

/**
 * Maintenance mode, read by the admin panel and by the public status endpoint
 * that the frontend checks on every page. A database hiccup counts as "not in
 * maintenance" rather than taking the whole site down.
 */
export async function readMaintenanceStatus(prisma: Pick<PrismaService, 'systemSetting'>) {
  const [enabled, message, estimatedEnd] = await Promise.all(
    ['MAINTENANCE_MODE', 'MAINTENANCE_MESSAGE', 'MAINTENANCE_ESTIMATED_END'].map((key) =>
      prisma.systemSetting.findUnique({ where: { key } }).catch(() => null),
    ),
  );
  return {
    enabled: enabled?.value === 'true',
    message: message?.value || "We are tuning SyncSekai's sync engines. We will be back shortly.",
    estimatedEnd: estimatedEnd?.value || null,
  };
}
