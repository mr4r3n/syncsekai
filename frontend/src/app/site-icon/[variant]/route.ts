import { promises as fs } from 'fs';
import path from 'path';

/*
 * /logo.webp, /icon.png y /apple-touch-icon.png se reescriben aquí (next.config).
 * Se sirve el icono subido desde Ajustes del sitio si el backend lo tiene; si
 * no, el fichero de serie de public/. Así los sitios que pintan el logo no
 * tienen que saber si hay uno personalizado.
 */
const DE_SERIE: Record<string, { fichero: string; tipo: string }> = {
  logo: { fichero: 'logo.webp', tipo: 'image/webp' },
  favicon: { fichero: 'icon.png', tipo: 'image/png' },
  apple: { fichero: 'apple-touch-icon.png', tipo: 'image/png' },
};

const CACHE = 'public, max-age=300';

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const serie = DE_SERIE[variant];
  if (!serie) return new Response('Not found', { status: 404 });

  const backend =
    process.env.INTERNAL_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://127.0.0.1:4000');

  try {
    const res = await fetch(`${backend}/api/setup/site-icon/${variant}`, { cache: 'no-store' });
    if (res.ok) {
      return new Response(await res.arrayBuffer(), {
        headers: { 'Content-Type': res.headers.get('content-type') || serie.tipo, 'Cache-Control': CACHE },
      });
    }
  } catch {
    // Backend caído: el icono de serie sigue saliendo.
  }

  const bytes = await fs.readFile(path.join(process.cwd(), 'public', serie.fichero));
  return new Response(bytes, { headers: { 'Content-Type': serie.tipo, 'Cache-Control': CACHE } });
}
