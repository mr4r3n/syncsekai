export function inferSeasonNumber(...titles: Array<string | null | undefined>): number | undefined {
  for (const title of titles) {
    if (!title) continue;
    const match =
      title.match(/(?:season|temporada)\s*(\d{1,2})\b/i) ||
      title.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i) ||
      title.match(/\bpart\s*(\d{1,2})\b/i) ||
      title.match(/\b(?:2nd|3rd|4th|5th)\s+season\b/i);
    if (match) {
      const val = Number(match[1]);
      if (val >= 1 && val <= 50) return val;
    }
    if (/\b(?:II|2nd)\b/i.test(title)) return 2;
    if (/\b(?:III|3rd)\b/i.test(title)) return 3;
    if (/\b(?:IV|4th)\b/i.test(title)) return 4;
    if (/\b(?:V|5th)\b/i.test(title)) return 5;
  }
  return 1;
}

export function extractBaseTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/(?:season|temporada)\s*\d{1,2}/gi, '')
    .replace(/\b(?:\d{1,2}(?:st|nd|rd|th)\s+season|2nd|3rd|4th|5th)\b/gi, '')
    .replace(/\b(?:part|cour)\s*\d{1,2}/gi, '')
    .replace(/\b(?:II|III|IV|V|VI)\b/g, '')
    .replace(/:\s*[^:]+$/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function clampProgress(progress: unknown, episodesTotal: number): number {
  const parsed = Math.max(0, Number(progress || 0));
  return episodesTotal > 0 ? Math.min(parsed, episodesTotal) : parsed;
}

export const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

export const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
