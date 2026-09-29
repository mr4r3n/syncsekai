import { MetadataRoute } from 'next';
import { TERMS_UPDATED_ON } from '@/content/legal/terms';
import { PRIVACY_UPDATED_ON } from '@/content/legal/privacy';

/**
 * lastmod is the date each page's content last changed, not the build time:
 * a sitemap that says "everything changed just now" on every build teaches
 * crawlers to ignore it.
 * ponytail: the landing, guide and FAQ dates are set by hand; bump them when
 * their content changes (the legal pages take theirs from their own documents).
 */
const LANDING_UPDATED_ON = '2026-09-27';
const GUIDE_UPDATED_ON = '2026-09-27';
const FAQ_UPDATED_ON = '2026-09-27';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://syncsekai.com';
  const page = (path: string, updatedOn: string, changeFrequency: 'weekly' | 'monthly', priority: number) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(`${updatedOn}T00:00:00Z`),
    changeFrequency,
    priority,
  });

  return [
    page('', LANDING_UPDATED_ON, 'weekly', 1.0),
    page('/docs', GUIDE_UPDATED_ON, 'weekly', 0.9),
    page('/faq', FAQ_UPDATED_ON, 'monthly', 0.8),
    page('/terms', TERMS_UPDATED_ON, 'monthly', 0.7),
    page('/privacy', PRIVACY_UPDATED_ON, 'monthly', 0.7),
    // Left out on purpose: /login, /register and /forgot-password (forms with
    // nothing to rank for; robots.txt still allows them) and /demo (noindex:
    // sample data should not compete with the landing page).
  ];
}
