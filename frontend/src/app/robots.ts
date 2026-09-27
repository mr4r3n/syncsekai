import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://syncsekai.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/docs',
          '/faq',
          '/terms',
          '/privacy',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
        ],
        disallow: [
          '/api/',
          '/catalog',
          '/history',
          '/connections',
          '/mappings',
          '/blacklist',
          '/settings',
          '/admin',
          '/users',
          '/tickets',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
