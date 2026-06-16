import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatIndianRealEstatePrice } from '@/lib/currency';
import {
  MapPin,
  ArrowLeft,
  Maximize2,
  BedDouble,
  Bath,
  Compass,
  Navigation,
  Image as ImageIcon,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { sortByDistance } from '@/lib/maps/distance';
import PropertyViewMap from '@/components/property-view-map-wrapper';

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

  const coverImage = property.imagesRelation?.find(img => img.isCover)?.url || 
                     property.imagesRelation?.[0]?.url || 
                     (property.images ? property.images.split(',')[0] : null);

  const googleMapsUrl = property.latitude && property.longitude
    ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}`
    : '#';

  const directionsUrl = property.latitude && property.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`
    : '#';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased pb-20">
      {/* Background radial gradient */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-[#D4AF37]/5 to-transparent pointer-events-none" />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 pt-28 relative z-10 space-y-12">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-[#D4AF37] transition-colors font-semibold"
        >
          <ArrowLeft size={14} />
          Back to Listings
        </Link>

        {/* Title and Price */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded text-[10px] uppercase tracking-wider text-[#F5D67B]">
              {property.type}
            </div>
            <h1 className="text-3xl md:text-5xl font-light tracking-wide">{property.name}</h1>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <MapPin size={16} className="text-[#D4AF37]" />
              <span>{property.location || `${property.address}, ${property.city}, ${property.state}`}</span>
            </div>
          </div>
          <div className="text-left md:text-right">
            <span className="text-xs uppercase tracking-widest text-white/45 block mb-1">Market Valuation</span>
            <span className="text-3xl md:text-4xl font-semibold text-[#D4AF37] block">
              {formatIndianRealEstatePrice(property.price)}
            </span>
          </div>
        </div>

        {/* Grid Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Details */}
          <div className="lg:col-span-7 space-y-10">
            {/* Image Showcase */}
            <div className="h-96 md:h-[450px] bg-white/5 rounded-xl border border-white/10 overflow-hidden relative group">
              {coverImage ? (
                <img 
                  src={coverImage} 
                  alt={property.name} 
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
                  <ImageIcon size={48} />
                  <span className="text-xs font-mono">No image loaded</span>
                </div>
              )}
            </div>

            {/* Specifications Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Bedrooms', val: `${property.bedrooms} Beds`, icon: BedDouble },
                { label: 'Bathrooms', val: `${property.bathrooms || 1} Baths`, icon: Bath },
                { label: 'Area size', val: `${property.area.toLocaleString()} ${property.areaUnit || 'Sq Ft'}`, icon: Maximize2 },
                { label: 'Floor level', val: `Floor ${property.floor}`, icon: Compass },
              ].map((spec, i) => (
                <div key={i} className="bg-[#161616] border border-white/5 p-4 rounded-xl text-center space-y-2">
                  <spec.icon size={20} className="text-[#D4AF37] mx-auto" />
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 block">{spec.label}</span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">{spec.val}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-3">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Overview & Description</h3>
              <p className="text-sm text-white/70 leading-relaxed font-light whitespace-pre-line">
                {property.description || 'No detailed property description has been cataloged for this luxury property.'}
              </p>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Property Amenities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 bg-[#161616]/50 border border-white/5 px-4 py-3 rounded-lg text-xs">
                      <CheckCircle size={14} className="text-[#D4AF37]" />
                      <span className="text-white/80">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: GIS Map & Actions */}
          <div className="lg:col-span-5 space-y-8">
            {/* GIS Map Card */}
            <div className="bg-[#161616] border border-white/5 p-5 rounded-xl space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                  <Compass size={14} className="text-[#D4AF37]" />
                  GIS Property Map
                </h3>
                {property.latitude && property.longitude && (
                  <span className="text-[9px] text-white/40 font-mono">
                    GPS: {property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}
                  </span>
                )}
              </div>

              {/* Interactive map display */}
              <div className="h-[280px] rounded-lg overflow-hidden border border-white/10 relative">
                <PropertyViewMap 
                  latitude={property.latitude} 
                  longitude={property.longitude} 
                  boundary={property.boundary} 
                />
              </div>

              {/* Navigation Action Buttons */}
              {property.latitude && property.longitude && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-3 px-4 bg-[#1E1E1E] hover:bg-white/5 border border-white/10 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors text-center"
                  >
                    <ExternalLink size={12} />
                    Open Maps
                  </a>
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-3 px-4 bg-[#D4AF37] hover:opacity-90 text-black rounded text-xs font-bold uppercase tracking-wider transition-colors text-center"
                  >
                    <Navigation size={12} />
                    Get Directions
                  </a>
                </div>
              )}
            </div>

            {/* Nearby Properties Panel */}
            {nearbyProperties.length > 0 && (
              <div className="bg-[#161616] border border-white/5 p-5 rounded-xl space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Nearby Listings</h3>
                <div className="space-y-4">
                  {nearbyProperties.map((prop) => {
                    const propImage = prop.imagesRelation?.find((img: any) => img.isCover)?.url || 
                                      prop.imagesRelation?.[0]?.url || 
                                      (prop.images ? prop.images.split(',')[0] : null);
                    return (
                      <Link 
                        key={prop.id} 
                        href={`/properties/${prop.id}`}
                        className="flex gap-4 p-2.5 rounded-lg border border-white/5 hover:border-[#D4AF37]/30 bg-black/30 hover:bg-black/60 transition-all group"
                      >
                        <div className="w-16 h-16 bg-white/5 rounded-md overflow-hidden shrink-0 relative">
                          {propImage ? (
                            <img src={propImage} alt={prop.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20"><ImageIcon size={16} /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                          <div>
                            <h4 className="text-xs font-semibold text-white truncate group-hover:text-[#F5D67B] transition-colors">{prop.name}</h4>
                            <p className="text-[10px] text-white/45 truncate mt-0.5">{prop.location}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[#D4AF37]">{formatIndianRealEstatePrice(prop.price)}</span>
                            {prop.distanceKm !== undefined && (
                              <span className="px-2 py-0.5 bg-[#D4AF37]/10 text-[#F5D67B] text-[8px] font-bold rounded">
                                {prop.distanceKm.toFixed(1)} km away
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
