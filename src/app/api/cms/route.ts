import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 1. Load Hero Config (with fallback bootstrap if missing)
    let hero = await db.cmsHeroConfig.findUnique({ where: { id: 'hero-config' } });
    if (!hero) {
      hero = await db.cmsHeroConfig.create({ data: { id: 'hero-config' } });
    }

    // 2. Load Banner Config
    let banner = await db.cmsAnnouncementBanner.findUnique({ where: { id: 'announcement' } });
    if (!banner) {
      banner = await db.cmsAnnouncementBanner.create({ data: { id: 'announcement' } });
    }

    // 3. Load SEO Config
    let seo = await db.cmsSeoConfig.findUnique({ where: { id: 'seo-config' } });
    if (!seo) {
      seo = await db.cmsSeoConfig.create({ data: { id: 'seo-config' } });
    }

    // 4. Load Sections Config
    let sections = await db.cmsSectionConfig.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    const defaultSections = [
      { id: 'hero', name: 'Hero Banner', displayOrder: 1 },
      { id: 'trust-bar', name: 'Trust Metric Strip', displayOrder: 2 },
      { id: 'categories', name: 'Explore Categories', displayOrder: 3 },
      { id: 'how-we-help', name: 'How We Help Timeline', displayOrder: 4 },
      { id: 'why-trust', name: 'Why Trust Aura Estates', displayOrder: 5 },
      { id: 'investment', name: 'Market Intelligence Showcase', displayOrder: 6 },
      { id: 'tools', name: 'Decision Support Tools', displayOrder: 7 },
      { id: 'featured', name: 'Featured Properties Spotlight', displayOrder: 8 },
      { id: 'localities', name: 'Locality pricing scorecards', displayOrder: 9 },
      { id: 'testimonials', name: 'Verified Buyer Testimonials', displayOrder: 10 },
      { id: 'research', name: 'Prop-Tech Research Journal', displayOrder: 11 },
      { id: 'footer', name: 'Expanded Footer sitemap', displayOrder: 12 },
    ];

    if (sections.length === 0) {
      for (const ds of defaultSections) {
        await db.cmsSectionConfig.create({
          data: { id: ds.id, name: ds.name, displayOrder: ds.displayOrder, visible: true }
        });
      }
      sections = await db.cmsSectionConfig.findMany({
        orderBy: { displayOrder: 'asc' }
      });
    }

    // 5. Load Hero Metrics (Visible only)
    const heroMetrics = await db.cmsHeroMetric.findMany({
      where: { visible: true },
      orderBy: { displayOrder: 'asc' }
    });

    // 6. Load Trust Metrics (Visible only)
    const trustMetrics = await db.cmsTrustMetric.findMany({
      where: { visible: true },
      orderBy: { displayOrder: 'asc' }
    });

    // 7. Load Localities Scorecards (Visible only)
    const localities = await db.cmsLocalityIntelligence.findMany({
      where: { visible: true },
      orderBy: { displayOrder: 'asc' }
    });

    // 8. Load Testimonials (Visible only)
    const testimonials = await db.cmsTestimonial.findMany({
      where: { visible: true },
      orderBy: { displayOrder: 'asc' }
    });

    // 9. Load Published Research Articles
    const articles = await db.cmsResearchArticle.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedDate: 'desc' },
      take: 6
    });

    // 10. Load Featured Properties Config
    let featuredConfig = await db.cmsFeaturedPropertyConfig.findUnique({ where: { id: 'featured-config' } });
    if (!featuredConfig) {
      featuredConfig = await db.cmsFeaturedPropertyConfig.create({ data: { id: 'featured-config' } });
    }

    // 11. Load Footer Config
    let footer = await db.cmsFooterConfig.findUnique({ where: { id: 'footer-config' } });
    if (!footer) {
      footer = await db.cmsFooterConfig.create({
        data: { id: 'footer-config', linksJson: {}, socialsJson: {} }
      });
    }

    return NextResponse.json({
      hero,
      banner,
      seo,
      sections,
      heroMetrics,
      trustMetrics,
      localities,
      testimonials,
      articles,
      featuredConfig,
      footer
    });
  } catch (err: any) {
    console.error('[PUBLIC_CMS_GET] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve website settings' }, { status: 500 });
  }
}
