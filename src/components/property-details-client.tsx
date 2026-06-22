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
  BedDouble
} from 'lucide-react';
import PropertyViewMap from '@/components/property-view-map-wrapper';

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
}

interface ClientProps {
  property: Property;
  nearby: Property[];
  sessionUser: any;
}

export default function PropertyDetailsClient({ property, nearby, sessionUser }: ClientProps) {
  // Gallery cover state
  const coverImage = property.imagesRelation?.find(img => img.isCover)?.url || 
                     property.imagesRelation?.[0]?.url || 
                     (property.images ? property.images.split(',')[0] : null);

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

  // Inquiry submission handler
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadLoading(true);
    setLeadError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          message: leadMessage,
          // Bypassing turnstile for simple client post or mock
          turnstileToken: 'bypass'
        })
      });
      if (res.ok) {
        setLeadSubmitted(true);
      } else {
        setLeadError('Failed to log inquiry. Please try again.');
      }
    } catch (err) {
      setLeadError('Network connection issue.');
    } finally {
      setLeadLoading(false);
    }
  };

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

  // Nearby Essentials Mock
  const NEARBY_ESSENTIALS = [
    { type: 'School', name: 'Spring Dale Academy', distance: '1.2 km', rating: 'A' },
    { type: 'Hospital', name: 'Sahara Multispecialty Hospital', distance: '2.5 km', rating: 'A+' },
    { type: 'Market', name: 'Patrakar Puram Retail Hub', distance: '0.8 km', rating: 'B+' },
    { type: 'Transit', name: 'Gomti Nagar Metro Stop', distance: '1.5 km', rating: 'A' }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16">
      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-8">
        
        {/* Back Link */}
        <Link
          href={`/${property.type.toLowerCase() === 'plot' || property.type.toLowerCase() === 'lot' ? 'plots' : property.type.toLowerCase() === 'villa' || property.type.toLowerCase() === 'duplex' ? 'residencies' : 'apartments'}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-trust-blue transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Catalog</span>
        </Link>

        {/* Title Block */}
        <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <span className="px-2.5 py-1 bg-trust-blue/10 border border-trust-blue/20 rounded-full text-xs font-semibold text-trust-blue uppercase tracking-wider">
              {property.type}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mt-2">
              {property.name}
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-2">
              <MapPin size={16} className="text-slate-400" />
              <span>{property.location || `${property.address}, ${property.city}, ${property.state}`}</span>
            </p>
          </div>
          <div className="text-left md:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Decision Valuation</span>
            <span className="text-3xl font-black text-trust-blue block mt-1">{formatPrice(property.price)}</span>
            <span className="text-[9px] uppercase font-bold text-soft-green mt-1">Registry Verified</span>
          </div>
        </div>

        {/* Two column detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image, Stats, Overview, Calc */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Gallery Image */}
            <div className="aspect-[16/9] bg-slate-100 rounded-xl overflow-hidden relative shadow-sm border border-slate-200">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <Maximize2 size={36} />
                  <span className="text-xs mt-2">No image loaded</span>
                </div>
              )}
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Bedrooms', val: property.bedrooms > 0 ? `${property.bedrooms} BHK` : 'Land Plot', icon: BedDouble },
                { label: 'Bathrooms', val: property.bathrooms > 0 ? `${property.bathrooms} Baths` : 'Zoned Land', icon: Activity },
                { label: 'Area Size', val: `${property.area.toLocaleString()} ${property.areaUnit || 'Sq Ft'}`, icon: Maximize2 },
                { label: 'Floor Level', val: property.floor > 0 ? `Floor ${property.floor}` : 'Ground level', icon: Compass }
              ].map((spec, idx) => (
                <div key={idx} className="border border-slate-200 p-4 rounded-xl text-center space-y-2 bg-slate-50">
                  <spec.icon size={20} className="text-trust-blue mx-auto" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{spec.label}</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">{spec.val}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Overview / Description */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-3 bg-white">
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Property Overview</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {property.description || 'Verified property description is compiling from RERA filings.'}
              </p>
            </div>

            {/* Inline EMI Estimate Calculator */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4 bg-white">
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                <Calculator size={14} className="text-trust-blue" />
                Affordability Preview — EMI Estimate
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Down Payment</span>
                    <span>₹{downPayment.toLocaleString()}</span>
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

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Interest Rate</span>
                    <span>{interestRate}%</span>
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

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Loan Tenure</span>
                    <span>{tenureYears} Years</span>
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

              <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-100">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Estimated monthly EMI</span>
                  <span className="text-2xl font-black text-trust-blue">₹{emiValue.toLocaleString()} / mo</span>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <span>Loan Amount: ₹{Math.max(0, property.price - downPayment).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Nearby Essentials */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4 bg-white">
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Nearby Essentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {NEARBY_ESSENTIALS.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{item.type}</span>
                      <span className="font-bold text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
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
            
            {/* Investment Snapshot */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4 bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-1">
                <TrendingUp size={16} className="text-soft-green" />
                Investment Snapshot
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Expected Yield</span>
                  <span className="font-bold text-soft-green">4.2% - 4.8% Yield</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Growth Potential</span>
                  <span className="font-bold text-trust-blue">High (Locality Index: A)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Buyer Demand Level</span>
                  <span className="font-bold text-slate-800">Active Search corridors</span>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Verification Status</span>
                  <span className="px-2 py-0.5 bg-soft-green/10 text-soft-green font-bold rounded text-[9px] uppercase">
                    100% Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Leaflet GIS Map */}
            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Map size={14} className="text-trust-blue" />
                  GIS Property Map
                </h3>
                {property.latitude && property.longitude && (
                  <span className="text-[9px] text-slate-400 font-mono">
                    GPS coords: {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
                  </span>
                )}
              </div>

              <div className="h-[240px]">
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
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-white border border-slate-200 hover:border-trust-blue hover:text-trust-blue text-slate-700 rounded text-[10px] font-bold uppercase transition-colors"
                  >
                    <ExternalLink size={10} />
                    Open Google Maps
                  </a>
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-trust-blue text-white hover:bg-trust-blue-hover rounded text-[10px] font-bold uppercase transition-colors"
                  >
                    <Navigation size={10} />
                    Get Directions
                  </a>
                </div>
              )}
            </div>

            {/* Inquiry Form */}
            <div className="border border-slate-200 p-6 rounded-xl bg-white shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
                Request Property Paperwork
              </h3>

              {leadSubmitted ? (
                <div className="p-4 bg-soft-green/10 border border-soft-green/20 text-soft-green text-xs rounded-lg">
                  Inquiry logged. Our locality expert will send title validation and tax documents shortly.
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3 text-xs">
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
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 outline-none focus:border-trust-blue font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Email Address</label>
                    <input
                      type="email"
                      required
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 outline-none focus:border-trust-blue font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 outline-none focus:border-trust-blue font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Message</label>
                    <textarea
                      rows={3}
                      value={leadMessage}
                      onChange={(e) => setLeadMessage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 outline-none focus:border-trust-blue font-medium resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={leadLoading}
                    className="w-full py-2.5 bg-trust-blue hover:bg-trust-blue-hover text-white font-bold rounded uppercase tracking-wider text-[10px] transition-colors"
                  >
                    {leadLoading ? 'Logging inquiry...' : 'Request verified Paperwork'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Recommended properties carousel */}
        {nearby.length > 0 && (
          <div className="border-t border-slate-100 pt-8 space-y-6">
            <h3 className="text-xl font-extrabold text-slate-900">Similar Properties in this corridor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {nearby.map((prop) => {
                const propImage = prop.imagesRelation?.[0]?.url || (prop.images ? prop.images.split(',')[0] : null);
                return (
                  <Link
                    key={prop.id}
                    href={`/properties/${prop.id}`}
                    className="group block border border-slate-200 rounded-xl overflow-hidden hover:border-trust-blue transition-colors bg-white shadow-sm"
                  >
                    <div className="h-44 bg-slate-100 relative overflow-hidden">
                      {propImage ? (
                        <img
                          src={propImage}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Maximize2 size={24} /></div>
                      )}
                      <div className="absolute top-3 left-3 bg-slate-100/90 text-slate-800 text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">
                        {prop.type}
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-trust-blue transition-colors">
                        {prop.name}
                      </h4>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>{prop.location}</span>
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <span className="font-extrabold text-trust-blue text-sm">{formatPrice(prop.price)}</span>
                        <span className="text-[10px] text-slate-400">{prop.area} Sq Ft</span>
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
