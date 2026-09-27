import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Tarjeta social generada por código.
 *
 * El Open Graph apuntaba a un logo cuadrado de 800x800. WhatsApp, Discord,
 * Twitter y Telegram recortan o encogen las imágenes cuadradas, así que el
 * enlace compartido se veía pobre justo en el canal por el que llega el tráfico
 * de una herramienta como esta. 1200x630 es la proporción que esperan todas.
 *
 * Se genera aquí en lugar de exportar un PNG para que la tarjeta siga al
 * producto: si cambia el titular o los servicios soportados, cambia con él.
 */
export const alt = 'SyncSekai — Sync anime from Plex, Jellyfin & Emby to AniList, MyAnimeList & Kitsu';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Descarga una variante de Outfit, la fuente del propio sitio.
 *
 * Devuelve null si algo falla: sin fuente propia la tarjeta se dibuja con la
 * tipográfica por defecto, que es peor pero funciona. Un corte de red no debe
 * tumbar la compilación entera por una imagen.
 */
async function cargarOutfit(peso: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Outfit:wght@${peso}&display=swap`,
      // Sin un User-Agent de navegador, Google devuelve woff2, que Satori no lee.
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
    ).then((r) => r.text());

    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** Lee un asset de /public y lo devuelve como data URI para incrustarlo. */
async function comoDataUri(fichero: string, mime: string): Promise<string | null> {
  try {
    const bin = await readFile(join(process.cwd(), 'public', fichero));
    return `data:${mime};base64,${bin.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [negrita, media, logo, plex, jellyfin, emby, anilist, mal] = await Promise.all([
    cargarOutfit(800),
    cargarOutfit(500),
    comoDataUri('icon.png', 'image/png'),
    comoDataUri('plex.svg', 'image/svg+xml'),
    comoDataUri('jellyfin.svg', 'image/svg+xml'),
    comoDataUri('emby.svg', 'image/svg+xml'),
    comoDataUri('anilist.svg', 'image/svg+xml'),
    comoDataUri('mal.svg', 'image/svg+xml'),
  ]);

  const fonts = [
    negrita && { name: 'Outfit', data: negrita, weight: 800 as const, style: 'normal' as const },
    media && { name: 'Outfit', data: media, weight: 500 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: 'normal' }[];

  const familia = fonts.length ? 'Outfit' : undefined;

  // Kitsu no tiene logo en /public, así que se representa con su color de marca.
  // Mejor una pastilla coherente que un hueco o un logo de peor calidad.
  const servicios = [
    { nombre: 'Plex', icono: plex, color: '#E5A00D' },
    { nombre: 'Jellyfin', icono: jellyfin, color: '#AA5CC3' },
    { nombre: 'Emby', icono: emby, color: '#52B54B' },
    { nombre: 'AniList', icono: anilist, color: '#02A9FF' },
    { nombre: 'MyAnimeList', icono: mal, color: '#2E51A2' },
    { nombre: 'Kitsu', icono: null, color: '#FD755C' },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '68px 76px',
          background: '#141414',
          backgroundImage:
            'radial-gradient(circle at 12% 6%, rgba(255,99,74,0.30), transparent 42%), radial-gradient(circle at 92% 96%, rgba(2,169,255,0.18), transparent 46%)',
          fontFamily: familia,
          color: '#F4F4F6',
        }}
      >
        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {logo ? (
            <img src={logo} width={40} height={40} alt="" style={{ borderRadius: 10 }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FF634A', display: 'flex' }} />
          )}
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>
            SyncSekai
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 6,
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 17,
              fontWeight: 500,
              color: '#A1A1AA',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            Anime scrobbler
          </div>
        </div>

        {/* Titular */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-2.4px',
              maxWidth: 940,
            }}
          >
            Every episode you watch, already on your lists.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 27,
              fontWeight: 500,
              color: '#A1A1AA',
              maxWidth: 880,
              lineHeight: 1.35,
            }}
          >
            Plex, Jellyfin and Emby to AniList, MyAnimeList and Kitsu, in real time. Nothing to install.
          </div>
        </div>

        {/* Servicios soportados */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {servicios.map((s) => (
            <div
              key={s.nombre}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${s.color}55`,
              }}
            >
              {s.icono ? (
                <img src={s.icono} width={24} height={24} alt="" style={{ borderRadius: 5 }} />
              ) : (
                <div
                  style={{ width: 24, height: 24, borderRadius: 5, background: s.color, display: 'flex' }}
                />
              )}
              <div style={{ display: 'flex', fontSize: 21, fontWeight: 500, color: '#E4E4E7' }}>
                {s.nombre}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
