import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://auraestates.com';

  // 1. Static URLs
  const staticUrls = [
    '',
    '/about',
    '/contact',
    '/investment-intelligence',
    '/plots',
    '/apartments',
    '/residencies',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // 2. Dynamic Property URLs (fetch only PUBLISHED)
  let propertyUrls: any[] = [];
  try {
    const properties = await db.property.findMany({
      where: {
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    propertyUrls = properties.map((prop) => ({
      url: `${baseUrl}/properties/${prop.id}`,
      lastModified: prop.updatedAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap: Failed to fetch properties:', error);
  }

  // 3. Dynamic Area / Locality URLs
  const defaultSlugs = ['gomti-nagar', 'indira-nagar', 'aliganj', 'hazratganj'];
  const uniqueSlugs = new Set(defaultSlugs);

  try {
    const cmsLocalities = await db.cmsLocalityIntelligence.findMany({
      where: { visible: true },
      select: { areaName: true },
    });

    cmsLocalities.forEach((loc) => {
      const slug = loc.areaName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (slug) {
        uniqueSlugs.add(slug);
      }
    });
  } catch (error) {
    console.error('Sitemap: Failed to fetch CMS localities:', error);
  }

  const areaUrls = Array.from(uniqueSlugs).map((slug) => ({
    url: `${baseUrl}/areas/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticUrls, ...propertyUrls, ...areaUrls];
}
