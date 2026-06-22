import React from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { sortByDistance } from '@/lib/maps/distance';
import PropertyDetailsClient from '@/components/property-details-client';

interface PropertyPageProps {
  params: Promise<{
    id: string;
  }>;
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
    imagesRelation: p.imagesRelation.map((img: any) => ({
      id: img.id,
      url: img.url,
      isCover: img.isCover
    }))
  }));

  return (
    <PropertyDetailsClient
      property={plainProperty}
      nearby={plainNearby}
      sessionUser={null}
    />
  );
}
