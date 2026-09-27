import type { Metadata } from 'next';
import en from '@/i18n/locales/en.json';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'How to sync Plex, Jellyfin & Emby with AniList, MyAnimeList (MAL) and Kitsu: what you install, when an episode is marked as watched, how tokens are stored and what control you have over your data.',
  robots: { index: true, follow: true },
};

// Questions live in dictionary, not here: page renders them with t() and
// this markup reads them from the same source, preventing divergence.
// In English because it is the metadata language indexed by Google (see root layout).
const QUESTIONS = Array.from({ length: 14 }, (_, i) => {
  const faq = en.faq as Record<string, string>;
  return {
    '@type': 'Question',
    name: faq[`q${i + 1}`],
    acceptedAnswer: { '@type': 'Answer', text: faq[`a${i + 1}`] },
  };
});

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS,
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {children}
    </>
  );
}
