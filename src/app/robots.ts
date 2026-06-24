import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/properties',
          '/properties/',
          '/areas',
          '/areas/',
          '/about',
          '/contact',
          '/investment-intelligence',
          '/plots',
          '/apartments',
          '/residencies',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/super-admin',
          '/super-admin/*',
          '/founder',
          '/founder/*',
          '/dashboard',
          '/dashboard/*',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/api',
          '/api/*',
        ],
      },
    ],
    sitemap: 'https://auraestates.com/sitemap.xml',
  };
}
