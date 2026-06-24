import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { db } from '@/lib/db';
import { sortByDistance } from '@/lib/maps/distance';
import PropertyDetailsClient from '@/components/property-details-client';

export const dynamic = 'force-dynamic';

interface PropertyPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!id) {
    return {};
  }

  const property = await db.property.findUnique({
    where: { id },
  });

  if (!property || property.status !== 'PUBLISHED') {
    return {};
  }

  const title = `${property.name} | ${property.location} | Aura Estates`;
  const description = property.description
    ? property.description.substring(0, 160)
    : `Check out ${property.name} located in ${property.location} on Aura Estates.`;
  
  const imageUrls = property.images ? property.images.split(',').map((img: string) => img.trim()) : [];
  const ogImage = imageUrls.length > 0 ? imageUrls[0] : 'https://auraestates.com/og-image.jpg';
  const canonicalUrl = `https://auraestates.com/properties/${property.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          alt: property.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PropertyDetailPage({ params }: PropertyPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const property = await db.property.findUnique({
    where: { id },
    include: { imagesRelation: true },
  });

  if (!property || property.status !== 'PUBLISHED') {
    notFound();
  }

  // Get nearby properties
  let nearbyProperties: any[] = [];
  if (property.latitude && property.longitude) {
    const allPublished = await db.property.findMany({
      where: {
        status: 'PUBLISHED',
        availability: 'AVAILABLE',
        id: { not: property.id }
      },
      include: { imagesRelation: true }
    });
    
    // Sort using distance engine
    nearbyProperties = sortByDistance(allPublished, property.latitude, property.longitude).slice(0, 3);
  }

  // Format amenities and dates for JSON compatibility
  const plainProperty = {
    id: property.id,
    name: property.name,
    description: property.description,
    type: property.type,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area: property.area,
    areaUnit: property.areaUnit,
    floor: property.floor,
    availability: property.availability,
    location: property.location,
    address: property.address,
    city: property.city,
    state: property.state,
    latitude: property.latitude,
    longitude: property.longitude,
    boundary: property.boundary,
    amenities: property.amenities,
    images: property.images,
    videoUrl: property.videoUrl,
    brochureUrl: property.brochureUrl,
    virtualTourUrl: property.virtualTourUrl,
    floorPlan: property.floorPlan,
    imagesRelation: property.imagesRelation.map(img => ({
      id: img.id,
      url: img.url,
      isCover: img.isCover
    }))
  };

  const plainNearby = nearbyProperties.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    type: p.type,
    price: p.price,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    area: p.area,
    areaUnit: p.areaUnit,
    floor: p.floor,
    availability: p.availability,
    location: p.location,
    address: p.address,
    city: p.city,
    state: p.state,
    latitude: p.latitude,
    longitude: p.longitude,
    boundary: p.boundary,
    amenities: p.amenities,
    images: p.images,
    videoUrl: p.videoUrl,
    brochureUrl: p.brochureUrl,
    virtualTourUrl: p.virtualTourUrl,
    floorPlan: p.floorPlan,
    imagesRelation: p.imagesRelation.map((img: any) => ({
      id: img.id,
      url: img.url,
      isCover: img.isCover
    }))
  }));

  const propertySchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": property.name,
    "description": property.description || "",
    "url": `https://auraestates.com/properties/${property.id}`,
    "image": property.images ? property.images.split(',').map((s: string) => s.trim()) : [],
    "about": {
      "@type": "Place",
      "name": property.name,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": property.address || property.location,
        "addressLocality": property.city || "Lucknow",
        "addressRegion": property.state || "Uttar Pradesh",
        "addressCountry": "IN"
      },
      "geo": (property.latitude && property.longitude) ? {
        "@type": "GeoCoordinates",
        "latitude": property.latitude,
        "longitude": property.longitude
      } : undefined
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": property.price,
      "availability": property.availability === "AVAILABLE" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://auraestates.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": property.city || "Lucknow",
        "item": `https://auraestates.com/areas/${property.city ? property.city.toLowerCase().replace(/\s+/g, '-') : 'lucknow'}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": property.name,
        "item": `https://auraestates.com/properties/${property.id}`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertySchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PropertyDetailsClient
        property={plainProperty}
        nearby={plainNearby}
        sessionUser={null}
      />
    </>
  );
}
