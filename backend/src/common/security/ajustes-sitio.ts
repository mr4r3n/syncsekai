/**
 * Ajustes públicos del sitio que se editan desde el panel.
 *
 * Lista cerrada, igual que las credenciales: `SystemSetting` guarda también el
 * bloqueo de instalación y el modo mantenimiento, y un endpoint que aceptara
 * cualquier clave sería "escribe lo que quieras en la configuración". Ninguno
 * de estos valores es secreto; todos se sirven al navegador.
 */

export interface AjusteSitio {
  clave: string;
  /** Nombre del campo en la respuesta pública. */
  campo: 'siteName' | 'siteTitle' | 'siteDescription' | 'contactEmail' | 'registrationOpen';
  porDefecto: string;
  maxLargo: number;
}

export const AJUSTES_SITIO: readonly AjusteSitio[] = [
  { clave: 'SITE_NAME', campo: 'siteName', porDefecto: 'SyncSekai', maxLargo: 40 },
  // Google corta el título sobre los 60 caracteres y la descripción sobre los 155.
  { clave: 'SITE_TITLE', campo: 'siteTitle', porDefecto: 'SyncSekai — Plex, Jellyfin & Emby to AniList, MAL & Kitsu', maxLargo: 70 },
  {
    clave: 'SITE_DESCRIPTION',
    campo: 'siteDescription',
    porDefecto: 'Automatically sync anime from Plex, Jellyfin & Emby to AniList, MyAnimeList (MAL) and Kitsu. No install, works from any device.',
    maxLargo: 170,
  },
  { clave: 'SITE_CONTACT_EMAIL', campo: 'contactEmail', porDefecto: '', maxLargo: 120 },
  { clave: 'REGISTRATION_OPEN', campo: 'registrationOpen', porDefecto: 'true', maxLargo: 5 },
] as const;

const PORCLAVE = new Map(AJUSTES_SITIO.map((a) => [a.clave, a]));

export function buscarAjusteSitio(clave: string): AjusteSitio | undefined {
  return PORCLAVE.get(clave);
}

export type AjustesSitioPublicos = {
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  contactEmail: string;
  registrationOpen: boolean;
};

/** Mezcla lo guardado con los valores por defecto; un valor vacío cuenta como no puesto. */
export function resolverAjustesSitio(guardados: Map<string, string>): AjustesSitioPublicos {
  const valor = (a: AjusteSitio) => (guardados.get(a.clave) || '').trim() || a.porDefecto;
  const por = Object.fromEntries(AJUSTES_SITIO.map((a) => [a.campo, valor(a)])) as Record<AjusteSitio['campo'], string>;
  return {
    siteName: por.siteName,
    siteTitle: por.siteTitle,
    siteDescription: por.siteDescription,
    contactEmail: por.contactEmail,
    registrationOpen: por.registrationOpen !== 'false',
  };
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Devuelve el motivo si el valor no vale; `null` si es aceptable. */
export function validarAjusteSitio(a: AjusteSitio, valor: string): string | null {
  if (valor.length > a.maxLargo) return `${a.clave} no puede superar ${a.maxLargo} caracteres.`;
  if (a.clave === 'SITE_CONTACT_EMAIL' && valor && !CORREO.test(valor)) return 'El correo de contacto no es válido.';
  if (a.clave === 'REGISTRATION_OPEN' && valor !== 'true' && valor !== 'false') return 'REGISTRATION_OPEN debe ser true o false.';
  if (/[\r\n<>]/.test(valor)) return `${a.clave} no admite saltos de línea ni etiquetas.`;
  return null;
}
