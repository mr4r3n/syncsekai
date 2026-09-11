/**
 * La plantilla de los correos que manda la aplicación.
 *
 * Reglas del formato, por compatibilidad entre clientes de correo:
 *
 * - Todo con `<table>`. Outlook usa el motor de Word y no aplica flex ni grid.
 * - Estilos en línea. No hay `<style>`: Gmail lo respeta, otros lo tiran.
 * - **La imagen no puede ser necesaria.** Casi todos los clientes bloquean las
 *   imágenes remotas hasta que el usuario las pide, así que el logotipo es
 *   decoración y el nombre va escrito al lado.
 * - **El botón tampoco.** Va siempre acompañado del enlace en texto, porque hay
 *   clientes que despintan los enlaces con fondo y quedan invisibles.
 * - Oscuro, como la web, pero con todos los colores puestos a mano y las dos
 *   metas de `color-scheme`. Sin ellas, Gmail y Outlook en modo oscuro invierten
 *   por su cuenta un correo que ya era oscuro y lo dejan gris sobre gris.
 *
 * Los colores son los mismos tokens del tema oscuro de `globals.css`, copiados
 * como literales: en un correo no hay variables CSS que valgan.
 */

/** `--accent-primary` */
const ACENTO = '#FF634A';
/** `--btn-primary-text`. Sobre el coral, el blanco se queda en 2,9:1. */
const TEXTO_SOBRE_ACENTO = '#0A0A0A';
/** Un rojo que llega a 4.5:1 con texto blanco; el coral de marca no llega. */
const PELIGRO = '#BE123C';
/** `--bg-app` */
const FONDO = '#1A1A1A';
/** `--bg-surface`, sin la transparencia: en un correo no hay nada detrás. */
const TARJETA = '#252525';
const TARJETA_SUAVE = '#2E2E2E';
/** `--text-primary` / `--text-secondary` / `--text-muted` */
const TEXTO = '#F4F4F6';
const TEXTO_SUAVE = '#D4D4D8';
const TEXTO_TENUE = '#A1A1AA';
/** `--border-subtle`, resuelto sobre la tarjeta. */
const BORDE = '#3A3A3A';
const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface Boton {
  texto: string;
  url: string;
  /** Rojo, para lo que no tiene vuelta atrás: borrar la cuenta. */
  peligro?: boolean;
}

export interface CorreoOpciones {
  /** El titular dentro del recuadro. */
  titulo: string;
  /** Párrafos del cuerpo, ya escapados si vienen de datos del usuario. */
  parrafos: string[];
  boton?: Boton;
  /** Un valor que hay que copiar tal cual: un código de un solo uso. */
  codigo?: string;
  /** Aviso al pie, en pequeño: caducidad, qué hacer si no fuiste tú. */
  nota?: string;
  /** Base para el logotipo. Sin ella el correo sale igual, sin imagen. */
  frontendUrl?: string;
}

/** `<`, `&` y compañía en un correo con el nombre de usuario dentro. */
export function escapar(valor: string): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plantillaCorreo(opciones: CorreoOpciones): string {
  const { titulo, parrafos, boton, codigo, nota, frontendUrl } = opciones;

  const logo = frontendUrl
    ? `<img src="${frontendUrl}/icon.png" width="28" height="28" alt=""
           style="display:block;border:0;border-radius:6px;" />`
    : '';

  const cuerpo = parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:${TEXTO_SUAVE};">${p}</p>`,
    )
    .join('');

  const bloqueCodigo = codigo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         <tr><td align="center" style="padding:8px 0 20px 0;">
           <div style="display:inline-block;padding:14px 28px;background:${TARJETA_SUAVE};border:1px solid ${BORDE};border-radius:8px;
                       font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
                       font-size:26px;font-weight:700;letter-spacing:6px;color:${TEXTO};">${escapar(codigo)}</div>
         </td></tr>
       </table>`
    : '';

  // Enlace en texto bajo el botón: algunos clientes eliminan los fondos de color.
  const bloqueBoton = boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         <tr><td align="center" style="padding:10px 0 18px 0;">
           <a href="${boton.url}"
              style="display:inline-block;padding:13px 30px;
                     background:${boton.peligro ? PELIGRO : ACENTO};
                     color:${boton.peligro ? '#FFFFFF' : TEXTO_SOBRE_ACENTO};
                     font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${escapar(boton.texto)}</a>
         </td></tr>
         <tr><td align="center" style="padding:0 0 6px 0;font-size:11px;line-height:1.5;color:${TEXTO_TENUE};word-break:break-all;">
           Si el botón no funciona, copia este enlace:<br />
           <a href="${boton.url}" style="color:${ACENTO};">${boton.url}</a>
         </td></tr>
       </table>`
    : '';

  const bloqueNota = nota
    ? `<p style="margin:18px 0 0 0;padding-top:16px;border-top:1px solid ${BORDE};
                 font-size:12px;line-height:1.5;color:${TEXTO_TENUE};">${nota}</p>`
    : '';

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapar(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${FONDO};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="max-width:520px;background:${TARJETA};border:1px solid ${BORDE};border-radius:12px;font-family:${FUENTE};">

      <tr><td style="padding:22px 28px;border-bottom:1px solid ${BORDE};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${logo ? `<td style="padding-right:10px;">${logo}</td>` : ''}
            <td style="font-size:15px;font-weight:700;color:${TEXTO};letter-spacing:-0.2px;">SyncSekai</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 14px 0;font-size:19px;font-weight:700;line-height:1.3;color:${TEXTO};">${escapar(titulo)}</h1>
        ${cuerpo}
        ${bloqueCodigo}
        ${bloqueBoton}
        ${bloqueNota}
      </td></tr>

      <tr><td style="padding:16px 28px;border-top:1px solid ${BORDE};font-size:11px;line-height:1.5;color:${TEXTO_TENUE};">
        Este mensaje se envía automáticamente. No hace falta responder.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
