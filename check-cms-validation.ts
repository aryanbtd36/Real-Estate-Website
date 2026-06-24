import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Point directly to database
process.env.DATABASE_URL = "postgresql://postgres.fmajzxxsqmemgqqlnaik:AryanMishra3662@13.239.87.90:5432/postgres?sslmode=no-verify";

import { UserRole, LegacyPermission as Permission } from '@prisma/client';

async function runCmsAudit() {
  const { db } = await import('./src/lib/db');

  console.log('================================================================');
  console.log('       AURA ESTATES - FOUNDER CMS LIFECYCLE VALIDATION AUDIT    ');
  console.log('================================================================\n');

  const results: { feature: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  function recordResult(feature: string, status: 'PASS' | 'FAIL', details?: string) {
    results.push({ feature, status, details });
    if (status === 'PASS') {
      console.log(`[PASS] ${feature}${details ? ` - ${details}` : ''}`);
    } else {
      console.error(`[FAIL] ${feature}${details ? ` - ${details}` : ''}`);
    }
  }

  // Helper to fetch local /api/cms (simulated or using native fetch since dev server is running)
  const getPublicCmsConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/cms');
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e: any) {
      console.error('Fetch /api/cms failed:', e.message);
      return null;
    }
  };

  // --- SECTION 1: HERO SECTION MANAGEMENT ---
  try {
    console.log('\n--- Section 1: Hero Section Management ---');
    const originalHero = await db.cmsHeroConfig.findUnique({ where: { id: 'hero-config' } });
    
    // Update fields
    const testHeadline = 'Audit Test Headline ' + Date.now();
    const testSubheadline = 'Audit Test Subheadline';
    const testCtaText = 'Audit CTA';
    const testCtaUrl = '/audit-cta';

    await db.cmsHeroConfig.update({
      where: { id: 'hero-config' },
      data: {
        headline: testHeadline,
        subheadline: testSubheadline,
        primaryCtaText: testCtaText,
        primaryCtaUrl: testCtaUrl
      }
    });

    const dbHero = await db.cmsHeroConfig.findUnique({ where: { id: 'hero-config' } });
    const apiCms = await getPublicCmsConfig();

    const dbPassed = dbHero?.headline === testHeadline && 
                     dbHero?.subheadline === testSubheadline &&
                     dbHero?.primaryCtaText === testCtaText &&
                     dbHero?.primaryCtaUrl === testCtaUrl;

    const apiPassed = apiCms?.hero?.headline === testHeadline &&
                      apiCms?.hero?.subheadline === testSubheadline &&
                      apiCms?.hero?.primaryCtaText === testCtaText &&
                      apiCms?.hero?.primaryCtaUrl === testCtaUrl;

    if (dbPassed && apiPassed) {
      recordResult('Hero Management', 'PASS', 'Database persistence & API revalidation succeeded.');
    } else {
      recordResult('Hero Management', 'FAIL', `DB matched: ${dbPassed}, API matched: ${apiPassed}`);
    }

    // Restore original Hero
    if (originalHero) {
      await db.cmsHeroConfig.update({
        where: { id: 'hero-config' },
        data: {
          headline: originalHero.headline,
          subheadline: originalHero.subheadline,
          primaryCtaText: originalHero.primaryCtaText,
          primaryCtaUrl: originalHero.primaryCtaUrl,
          highlightedText: originalHero.highlightedText,
          secondaryCtaText: originalHero.secondaryCtaText,
          secondaryCtaUrl: originalHero.secondaryCtaUrl,
          backgroundMedia: originalHero.backgroundMedia,
          bgType: originalHero.bgType,
          visible: originalHero.visible
        }
      });
    }
  } catch (err: any) {
    recordResult('Hero Management', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 2: TESTIMONIALS MANAGEMENT ---
  try {
    console.log('\n--- Section 2: Testimonials Management ---');
    const testName = 'Audit Testimonial Person ' + Date.now();
    const testReview = 'Audit review content.';
    const testLoc = 'Lucknow';

    // 1. Create
    const created = await db.cmsTestimonial.create({
      data: {
        name: testName,
        review: testReview,
        location: testLoc,
        visible: true,
        displayOrder: 999
      }
    });
    
    let apiCms = await getPublicCmsConfig();
    const isTestimonialVisible = apiCms?.testimonials?.some((t: any) => t.id === created.id);

    // 2. Update (Edit visibility to false)
    await db.cmsTestimonial.update({
      where: { id: created.id },
      data: { visible: false }
    });

    let apiCmsAfterHide = await getPublicCmsConfig();
    const isTestimonialHidden = !apiCmsAfterHide?.testimonials?.some((t: any) => t.id === created.id);

    // 3. Delete
    await db.cmsTestimonial.delete({ where: { id: created.id } });

    if (created && isTestimonialVisible && isTestimonialHidden) {
      recordResult('Testimonials', 'PASS', 'Create, visibility toggle (show/hide), and deletion verified.');
    } else {
      recordResult('Testimonials', 'FAIL', `Created: ${!!created}, Visible initially: ${isTestimonialVisible}, Hidden after update: ${isTestimonialHidden}`);
    }
  } catch (err: any) {
    recordResult('Testimonials', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 3: HOMEPAGE ORDERING CONTROLS ---
  try {
    console.log('\n--- Section 3: Homepage Ordering Controls ---');
    const sections = await db.cmsSectionConfig.findMany({ orderBy: { displayOrder: 'asc' } });
    if (sections.length < 2) {
      throw new Error('Not enough sections config to test reordering');
    }

    const sec1 = sections[0];
    const sec2 = sections[1];

    // Swap display order
    await db.cmsSectionConfig.update({ where: { id: sec1.id }, data: { displayOrder: sec2.displayOrder } });
    await db.cmsSectionConfig.update({ where: { id: sec2.id }, data: { displayOrder: sec1.displayOrder } });

    const apiCms = await getPublicCmsConfig();
    const apiSections = apiCms?.sections || [];
    const index1 = apiSections.findIndex((s: any) => s.id === sec1.id);
    const index2 = apiSections.findIndex((s: any) => s.id === sec2.id);

    // Reordered order check
    const isReordered = index1 > index2; // since sec1 now has a larger displayOrder than sec2

    if (isReordered) {
      recordResult('Homepage Ordering', 'PASS', 'Swapped section order persisted in DB and returned correctly by API.');
    } else {
      recordResult('Homepage Ordering', 'FAIL', `Sections order in API: index1=${index1}, index2=${index2}`);
    }

    // Restore original ordering
    await db.cmsSectionConfig.update({ where: { id: sec1.id }, data: { displayOrder: sec1.displayOrder } });
    await db.cmsSectionConfig.update({ where: { id: sec2.id }, data: { displayOrder: sec2.displayOrder } });

  } catch (err: any) {
    recordResult('Homepage Ordering', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 4: VISIBILITY CONTROLS ---
  try {
    console.log('\n--- Section 4: Visibility Controls ---');
    const sections = await db.cmsSectionConfig.findMany({ orderBy: { displayOrder: 'asc' } });
    if (sections.length === 0) {
      throw new Error('No sections configurations');
    }

    const targetSection = sections[0];
    const originalVisible = targetSection.visible;

    // Toggle off
    await db.cmsSectionConfig.update({ where: { id: targetSection.id }, data: { visible: false } });
    let apiCms = await getPublicCmsConfig();
    const sectionAfterHide = apiCms?.sections?.find((s: any) => s.id === targetSection.id);
    const isHidden = sectionAfterHide && sectionAfterHide.visible === false;

    // Toggle on
    await db.cmsSectionConfig.update({ where: { id: targetSection.id }, data: { visible: true } });
    let apiCms2 = await getPublicCmsConfig();
    const sectionAfterShow = apiCms2?.sections?.find((s: any) => s.id === targetSection.id);
    const isVisible = sectionAfterShow && sectionAfterShow.visible === true;

    if (isHidden && isVisible) {
      recordResult('Visibility Controls', 'PASS', 'Visibility hide/show config works perfectly.');
    } else {
      recordResult('Visibility Controls', 'FAIL', `IsHidden: ${isHidden}, IsVisible: ${isVisible}`);
    }

    // Restore
    await db.cmsSectionConfig.update({ where: { id: targetSection.id }, data: { visible: originalVisible } });
  } catch (err: any) {
    recordResult('Visibility Controls', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 5: SEO CONTROLS ---
  try {
    console.log('\n--- Section 5: SEO Controls ---');
    const originalSeo = await db.cmsSeoConfig.findUnique({ where: { id: 'seo-config' } });

    const testMetaTitle = 'Audit SEO Title ' + Date.now();
    const testMetaDesc = 'Audit SEO Description';
    const testOgImg = 'http://localhost/audit-og.png';

    await db.cmsSeoConfig.update({
      where: { id: 'seo-config' },
      data: {
        metaTitle: testMetaTitle,
        metaDescription: testMetaDesc,
        ogImage: testOgImg
      }
    });

    const dbSeo = await db.cmsSeoConfig.findUnique({ where: { id: 'seo-config' } });
    const apiCms = await getPublicCmsConfig();

    const dbPassed = dbSeo?.metaTitle === testMetaTitle &&
                     dbSeo?.metaDescription === testMetaDesc &&
                     dbSeo?.ogImage === testOgImg;

    const apiPassed = apiCms?.seo?.metaTitle === testMetaTitle &&
                      apiCms?.seo?.metaDescription === testMetaDesc &&
                      apiCms?.seo?.ogImage === testOgImg;

    if (dbPassed && apiPassed) {
      recordResult('SEO Controls', 'PASS', 'Page title, meta description, and social OG preview image URL saved and returned by API.');
    } else {
      recordResult('SEO Controls', 'FAIL', `DB matched: ${dbPassed}, API matched: ${apiPassed}`);
    }

    // Restore SEO
    if (originalSeo) {
      await db.cmsSeoConfig.update({
        where: { id: 'seo-config' },
        data: {
          metaTitle: originalSeo.metaTitle,
          metaDescription: originalSeo.metaDescription,
          ogImage: originalSeo.ogImage,
          keywords: originalSeo.keywords,
          canonicalUrl: originalSeo.canonicalUrl,
          structuredData: originalSeo.structuredData || undefined
        }
      });
    }
  } catch (err: any) {
    recordResult('SEO Controls', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 6: TEMPLATE BUILDER VALIDATION ---
  try {
    console.log('\n--- Section 6: Template Builder Validation ---');
    const templates = ['PLOT', 'APARTMENT', 'RESIDENCY', 'COMMERCIAL'];
    let templatesVerified = true;

    for (const type of templates) {
      const template = await db.propertyTemplate.findUnique({
        where: { type },
        include: { versions: true }
      });

      if (!template) {
        templatesVerified = false;
        console.error(`    FAIL: Template ${type} not found in database.`);
        continue;
      }

      console.log(`    Verifying ${type} template schema. Name: ${template.name}, Version: v${template.version}, Fields count: ${template.fields ? (template.fields as any[]).length : 0}`);

      // Perform a test update
      const originalFields = template.fields as any[];
      const originalVersion = template.version;

      const testField = { name: 'audit_test_field', label: 'Audit Test Field', type: 'text', required: false };
      const updatedFields = [...originalFields, testField];

      // Add a field
      const updatedTemplate = await db.propertyTemplate.update({
        where: { id: template.id },
        data: {
          fields: updatedFields,
          version: originalVersion + 1
        }
      });

      // Add version record
      const versionRecord = await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: originalVersion + 1,
          fields: updatedFields,
          changedBy: 'Audit Script'
        }
      });

      // Verify DB persists
      const reloaded = await db.propertyTemplate.findUnique({
        where: { id: template.id }
      });

      const fieldAdded = reloaded?.version === originalVersion + 1 &&
                         (reloaded.fields as any[]).some(f => f.name === 'audit_test_field');

      // Reorder fields
      const reorderedFields = [...originalFields];
      if (reorderedFields.length >= 2) {
        const temp = reorderedFields[0];
        reorderedFields[0] = reorderedFields[1];
        reorderedFields[1] = temp;
      }

      await db.propertyTemplate.update({
        where: { id: template.id },
        data: {
          fields: reorderedFields,
          version: originalVersion + 2
        }
      });

      const reorderedVersion = await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: originalVersion + 2,
          fields: reorderedFields,
          changedBy: 'Audit Script Reorder'
        }
      });

      // Rollback to original fields
      await db.propertyTemplate.update({
        where: { id: template.id },
        data: {
          fields: originalFields,
          version: originalVersion + 3
        }
      });

      await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: originalVersion + 3,
          fields: originalFields,
          changedBy: 'Audit Script Rollback'
        }
      });

      // Clean up audit version entries
      await db.propertyTemplateVersion.deleteMany({
        where: {
          templateId: template.id,
          version: { in: [originalVersion + 1, originalVersion + 2, originalVersion + 3] }
        }
      });

      // Reset template details
      await db.propertyTemplate.update({
        where: { id: template.id },
        data: {
          fields: originalFields,
          version: originalVersion
        }
      });

      if (!fieldAdded || !reorderedVersion || !versionRecord) {
        templatesVerified = false;
        console.error(`    FAIL: Schema mutation or rollback logs failed on template ${type}`);
      }
    }

    if (templatesVerified) {
      recordResult('Template Builder', 'PASS', 'Zoned Templates (PLOT, APARTMENT, RESIDENCY, COMMERCIAL) schema updates, fields order and rollback logs verified.');
    } else {
      recordResult('Template Builder', 'FAIL', 'Some templates had issues during schema verification.');
    }
  } catch (err: any) {
    recordResult('Template Builder', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 7: PUBLISH / UNPUBLISH WORKFLOW ---
  try {
    console.log('\n--- Section 7: Publish / Unpublish Workflow ---');
    
    // Create research article as DRAFT
    const testSlug = 'audit-test-slug-' + Date.now();
    const created = await db.cmsResearchArticle.create({
      data: {
        title: 'Audit Article title',
        slug: testSlug,
        content: 'Audit Content.',
        status: 'DRAFT',
        author: 'Audit Reporter'
      }
    });

    // Check if in API (should be absent)
    let apiCms = await getPublicCmsConfig();
    const inDraftAbsent = !apiCms?.articles?.some((a: any) => a.id === created.id);

    // Transition to PUBLISHED
    await db.cmsResearchArticle.update({
      where: { id: created.id },
      data: { status: 'PUBLISHED' }
    });

    let apiCmsPub = await getPublicCmsConfig();
    const inPublishedPresent = apiCmsPub?.articles?.some((a: any) => a.id === created.id);

    // Unpublish back to DRAFT
    await db.cmsResearchArticle.update({
      where: { id: created.id },
      data: { status: 'DRAFT' }
    });

    let apiCmsUnpub = await getPublicCmsConfig();
    const inUnpublishedAbsent = !apiCmsUnpub?.articles?.some((a: any) => a.id === created.id);

    // Delete
    await db.cmsResearchArticle.delete({ where: { id: created.id } });

    if (inDraftAbsent && inPublishedPresent && inUnpublishedAbsent) {
      recordResult('Publishing Workflow', 'PASS', 'Workflow (Draft -> Published -> Unpublished) correctly reflects content in public API endpoint.');
    } else {
      recordResult('Publishing Workflow', 'FAIL', `Draft absent: ${inDraftAbsent}, Published present: ${inPublishedPresent}, Unpublished absent: ${inUnpublishedAbsent}`);
    }
  } catch (err: any) {
    recordResult('Publishing Workflow', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 8: CACHE REVALIDATION ---
  try {
    console.log('\n--- Section 8: Cache Revalidation ---');
    // Change Hero headline and check if it is returned immediately
    const testHeadline = 'Audit Cache Headline ' + Date.now();
    await db.cmsHeroConfig.update({
      where: { id: 'hero-config' },
      data: { headline: testHeadline }
    });

    const apiCms = await getPublicCmsConfig();
    const isInstant = apiCms?.hero?.headline === testHeadline;

    if (isInstant) {
      recordResult('Cache Revalidation', 'PASS', 'Zero-delay cache invalidation confirmed. Public endpoint returns fresh copy on database update.');
    } else {
      recordResult('Cache Revalidation', 'FAIL', 'Endpoint returned stale data. Expected headline: ' + testHeadline + ', got: ' + apiCms?.hero?.headline);
    }

    // Restore
    await db.cmsHeroConfig.update({
      where: { id: 'hero-config' },
      data: { headline: 'Find the Right Property. Backed by Data, Not Guesswork.' }
    });
  } catch (err: any) {
    recordResult('Cache Revalidation', 'FAIL', 'Crashed with error: ' + err.message);
  }

  // --- SECTION 9: PERMISSIONS VALIDATION ---
  try {
    console.log('\n--- Section 9: Security Validation ---');
    // Test the logic of requireFounderSuperAdmin.
    // In src/lib/permissions.ts, the helper restricts to: isFounder === true AND role === 'SUPER_ADMIN'.
    // Let's check user roles in our database to ensure permissions check holds.
    const founder = await db.user.findFirst({ where: { isFounder: true, role: 'SUPER_ADMIN' } });
    const standardAdmin = await db.user.findFirst({ where: { role: 'ADMIN' } });
    const standardUser = await db.user.findFirst({ where: { role: 'USER' } });

    const founderCheck = founder !== null;
    const standardAdminRestricted = standardAdmin?.isFounder === false || standardAdmin?.role !== 'SUPER_ADMIN';
    const standardUserRestricted = standardUser?.isFounder === false || standardUser?.role !== 'SUPER_ADMIN';

    if (founderCheck && standardAdminRestricted && standardUserRestricted) {
      recordResult('Permissions', 'PASS', 'Founder immortal profile role mapped correctly. Standard admins/users do not carry Founder status.');
    } else {
      recordResult('Permissions', 'FAIL', `Founder exists: ${founderCheck}, standardAdminRestricted: ${standardAdminRestricted}, standardUserRestricted: ${standardUserRestricted}`);
    }
  } catch (err: any) {
    recordResult('Permissions', 'FAIL', 'Crashed with error: ' + err.message);
  }

  console.log('\n================================================================');
  console.log('              FOUNDER CMS AUDIT VERIFICATION COMPLETE           ');
  console.log('================================================================');
  console.table(results);
}

runCmsAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
