/**
 * Catalog of social networks that can be linked from the footer.
 *
 * One is picked from the dropdown and the name and icon come from it: no
 * image has to be uploaded. The files live in `frontend/public/social/` and
 * are served as static assets.
 *
 * Having the server set the icon from the identifier, rather than the client
 * sending any path, is deliberate: `iconUrl` ends up in the `src` of an image
 * that everyone who opens the landing page sees, so it must come from a closed
 * list just like the target URL.
 *
 * Several brands are monochrome black (X, GitHub, TikTok). On their own they
 * disappear on the dark theme, so those ship a second white variant and the
 * footer shows one or the other depending on the theme.
 *
 * To swap an icon, drop a file with the same name into
 * `frontend/public/social/`; this file does not need to change.
 */

export interface SocialNetwork {
  /** Stable identifier. It is also the SVG file name. */
  id: string;
  /** Display name. */
  label: string;
  /** Icon path for the light theme (and for both if there is no variant). */
  icon: string;
  /** Light variant of the glyph, only for monochrome brands. */
  iconDark?: string;
  /** Example shown in the form, so it is clear what is expected. */
  example: string;
}

export const SOCIAL_NETWORKS: readonly SocialNetwork[] = [
  { id: 'discord', label: 'Discord', icon: '/social/discord.svg', example: 'https://discord.gg/your-server' },
  { id: 'x', label: 'X', icon: '/social/x.svg', iconDark: '/social/x-light.svg', example: 'https://x.com/your-account' },
  { id: 'instagram', label: 'Instagram', icon: '/social/instagram.svg', example: 'https://instagram.com/your-account' },
  { id: 'facebook', label: 'Facebook', icon: '/social/facebook.svg', example: 'https://facebook.com/your-page' },
  { id: 'youtube', label: 'YouTube', icon: '/social/youtube.svg', example: 'https://youtube.com/@your-channel' },
  { id: 'twitch', label: 'Twitch', icon: '/social/twitch.svg', example: 'https://twitch.tv/your-channel' },
  { id: 'tiktok', label: 'TikTok', icon: '/social/tiktok.svg', iconDark: '/social/tiktok-light.svg', example: 'https://tiktok.com/@your-account' },
  { id: 'reddit', label: 'Reddit', icon: '/social/reddit.svg', example: 'https://reddit.com/r/your-community' },
  { id: 'telegram', label: 'Telegram', icon: '/social/telegram.svg', example: 'https://t.me/your-channel' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '/social/whatsapp.svg', example: 'https://chat.whatsapp.com/your-group' },
  { id: 'bluesky', label: 'Bluesky', icon: '/social/bluesky.svg', example: 'https://bsky.app/profile/your-account' },
  { id: 'mastodon', label: 'Mastodon', icon: '/social/mastodon.svg', example: 'https://mastodon.social/@your-account' },
  { id: 'github', label: 'GitHub', icon: '/social/github.svg', iconDark: '/social/github-light.svg', example: 'https://github.com/your-account' },
];

export function findNetwork(id: unknown): SocialNetwork | null {
  if (typeof id !== 'string') return null;
  return SOCIAL_NETWORKS.find((r) => r.id === id) ?? null;
}

/** Is this icon path one from the catalog? Nothing else is accepted for SOCIAL. */
export function isCatalogIcon(urlPath: unknown): boolean {
  if (typeof urlPath !== 'string') return false;
  return SOCIAL_NETWORKS.some((r) => r.icon === urlPath || r.iconDark === urlPath);
}
