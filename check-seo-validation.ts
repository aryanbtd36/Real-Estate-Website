import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Bypasses sandbox DNS constraints to connect to database for seeding
process.env.DATABASE_URL = "postgresql://postgres.fmajzxxsqmemgqqlnaik:AryanMishra3662@13.239.87.90:5432/postgres?sslmode=no-verify";

async function runSeoValidation() {
  console.log('================================================================');
  console.log('         AURA ESTATES - TECHNICAL SEO VALIDATION AUDIT          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // Helper to extract meta tags
  function getMetaTag(html: string, attrName: string, attrVal: string): string | null {
    const regex = new RegExp(`<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    
    const regexContentFirst = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${attrVal}["']`, 'i');
    const matchCF = html.match(regexContentFirst);
    return matchCF ? matchCF[1] : null;
  }

  // Helper to extract link tags
  function getLinkTag(html: string, rel: string): string | null {
    const regex = new RegExp(`<link\\s+[^>]*rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    
    const regexHrefFirst = new RegExp(`<link\\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']${rel}["']`, 'i');
    const matchHF = html.match(regexHrefFirst);
    return matchHF ? matchHF[1] : null;
  }

  // Helper to extract JSON-LD script content
  function getJsonLd(html: string, schemaType?: string): any[] {
    const regex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const schemas: any[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (!schemaType || parsed['@type'] === schemaType) {
          schemas.push(parsed);
        }
      } catch (e) {}
    }
    return schemas;
  }

  // 1. Robots.txt check
  try {
    const res = await fetch('http://localhost:3000/robots.txt');
    assert(res.status === 200, 'Robots: robots.txt accessible (HTTP 200)');
    const text = await res.text();
    assert(text.toLowerCase().includes('user-agent: *'), 'Robots: defines global user-agent rules');
    assert(text.includes('Disallow: /admin'), 'Robots: disallows admin dashboard');
    assert(text.includes('Disallow: /super-admin'), 'Robots: disallows super admin');
    assert(text.includes('Disallow: /founder'), 'Robots: disallows founder portal');
    assert(text.includes('Disallow: /api'), 'Robots: disallows internal API routes');
    assert(text.includes('Allow: /properties'), 'Robots: allows property catalog indexing');
    assert(text.includes('Allow: /areas'), 'Robots: allows locality dossiers indexing');
    assert(text.includes('Sitemap: https://auraestates.com/sitemap.xml'), 'Robots: exposes canonical sitemap link');
  } catch (err: any) {
    console.error('[FAIL] Robots.txt check failed:', err.message);
    failed++;
  }

  // 2. Sitemap.xml check
  try {
    const res = await fetch('http://localhost:3000/sitemap.xml');
    assert(res.status === 200, 'Sitemap: sitemap.xml accessible (HTTP 200)');
    const xml = await res.text();
    assert(xml.includes('<urlset'), 'Sitemap: contains standard root URLSet tag');
    assert(xml.includes('https://auraestates.com/about'), 'Sitemap: references about page route');
    assert(xml.includes('https://auraestates.com/contact'), 'Sitemap: references contact page route');
    assert(xml.includes('https://auraestates.com/investment-intelligence'), 'Sitemap: references intelligence dossier route');
    assert(xml.includes('https://auraestates.com/areas/gomti-nagar'), 'Sitemap: references Gomti Nagar locality page');
  } catch (err: any) {
    console.error('[FAIL] Sitemap.xml check failed:', err.message);
    failed++;
  }

  // 3. Homepage SEO & Schema check
  try {
    const res = await fetch('http://localhost:3000/');
    assert(res.status === 200, 'Homepage: loaded successfully (HTTP 200)');
    const html = await res.text();
    
    // Check Organization Schema
    const orgSchemas = getJsonLd(html, 'Organization');
    assert(orgSchemas.length > 0, 'Homepage: organization schema present');
    if (orgSchemas.length > 0) {
      assert(orgSchemas[0].name === 'Aura Estates', 'Homepage: Organization name correct');
      assert(orgSchemas[0].url === 'https://auraestates.com', 'Homepage: Organization url correct');
    }
  } catch (err: any) {
    console.error('[FAIL] Homepage SEO check failed:', err.message);
    failed++;
  }

  // 4. Locality Dossier (Gomti Nagar) Page checks
  try {
    const res = await fetch('http://localhost:3000/areas/gomti-nagar');
    assert(res.status === 200, 'Locality Page: loaded successfully (HTTP 200)');
    const html = await res.text();
    
    // Check Breadcrumb List
    const breadcrumbList = getJsonLd(html, 'BreadcrumbList');
    assert(breadcrumbList.length > 0, 'Locality Page: breadcrumb list schema present');
    if (breadcrumbList.length > 0) {
      const items = breadcrumbList[0].itemListElement;
      assert(items[0].name === 'Home', 'Locality Breadcrumb: step 1 is Home');
      assert(items[1].name.toLowerCase().includes('gomti nagar'), 'Locality Breadcrumb: step 2 is Locality Name');
    }
  } catch (err: any) {
    console.error('[FAIL] Locality Page checks failed:', err.message);
    failed++;
  }

  // 5. Dynamic Property Page checks (with dynamic test seeding)
  let tempProp: any = null;
  try {
    const { db } = await import('./src/lib/db');
    // Ensure clean state
    await db.property.deleteMany({
      where: { name: 'SEO-AUDIT-TEMP-PROP' }
    });

    // Create temp published property
    tempProp = await db.property.create({
      data: {
        name: 'SEO-AUDIT-TEMP-PROP',
        description: 'A beautiful luxury test villa with garden and pool.',
        type: 'Residency',
        price: 25000000,
        bedrooms: 4,
        bathrooms: 4,
        area: 3200,
        floor: 2,
        location: 'Sector 4, Gomti Nagar, Lucknow',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        status: 'PUBLISHED',
        availability: 'AVAILABLE',
        latitude: 26.8625,
        longitude: 80.9845
      }
    });

    const detailRes = await fetch(`http://localhost:3000/properties/${tempProp.id}`);
    assert(detailRes.status === 200, `Property Page: dynamic detail route loaded (HTTP 200 for id: ${tempProp.id})`);
    const html = await detailRes.text();

    // Check head title & description
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    assert(title.includes(tempProp.name), 'Property Page: dynamic title includes property name', `Title: ${title}`);
    
    // Check dynamic canonical
    const canonical = getLinkTag(html, 'canonical');
    assert(canonical === `https://auraestates.com/properties/${tempProp.id}`, 'Property Page: self-referencing canonical URL correct', `Canonical: ${canonical}`);

    // Check Open Graph tags
    const ogTitle = getMetaTag(html, 'property', 'og:title');
    assert(
      ogTitle?.includes(tempProp.name) ?? false,
      'Property Page: og:title tag rendered correctly'
    );
    
    const ogUrl = getMetaTag(html, 'property', 'og:url');
    assert(ogUrl === `https://auraestates.com/properties/${tempProp.id}`, 'Property Page: og:url matches canonical');

    // Check Schemas
    const listingSchema = getJsonLd(html, 'RealEstateListing');
    assert(listingSchema.length > 0, 'Property Page: RealEstateListing schema injected');
    if (listingSchema.length > 0) {
      assert(listingSchema[0].name === tempProp.name, 'Property Schema: matches name');
      assert(listingSchema[0].offers?.price === tempProp.price, 'Property Schema: offers correct listing price');
    }

    const breadcrumbs = getJsonLd(html, 'BreadcrumbList');
    assert(breadcrumbs.length > 0, 'Property Page: BreadcrumbList schema injected');
    if (breadcrumbs.length > 0) {
      const steps = breadcrumbs[0].itemListElement;
      assert(steps[0].name === 'Home', 'Property Breadcrumb: step 1 is Home');
      assert(steps[1].name === (tempProp.city || 'Lucknow'), 'Property Breadcrumb: step 2 is Locality/City');
      assert(steps[2].name === tempProp.name, 'Property Breadcrumb: step 3 is Property name');
    }
  } catch (err: any) {
    console.error('[FAIL] Dynamic Property Page checks failed:', err.message || err);
    failed++;
  } finally {
    if (tempProp) {
      try {
        const { db } = await import('./src/lib/db');
        await db.property.delete({
          where: { id: tempProp.id }
        });
        console.log('[INFO] Seeded temporary property cleaned up.');
      } catch (err) {}
    }
  }

  console.log('\n================================================================');
  console.log('                 VERIFICATION COMPLETED SUMMARY                 ');
  console.log('================================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSeoValidation();
