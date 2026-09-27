/**
 * Nombre de país en el idioma de la interfaz a partir del código ISO.
 *
 * El backend guarda el nombre en español (viene de su tabla ISO); pintar el
 * código con `Intl.DisplayNames` da el nombre en el idioma activo sin
 * mantener otra tabla. Si el código no es válido, se devuelve lo que llegó.
 */
export function nombreRegion(code: string | undefined | null, locale: string, fallback = ''): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return fallback;
  try {
    const nombre = new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase());
    // Un código que no existe (XX) vuelve tal cual: no es un nombre.
    return nombre && nombre !== code.toUpperCase() ? nombre : fallback;
  } catch {
    return fallback;
  }
}
