import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://syncsekai.com';
  const now = new Date();

  return [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // /login, /register y /forgot-password se retiran del sitemap a propósito.
    //
    // Son formularios sin contenido indexable: no pueden posicionar para ninguna
    // consulta y, al incluirlos, el sitemap deja de ser una lista de "esto es lo
    // que merece la pena rastrear" y pasa a ser un volcado de rutas. Google sigue
    // pudiendo rastrearlas —robots.txt las permite— simplemente no se le sugieren.
  ];
}
