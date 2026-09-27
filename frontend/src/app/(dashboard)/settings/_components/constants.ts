import type { ThemeSwatch } from './types';

/**
 * Translates legacy palette names to current ones.
 *
 * Palettes were named after products from which appearance was copied. That
 * name is already stored in localStorage and in settings.themePalette in database,
 * so renaming directly would leave users with nonexistent palette and default
 * background. Here they are translated on the fly.
 */
const LEGACY_PALETTES: Record<string, string> = {
  'discord-dark': 'grafito',
  'discord-ash': 'carbon',
  'discord-light': 'marfil',
};

export function normalizePalette(palette?: string | null): string {
  if (!palette) return 'sync';
  return LEGACY_PALETTES[palette] ?? palette;
}

export const THEME_SWATCHES: ThemeSwatch[] = [
  {
    id: 'claro',
    name: 'settings.themeLight',
    bgColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.15)',
    palette: 'marfil',
    mode: 'light',
  },
  // Visible names were swapped relative to color applied:
  // "Dark" rendered #313338 (gray) and "Ash" rendered #111214 (near black).
  // Inherited naming from product whose look was mirrored,
  // where theme called "dark" is precisely that gray.
  // Labels corrected; `id` values preserved as stored in
  // localStorage, with renamed palettes translated in normalizePalette().
  {
    id: 'oscuro',
    name: 'settings.themeAsh',
    bgColor: '#313338',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'grafito',
    mode: 'dark',
  },
  {
    id: 'ceniza',
    name: 'settings.themeDark',
    bgColor: '#111214',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    palette: 'carbon',
    mode: 'dark',
  },
  {
    id: 'sync',
    name: 'settings.themeSync',
    bgColor: '#1A1A1A',
    dotColor: '#FF634A',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'sync',
    mode: 'dark',
  },
  {
    id: 'plex',
    name: 'settings.themePlex',
    bgColor: '#171717',
    dotColor: '#E5A00D',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'plex',
    mode: 'dark',
  },
  {
    id: 'auto',
    name: 'settings.syncWithSystem',
    bgColor: '#2B2D31',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    isAuto: true,
  },
];

export { LEGACY_PALETTES };
