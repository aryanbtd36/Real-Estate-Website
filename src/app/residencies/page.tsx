'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/navbar';
import {
  Search,
  MapPin,
  Maximize2,
  Compass,
  CheckCircle2,
  ListFilter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Home,
  Map,
  BedDouble
} from 'lucide-react';

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
  status: string;
}

export default function ResidenciesCatalogPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [filterBedrooms, setFilterBedrooms] = useState('');
  const [sortBy, setSortBy] = useState('price-asc');
  
  // Map coordinates state
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fallbacks in case DB is empty
  const fallbackResidencies: Property[] = [
    {
      id: 'mock-res-1',
      name: 'Indira Nagar Independent Villa',
      location: 'Sector B, Indira Nagar, Lucknow',
      price: 8500000,
      bedrooms: 3,
      area: 2400,
      areaUnit: 'Sq Ft',
      type: 'Villa',
      floor: 2,
      availability: 'AVAILABLE',
      latitude: 26.8820,
      longitude: 80.9920,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'mock-res-2',
      name: 'Gomti Nagar Green Duplex',
      location: 'Vibhuti Khand, Gomti Nagar, Lucknow',
      price: 14500000,
      bedrooms: 4,
      area: 3200,
      areaUnit: 'Sq Ft',
      type: 'Duplex',
      floor: 2,
      availability: 'AVAILABLE',
      latitude: 26.8640,
      longitude: 80.9780,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'mock-res-3',
      name: 'Aliganj Residential Villa',
      location: 'Sector K, Aliganj, Lucknow',
      price: 11000000,
      bedrooms: 3,
      area: 2800,
      areaUnit: 'Sq Ft',
      type: 'Villa',
      floor: 2,
      availability: 'AVAILABLE',
      latitude: 26.8910,
      longitude: 80.9420,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&auto=format&fit=crop&q=80',
      status: 'PUBLISHED'
    },
    {
      id: 'mock-res-4',
      name: 'Mahanagar Classic Duplex',
      location: 'Shadab Colony, Mahanagar, Lucknow',
      price: 16500000,
      bedrooms: 4,
      area: 3500,
      areaUnit: 'Sq Ft',
      type: 'Duplex',
      floor: 2,
      availability: 'AVAILABLE',
      latitude: 26.8720,
      longitude: 80.9520,
      boundary: null,
      images: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&auto=format&fit=crop&q=80',
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
              (p.type.toLowerCase() === 'villa' ||
                p.type.toLowerCase() === 'duplex' ||
                p.type.toLowerCase() === 'house') &&
              (p.status === 'PUBLISHED' || !p.status)
          );
          setProperties(list.length > 0 ? list : fallbackResidencies);
          if (list.length > 0) {
            setSelectedProp(list[0]);
          } else {
            setSelectedProp(fallbackResidencies[0]);
          }
        } else {
          setProperties(fallbackResidencies);
          setSelectedProp(fallbackResidencies[0]);
        }
      } catch (err) {
        console.error('Failed to load residencies:', err);
        setProperties(fallbackResidencies);
        setSelectedProp(fallbackResidencies[0]);
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
    if (filterBedrooms && p.bedrooms < parseInt(filterBedrooms, 10)) {
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
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Villas & Independent Houses</h1>
          <p className="text-sm text-slate-500 mt-1">Browse verified built-up villas, duplexes, and independent residencies across Lucknow corridors.</p>
        </div>

        {/* Search & Sticky Filters Bar */}
        <div className="sticky top-[60px] z-30 bg-white border border-slate-200 p-4 rounded-xl shadow-md flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search homes by location, keyword..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-9 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700"
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
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-medium"
            >
              <option value="">All Areas</option>
              <option value="gomti">Gomti Nagar</option>
              <option value="indira">Indira Nagar</option>
              <option value="aliganj">Aliganj</option>
              <option value="mahanagar">Mahanagar</option>
              <option value="jankipuram">Jankipuram</option>
            </select>

            <select
              value={filterBudget}
              onChange={(e) => {
                setFilterBudget(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-medium"
            >
              <option value="">No Budget Limit</option>
              <option value="6000000">Under ₹60 Lakh</option>
              <option value="10000000">Under ₹1 Crore</option>
              <option value="15000000">Under ₹1.5 Crore</option>
              <option value="20000000">Under ₹2 Crore</option>
            </select>

            <select
              value={filterBedrooms}
              onChange={(e) => {
                setFilterBedrooms(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-medium"
            >
              <option value="">Any Bedrooms</option>
              <option value="2">2+ BHK</option>
              <option value="3">3+ BHK</option>
              <option value="4">4+ BHK</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none text-slate-700 font-medium"
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
          <div className="lg:col-span-7 space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-64 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-xl">
                <Compass className="text-slate-400 mx-auto mb-3" size={32} />
                <h3 className="font-bold text-slate-900 text-lg">No matching residencies found</h3>
                <p className="text-sm text-slate-500 mt-1">Try expanding your budget parameters or removing location filters.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {paginated.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => setSelectedProp(res)}
                      className={`cursor-pointer bg-white border rounded-xl overflow-hidden shadow-sm transition-all flex flex-col justify-between h-[360px] ${
                        selectedProp?.id === res.id
                          ? 'border-trust-blue ring-1 ring-trust-blue/30'
                          : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="relative h-44 bg-slate-100">
                        <img
                          src={res.images ? res.images.split(',')[0] : 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&auto=format&fit=crop&q=80'}
                          alt={res.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-trust-blue text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          Verified
                        </div>
                        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded font-medium">
                          {res.bedrooms} BHK • {res.area} {res.areaUnit || 'Sq Ft'}
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{res.name}</h3>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{res.location}</span>
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Residency Price</span>
                            <span className="text-base font-extrabold text-trust-blue">{formatPrice(res.price)}</span>
                          </div>
                          <Link
                            href={`/properties/${res.id}`}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-trust-blue hover:text-white rounded text-xs font-semibold text-slate-700 transition-colors"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Map Side */}
          <div className="lg:col-span-5 lg:sticky lg:top-[140px] bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Map size={14} className="text-trust-blue" />
                GIS Residency Mapping
              </h3>
              {selectedProp && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Pin: {selectedProp.name.split(' ')[0]}
                </span>
              )}
            </div>

            <div className="h-[360px] md:h-[420px]">
              {selectedProp ? (
                <PropertyViewMap
                  latitude={selectedProp.latitude}
                  longitude={selectedProp.longitude}
                  boundary={selectedProp.boundary}
                />
              ) : (
                <div className="w-full h-full bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                  Select a house to view locality mapping
                </div>
              )}
            </div>

            {selectedProp && (
              <div className="bg-white p-3 border border-slate-200 rounded-lg text-xs space-y-1.5 shadow-sm">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{selectedProp.name}</h4>
                <p className="text-slate-500 text-[11px]">{selectedProp.location}</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-extrabold text-trust-blue">{formatPrice(selectedProp.price)}</span>
                  <span className="text-[10px] bg-soft-green/10 text-soft-green font-bold px-2 py-0.5 rounded uppercase">
                    Boundary Verified
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
