/**
 * Avatares que se ofrecen a quien no quiere subir una foto propia.
 *
 * La lista viva se guarda en SystemSetting['PRESET_AVATARS'] como un array JSON
 * de rutas, de modo que se pueda ampliar desde el panel sin tocar el código ni
 * la base de datos. Cuando esa clave no existe todavía se usan los ocho que
 * vienen con el frontend, para que la funcionalidad no nazca vacía.
 *
 * Las rutas admitidas son de dos formas y sólo esas dos:
 *   /avatars/<id>.svg                    los que vienen en frontend/public
 *   /api/auth/avatar/preset/<fichero>    los que se suben desde el panel
 *
 * Es una lista cerrada, no un campo libre. Si el cliente pudiera mandar una
 * cadena cualquiera, `avatarUrl` pasaría a ser una URL elegida por el usuario e
 * incrustada en el <img> de todo el que vea su perfil: un balizador de terceros
 * de regalo y, con un `javascript:`, algo bastante peor.
 *
 * scripts/check-avatares-predeterminados.js comprueba que los de serie sigan
 * existiendo en disco y que el validador siga rechazando lo que debe.
 */

export const CLAVE_AVATARES_PREDETERMINADOS = 'PRESET_AVATARS';

/** Los que se sirven como fichero estático desde frontend/public/avatars. */
export const AVATARES_DE_SERIE: readonly string[] = [
  '/avatars/luna.svg',
  '/avatars/sakura.svg',
  '/avatars/ola.svg',
  '/avatars/torii.svg',
  '/avatars/gato.svg',
  '/avatars/estrella.svg',
  '/avatars/casete.svg',
  '/avatars/brote.svg',
];

/** Carpeta, dentro de uploads/, donde aterrizan los que se suben. */
export const CARPETA_PRESETS_SUBIDOS = 'avatars-preset';

const DE_SERIE = /^\/avatars\/[a-z0-9-]{1,40}\.svg$/;
const SUBIDO = /^\/api\/auth\/avatar\/preset\/[A-Za-z0-9_-]{1,60}\.webp$/;

/**
 * ¿Tiene esta cadena la forma de una ruta de avatar predeterminado?
 *
 * Es la criba de forma, no la de pertenencia: que algo tenga buena pinta no
 * significa que esté en la lista. Antes de guardarlo hay que comprobar además
 * que aparezca en la lista viva.
 */
export function pareceRutaDeAvatar(valor: unknown): valor is string {
  return typeof valor === 'string' && (DE_SERIE.test(valor) || SUBIDO.test(valor));
}

/** Extrae el nombre de fichero de una ruta de preset subido, o null. */
export function ficheroDePresetSubido(ruta: string): string | null {
  if (!SUBIDO.test(ruta)) return null;
  return ruta.slice(ruta.lastIndexOf('/') + 1);
}
