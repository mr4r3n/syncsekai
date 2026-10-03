import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Generate random cryptographic base64 nonce for each request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  // Directivas de scripts estrictas:
  // In production: 'nonce-${nonce}' 'strict-dynamic', without 'unsafe-inline'.
  // In development: 'unsafe-eval' for Next.js / React HMR.
  const scriptSrc = isDev
    ? `'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // Strict connect-src: only 'self' and https://plex.tv (used by PlexPinModal)
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
    // In development the backend lives at http://localhost:4000 and covers are
    // served from there, so without http: CSP blocks them. In production
    // frontend and backend share origin and 'self' suffices.
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Intercept all routes except static or internal resources:
     * - api (proxy routes)
     * - _next/static (cached static files)
     * - _next/image (image optimization)
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
