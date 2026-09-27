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
 * Name, title, and description come from Site Settings (SystemSetting) and are
 * read on the server when generating the page. If backend does not respond, default
 * values are used: the homepage must not crash over this.
 */
async function readSiteSettings() {
  const backend =
    process.env.INTERNAL_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://127.0.0.1:4000');
  try {
    const res = await fetch(`${backend}/api/setup/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as { siteName: string; siteTitle: string; siteDescription: string; iconVersion: string | null };
  } catch {
    return null;
  }
}

// 56 and 143 characters: Google truncates title around 60 and description around 155.
const DEFAULT_TITLE = 'SyncSekai — Plex, Jellyfin & Emby to AniList, MAL & Kitsu';
const DEFAULT_DESCRIPTION =
  'Automatically sync anime from Plex, Jellyfin & Emby to AniList, MyAnimeList (MAL) and Kitsu. No install, works from any device.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSiteSettings();
  const name = settings?.siteName || 'SyncSekai';
  const title = settings?.siteTitle || DEFAULT_TITLE;
  const description = settings?.siteDescription || DEFAULT_DESCRIPTION;
  // The version changes icon URL when uploading a new one, to bypass browser cache.
  const v = settings?.iconVersion ? `?v=${settings.iconVersion}` : '';
  return {
    ...META_BASE,
    // No icon.png or favicon.ico in app/: those generate their own tags
    // with a fixed hash and browser would not detect a new icon.
    icons: {
      icon: [{ url: `/icon.png${v}`, type: 'image/png' }],
      shortcut: '/favicon.ico',
      apple: `/apple-touch-icon.png${v}`,
    },
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    publisher: name,
    openGraph: { ...META_BASE.openGraph, title, description, siteName: name },
    twitter: { ...META_BASE.twitter, title, description },
  };
}

const META_BASE: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://syncsekai.com'),
  // Metadata is in English, not Spanish, even though interface remains
  // bilingual. Language toggle is client-only, so Google indexes a
  // single version: best to target the audience actively searching. Inbound
  // search queries are in English and United States accounts for 32 of 53 visits.
  // This does NOT alter what user sees: interface remains bilingual.
  title: { default: DEFAULT_TITLE, template: '%s | SyncSekai' },
  description: DEFAULT_DESCRIPTION,
  // Google has ignored meta keywords since 2009. The list is kept because
  // it costs nothing and minor search engines read it, but expect no ranking from here:
  // ranking drivers are title, description, and visible page text.
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
    // Relative on purpose: Next resolves it against metadataBase and current route,
    // so each page declares its own canonical URL. Hardcoding pointed
    // to root, and since root layout inherits everything, /terms and /privacy told
    // Google they were homepage copies and were dropped from the index.
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
    // Omitting `images` here intentionally: defining them overrides
    // opengraph-image.tsx and would serve 800x800 square logo again, which
    // platforms crop. By omitting them, Next uses the 1200x630 card
    // generated in app/opengraph-image.tsx, matching expected aspect ratio.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SyncSekai — Real-time anime scrobbler',
    description:
      'Automatically sync the episodes you watch on Plex, Jellyfin or Emby to AniList, MyAnimeList and Kitsu.',
    // Same as above: the card is provided by twitter-image / opengraph-image.
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
      // featureList describes specific capabilities, allowing search engines
      // to match entry with long-tail queries like
      // "sync plex with anilist" instead of just the brand name.
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
        {/*
          Applies stored theme BEFORE first paint. Server always outputs
          data-theme="dark", so without this light theme users saw a dark
          flash until React hydrated. Included with CSP nonce.
          Placed at end of <body>, per Next docs: in <head> React warns
          that script does not run on client render, and as direct child
          of <html> it is invalid HTML.
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
      </body>
    </html>
  );
}
