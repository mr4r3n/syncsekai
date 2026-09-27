import type { Metadata } from 'next';

export const metadata: Metadata = {
  // Sin sufijo: la plantilla del layout raiz ya anade "| SyncSekai" y salia repetido.
  title: 'Documentation and setup guide',
  description:
    'Full guide to syncing Plex, Jellyfin and Emby Media Servers with AniList, MyAnimeList and Kitsu: webhook setup, automatic title mapping and real-time scrobbling.',
  keywords: [
    'SyncSekai Documentación',
    'Plex AniList',
    'Jellyfin AniList',
    'Emby AniList',
    'Plex MyAnimeList',
    'Jellyfin MyAnimeList',
    'Emby MyAnimeList',
    'Plex Kitsu',
    'Jellyfin Kitsu',
    'Emby Kitsu',
    'Webhook Plex Anime',
    'Webhook Jellyfin Anime',
    'Emby Anime Sync',
    'Scrobbler Anime',
    'Guía SyncSekai',
  ],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://syncsekai.com/docs',
  },
  openGraph: {
    title: 'Documentación Oficial — SyncSekai Anime Scrobbler',
    description:
      'Aprende a conectar y sincronizar tu servidor Plex, Jellyfin o Emby con AniList, MyAnimeList y Kitsu en minutos.',
    url: 'https://syncsekai.com/docs',
    siteName: 'SyncSekai',
    type: 'article',
    images: [
      {
        url: '/logo.jpeg',
        width: 800,
        height: 800,
        alt: 'SyncSekai Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Documentación Oficial — SyncSekai',
    description:
      'Guía paso a paso para vincular tu servidor Plex, Jellyfin o Emby con rastreadores de anime en tiempo real.',
    images: ['/logo.jpeg'],
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
