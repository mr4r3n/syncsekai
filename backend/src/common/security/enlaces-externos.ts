/**
 * Validación de las URL que un administrador configura para el pie de la web.
 *
 * Estas cadenas acaban en el `href` de un enlace que ve todo el que abre la
 * portada, incluida gente sin cuenta. Un `javascript:` ahí no es un enlace roto:
 * es ejecución de guion servida por nosotros, en nuestro dominio, con la sesión
 * de quien pinche. `data:` permite lo mismo por otra puerta, y `//otrositio.com`
 * parece una ruta interna y no lo es.
 *
 * Por eso esto es una lista de lo que se acepta, no de lo que se prohíbe: una
 * lista de prohibidos siempre va por detrás del siguiente esquema que alguien
 * invente, y el navegador tolera cosas que una prohibición ingenua deja pasar.
 *
 * scripts/check-enlaces-externos.js recorre los casos que motivan cada regla.
 */

/** Longitud máxima. No hay ninguna URL legítima de un pie de página así de larga. */
const MAXIMO = 500;

/**
 * Cualquier espacio en blanco o carácter de control.
 *
 * Es la vía clásica para colar un esquema prohibido por delante de un filtro
 * que sólo mira el prefijo: un salto de línea en medio de `javascript:` lo
 * esconde de la comprobación y el navegador lo interpreta igual.
 */
const BLANCO_O_CONTROL = /[\s\u0000-\u001F\u007F]/;

/**
 * Normaliza y valida una URL de enlace externo.
 * Devuelve la URL ya limpia, o null si no es admisible.
 *
 * Sólo pasa `https://`. Se deja fuera `http://` a propósito: son enlaces que
 * publicamos nosotros y mandar a la gente a texto plano en 2026 no tiene
 * defensa; si un sitio amigo no tiene TLS, no se enlaza.
 */
export function normalizarUrlExterna(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim();
  if (!limpio || limpio.length > MAXIMO) return null;
  if (BLANCO_O_CONTROL.test(limpio)) return null;

  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    // Sin esquema no hay URL absoluta: descarta rutas relativas y `//host`.
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;

  // Credenciales incrustadas: `https://usuario:clave@sitio.com`. No hacen falta
  // nunca aquí y sirven para disfrazar el destino real ante quien mira el enlace.
  if (url.username || url.password) return null;

  return url.toString();
}

/**
 * Normaliza y valida una dirección de correo para el enlace de contacto.
 * Se guarda ya como `mailto:`, que es como se va a usar.
 */
export function normalizarCorreoExterno(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim().replace(/^mailto:/i, '');
  if (!limpio || limpio.length > MAXIMO) return null;
  if (BLANCO_O_CONTROL.test(limpio)) return null;

  // Deliberadamente estricta: es una dirección que escribe un administrador en
  // un formulario, no un campo de registro donde haya que aceptar rarezas.
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(limpio)) return null;

  return `mailto:${limpio}`;
}

/**
 * Valida cualquiera de las dos formas, que es lo que guarda `SiteLink.url`.
 */
export function normalizarDestinoEnlace(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim().toLowerCase().startsWith('mailto:')) {
    return normalizarCorreoExterno(valor);
  }
  return normalizarUrlExterna(valor);
}

/**
 * Texto que escribe un administrador y se muestra tal cual (nombre y
 * descripción). React ya escapa el contenido al renderizarlo, así que aquí lo
 * único que hace falta es acotar la longitud y quitar controles, para que un
 * nombre de 10 000 caracteres no reviente la maquetación del pie.
 */
export function normalizarTextoEnlace(valor: unknown, maximo: number): string | null {
  if (typeof valor !== 'string') return null;

  const limpio = valor.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!limpio) return null;

  return limpio.slice(0, maximo);
}
