import { promises as fs } from 'fs';
import path from 'path';

/*
 * /logo.webp, /icon.png, and /apple-touch-icon.png rewrite here (next.config).
 * Serves icon uploaded from Site Settings if backend provides it; otherwise,
 * stock file from public/. This way places rendering logo do not need to know
 * if a custom one exists.
 */
const BUILT_IN: Record<string, { file: string; type: string }> = {
  logo: { file: 'logo.webp', type: 'image/webp' },
  favicon: { file: 'icon.png', type: 'image/png' },
  apple: { file: 'apple-touch-icon.png', type: 'image/png' },
};

const CACHE = 'public, max-age=300';

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const stock = BUILT_IN[variant];
  if (!stock) return new Response('Not found', { status: 404 });

  const backend =
    process.env.INTERNAL_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://127.0.0.1:4000');

  try {
    const res = await fetch(`${backend}/api/setup/site-icon/${variant}`, { cache: 'no-store' });
    if (res.ok) {
      return new Response(await res.arrayBuffer(), {
        headers: { 'Content-Type': res.headers.get('content-type') || stock.type, 'Cache-Control': CACHE },
      });
    }
  } catch {
    // Backend down: stock icon continues serving.
  }

  const bytes = await fs.readFile(path.join(process.cwd(), 'public', stock.file));
  return new Response(bytes, { headers: { 'Content-Type': stock.type, 'Cache-Control': CACHE } });
}
