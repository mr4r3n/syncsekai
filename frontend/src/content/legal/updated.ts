/**
 * The "Last updated" line of a legal page, built from the same date the
 * sitemap publishes as its lastmod, so the two cannot drift apart.
 */
export function updatedLabel(isoDate: string): { en: string; es: string } {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const format = (locale: string) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { en: `Last updated: ${format('en-US')}`, es: `Última actualización: ${format('es-ES')}` };
}
