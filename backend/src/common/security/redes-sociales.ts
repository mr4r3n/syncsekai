/**
 * Catálogo de redes que se pueden enlazar desde el pie.
 *
 * Se elige una del desplegable y de ahí salen el nombre y el icono: no hay que
 * subir ninguna imagen. Los ficheros viven en `frontend/public/social/` y se
 * sirven como estáticos.
 *
 * Que el icono lo ponga el servidor a partir del identificador, y no el cliente
 * como una ruta cualquiera, es deliberado: `iconUrl` acaba en el `src` de una
 * imagen que ve todo el que abre la portada, así que tiene que salir de una
 * lista cerrada igual que la URL de destino.
 *
 * Varias marcas son monocromas y negras (X, GitHub, TikTok). Sueltas
 * desaparecen sobre el tema oscuro, así que esas traen una segunda variante en
 * blanco y el pie enseña una u otra según el tema.
 *
 * Para cambiar un icono por otro basta con dejar el fichero con el mismo nombre
 * en `frontend/public/social/`; no hay que tocar este fichero.
 */

export interface RedSocial {
  /** Identificador estable. Es también el nombre del fichero SVG. */
  id: string;
  /** Nombre que se muestra. */
  label: string;
  /** Ruta del icono para el tema claro (y para todos si no hay variante). */
  icon: string;
  /** Variante clara del glifo, sólo en las marcas monocromas. */
  iconDark?: string;
  /** Ejemplo que se enseña en el formulario, para que se vea qué se espera. */
  ejemplo: string;
}

export const REDES_SOCIALES: readonly RedSocial[] = [
  { id: 'discord', label: 'Discord', icon: '/social/discord.svg', ejemplo: 'https://discord.gg/tu-servidor' },
  { id: 'x', label: 'X', icon: '/social/x.svg', iconDark: '/social/x-light.svg', ejemplo: 'https://x.com/tu-cuenta' },
  { id: 'instagram', label: 'Instagram', icon: '/social/instagram.svg', ejemplo: 'https://instagram.com/tu-cuenta' },
  { id: 'facebook', label: 'Facebook', icon: '/social/facebook.svg', ejemplo: 'https://facebook.com/tu-pagina' },
  { id: 'youtube', label: 'YouTube', icon: '/social/youtube.svg', ejemplo: 'https://youtube.com/@tu-canal' },
  { id: 'twitch', label: 'Twitch', icon: '/social/twitch.svg', ejemplo: 'https://twitch.tv/tu-canal' },
  { id: 'tiktok', label: 'TikTok', icon: '/social/tiktok.svg', iconDark: '/social/tiktok-light.svg', ejemplo: 'https://tiktok.com/@tu-cuenta' },
  { id: 'reddit', label: 'Reddit', icon: '/social/reddit.svg', ejemplo: 'https://reddit.com/r/tu-comunidad' },
  { id: 'telegram', label: 'Telegram', icon: '/social/telegram.svg', ejemplo: 'https://t.me/tu-canal' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '/social/whatsapp.svg', ejemplo: 'https://chat.whatsapp.com/tu-grupo' },
  { id: 'bluesky', label: 'Bluesky', icon: '/social/bluesky.svg', ejemplo: 'https://bsky.app/profile/tu-cuenta' },
  { id: 'mastodon', label: 'Mastodon', icon: '/social/mastodon.svg', ejemplo: 'https://mastodon.social/@tu-cuenta' },
  { id: 'github', label: 'GitHub', icon: '/social/github.svg', iconDark: '/social/github-light.svg', ejemplo: 'https://github.com/tu-cuenta' },
];

export function buscarRed(id: unknown): RedSocial | null {
  if (typeof id !== 'string') return null;
  return REDES_SOCIALES.find((r) => r.id === id) ?? null;
}

/** ¿Es esta ruta de icono una del catálogo? Nada más se admite para SOCIAL. */
export function esIconoDeCatalogo(ruta: unknown): boolean {
  if (typeof ruta !== 'string') return false;
  return REDES_SOCIALES.some((r) => r.icon === ruta || r.iconDark === ruta);
}
