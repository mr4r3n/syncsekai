import type { Metadata } from 'next';

export const metadata: Metadata = {
  // Without suffix: root layout template already appends "| SyncSekai" and it appeared duplicated.
  title: 'Documentation and setup guide',
  description:
    'Full guide to syncing Plex, Jellyfin and Emby Media Servers with AniList, MyAnimeList and Kitsu: webhook setup, automatic title mapping and real-time scrobbling.',
  keywords: [
    'SyncSekai documentation',
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
    'SyncSekai setup guide',
  ],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://syncsekai.com/docs',
  },
  openGraph: {
    title: 'Official Documentation — SyncSekai Anime Scrobbler',
    description:
      'Learn how to connect and sync your Plex, Jellyfin, or Emby server with AniList, MyAnimeList, and Kitsu in minutes.',
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
    title: 'Official Documentation — SyncSekai',
    description:
      'Step-by-step guide to linking your Plex, Jellyfin, or Emby server with anime trackers in real time.',
    images: ['/logo.jpeg'],
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
