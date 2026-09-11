/**
 * Las credenciales del sistema que se pueden cambiar desde el panel.
 *
 * Es una lista cerrada a propósito. `SystemSetting` guarda mucho más que
 * credenciales —el bloqueo de instalación, el estado de mantenimiento, marcas
 * internas— y un endpoint que aceptara cualquier clave sería, en la práctica,
 * "escribe lo que quieras en la configuración del sistema". Aquí sólo entra lo
 * que esta pantalla tiene que poder rotar.
 *
 * Estas credenciales sólo se escribían durante la instalación, así que hasta
 * ahora no había forma de rotarlas: ni cuando caducan, ni cuando se filtran, que
 * es justo cuando hace falta.
 */

export interface CredencialSistema {
  clave: string;
  /** Se guarda cifrada y nunca se devuelve al navegador. */
  secreta: boolean;
  grupo: 'google' | 'discord' | 'anilist' | 'mal' | 'smtp' | 'plex';
  /**
   * El nombre técnico, sin traducir. Es el que aparece en la consola del
   * proveedor y en la variable de entorno: traducirlo obligaría a buscar la
   * equivalencia justo cuando se está copiando un valor de un sitio a otro.
   */
  etiqueta: string;
}

export const CREDENCIALES_SISTEMA: readonly CredencialSistema[] = [
  { clave: 'GOOGLE_CLIENT_ID', secreta: false, grupo: 'google', etiqueta: 'Client ID' },
  { clave: 'GOOGLE_CLIENT_SECRET', secreta: true, grupo: 'google', etiqueta: 'Client Secret' },

  { clave: 'DISCORD_CLIENT_ID', secreta: false, grupo: 'discord', etiqueta: 'Client ID' },
  { clave: 'DISCORD_CLIENT_SECRET', secreta: true, grupo: 'discord', etiqueta: 'Client Secret' },
  { clave: 'DISCORD_BOT_TOKEN', secreta: true, grupo: 'discord', etiqueta: 'Bot Token' },

  { clave: 'ANILIST_CLIENT_ID', secreta: false, grupo: 'anilist', etiqueta: 'Client ID' },
  { clave: 'ANILIST_CLIENT_SECRET', secreta: true, grupo: 'anilist', etiqueta: 'Client Secret' },

  { clave: 'MAL_CLIENT_ID', secreta: false, grupo: 'mal', etiqueta: 'Client ID' },
  { clave: 'MAL_CLIENT_SECRET', secreta: true, grupo: 'mal', etiqueta: 'Client Secret' },

  { clave: 'SMTP_HOST', secreta: false, grupo: 'smtp', etiqueta: 'Host' },
  { clave: 'SMTP_PORT', secreta: false, grupo: 'smtp', etiqueta: 'Port' },
  { clave: 'SMTP_USER', secreta: false, grupo: 'smtp', etiqueta: 'User' },
  { clave: 'SMTP_PASS', secreta: true, grupo: 'smtp', etiqueta: 'Password' },
  { clave: 'SMTP_FROM', secreta: false, grupo: 'smtp', etiqueta: 'From' },

  { clave: 'PLEX_CLIENT_ID', secreta: false, grupo: 'plex', etiqueta: 'Client ID' },
] as const;

const PORCLAVE = new Map(CREDENCIALES_SISTEMA.map((c) => [c.clave, c]));

/** `undefined` si la clave no está en la lista: no se toca nada que no esté aquí. */
export function buscarCredencial(clave: string): CredencialSistema | undefined {
  return PORCLAVE.get(clave);
}

/**
 * Cómo se enseña un valor ya guardado.
 *
 * Un secreto no vuelve nunca al navegador, ni siquiera parcialmente: unos pocos
 * caracteres de un client secret son unos pocos caracteres menos que adivinar, y
 * quien administra no necesita releerlo, necesita saber si está puesto y poder
 * cambiarlo. De los que no son secretos —un client id, un host de correo— sí se
 * devuelve el valor, porque hay que poder comprobar que es el correcto.
 */
export function valorParaMostrar(cred: CredencialSistema, valor: string): string | null {
  if (!valor) return null;
  return cred.secreta ? null : valor;
}
