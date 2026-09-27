import type { ThemeSwatch } from './types';

/**
 * Traduce nombres de paleta antiguos a los actuales.
 *
 * Las paletas se llamaban por el producto del que se copió su aspecto. Ese
 * nombre ya está guardado en localStorage y en settings.themePalette de la base
 * de datos, así que renombrarlas a secas dejaría a esos usuarios con una paleta
 * inexistente y el fondo por defecto. Aquí se traducen al vuelo.
 */
const PALETAS_HEREDADAS: Record<string, string> = {
  'discord-dark': 'grafito',
  'discord-ash': 'carbon',
  'discord-light': 'marfil',
};

export function normalizarPaleta(paleta?: string | null): string {
  if (!paleta) return 'sync';
  return PALETAS_HEREDADAS[paleta] ?? paleta;
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
  // Los nombres visibles estaban intercambiados respecto al color que aplican:
  // "Oscuro" pintaba #313338 (gris) y "Ceniza" pintaba #111214 (casi negro).
  // Venía de heredar la nomenclatura del producto del que se copió el aspecto,
  // donde el tema llamado "oscuro" es precisamente el gris.
  // Se corrigen las etiquetas; los `id` se conservan porque están guardados en
  // localStorage, y las paletas renombradas se traducen en normalizarPaleta().
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

export { PALETAS_HEREDADAS };
