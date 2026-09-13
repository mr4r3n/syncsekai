import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { SidebarProvider } from '@/components/SidebarProvider';
import { UnsavedChangesProvider } from '@/components/UnsavedChangesProvider';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { GlobalAtmosphere } from '@/components/banner-effects/GlobalAtmosphere';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { MaintenanceGuard } from '@/components/MaintenanceGuard';
import { I18nProvider } from '@/i18n/I18nProvider';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-urbane',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-circular',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Nombre, título y descripción salen de Ajustes del sitio (SystemSetting) y se
 * leen en el servidor al generar la página. Si el backend no responde se usan
 * los valores por defecto: la portada no debe caer por esto.
 */
async function leerAjustesSitio() {
  const backend =
    process.env.INTERNAL_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://127.0.0.1:4000');
  try {
    const res = await fetch(`${backend}/api/setup/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as { siteName: string; siteTitle: string; siteDescription: string };
  } catch {
    return null;
  }
}

// 56 y 143 caracteres: Google corta el título sobre los 60 y la descripción sobre los 155.
const TITULO_POR_DEFECTO = 'SyncSekai — Plex, Jellyfin & Emby to AniList, MAL & Kitsu';
const DESCRIPCION_POR_DEFECTO =
  'Automatically sync anime from Plex, Jellyfin & Emby to AniList, MyAnimeList (MAL) and Kitsu. No install, works from any device.';

export async function generateMetadata(): Promise<Metadata> {
  const ajustes = await leerAjustesSitio();
  const nombre = ajustes?.siteName || 'SyncSekai';
  const titulo = ajustes?.siteTitle || TITULO_POR_DEFECTO;
  const descripcion = ajustes?.siteDescription || DESCRIPCION_POR_DEFECTO;
  return {
    ...META_BASE,
    title: { default: titulo, template: `%s | ${nombre}` },
    description: descripcion,
    applicationName: nombre,
    publisher: nombre,
    openGraph: { ...META_BASE.openGraph, title: titulo, description: descripcion, siteName: nombre },
    twitter: { ...META_BASE.twitter, title: titulo, description: descripcion },
  };
}

const META_BASE: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://syncsekai.com'),
  // Los metadatos van en ingles, no en castellano, aunque la interfaz siga siendo
  // bilingue. El cambio de idioma es solo de cliente, asi que Google indexa una
  // unica version: conviene que sea la del publico que de verdad busca. Las
  // consultas que llegan estan en ingles y Estados Unidos aporta 32 de 53 visitas.
  // Esto NO altera lo que ve el usuario: la interfaz sigue siendo bilingue.
  title: { default: TITULO_POR_DEFECTO, template: '%s | SyncSekai' },
  description: DESCRIPCION_POR_DEFECTO,
  // Google ignora meta keywords desde 2009. Se mantiene la lista porque
  // no cuesta nada y algún buscador menor la lee, pero no esperes posición de aquí:
  // lo que posiciona son el title, la description y el texto visible de la página.
  keywords: [
    'SyncSekai',
    'Plex Anime Sync',
    'Jellyfin Anime Sync',
    'Jellyfin',
    'Emby Anime Sync',
    'Emby',
    'AniList',
    'MyAnimeList',
    'MAL',
    'MAL Sync',
    'PlexAniBridge',
    'Kitsu',
    'Anime Scrobbler',
    'Plex Webhook Anime',
    'Jellyfin Webhook Anime',
    'Emby Anime Watcher',
    'Sincronizar Plex con AniList',
    'Sincronizar Jellyfin con AniList',
    'Sincronizar Emby con AniList',
    'Sincronizar Plex con MyAnimeList',
    'Sincronizar Jellyfin con MyAnimeList',
    'Sincronizar Emby con MyAnimeList',
    'Sincronizar Plex con Kitsu',
    'Sincronizar Jellyfin con Kitsu',
    'Sincronizar Emby con Kitsu',
    'Anime Tracker Plex',
    'Anime Tracker Jellyfin',
    'Anime Tracker Emby',
    'Auto Scrobble Anime',
    'syncsekai.com',
  ],
  authors: [{ name: 'SyncSekai', url: 'https://syncsekai.com' }],
  creator: 'SyncSekai',
  publisher: 'SyncSekai',
  category: 'technology',
  classification: 'Software, Anime Tracking, Media Synchronization',
  alternates: {
    // Relativo a propósito: Next lo resuelve contra metadataBase y la ruta actual,
    // así que cada página declara su propia URL canónica. Escrito a mano apuntaba
    // a la raíz, y como el layout raíz lo hereda todo, /terms y /privacy le decían
    // a Google que eran copias de la portada y quedaban fuera del índice.
    canonical: './',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://syncsekai.com',
    title: 'SyncSekai — Sync Plex, Jellyfin & Emby anime with AniList, MAL & Kitsu',
    description:
      'Real-time sync between Plex, Jellyfin, Emby and your AniList, MyAnimeList and Kitsu lists.',
    siteName: 'SyncSekai',
    // Sin `images` aquí a propósito: definirlas tiene prioridad sobre el fichero
    // opengraph-image.tsx y volvería a servirse el logo cuadrado de 800x800, que
    // las plataformas recortan. Al omitirlas, Next usa la tarjeta 1200x630
    // generada en app/opengraph-image.tsx, que es la proporción que esperan.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SyncSekai — Real-time anime scrobbler',
    description:
      'Automatically sync the episodes you watch on Plex, Jellyfin or Emby to AniList, MyAnimeList and Kitsu.',
    // Igual que arriba: la tarjeta la aporta twitter-image / opengraph-image.
    creator: '@SyncSekai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://syncsekai.com/#website',
      url: 'https://syncsekai.com',
      name: 'SyncSekai',
      description: 'Real-time anime sync between Plex, Jellyfin, Emby and AniList, MyAnimeList and Kitsu.',
      inLanguage: 'en',
      publisher: {
        '@id': 'https://syncsekai.com/#organization',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://syncsekai.com/#organization',
      name: 'SyncSekai',
      url: 'https://syncsekai.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://syncsekai.com/logo.jpeg',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://syncsekai.com/#software',
      name: 'SyncSekai',
      applicationCategory: 'MultimediaApplication',
      applicationSubCategory: 'Anime library synchronisation',
      operatingSystem: 'Web',
      inLanguage: 'en',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      // featureList describe capacidades concretas, que es lo que permite a un
      // buscador relacionar la ficha con consultas de intención larga del tipo
      // "sincronizar plex con anilist" en lugar de solo con la marca.
      featureList: [
        'Syncs Plex, Jellyfin or Emby episode progress to AniList',
        'Syncs Plex, Jellyfin or Emby episode progress to MyAnimeList (MAL)',
        'Syncs Plex, Jellyfin or Emby episode progress to Kitsu',
        'Real-time scrobbling through native Plex Media Server webhooks, the Jellyfin Webhook plugin, or Emby session watching',
        'Automatic title and season mapping between your media server and the trackers',
        'Score and watch-status synchronisation',
        'Sync history with error diagnostics',
        'Unified catalogue of everything you have watched, from your library and from every linked tracker',
        'Per-title rules and a blacklist to keep chosen series out of the sync',
      ],
      softwareRequirements: 'Plex Media Server, Jellyfin Server, or Emby Server',
      author: { '@id': 'https://syncsekai.com/#organization' },
      description:
        'Anime scrobbler and sync service for Plex, Jellyfin and Emby: it detects every episode you play and updates your progress on AniList, MyAnimeList and Kitsu automatically.',
    },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Aplica el tema guardado ANTES del primer pintado.
          El servidor emite siempre data-theme="dark", así que sin esto quien usa
          el tema claro veía un destello oscuro en cada carga hasta que hidrataba
          React. Va con el nonce de la CSP, como el resto de scripts en línea.
        */}
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('plexsync_selected_theme');var t=s==='claro'?'light':(localStorage.getItem('plexsync_theme')||'dark');document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('plexsync_locale');if(l==='es'||l==='en'){document.documentElement.lang=l;}}catch(e){}",
          }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)]" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--accent-primary)] focus:text-white focus:rounded-[6px] focus:shadow-lg focus:font-bold focus:text-xs focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <I18nProvider>
          <ToastProvider>
            <SidebarProvider>
              <UnsavedChangesProvider>
                <GlobalAtmosphere />
                <AnnouncementBanner />
                <CookieConsentBanner />
                <MaintenanceGuard>{children}</MaintenanceGuard>
              </UnsavedChangesProvider>
            </SidebarProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
