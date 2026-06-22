'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Maximize2,
  BedDouble,
  Compass,
  Image as ImageIcon,
  Compass as CompassIcon,
  Navigation,
  Eye,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianRealEstatePrice } from '@/lib/currency';

export default function PropertiesCatalogPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [filterBedrooms, setFilterBedrooms] = useState('');

  // Geolocation / Near Me State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        // Only show published properties
        const published = (Array.isArray(data) ? data : []).filter(p => p.status === 'PUBLISHED');
        setProperties(published);
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNearMeToggle = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      setCoords(null);
      fetchListings();
      return;
    }

    if (!navigator.geolocation) {
      alert('Unable to determine current location.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setNearMeActive(true);
        setGpsLoading(false);

        // Fetch nearby sorted listings
        try {
          setLoading(true);
          const res = await fetch(`/api/properties/nearby?lat=${lat}&lng=${lng}&radius=50&limit=30`);
          if (res.ok) {
            const data = await res.json();
            setProperties(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          alert('Location permission denied.');
        } else if (error.code === error.TIMEOUT) {
          alert('Location request timed out.');
        } else {
          alert('Unable to determine current location.');
        }
      },
      { timeout: 10000 }
    );
  };

  // Client side local filters for standard inputs
  const filteredProperties = properties.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.location.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterType && p.type !== filterType) return false;
    if (filterBudget && p.price > parseInt(filterBudget, 10)) return false;
    if (filterBedrooms && p.bedrooms < parseInt(filterBedrooms, 10)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-20">
      {/* Background radial gradient */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-trust-blue/5 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 pt-28 relative z-10 space-y-12">
        {/* Title */}
        <div className="border-b border-slate-100 pb-6">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">Find Lucknow Properties</h1>
          <p className="text-sm text-slate-500 mt-2">Discover GIS-mapped plots, residential buildings, and estate listings.</p>
        </div>

        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 items-center">
          <div className="relative md:col-span-3">
            <input
              type="text"
              placeholder="Search by title, neighborhood..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-trust-blue p-2.5 pl-9 rounded-lg text-slate-700 text-xs outline-none transition-colors"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={14} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:col-span-9">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] outline-none cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Duplex">Duplex</option>
              <option value="Lot">Lot / Plot</option>
            </select>

            <select
              value={filterBudget}
              onChange={(e) => setFilterBudget(e.target.value)}
              className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] outline-none cursor-pointer"
            >
              <option value="">No Budget Limit</option>
              <option value="5000000">Under ₹50 Lakh</option>
              <option value="10000000">Under ₹1 Crore</option>
              <option value="15000000">Under ₹1.5 Crore</option>
              <option value="20000000">Under ₹2 Crore</option>
              <option value="30000000">Under ₹3 Crore</option>
            </select>

            <select
              value={filterBedrooms}
              onChange={(e) => setFilterBedrooms(e.target.value)}
              className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] outline-none cursor-pointer"
            >
              <option value="">Any Bedrooms</option>
              <option value="2">2+ Beds</option>
              <option value="3">3+ Beds</option>
              <option value="4">4+ Beds</option>
            </select>

            <button
              onClick={handleNearMeToggle}
              disabled={gpsLoading}
              className={`w-full py-2 border text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                nearMeActive
                  ? 'border-trust-blue bg-trust-blue/15 text-trust-blue'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
              }`}
            >
              <CompassIcon size={12} className={gpsLoading ? 'animate-spin' : ''} />
              {gpsLoading ? 'Locating...' : nearMeActive ? 'Proximity Filter On' : 'Near Me Discovery'}
            </button>
          </div>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-slate-50 rounded-xl animate-pulse animate-duration-1000" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 p-16 text-center rounded-xl">
            <p className="text-slate-400">No properties cataloged matching your parameters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredProperties.map((prop) => {
              const coverImg = prop.imagesRelation?.find((img: any) => img.isCover)?.url || 
                               (prop.images ? prop.images.split(',')[0] : null);

              return (
                <div
                  key={prop.id}
                  className="group bg-white border border-slate-100 hover:border-trust-blue/30 rounded-lg overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1 flex flex-col h-full"
                >
                  {/* Photo area */}
                  <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {coverImg ? (
                      <img src={coverImg} alt={prop.name} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" />
                    ) : (
                      <div className="text-slate-300"><ImageIcon size={36} /></div>
                    )}

                    {/* Proximity badge */}
                    {prop.distanceKm !== undefined && (
                      <div className="absolute top-4 left-4 z-20 px-2.5 py-1 bg-trust-blue text-white text-[9px] uppercase tracking-wider font-extrabold rounded shadow-md">
                        {prop.distanceKm.toFixed(1)} km away
                      </div>
                    )}

                    <div className="absolute top-4 right-4 z-20 px-2.5 py-1 bg-black/60 backdrop-blur border border-slate-100/10 rounded text-[9px] uppercase tracking-wider text-white">
                      Floor {prop.floor}
                    </div>

                    <Link
                      href={`/properties/${prop.id}`}
                      className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-trust-blue text-white hover:bg-trust-blue-hover text-[10px] font-bold uppercase rounded shadow transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={12} />
                      View Listing
                    </Link>
                  </div>

                  {/* Body details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-slate-800 group-hover:text-trust-blue transition-colors truncate">
                          {prop.name}
                        </h3>
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[8px] text-slate-500 uppercase tracking-widest shrink-0">
                          {prop.type}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-slate-500 gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        <span className="truncate">{prop.location}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <div>
                        <span className="text-[8px] uppercase tracking-widest text-slate-400 block">Price</span>
                        <span className="font-bold text-trust-blue text-sm">
                          {formatIndianRealEstatePrice(prop.price)}
                        </span>
                      </div>
                      <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                        <div>{prop.bedrooms} Bed / {prop.bathrooms || 1} Bath</div>
                        <div>{prop.area.toLocaleString()} {prop.areaUnit || 'Sq Ft'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
