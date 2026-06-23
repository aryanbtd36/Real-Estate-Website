'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import {
  Search,
  MapPin,
  Maximize2,
  Compass,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Map,
  Sparkles
} from 'lucide-react';
import { handleImageError } from '@/lib/images';

const PropertyViewMap = dynamic(() => import('@/components/property-view-map-wrapper'), { ssr: false });

interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  bedrooms: number;
  area: number;
  areaUnit: string;
  type: string;
  floor: number;
  availability: string;
  latitude: number | null;
  longitude: number | null;
  boundary: string | null;
  images: string;
  imagesRelation?: { id: string; url: string; isCover: boolean; }[];
  status: string;
}

function PlotsCatalogContent() {
  const searchParams = useSearchParams();

  // Extract initial values from URL query parameters
  const initialLocParam = searchParams.get('location') || '';
  let initialLoc = '';
  if (initialLocParam.includes('gomti')) initialLoc = 'gomti';
  else if (initialLocParam.includes('indira')) initialLoc = 'indira';
  else if (initialLocParam.includes('aliganj')) initialLoc = 'aliganj';
  else if (initialLocParam.includes('mahanagar')) initialLoc = 'mahanagar';
  else if (initialLocParam.includes('jankipuram')) initialLoc = 'jankipuram';
  else if (initialLocParam.includes('sultanpur')) initialLoc = 'sultanpur';
  else if (initialLocParam.includes('deva')) initialLoc = 'deva';

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filterLocation, setFilterLocation] = useState(initialLoc);
  const [filterBudget, setFilterBudget] = useState(searchParams.get('budget') || '');
  const [filterMinArea, setFilterMinArea] = useState(searchParams.get('minArea') || '');
  const [sortBy, setSortBy] = useState('price-asc');
  
  // Map coordinates state
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fallbacks in case DB is empty
  const fallbackPlots: Property[] = [
    {
      id: 'plot-1',
      name: 'Gomti Nagar Extension Plots',
      location: 'Sector 4, Gomti Nagar, Lucknow',
      price: 6500000,
      bedrooms: 0,
      area: 1800,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      floor: 0,
      availability: 'AVAILABLE',
      latitude: 26.8620,
      longitude: 80.9850,
      boundary: JSON.stringify([
        [26.8625, 80.9845],
        [26.8625, 80.9855],
        [26.8615, 80.9855],
        [26.8615, 80.9845]
      ]),
      images: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'plot-2',
      name: 'Deva Road Residential Land',
      location: 'Mati, Lucknow',
      price: 2800000,
      bedrooms: 0,
      area: 1200,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      floor: 0,
      availability: 'AVAILABLE',
      latitude: 26.8850,
      longitude: 81.0250,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'plot-3',
      name: 'Sultanpur Road Verified Plot',
      location: 'Near IT City, Lucknow',
      price: 4500000,
      bedrooms: 0,
      area: 1500,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      floor: 0,
      availability: 'AVAILABLE',
      latitude: 26.8120,
      longitude: 81.0120,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'plot-4',
      name: 'Faizabad Road Canal-facing Land',
      location: 'Safedabad, Lucknow',
      price: 5200000,
      bedrooms: 0,
      area: 2000,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      floor: 0,
      availability: 'AVAILABLE',
      latitude: 26.8920,
      longitude: 81.0550,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    }
  ];

  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          const list = (Array.isArray(data) ? data : []).filter(
            (p: any) =>
              (p.type.toLowerCase() === 'lot' || p.type.toLowerCase() === 'plot') &&
              (p.status === 'PUBLISHED' || !p.status)
          );
          setProperties(list.length > 0 ? list : fallbackPlots);
          if (list.length > 0) {
            setSelectedProp(list[0]);
          } else {
            setSelectedProp(fallbackPlots[0]);
          }
        } else {
          setProperties(fallbackPlots);
          setSelectedProp(fallbackPlots[0]);
        }
      } catch (err) {
        console.error('Failed to load plots:', err);
        setProperties(fallbackPlots);
        setSelectedProp(fallbackPlots[0]);
      } finally {
        setLoading(false);
      }
    }
    fetchListings();
  }, []);

  // Filter listings
  const filtered = properties.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.location.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterLocation && p.location.toLowerCase().replace('-', ' ').indexOf(filterLocation.toLowerCase().replace('-', ' ')) === -1) {
      return false;
    }
    if (filterBudget && p.price > parseInt(filterBudget, 10)) {
      return false;
    }
    if (filterMinArea && p.area < parseInt(filterMinArea, 10)) {
      return false;
    }
    return true;
  });

  // Sort listings
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'area-desc') return b.area - a.area;
    return 0;
  });

  // Pagination bounds
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Crore`;
    }
    return `₹${(price / 100000).toFixed(1)} Lakh`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200/60 pb-6 text-left">
          <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Asset class discovery</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mt-1">Verified Land & Plot Registry</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Browse boundary-surveyed plots and vacant land listings validated by state registry office audits.</p>
        </div>

        {/* Search & Sticky Filters Bar */}
        <div className="sticky top-[68px] z-30 bg-white/95 backdrop-blur-md border border-slate-200/60 p-4 rounded-[20px] shadow-premium flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search plots by neighborhood or keyword..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-9 rounded-xl text-xs outline-none focus:border-trust-blue text-slate-700 font-medium"
            />
            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
          </div>

          <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
            <select
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="">All Areas</option>
              <option value="gomti">Gomti Nagar</option>
              <option value="indira">Indira Nagar</option>
              <option value="aliganj">Aliganj</option>
              <option value="mahanagar">Mahanagar</option>
              <option value="jankipuram">Jankipuram</option>
              <option value="sultanpur">Sultanpur Road</option>
              <option value="deva">Deva Road</option>
            </select>

            <select
              value={filterBudget}
              onChange={(e) => {
                setFilterBudget(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="">No Budget Limit</option>
              <option value="3000000">Under ₹30 Lakh</option>
              <option value="5000000">Under ₹50 Lakh</option>
              <option value="10000000">Under ₹1 Crore</option>
              <option value="15000000">Under ₹1.5 Crore</option>
            </select>

            <select
              value={filterMinArea}
              onChange={(e) => {
                setFilterMinArea(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="">Any Size</option>
              <option value="1000">1000+ Sq Ft</option>
              <option value="1500">1500+ Sq Ft</option>
              <option value="2000">2000+ Sq Ft</option>
              <option value="3000">3000+ Sq Ft</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="area-desc">Size: Largest first</option>
            </select>
          </div>
        </div>

        {/* Catalog grid and Split Map layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Listings side */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[360px] bg-white border border-slate-200/60 rounded-[24px] animate-pulse" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/60 rounded-[24px] shadow-premium">
                <Compass className="text-slate-300 mx-auto mb-3" size={36} />
                <h3 className="font-bold text-slate-900 text-lg">No matching plots found</h3>
                <p className="text-sm text-slate-500 mt-1">Try expanding your budget parameters or removing location filters.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {paginated.map((plot) => (
                    <div
                      key={plot.id}
                      onClick={() => setSelectedProp(plot)}
                      className={`cursor-pointer bg-white border rounded-[24px] overflow-hidden shadow-premium hover:shadow-premium-hover transition-all flex flex-col justify-between h-[360px] ${
                        selectedProp?.id === plot.id
                          ? 'border-trust-blue ring-1 ring-trust-blue/30'
                          : 'border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="relative h-44 bg-slate-100">
                        {(() => {
                          const coverImg = plot.imagesRelation?.find(img => img.isCover)?.url || 
                                           plot.imagesRelation?.[0]?.url || 
                                           (plot.images ? plot.images.split(',')[0] : 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80');
                          return (
                            <img
                              src={coverImg}
                              alt={plot.name}
                              className="w-full h-full object-cover"
                              onError={(e) => handleImageError(e, plot.type)}
                            />
                          );
                        })()}
                        <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow flex items-center gap-1 border border-emerald-400/25">
                          <CheckCircle2 size={10} />
                          Registry Verified
                        </div>
                        <div className="absolute bottom-3 right-3 bg-slate-950/70 text-white text-[10px] px-2.5 py-1 rounded font-bold backdrop-blur-xs">
                          {plot.area} {plot.areaUnit || 'Sq Ft'}
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Plot Listing</span>
                          <h3 className="font-bold text-slate-900 text-sm mt-1.5 line-clamp-1">{plot.name}</h3>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{plot.location}</span>
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                          <div>
                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Appraised Price</span>
                            <span className="text-base font-extrabold text-trust-blue">{formatPrice(plot.price)}</span>
                          </div>
                          <Link
                            href={`/properties/${plot.id}`}
                            className="px-3.5 py-1.5 bg-slate-50 hover:bg-trust-blue hover:text-white rounded-lg text-xs font-bold text-slate-700 transition-colors border border-slate-200/40"
                          >
                            Prospectus
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-200/60">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Map Side */}
          <div className="lg:col-span-5 lg:sticky lg:top-[140px] bg-white p-4 border border-slate-200/60 rounded-[24px] space-y-4 shadow-premium text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Map size={14} className="text-trust-blue" />
                GIS Spatial Mapping
              </h3>
              {selectedProp && (
                <span className="text-[9px] text-slate-400 font-mono">
                  Coords: {selectedProp.latitude?.toFixed(4)}, {selectedProp.longitude?.toFixed(4)}
                </span>
              )}
            </div>

            <div className="h-[360px] md:h-[420px] rounded-xl overflow-hidden border border-slate-200/60">
              {selectedProp ? (
                <PropertyViewMap
                  latitude={selectedProp.latitude}
                  longitude={selectedProp.longitude}
                  boundary={selectedProp.boundary}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                  Select a plot listing to survey boundary limits
                </div>
              )}
            </div>

            {selectedProp && (
              <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl text-xs space-y-1.5 shadow-2xs">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{selectedProp.name}</h4>
                <p className="text-slate-500 text-[11px] font-medium">{selectedProp.location}</p>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/40">
                  <span className="font-extrabold text-trust-blue text-sm">{formatPrice(selectedProp.price)}</span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full uppercase border border-emerald-500/20">
                    Decision Verified
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlotsCatalogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-trust-blue border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PlotsCatalogContent />
    </Suspense>
  );
}
