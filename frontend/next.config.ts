import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Alt-Svc', value: 'clear' },
          ...(!isDev ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://127.0.0.1:4000');
    return {
      // Antes de mirar public/: así el icono subido desde Ajustes del sitio
      // sustituye al de serie en todos los sitios que usan estas rutas.
      beforeFiles: [
        { source: '/logo.webp', destination: '/site-icon/logo' },
        { source: '/icon.png', destination: '/site-icon/favicon' },
        { source: '/apple-touch-icon.png', destination: '/site-icon/apple' },
      ],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
