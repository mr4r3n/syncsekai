import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Generar nonce criptográfico aleatorio en base64 para cada solicitud
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  // Directivas de scripts estrictas:
  // En producción: 'nonce-${nonce}' 'strict-dynamic', sin 'unsafe-inline'.
  // En desarrollo: 'unsafe-eval' para HMR de Next.js / React.
  const scriptSrc = isDev
    ? `'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // connect-src estricto: únicamente 'self' y https://plex.tv (usado por PlexPinModal)
  const connectSrc = isDev
    ? "'self' https://plex.tv ws: wss: http: https:"
    : "'self' https://plex.tv";

  const cspHeader = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // En desarrollo el backend vive en http://localhost:4000 y las portadas se
    // sirven desde ahí, así que sin http: la CSP las bloquea. En producción
    // frontend y backend comparten origen y basta con 'self'.
    `img-src 'self' data: blob: https:${isDev ? ' http:' : ''}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Interceptar todas las rutas excepto recursos estáticos o internos:
     * - api (rutas proxy)
     * - _next/static (archivos estáticos cacheados)
     * - _next/image (optimización de imágenes)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
