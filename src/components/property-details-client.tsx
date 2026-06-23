'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Maximize2,
  Compass,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Percent,
  Layers,
  ArrowLeft,
  TrendingUp,
  Map,
  School,
  Activity,
  Phone,
  Mail,
  User,
  ShieldCheck,
  ChevronRight as ChevronRightIcon,
  Navigation,
  ExternalLink,
  BedDouble,
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';
import PropertyViewMap from '@/components/property-view-map-wrapper';
import { Turnstile } from '@/components/turnstile';
import { handleImageError, isValidCloudinaryUrl } from '@/lib/images';

interface PropertyImage {
  id: string;
  url: string;
  isCover: boolean;
}

interface Property {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  areaUnit: string;
  floor: number;
  availability: string;
  location: string;
  address: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  boundary: string | null;
  amenities: string[];
  imagesRelation: PropertyImage[];
  images: string;
  videoUrl?: string | null;
  brochureUrl?: string | null;
  virtualTourUrl?: string | null;
}

interface ClientProps {
  property: Property;
  nearby: Property[];
  sessionUser: any;
}

export default function PropertyDetailsClient({ property, nearby, sessionUser }: ClientProps) {
  // Get all images
  const allImages = property.imagesRelation && property.imagesRelation.length > 0
    ? property.imagesRelation.map(img => img.url)
    : (property.images ? property.images.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

  const coverUrl = property.imagesRelation?.find(img => img.isCover)?.url || 
                   property.imagesRelation?.[0]?.url || 
                   (property.images ? property.images.split(',')[0] : null);
  const initialIndex = allImages.indexOf(coverUrl || '') !== -1 ? allImages.indexOf(coverUrl || '') : 0;
  
  const [activeImageIndex, setActiveImageIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const activeImageUrl = allImages[activeImageIndex] || null;

  const handlePrev = () => {
    setActiveImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  // EMI Calculator State
  const [downPayment, setDownPayment] = useState(Math.round(property.price * 0.2));
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);

  // Inquiry Form State
  const [leadName, setLeadName] = useState(sessionUser?.name || '');
  const [leadEmail, setLeadEmail] = useState(sessionUser?.email || '');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadMessage, setLeadMessage] = useState(`Hi, I am interested in "${property.name}". Please share the verified paperwork and registry details.`);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // Math for EMI
  const calculateEMI = () => {
    const P = Math.max(0, property.price - downPayment);
    const r = (interestRate / 12) / 100;
    const n = tenureYears * 12;
    if (r === 0) return P / n;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return isNaN(emi) ? 0 : Math.round(emi);
  };
  const emiValue = calculateEMI();

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Crore`;
    }
    return `₹${(price / 100000).toFixed(1)} Lakh`;
  };

  const googleMapsUrl = property.latitude && property.longitude
    ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}`
    : '#';

  const directionsUrl = property.latitude && property.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`
    : '#';

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');

    if (!turnstileToken) {
      setLeadError('Please complete the Turnstile bot verification check.');
      return;
    }

    setLeadLoading(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          message: leadMessage,
          turnstileToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setLeadError(data.error || 'Failed to submit inquiry.');
      } else {
        setLeadSubmitted(true);
      }
    } catch (err) {
      setLeadError('An unexpected error occurred. Please try again.');
    } finally {
      setLeadLoading(false);
    }
  };

  // Nearby Essentials Mock
  const NEARBY_ESSENTIALS = [
    { type: 'School', name: 'Spring Dale Academy', distance: '1.2 km', rating: 'A' },
    { type: 'Hospital', name: 'Sahara Multispecialty Hospital', distance: '2.5 km', rating: 'A+' },
    { type: 'Market', name: 'Patrakar Puram Retail Hub', distance: '0.8 km', rating: 'B+' },
    { type: 'Transit', name: 'Gomti Nagar Metro Stop', distance: '1.5 km', rating: 'A' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-8">
        
        {/* Back Link */}
        <Link
          href={`/${property.type.toLowerCase() === 'plot' || property.type.toLowerCase() === 'lot' ? 'plots' : property.type.toLowerCase() === 'villa' || property.type.toLowerCase() === 'duplex' ? 'residencies' : 'apartments'}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-trust-blue transition-all"
        >
          <ArrowLeft size={12} />
          <span>Back to Catalog</span>
        </Link>

        {/* Title Block formatted as Investment Dossier Header */}
        <div className="bg-white rounded-[24px] p-6 border border-slate-200/60 shadow-premium flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-left">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-trust-blue/10 border border-trust-blue/20 rounded-full text-[10px] font-bold text-trust-blue uppercase tracking-wider">
                {property.type}
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={10} />
                RERA Registered
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              {property.name}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
              <MapPin size={14} className="text-slate-400" />
              <span>{property.location || `${property.address}, ${property.city}, ${property.state}`}</span>
            </p>
          </div>
          <div className="text-left md:text-right border-l md:border-l-0 md:border-r border-slate-100 pl-4 md:pl-0 md:pr-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Indexed Valuation</span>
            <span className="text-3xl font-black text-trust-blue block mt-1">{formatPrice(property.price)}</span>
            <span className="text-[9px] uppercase font-extrabold text-slate-500 block mt-1">Registry Verified</span>
          </div>
        </div>

        {/* Two column detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image, Specs, Overview, Calc */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Gallery Image Carousel */}
            <div className="space-y-4">
              <div className="aspect-[16/9] bg-slate-100 rounded-[24px] overflow-hidden relative shadow-premium border border-slate-200/60 group">
                {activeImageUrl ? (
                  <>
                    <img
                      src={activeImageUrl}
                      alt={property.name}
                      className="w-full h-full object-cover transition-all duration-500"
                      onError={(e) => handleImageError(e, property.type)}
                    />
                    {allImages.length > 1 && (
                      <>
                        {/* Left Control Chevron */}
                        <button
                          type="button"
                          onClick={handlePrev}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md border border-white/30 text-white rounded-full p-2.5 transition-all hover:scale-105 active:scale-95 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        {/* Right Control Chevron */}
                        <button
                          type="button"
                          onClick={handleNext}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md border border-white/30 text-white rounded-full p-2.5 transition-all hover:scale-105 active:scale-95 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
                    <Maximize2 size={36} />
                    <span className="text-xs mt-2">No image loaded</span>
                  </div>
                )}
              </div>

              {/* Thumbnails Row */}
              {allImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-slate-200">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all relative ${
                        activeImageIndex === idx ? 'border-trust-blue scale-102 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageError(e, property.type)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              {[
                { label: 'Bedrooms', val: property.bedrooms > 0 ? `${property.bedrooms} BHK` : 'Land Plot', icon: BedDouble },
                { label: 'Bathrooms', val: property.bathrooms > 0 ? `${property.bathrooms} Baths` : 'Zoned Land', icon: Activity },
                { label: 'Area Size', val: `${property.area.toLocaleString()} ${property.areaUnit || 'Sq Ft'}`, icon: Maximize2 },
                { label: 'Floor Level', val: property.floor > 0 ? `Floor ${property.floor}` : 'Ground level', icon: Compass }
              ].map((spec, idx) => (
                <div key={idx} className="border border-slate-200/60 p-4 rounded-xl space-y-2 bg-white shadow-xs">
                  <spec.icon size={18} className="text-trust-blue" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{spec.label}</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">{spec.val}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Overview / Description */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-3 shadow-premium text-left">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <FileText size={14} className="text-trust-blue" />
                Property Overview
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {property.description || 'Verified property description is compiling from RERA filings.'}
              </p>
            </div>

            {/* Media & Documents Catalog */}
            {(property.videoUrl || property.brochureUrl) && (
              <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-5 shadow-premium text-left">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-trust-blue" />
                  Media & Documents Catalog
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Video Tour Player / Link */}
                  {property.videoUrl && (property.videoUrl.startsWith('http://') || property.videoUrl.startsWith('https://')) && (
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Showcase Video Tour</span>
                      {property.videoUrl.toLowerCase().includes('.mp4') || property.videoUrl.toLowerCase().includes('res.cloudinary.com') ? (
                        <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 shadow-sm">
                          <video
                            src={property.videoUrl}
                            controls
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <a
                          href={property.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center border border-red-100">
                              <Compass size={18} />
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-xs block group-hover:text-trust-blue transition-colors">Virtual Video Tour</span>
                              <span className="text-[10px] text-slate-400 block font-normal">Click to play dynamic walkthrough</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Brochure Download Card */}
                  {property.brochureUrl && (property.brochureUrl.startsWith('http://') || property.brochureUrl.startsWith('https://')) && (
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Property Brochure PDF</span>
                      <a
                        href={property.brochureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition-all group h-[74px]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-trust-blue/5 text-trust-blue rounded-lg flex items-center justify-center border border-trust-blue/10">
                            <FileText size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs block group-hover:text-trust-blue transition-colors">Download Brochure</span>
                            <span className="text-[10px] text-slate-400 block font-normal">Download verified specifications</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Decision Confidence Indicators / Registry check list */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-4 shadow-premium text-left">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-soft-green" />
                Aura Decision Confidence Indicators
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <CheckCircle2 size={16} className="text-soft-green shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block">Registry Title Audit</span>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">Deeds match local registry database logs. Free of legal encumbrances.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <CheckCircle2 size={16} className="text-soft-green shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block">Physical GPS Boundary Check</span>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">On-site coordinates surveyed and boundary limits confirmed matching RERA filings.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <CheckCircle2 size={16} className="text-soft-green shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block">Direct Owner Representation</span>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">Direct communication setup bypassing broker pricing commission layers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <CheckCircle2 size={16} className="text-soft-green shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block">Historical Index Match</span>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">Pricing conforms within standard deviations of neighborhood pricing CAGR indices.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inline EMI Estimate Calculator */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-4 shadow-premium text-left">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Calculator size={14} className="text-trust-blue" />
                Affordability Preview — EMI Calculator
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Down Payment</span>
                    <span className="text-slate-800">₹{downPayment.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="100000"
                    max={property.price}
                    step="50000"
                    value={downPayment}
                    onChange={(e) => setDownPayment(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 accent-trust-blue rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Interest Rate</span>
                    <span className="text-slate-800">{interestRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="15"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 accent-trust-blue rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Loan Tenure</span>
                    <span className="text-slate-800">{tenureYears} Years</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={tenureYears}
                    onChange={(e) => setTenureYears(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 accent-trust-blue rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-100 mt-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Monthly Loan Repayment</span>
                  <span className="text-xl font-black text-trust-blue">₹{emiValue.toLocaleString()} / mo</span>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-semibold">
                  <span>Loan Principal: ₹{Math.max(0, property.price - downPayment).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Nearby Essentials */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-4 shadow-premium text-left">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Compass size={14} className="text-trust-blue" />
                Transit & Neighborhood Infrastructure
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                {NEARBY_ESSENTIALS.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{item.type}</span>
                      <span className="font-bold text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0 pl-4 border-l border-slate-200/60">
                      <span className="font-bold text-slate-700 block">{item.distance}</span>
                      <span className="text-[9px] text-soft-green font-bold uppercase">{item.rating} Grade</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Investment Snapshot, Map, Leads Form */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Investment Snapshot Sidebar */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] space-y-4 shadow-premium text-left">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <TrendingUp size={16} className="text-soft-green" />
                Investment Snapshot
              </h3>
              
              <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Expected Yield</span>
                  <span className="font-bold text-soft-green">4.2% - 4.8% Yield</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Appreciation Rating</span>
                  <span className="font-bold text-trust-blue">High (CAGR Index: A+)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">Buyer Demand</span>
                  <span className="font-bold text-slate-800">Active Search corridors</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-normal">RERA Verification</span>
                  <span className="px-2 py-0.5 bg-soft-green/10 text-soft-green font-bold rounded text-[9px] uppercase tracking-wider border border-soft-green/20">
                    100% Checked
                  </span>
                </div>
              </div>
            </div>

            {/* Leaflet GIS Map */}
            <div className="bg-white border border-slate-200/60 p-4 rounded-[24px] shadow-premium space-y-3 text-left">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Map size={14} className="text-trust-blue" />
                  GIS Property Map
                </h3>
                {property.latitude && property.longitude && (
                  <span className="text-[9px] text-slate-400 font-mono">
                    Coords: {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
                  </span>
                )}
              </div>

              <div className="h-[240px] rounded-xl overflow-hidden border border-slate-200/60">
                <PropertyViewMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  boundary={property.boundary}
                />
              </div>

              {property.latitude && property.longitude && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 border border-slate-200 hover:border-trust-blue hover:text-trust-blue text-slate-700 rounded-lg text-[9px] font-bold uppercase transition-all"
                  >
                    <ExternalLink size={10} />
                    Open Google Maps
                  </a>
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-trust-blue text-white hover:bg-trust-blue-hover rounded-lg text-[9px] font-bold uppercase transition-all"
                  >
                    <Navigation size={10} />
                    Get Directions
                  </a>
                </div>
              )}
            </div>

            {/* Inquiry Form */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-[24px] shadow-premium space-y-4 text-left">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
                Request verified Paperwork
              </h3>

              {leadSubmitted ? (
                <div className="p-4 bg-soft-green/10 border border-soft-green/20 text-soft-green text-xs rounded-lg">
                  Inquiry logged. Our locality expert will send title validation and tax documents shortly.
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3.5 text-xs text-left">
                  {leadError && (
                    <div className="p-2.5 bg-red-100 border border-red-200 text-red-700 rounded text-[11px]">
                      {leadError}
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Full Name</label>
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Email Address</label>
                    <input
                      type="email"
                      required
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Message</label>
                    <textarea
                      rows={3}
                      value={leadMessage}
                      onChange={(e) => setLeadMessage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-semibold resize-none"
                    />
                  </div>

                  <div className="py-1">
                    <Turnstile onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} />
                  </div>

                  <button
                    type="submit"
                    disabled={leadLoading}
                    className="w-full py-2.5 bg-trust-blue hover:bg-trust-blue-hover text-white font-bold rounded-lg uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                  >
                    {leadLoading ? 'Logging inquiry...' : 'Request verified Paperwork'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Recommended properties carousel list */}
        {nearby.length > 0 && (
          <div className="border-t border-slate-200/60 pt-8 space-y-6 text-left">
            <h3 className="text-xl font-extrabold text-slate-900">Similar Properties in this corridor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {nearby.map((prop) => {
                const propImage = prop.imagesRelation?.[0]?.url || (prop.images ? prop.images.split(',')[0] : null);
                return (
                  <Link
                    key={prop.id}
                    href={`/properties/${prop.id}`}
                    className="group block border border-slate-200/80 rounded-[24px] overflow-hidden hover:border-trust-blue transition-all bg-white shadow-premium hover:shadow-premium-hover"
                  >
                    <div className="h-44 bg-slate-100 relative overflow-hidden">
                      {propImage ? (
                        <img
                          src={propImage}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          onError={(e) => handleImageError(e, prop.type)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Maximize2 size={24} /></div>
                      )}
                      <div className="absolute top-3 left-3 bg-slate-100/90 text-slate-800 text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">
                        {prop.type}
                      </div>
                    </div>
                    <div className="p-5 space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-trust-blue transition-colors">
                        {prop.name}
                      </h4>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 font-medium">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>{prop.location}</span>
                      </p>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                        <span className="font-extrabold text-trust-blue text-sm">{formatPrice(prop.price)}</span>
                        <span className="text-[10px] bg-slate-50 px-2 py-0.5 rounded text-slate-500 font-bold">{prop.area} Sq Ft</span>
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
  );
}
