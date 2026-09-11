import type { Metadata } from 'next';
import en from '@/i18n/locales/en.json';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'How to sync Plex, Jellyfin & Emby with AniList, MyAnimeList (MAL) and Kitsu: what you install, when an episode is marked as watched, how tokens are stored and what control you have over your data.',
  robots: { index: true, follow: true },
};

// Las preguntas viven en el diccionario, no aquí: la página las pinta con t() y
// este marcado las lee de la misma fuente, así no pueden desincronizarse.
// En ingles porque es el idioma de los metadatos que indexa Google (ver layout raiz).
const PREGUNTAS = Array.from({ length: 14 }, (_, i) => {
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
  mainEntity: PREGUNTAS,
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
