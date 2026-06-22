import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Load or bootstrap Hero Config
    let hero = await db.cmsHeroConfig.findUnique({ where: { id: 'hero-config' } });
    if (!hero) {
      hero = await db.cmsHeroConfig.create({
        data: { id: 'hero-config' }
      });
    }

    // Load or bootstrap Banner Config
    let banner = await db.cmsAnnouncementBanner.findUnique({ where: { id: 'announcement' } });
    if (!banner) {
      banner = await db.cmsAnnouncementBanner.create({
        data: { id: 'announcement' }
      });
    }

    // Load or bootstrap SEO Config
    let seo = await db.cmsSeoConfig.findUnique({ where: { id: 'seo-config' } });
    if (!seo) {
      seo = await db.cmsSeoConfig.create({
        data: { id: 'seo-config' }
      });
    }

    // Load or bootstrap Featured Config
    let featured = await db.cmsFeaturedPropertyConfig.findUnique({ where: { id: 'featured-config' } });
    if (!featured) {
      featured = await db.cmsFeaturedPropertyConfig.create({
        data: { id: 'featured-config' }
      });
    }

    // Load or bootstrap Footer Config
    let footer = await db.cmsFooterConfig.findUnique({ where: { id: 'footer-config' } });
    if (!footer) {
      footer = await db.cmsFooterConfig.create({
        data: { id: 'footer-config', linksJson: {}, socialsJson: {} }
      });
    }

    // Load sections config. Bootstrap if missing
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

    return NextResponse.json({
      hero,
      banner,
      seo,
      featured,
      footer,
      sections
    });
  } catch (err: any) {
    console.error('[CMS_GET] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve website CMS configs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data fields' }, { status: 400 });
    }

    let updatedRecord: any = null;

    if (type === 'hero') {
      updatedRecord = await db.cmsHeroConfig.update({
        where: { id: 'hero-config' },
        data: {
          headline: data.headline,
          highlightedText: data.highlightedText,
          subheadline: data.subheadline,
          primaryCtaText: data.primaryCtaText,
          primaryCtaUrl: data.primaryCtaUrl,
          secondaryCtaText: data.secondaryCtaText,
          secondaryCtaUrl: data.secondaryCtaUrl,
          backgroundMedia: data.backgroundMedia,
          bgType: data.bgType,
          visible: data.visible
        }
      });
    } else if (type === 'banner') {
      updatedRecord = await db.cmsAnnouncementBanner.update({
        where: { id: 'announcement' },
        data: {
          title: data.title,
          description: data.description,
          ctaText: data.ctaText,
          ctaUrl: data.ctaUrl,
          visible: data.visible
        }
      });
    } else if (type === 'seo') {
      updatedRecord = await db.cmsSeoConfig.update({
        where: { id: 'seo-config' },
        data: {
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          keywords: data.keywords,
          ogImage: data.ogImage,
          canonicalUrl: data.canonicalUrl,
          structuredData: data.structuredData
        }
      });
    } else if (type === 'featured') {
      updatedRecord = await db.cmsFeaturedPropertyConfig.update({
        where: { id: 'featured-config' },
        data: {
          mode: data.mode,
          manualIds: Array.isArray(data.manualIds) ? data.manualIds : []
        }
      });
    } else if (type === 'footer') {
      updatedRecord = await db.cmsFooterConfig.update({
        where: { id: 'footer-config' },
        data: {
          linksJson: data.linksJson,
          socialsJson: data.socialsJson,
          companyInfo: data.companyInfo,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail
        }
      });
    } else if (type === 'sections') {
      // Re-order and toggle visibility of homepage sections
      // data must be an array of { id: string, visible: boolean, displayOrder: number }
      if (!Array.isArray(data)) {
        return NextResponse.json({ error: 'Data field must be an array for sections updates' }, { status: 400 });
      }

      for (const section of data) {
        await db.cmsSectionConfig.update({
          where: { id: section.id },
          data: {
            visible: section.visible,
            displayOrder: section.displayOrder
          }
        });
      }
      updatedRecord = { updatedCount: data.length };
    } else {
      return NextResponse.json({ error: `Unsupported configuration block: ${type}` }, { status: 400 });
    }

    // Log this action to Governance AuditLogs
    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Website CMS Settings updated [Component: ${type.toUpperCase()}]`,
      details: { component: type, changes: data }
    });

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (err: any) {
    console.error('[CMS_POST] Error:', err);
    return NextResponse.json({ error: 'Failed to save website CMS configuration' }, { status: 500 });
  }
}
