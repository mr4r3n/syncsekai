/**
 * Identificación de imágenes por sus bytes de cabecera.
 *
 * La extensión del fichero y el Content-Type los elige el cliente, así que
 * ninguno de los dos sirve para decidir si algo es una imagen: basta renombrar
 * un .html a .png para que ambos mientan. Los bytes iniciales, en cambio, los
 * pone el codificador que generó el fichero.
 *
 * Esto no sustituye al reencodeo con sharp, que es lo que de verdad neutraliza
 * una carga incrustada. Es una criba previa para no entregarle bytes
 * arbitrarios al decodificador de imágenes, que históricamente ha sido una
 * superficie de ataque con CVEs propios.
 */

import { BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';

export type TipoImagen = 'jpeg' | 'png' | 'webp';

/** Formatos que aceptamos en subidas de usuario, alineados con lo que dice la interfaz. */
export const FORMATOS_ACEPTADOS: readonly TipoImagen[] = ['jpeg', 'png', 'webp'];

function empiezaPor(buffer: Buffer, bytes: number[], desplazamiento = 0): boolean {
  if (buffer.length < desplazamiento + bytes.length) return false;
  return bytes.every((b, i) => buffer[desplazamiento + i] === b);
}

/**
 * Devuelve el formato detectado por cabecera, o null si no reconoce ninguno.
 *
 * Solo cubre JPEG, PNG y WebP porque son los tres que ofrece la
 * interfaz. Si algún día se aceptan AVIF o HEIC, hay que añadir su firma aquí
 * (ambos usan cajas ftyp de ISO-BMFF, con la marca en el desplazamiento 4).
 */
export function detectarTipoImagen(buffer: Buffer): TipoImagen | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (empiezaPor(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: 89 "PNG" CR LF SUB LF
  if (empiezaPor(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // WebP: "RIFF" ... "WEBP" (el tamaño ocupa los bytes 4-7)
  if (
    empiezaPor(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    empiezaPor(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }

  return null;
}

const logger = new Logger('imagen');

/**
 * Valida una imagen subida por un usuario y la reescribe como WebP cuadrado.
 *
 * Es la única puerta por la que entra una imagen de usuario al disco: la usan
 * el avatar propio, los avatares predeterminados y los logos de los sitios
 * enlazados. Si se relaja aquí, se relaja en los tres a la vez, que es
 * justamente lo que se quiere de una comprobación de frontera; si cada módulo
 * tuviera la suya, arreglar una dejaría las otras abiertas sin que se note.
 */
/** Variantes del icono del sitio: nombre de fichero y lado en píxeles. */
export const VARIANTES_ICONO_SITIO = {
  logo: { fichero: 'logo.webp', lado: 512 },
  favicon: { fichero: 'favicon.png', lado: 64 },
  apple: { fichero: 'apple-touch-icon.png', lado: 180 },
} as const;

/**
 * Escribe las tres variantes del icono del sitio a partir de una subida.
 * Pasa por `reencodearImagenCuadrada` para la primera (validación y reencodeo)
 * y deriva las otras dos de ese WebP ya limpio.
 */
export async function reencodearIconoSitio(fileBuffer: Buffer, carpeta: string): Promise<void> {
  const logo = path.join(carpeta, VARIANTES_ICONO_SITIO.logo.fichero);
  await reencodearImagenCuadrada(fileBuffer, logo, VARIANTES_ICONO_SITIO.logo.lado);
  for (const v of [VARIANTES_ICONO_SITIO.favicon, VARIANTES_ICONO_SITIO.apple]) {
    await sharp(logo).resize(v.lado, v.lado).png().toFile(path.join(carpeta, v.fichero));
  }
}

export async function reencodearImagenCuadrada(
  fileBuffer: Buffer,
  outputPath: string,
  lado = 256,
): Promise<void> {
  // Criba por bytes de cabecera ANTES de tocar el decodificador. La extension
  // y el Content-Type los elige el cliente, asi que un .html renombrado a .png
  // los enganaria a los dos; los bytes iniciales no.
  if (!detectarTipoImagen(fileBuffer)) {
    throw new BadRequestException(
      'El archivo no es una imagen valida. Se aceptan JPEG, PNG y WebP.',
    );
  }

  // limitInputPixels acota las bombas de descompresion: un PNG de pocos KB
  // puede declarar dimensiones enormes y agotar la memoria al decodificarse.
  // Mismo limite que ya usa covers.service.ts para las portadas remotas.
  try {
    const entrada = sharp(fileBuffer, { limitInputPixels: 25_000_000 });
    const meta = await entrada.metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('No se pudieron leer las dimensiones de la imagen.');
    }

    // El reencodeo es lo que de verdad neutraliza cualquier carga incrustada:
    // se descodifican los pixeles y se vuelve a escribir un WebP nuevo, de modo
    // que nada del fichero original sobrevive salvo la imagen en si.
    await entrada
      .resize(lado, lado, { fit: 'cover', position: 'center' })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath);
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    logger.warn(`Imagen rechazada al procesarla: ${err.message}`);
    throw new BadRequestException(
      'La imagen no se pudo procesar. Comprueba que no este corrupta y que no supere los 25 megapixeles.',
    );
  }
}
