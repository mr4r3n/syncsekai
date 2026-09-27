/**
 * Image identification by header bytes.
 *
 * The file extension and the Content-Type are chosen by the client, so
 * neither can decide whether something is an image: renaming a .html to .png
 * is enough to make both lie. The leading bytes, however, are written by the
 * encoder that produced the file.
 *
 * This does not replace re-encoding with sharp, which is what actually
 * neutralizes an embedded payload. It is a pre-filter so arbitrary bytes are
 * never handed to the image decoder, which has historically been an attack
 * surface with its own CVEs.
 */

import { BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

export type ImageType = 'jpeg' | 'png' | 'webp';

/** Formats accepted in user uploads, matching what the interface says. */
export const ACCEPTED_FORMATS: readonly ImageType[] = ['jpeg', 'png', 'webp'];

function hasPrefix(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buffer[offset + i] === b);
}

/**
 * Returns the format detected from the header, or null if none is recognized.
 *
 * It only covers JPEG, PNG and WebP because those are the three the interface
 * offers. If AVIF or HEIC are ever accepted, their signature must be added
 * here (both use ISO-BMFF ftyp boxes, with the brand at offset 4).
 */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: 89 "PNG" CR LF SUB LF
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // WebP: "RIFF" ... "WEBP" (the size takes bytes 4-7)
  if (
    hasPrefix(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }

  return null;
}

const logger = new Logger('image');

/**
 * Validates an image uploaded by a user and rewrites it as a square WebP.
 *
 * It is the only door through which a user image reaches the disk: it is used
 * by the user's own avatar, the default avatars and the logos of linked sites.
 * Relaxing it here relaxes all three at once, which is exactly what a boundary
 * check should do; if each module had its own, fixing one would leave the
 * others open without anyone noticing.
 */
/** Site icon variants: file name and side length in pixels. */
export const SITE_ICON_VARIANTS = {
  logo: { file: 'logo.webp', size: 512 },
  favicon: { file: 'favicon.png', size: 64 },
  apple: { file: 'apple-touch-icon.png', size: 180 },
} as const;

/**
 * Writes the three site icon variants from an upload.
 * The first goes through `reencodeSquareImage` (validation and re-encoding)
 * and the other two are derived from that clean WebP.
 */
export async function reencodeSiteIcon(fileBuffer: Buffer, dir: string): Promise<void> {
  const logo = path.join(dir, SITE_ICON_VARIANTS.logo.file);
  await reencodeSquareImage(fileBuffer, logo, SITE_ICON_VARIANTS.logo.size);
  // From memory, not from the path: libvips keeps the file open and on
  // Windows that prevents deleting it afterwards.
  const cleaned = await fs.promises.readFile(logo);
  for (const v of [SITE_ICON_VARIANTS.favicon, SITE_ICON_VARIANTS.apple]) {
    await sharp(cleaned).resize(v.size, v.size).png().toFile(path.join(dir, v.file));
  }
}

export async function reencodeSquareImage(
  fileBuffer: Buffer,
  outputPath: string,
  size = 256,
): Promise<void> {
  // Header-byte check BEFORE touching the decoder. The extension and the
  // Content-Type are chosen by the client, so a .html renamed to .png would
  // fool both; the leading bytes would not.
  if (!detectImageType(fileBuffer)) {
    throw new BadRequestException(
      'The file is not a valid image. JPEG, PNG and WebP are accepted.',
    );
  }

  // limitInputPixels caps decompression bombs: a PNG of a few KB can declare
  // huge dimensions and exhaust memory while being decoded.
  // Same limit covers.service.ts already uses for remote covers.
  try {
    const input = sharp(fileBuffer, { limitInputPixels: 25_000_000 });
    const meta = await input.metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('Could not read the image dimensions.');
    }

    // Re-encoding is what actually neutralizes any embedded payload: the pixels
    // are decoded and a brand new WebP is written, so nothing from the original
    // file survives except the image itself.
    await input
      .resize(size, size, { fit: 'cover', position: 'center' })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath);
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    logger.warn(`Image rejected while processing it: ${err.message}`);
    throw new BadRequestException(
      'The image could not be processed. Check that it is not corrupt and does not exceed 25 megapixels.',
    );
  }
}
