'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import {
  Search,
  MapPin,
  TrendingUp,
  Calculator,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Layers,
  Activity,
  CheckCircle2,
  Building2,
  DollarSign,
  Percent,
  Compass,
  Mail,
  Phone,
  ArrowUpRight,
  Star,
  BookOpen,
  Users,
  Award,
  ShieldAlert,
  Sliders,
  Check,
  CheckCircle
} from 'lucide-react';
import { formatIndianRealEstatePrice } from '@/lib/currency';

interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  bedrooms: number;
  area: number;
  areaUnit: string;
  type: string;
  availability: string;
  featured: boolean;
  images: string;
  status?: string;
  templateId?: string;
  templateFields?: any;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmsData, setCmsData] = useState<any>(null);

  // Search form state
  const [searchLocation, setSearchLocation] = useState('');
  const [searchType, setSearchType] = useState('Plot');
  const [searchBudget, setSearchBudget] = useState('');

  // Interactive Mini Tools state in Section 5
  const [miniEmiPrincipal, setMiniEmiPrincipal] = useState(5000000);
  const [miniEmiRate, setMiniEmiRate] = useState(8.5);
  const [miniEmiTenure, setMiniEmiTenure] = useState(20);
  const [miniYieldPrice, setMiniYieldPrice] = useState(6000000);
  const [miniYieldRent, setMiniYieldRent] = useState(22000);

  // Testimonials Tab state
  const [activeTestimonialTab, setActiveTestimonialTab] = useState<'family' | 'investor' | 'firsttime'>('family');

  // Load properties and CMS data on mount
  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          const published = (Array.isArray(data) ? data : []).filter(
            (p: any) => p.status === 'PUBLISHED' || !p.status
          );
          setProperties(published);
        }
      } catch (err) {
        console.error('Error loading properties:', err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchCms() {
      try {
        const res = await fetch('/api/cms');
        if (res.ok) {
          const json = await res.json();
          setCmsData(json);
        }
      } catch (err) {
        console.error('Error fetching landing page CMS configs:', err);
      }
    }

    fetchProperties();
    fetchCms();
  }, []);

  // Update SEO Meta Tags from CMS config in DOM
  useEffect(() => {
    if (cmsData?.seo) {
      document.title = cmsData.seo.metaTitle || 'Aura Estates';
      const descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) descMeta.setAttribute('content', cmsData.seo.metaDescription || '');
      const kwMeta = document.querySelector('meta[name="keywords"]');
      if (kwMeta) kwMeta.setAttribute('content', cmsData.seo.keywords || '');
    }
  }, [cmsData]);

  // Pricing format utility
  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Crore`;
    }
    return `₹${(price / 100000).toFixed(1)} Lakh`;
  };

  // Math calculations for inline widgets
  const calculateMiniEMI = () => {
    const P = miniEmiPrincipal;
    const r = (miniEmiRate / 12) / 100;
    const n = miniEmiTenure * 12;
    if (r === 0) return Math.round(P / n);
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
  };

  const calculateMiniYield = () => {
    const grossAnnual = miniYieldRent * 12;
    const yieldPct = (grossAnnual / miniYieldPrice) * 100;
    return yieldPct.toFixed(2);
  };

  // MOCK FALLBACK DATA
  const fallbackPlots: Property[] = [
    {
      id: 'mock-plot-1',
      name: 'Gomti Nagar Extension Plots',
      location: 'Sector 4, Gomti Nagar, Lucknow',
      price: 6500000,
      bedrooms: 0,
      area: 1800,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      availability: 'AVAILABLE',
      featured: true,
      images: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80'
    },
    {
      id: 'mock-plot-2',
      name: 'Deva Road Residential Land',
      location: 'Mati, Lucknow',
      price: 2800000,
      bedrooms: 0,
      area: 1200,
      areaUnit: 'Sq Ft',
      type: 'Plot',
      availability: 'AVAILABLE',
      featured: true,
      images: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80'
    }
  ];

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
      availability: 'AVAILABLE',
      featured: true,
      images: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&auto=format&fit=crop&q=80'
    }
  ];

  // Logic to calculate spotlight & carousel based on Featured Property Config
  const getFeaturedCollection = () => {
    if (properties.length === 0) return [...fallbackPlots, ...fallbackResidencies];
    
    if (cmsData?.featuredConfig?.mode === 'MANUAL' && Array.isArray(cmsData.featuredConfig.manualIds) && cmsData.featuredConfig.manualIds.length > 0) {
      const manual = properties.filter(p => cmsData.featuredConfig.manualIds.includes(p.id));
      if (manual.length > 0) return manual;
    }
    
    // Auto mode or fallback: items marked featured
    const featured = properties.filter(p => p.featured);
    return featured.length > 0 ? featured : properties;
  };

  const featuredCollection = getFeaturedCollection();
  const spotlightProperty = featuredCollection[0] || fallbackResidencies[0];
  const carouselProperties = featuredCollection.slice(1).length > 0 ? featuredCollection.slice(1) : fallbackPlots;

  // Dynamic Metrics mapping helper
  const getHeroMetrics = () => {
    if (cmsData?.heroMetrics && cmsData.heroMetrics.length > 0) {
      return cmsData.heroMetrics;
    }
    return [
      { id: '1', title: 'Top Growth Area', value: 'Gomti Nagar Ext.', suffix: '+28% CAGR' },
      { id: '2', title: 'Avg. Rental Yield', value: '4.8% Net', suffix: 'लखनऊ City Average' }
    ];
  };

  const getTrustMetrics = () => {
    if (cmsData?.trustMetrics && cmsData.trustMetrics.length > 0) {
      return cmsData.trustMetrics;
    }
    return [
      { id: '1', title: 'Verified Listings', value: '1,200', suffix: '+' },
      { id: '2', title: 'Localities Covered', value: '50', suffix: '+' },
      { id: '3', title: 'User Satisfaction', value: '92', suffix: '%' },
      { id: '4', title: 'Verified Documentation', value: '100', suffix: '%' }
    ];
  };

  // Locality scoreboard rendering helper
  const getLocalitiesScorecards = () => {
    if (cmsData?.localities && cmsData.localities.length > 0) {
      return cmsData.localities;
    }
    return [
      { id: '1', areaName: 'Gomti Nagar', investmentRating: 'A+', growthScore: 92, connectivityScore: 95, demandScore: 92 },
      { id: '2', areaName: 'Indira Nagar', investmentRating: 'A', growthScore: 84, connectivityScore: 90, demandScore: 84 },
      { id: '3', areaName: 'Shaheed Path', investmentRating: 'A+', growthScore: 96, connectivityScore: 88, demandScore: 96 },
      { id: '4', areaName: 'Hazratganj', investmentRating: 'A+', growthScore: 88, connectivityScore: 96, demandScore: 91 }
    ];
  };

  // Testimonial selector
  const getTestimonialList = () => {
    if (cmsData?.testimonials && cmsData.testimonials.length > 0) {
      return cmsData.testimonials;
    }
    // Static fallbacks
    return [
      { id: 'f-1', name: 'The Mishra Family', location: 'Purchased Plot, Gomti Nagar', review: 'Aura Estates helped us verify the boundary limits of our plot in Gomti Nagar Ext. before we finalized the transaction. The transparency check is unmatched.', propertyType: 'Plot', rating: 5 },
      { id: 'i-1', name: 'Aryan B.', location: 'Portfolio Manager, UP Land Holdings', review: 'The locality pricing scorecard is incredibly robust. I checked historical CAGR details on Sultanpur Road and made an investment decision completely based on transaction indices.', propertyType: 'Residency', rating: 5 },
      { id: 'ft-1', name: 'K. Raghavan', location: 'First-time flat buyer, Indira Nagar', review: 'The inline EMI calculators and transparent stamp duty estimators gave me clear buying constraints. We got our first 2 BHK flat without any pushy agent calls.', propertyType: 'Apartment', rating: 5 }
    ];
  };

  const testimonialsList = getTestimonialList();
  const filteredTestimonials = testimonialsList.filter((t: any) => {
    const pType = (t.propertyType || '').toLowerCase();
    if (activeTestimonialTab === 'family') return pType.includes('plot') || t.featured || pType.includes('land');
    if (activeTestimonialTab === 'investor') return pType.includes('residency') || pType.includes('villa') || pType.includes('commercial') || pType.includes('duplex');
    if (activeTestimonialTab === 'firsttime') return pType.includes('apartment') || pType.includes('flat') || pType.includes('society');
    return true;
  });

  // Dynamic layout renderer mapping
  const renderCmsSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        if (cmsData?.hero && !cmsData.hero.visible) return null;
        
        const headline = cmsData?.hero?.headline || "Find the Right Property. Backed by Data, Not Guesswork.";
        const subheadline = cmsData?.hero?.subheadline || "Discover verified plots, apartments, and residences with real market insights, investment intelligence, locality trends, and transparent pricing.";
        const primaryText = cmsData?.hero?.primaryCtaText || "Explore Properties";
        const primaryUrl = cmsData?.hero?.primaryCtaUrl || "/plots";
        const secondaryText = cmsData?.hero?.secondaryCtaText || "View Market Intelligence";
        const secondaryUrl = cmsData?.hero?.secondaryCtaUrl || "/investment-intelligence";
        const mediaUrl = cmsData?.hero?.backgroundMedia || "";
        const bgType = cmsData?.hero?.bgType || "image";

        return (
          <section key="hero" className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden grid-pattern">
            {/* Background media if configured */}
            {mediaUrl && (
              <div className="absolute inset-0 w-full h-full -z-20 overflow-hidden">
                {bgType === 'video' ? (
                  <video src={mediaUrl} autoPlay loop muted className="w-full h-full object-cover opacity-15" />
                ) : (
                  <img src={mediaUrl} alt="Hero Background Image" className="w-full h-full object-cover opacity-15" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white" />
              </div>
            )}
            
            {/* Stripe/Linear style background accents */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-radial from-blue-50/40 via-blue-100/10 to-transparent blur-[80px] pointer-events-none -z-10" />
            <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-50/30 blur-3xl animate-float-slow -z-10" />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-emerald-50/20 blur-3xl animate-float-rev -z-10" />

            <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
              {/* Hero Left */}
              <div className="lg:col-span-6 flex flex-col space-y-6 text-left">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-trust-blue/10 rounded-full text-xs font-semibold text-trust-blue w-fit"
                >
                  <ShieldCheck size={14} />
                  100% Registry Verification & Boundary Checks
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] text-slate-900"
                >
                  {headline}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-base sm:text-lg text-slate-500 font-normal leading-relaxed max-w-xl"
                >
                  {subheadline}
                </motion.p>

                {/* Search */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="w-full bg-white p-3 rounded-2xl border border-slate-200 shadow-xl"
                >
                  <form 
                    action={`/${searchType.toLowerCase() === 'plot' ? 'plots' : searchType.toLowerCase() === 'villa' || searchType.toLowerCase() === 'duplex' ? 'residencies' : 'apartments'}`}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                  >
                    <div className="md:col-span-3 flex flex-col space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider pl-1">Locality</label>
                      <select
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 p-2 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-trust-blue"
                        name="location"
                      >
                        <option value="">All Areas</option>
                        <option value="gomti-nagar">Gomti Nagar</option>
                        <option value="indira-nagar">Indira Nagar</option>
                        <option value="hazratganj">Hazratganj</option>
                        <option value="aliganj">Aliganj</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 flex flex-col space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider pl-1">Category</label>
                      <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 p-2 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-trust-blue"
                        name="type"
                      >
                        <option value="Plot">Plot / Land</option>
                        <option value="Apartment">Apartment</option>
                        <option value="Residency">Independent House / Villa</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 flex flex-col space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider pl-1">Budget</label>
                      <select
                        value={searchBudget}
                        onChange={(e) => setSearchBudget(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 p-2 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-trust-blue"
                        name="budget"
                      >
                        <option value="">No Limit</option>
                        <option value="5000000">Under ₹50 L</option>
                        <option value="10000000">Under ₹1 Cr</option>
                        <option value="20000000">Under ₹2 Cr</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 pt-3.5">
                      <button
                        type="submit"
                        className="w-full h-9 bg-trust-blue text-white hover:bg-trust-blue-hover rounded-lg font-bold flex items-center justify-center gap-1.5 shadow transition-colors text-xs"
                      >
                        <Search size={14} />
                        <span>Search</span>
                      </button>
                    </div>
                  </form>
                </motion.div>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="flex flex-wrap gap-4 pt-2"
                >
                  <Link
                    href={primaryUrl}
                    className="px-6 py-3 bg-trust-blue hover:bg-trust-blue-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-colors flex items-center gap-2"
                  >
                    <span>{primaryText}</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    href={secondaryUrl}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-slate-200 flex items-center gap-2"
                  >
                    <span>{secondaryText}</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </motion.div>
              </div>

              {/* Hero Right */}
              <div className="lg:col-span-6 flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="w-full max-w-lg glass-panel rounded-3xl p-6 shadow-2xl relative space-y-6"
                >
                  <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                    Live Market Data
                  </div>

                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Lucknow Index</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">Aura-LK26</span>
                        <span className="text-xs font-bold text-soft-green flex items-center gap-0.5">
                          <TrendingUp size={12} />
                          ↑ 18.4% YoY
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Verified Pool</span>
                      <span className="text-xl font-extrabold text-trust-blue">{properties.length > 0 ? properties.length : '1,200+'} Listings</span>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                      <span>Price Growth Trend (2022 - 2026)</span>
                      <span className="text-slate-600">Avg. ₹5,450/Sq Ft</span>
                    </div>
                    <div className="h-28 w-full bg-slate-50/50 rounded-xl p-2 relative overflow-hidden border border-slate-100">
                      <svg className="w-full h-full text-trust-blue" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--trust-blue)" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="var(--trust-blue)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="15" x2="200" y2="15" stroke="rgba(226, 232, 240, 0.4)" strokeDasharray="3" />
                        <line x1="0" y1="35" x2="200" y2="35" stroke="rgba(226, 232, 240, 0.4)" strokeDasharray="3" />
                        <path d="M0,50 Q30,42 60,35 T120,20 T170,12 T200,5 L200,60 L0,60 Z" fill="url(#chartGrad)" />
                        <motion.path
                          d="M0,50 Q30,42 60,35 T120,20 T170,12 T200,5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                        <circle cx="200" cy="5" r="3.5" fill="var(--color-soft-green)" />
                      </svg>
                    </div>
                  </div>

                  {/* Performance Indicators */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {getHeroMetrics().slice(0, 2).map((m: any) => (
                      <div key={m.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100/50 space-y-1">
                        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">{m.title}</span>
                        <span className="text-xs font-bold text-slate-800 block truncate">{m.value}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">{m.suffix}</span>
                      </div>
                    ))}
                  </div>

                  {/* Locality bars */}
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Demand Distribution</span>
                    <div className="space-y-1.5">
                      {getLocalitiesScorecards().slice(0, 2).map((loc: any, idx: number) => (
                        <React.Fragment key={loc.id}>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-semibold text-slate-600">{loc.areaName}</span>
                            <span className="font-bold text-slate-700">{loc.demandScore}/100</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${loc.demandScore}%` }}
                              transition={{ duration: 1, delay: idx * 0.15 }}
                              className="h-full bg-trust-blue rounded-full"
                            />
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        );

      case 'trust-bar':
        return (
          <section key="trust-bar" className="bg-slate-50 border-y border-slate-200 py-6">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-slate-200">
              {getTrustMetrics().map((m: any) => (
                <div key={m.id}>
                  <div className="text-2xl font-black text-trust-blue">{m.value}{m.suffix}</div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-0.5">{m.title}</div>
                </div>
              ))}
            </div>
          </section>
        );

      case 'categories':
        return (
          <section key="categories" className="py-24 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
              <div className="space-y-2">
                <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Structural Categories</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Explore Properties by Asset Class</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Link href="/plots" className="group relative h-96 rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 block">
                  <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80" alt="Plots" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <span className="text-[9px] bg-emerald-500 px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">High appreciation</span>
                    <h3 className="text-xl font-bold">Residential Plots</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">Residential Plots • Commercial Land • Investment Land</p>
                  </div>
                </Link>

                <Link href="/residencies" className="group relative h-96 rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 block">
                  <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80" alt="Residencies" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <span className="text-[9px] bg-trust-blue px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">Built Properties</span>
                    <h3 className="text-xl font-bold">Residencies</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">Independent Homes • Luxury Villas • Builder Floors</p>
                  </div>
                </Link>

                <Link href="/apartments" className="group relative h-96 rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 block">
                  <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80" alt="Apartments" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <span className="text-[9px] bg-sky-500 px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">Ready to move</span>
                    <h3 className="text-xl font-bold">Apartments</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">1 BHK • 2 BHK Flats • High-rise Society Apartments</p>
                  </div>
                </Link>
              </div>
            </div>
          </section>
        );

      case 'how-we-help':
      case 'why-trust':
        return (
          <section key={sectionId} className="py-24 border-b border-slate-100 bg-slate-50/50">
            <div className="max-w-5xl mx-auto px-6 text-center space-y-16">
              <div className="space-y-2">
                <span className="text-soft-green text-xs font-bold uppercase tracking-widest block">User Journey</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Structured Path to Confident Ownership</h2>
              </div>

              <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="hidden md:block absolute top-[40px] left-[12%] right-[12%] h-0.5 bg-slate-200" />

                <div className="relative space-y-4">
                  <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl shadow-md flex items-center justify-center mx-auto text-trust-blue z-10 relative">
                    <Search size={32} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Step 1</div>
                    <h3 className="font-bold text-slate-900 text-sm">Search Verified</h3>
                    <p className="text-xs text-slate-500 leading-relaxed px-4">Browse physical boundary verified listings matched with registry office data.</p>
                  </div>
                </div>

                <div className="relative space-y-4">
                  <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl shadow-md flex items-center justify-center mx-auto text-trust-blue z-10 relative">
                    <Layers size={32} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Step 2</div>
                    <h3 className="font-bold text-slate-900 text-sm">Compare Opportunities</h3>
                    <p className="text-xs text-slate-500 leading-relaxed px-4">Use side-by-side matrices to check yield, layout sizes, and pricing curves.</p>
                  </div>
                </div>

                <div className="relative space-y-4">
                  <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl shadow-md flex items-center justify-center mx-auto text-trust-blue z-10 relative">
                    <Activity size={32} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Step 3</div>
                    <h3 className="font-bold text-slate-900 text-sm">Understand Trends</h3>
                    <p className="text-xs text-slate-500 leading-relaxed px-4">Inspect locality reports on infrastructure, hospitals, and schools.</p>
                  </div>
                </div>

                <div className="relative space-y-4">
                  <div className="w-20 h-20 bg-trust-blue text-white rounded-2xl shadow-lg flex items-center justify-center mx-auto z-10 relative">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-trust-blue tracking-widest">Step 4</div>
                    <h3 className="font-bold text-slate-900 text-sm">Decide Confidently</h3>
                    <p className="text-xs text-slate-500 leading-relaxed px-4">Finalize paperwork with clean verification credentials.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'investment':
        return (
          <section key="investment" className="py-24 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                  <span className="text-soft-green text-xs font-bold uppercase tracking-widest">Bloomberg meets Zillow</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Real Estate Appreciation Dashboard</h2>
                </div>
                <Link href="/investment-intelligence" className="text-xs font-bold text-trust-blue hover:underline flex items-center gap-1">
                  <span>Explore Analytics Dashboard</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 bg-slate-50 p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-2 text-xs font-bold">
                    <div className="text-slate-700">Localities Price Appreciation % (5 Yr History)</div>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1 text-trust-blue">
                        <span className="w-2.5 h-2.5 bg-trust-blue rounded-full"></span> Gomti Nagar (+28%)
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full"></span> Indira Nagar (+17%)
                      </span>
                      <span className="flex items-center gap-1 text-emerald-500">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Shaheed Path (+35%)
                      </span>
                    </div>
                  </div>

                  <div className="h-64 bg-white rounded-xl border border-slate-200 p-4 relative">
                    <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
                      <line x1="0" y1="30" x2="400" y2="30" stroke="rgba(226, 232, 240, 0.4)" strokeDasharray="3" />
                      <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(226, 232, 240, 0.4)" strokeDasharray="3" />
                      <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(226, 232, 240, 0.4)" strokeDasharray="3" />
                      <path d="M0,130 Q100,115 200,90 T400,60" fill="none" stroke="var(--color-trust-blue)" strokeWidth="2.5" />
                      <path d="M0,130 Q100,123 200,110 T400,95" fill="none" stroke="#94a3b8" strokeWidth="2" />
                      <path d="M0,130 Q100,105 200,75 T400,45" fill="none" stroke="var(--color-soft-green)" strokeWidth="2.5" />
                      <circle cx="400" cy="60" r="3.5" fill="var(--color-trust-blue)" />
                      <circle cx="400" cy="95" r="3" fill="#94a3b8" />
                      <circle cx="400" cy="45" r="3.5" fill="var(--color-soft-green)" />
                    </svg>
                    <div className="absolute top-4 left-4 p-2.5 bg-slate-900 text-white rounded text-[9px] font-mono leading-relaxed space-y-0.5">
                      <div>REGISTRY STATS ACTIVE</div>
                      <div>LAST SEEDED CORRIDORS: 6</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl flex gap-3 shadow-sm hover:shadow transition-shadow">
                    <div className="w-9 h-9 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Star size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Highest Demand Locality</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Vibhuti Khand (Gomti Nagar) holds average growth multiplier scores of 9.2.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl flex gap-3 shadow-sm hover:shadow transition-shadow">
                    <div className="w-9 h-9 rounded bg-blue-50 text-trust-blue flex items-center justify-center shrink-0"><TrendingUp size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Fastest Growing Zone</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Shaheed Path corridor has appreciated +35% in total transaction index rates.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl flex gap-3 shadow-sm hover:shadow transition-shadow">
                    <div className="w-9 h-9 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Percent size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Best Rental Yield Areas</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Central commercial corridors in Indira Nagar return 3.8% annual net yields.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'tools':
        return (
          <section key="tools" className="py-24 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-center">
                <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Interactive Simulators</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Evaluate Your Purchases Real-Time</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="border border-slate-200 p-6 rounded-2xl bg-slate-50 flex flex-col justify-between shadow-sm relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-trust-blue/10 rounded-lg text-trust-blue"><Calculator size={20} /></div>
                      <h3 className="font-extrabold text-slate-900 text-base">EMI Estimator</h3>
                    </div>
                    <p className="text-xs text-slate-500">Estimate monthly outgoings. Drag the slider to test loan size variations.</p>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Principal Amount</span>
                        <span>₹{(miniEmiPrincipal / 100000).toFixed(0)} Lakh</span>
                      </div>
                      <input
                        type="range" min="1000000" max="15000000" step="500000"
                        value={miniEmiPrincipal}
                        onChange={(e) => setMiniEmiPrincipal(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-slate-200 accent-trust-blue rounded-lg cursor-pointer"
                      />
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Estimated Outflow</span>
                        <span className="text-sm font-extrabold text-trust-blue">₹{calculateMiniEMI().toLocaleString()}/mo</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=emi" className="text-xs text-trust-blue font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Configure Advanced Parameters</span><ArrowRight size={12} />
                  </Link>
                </div>

                <div className="border border-slate-200 p-6 rounded-2xl bg-slate-50 flex flex-col justify-between shadow-sm relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 text-soft-green rounded-lg"><Percent size={20} /></div>
                      <h3 className="font-extrabold text-slate-900 text-base">Rental Yield Estimator</h3>
                    </div>
                    <p className="text-xs text-slate-500">Determine yield outcomes based on neighborhood monthly lease rates.</p>
                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Cost (Lakh)</label>
                          <input
                            type="number"
                            value={miniYieldPrice / 100000}
                            onChange={(e) => setMiniYieldPrice((parseFloat(e.target.value) || 0) * 100000)}
                            className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-700 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Rent/mo</label>
                          <input
                            type="number"
                            value={miniYieldRent}
                            onChange={(e) => setMiniYieldRent(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-700 font-bold"
                          />
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Gross Return Yield</span>
                        <span className="text-sm font-extrabold text-soft-green">{calculateMiniYield()}% Yield</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=yield" className="text-xs text-trust-blue font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Configure Annual Expenses</span><ArrowRight size={12} />
                  </Link>
                </div>

                <div className="border border-slate-200 p-6 rounded-2xl bg-slate-50 flex flex-col justify-between shadow-sm relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Layers size={20} /></div>
                      <h3 className="font-extrabold text-slate-900 text-base">Comparison Portal</h3>
                    </div>
                    <p className="text-xs text-slate-500">Direct comparison index comparing up to 3 selected properties side-by-side.</p>
                    <div className="space-y-2 pt-1 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                        <Check size={12} className="text-soft-green shrink-0" />
                        <span className="truncate">Compare Square Yards to Bigha / Gaj</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                        <Check size={12} className="text-soft-green shrink-0" />
                        <span className="truncate">Assess Locality Scores dynamically</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=compare" className="text-xs text-trust-blue font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Launch Compare Matrix</span><ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        );

      case 'featured':
        return (
          <section key="featured" className="py-24 border-b border-slate-100 bg-slate-50/20">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-left">
                <span className="text-soft-green text-xs font-bold uppercase tracking-widest block">Premium Showcase</span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Featured Property Spotlight</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden items-stretch">
                <div className="lg:col-span-7 relative min-h-[300px]">
                  <img
                    src={spotlightProperty.images ? spotlightProperty.images.split(',')[0] : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80'}
                    alt={spotlightProperty.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 bg-trust-blue text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Featured Deal
                  </div>
                </div>

                <div className="lg:col-span-5 p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {spotlightProperty.type} Listing
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{spotlightProperty.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 gap-1">
                      <MapPin size={14} className="text-slate-400" />
                      <span>{spotlightProperty.location}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-400">Listed Price</span>
                      <span className="font-bold text-trust-blue">{formatPrice(spotlightProperty.price)}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-400">Listed Area Size</span>
                      <span>{spotlightProperty.area} {spotlightProperty.areaUnit || 'Sq Ft'}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-400">Estimated Yield Potential</span>
                      <span className="text-soft-green font-extrabold">4.2% YoY</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-400">Locality Rating</span>
                      <span className="text-trust-blue font-extrabold">A+ Stable</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Link
                      href={`/properties/${spotlightProperty.id}`}
                      className="w-full py-3 bg-trust-blue hover:bg-trust-blue-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl text-center shadow transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Complete Analysis</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Carousel */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-400">Alternative Options Available</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {carouselProperties.map((prop) => (
                    <Link 
                      href={`/properties/${prop.id}`} 
                      key={prop.id}
                      className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow hover:border-slate-300 transition-all flex flex-col justify-between h-40"
                    >
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 border px-1.5 py-0.5 rounded">{prop.type}</span>
                        <h4 className="font-bold text-slate-900 text-sm mt-2 line-clamp-1">{prop.name}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{prop.location}</p>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs font-bold mt-2">
                        <span className="text-trust-blue">{formatPrice(prop.price)}</span>
                        <span className="text-slate-400">{prop.area} {prop.areaUnit || 'Sq Ft'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );

      case 'localities':
        return (
          <section key="localities" className="py-24 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Locality Audits</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Locality Pricing Scorecard</h2>
                </div>
                <Link href="/investment-intelligence" className="text-xs font-bold text-trust-blue hover:underline">
                  See All Lucknow Localities
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {getLocalitiesScorecards().map((loc: any) => (
                  <Link 
                    href={`/areas/${loc.areaName.toLowerCase().replace(/ /g, '-')}`}
                    key={loc.id}
                    className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all space-y-4 block text-left"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-extrabold text-slate-900 text-lg">{loc.areaName}</h3>
                      <span className="text-xs font-black text-soft-green">{loc.investmentRating} Rating</span>
                    </div>
                    <div className="space-y-2 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between">
                        <span>Growth Index</span>
                        <span className="text-slate-800">{loc.growthScore} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Connectivity</span>
                        <span className="text-slate-800">{loc.connectivityScore} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rental Yield</span>
                        <span className="text-slate-800">{loc.demandScore} / 100</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-trust-blue font-bold block pt-2">View Locality Report →</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );

      case 'testimonials':
        return (
          <section key="testimonials" className="py-24 border-b border-slate-100">
            <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
              <div className="space-y-2">
                <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Client Testimonials</span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Verified Buyer Testimonials</h2>
              </div>

              {/* Tabs */}
              <div className="flex justify-center border-b border-slate-200 pb-2 gap-2">
                <button
                  onClick={() => setActiveTestimonialTab('family')}
                  className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${
                    activeTestimonialTab === 'family' ? 'bg-trust-blue text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Family Buyers
                </button>
                <button
                  onClick={() => setActiveTestimonialTab('investor')}
                  className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${
                    activeTestimonialTab === 'investor' ? 'bg-trust-blue text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Investors
                </button>
                <button
                  onClick={() => setActiveTestimonialTab('firsttime')}
                  className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${
                    activeTestimonialTab === 'firsttime' ? 'bg-trust-blue text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  First-Time Buyers
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl min-h-[220px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                  {filteredTestimonials.length > 0 ? (
                    <motion.div
                      key={activeTestimonialTab}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4"
                    >
                      <div className="flex justify-center text-amber-400">
                        {[...Array(filteredTestimonials[0].rating || 5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                      </div>
                      <blockquote className="text-sm md:text-base text-slate-600 italic leading-relaxed">
                        "{filteredTestimonials[0].review}"
                      </blockquote>
                      <cite className="block text-xs font-bold text-slate-700 not-italic mt-2">
                        — {filteredTestimonials[0].name} ({filteredTestimonials[0].location})
                      </cite>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No testimonials registered for this buyer group.</p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        );

      case 'research':
        return (
          <section key="research" className="py-24 border-b border-slate-100 bg-slate-50/50">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-center">
                <span className="text-soft-green text-xs font-bold uppercase tracking-widest block">Prop-Tech Journal</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Independent Research & Guides</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                {cmsData?.articles && cmsData.articles.length > 0 ? (
                  cmsData.articles.slice(0, 4).map((art: any) => (
                    <div key={art.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow transition-shadow flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border rounded">
                          {art.author || 'Research Team'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-2">{art.title}</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                          {art.content.replace(/[#*`_-]/g, '').slice(0, 120)}...
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-50">
                        <span>{new Date(art.publishedDate).toLocaleDateString()}</span>
                        <Link href="/about" className="text-trust-blue hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallbacks
                  <>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow transition-shadow flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border rounded">Buying Checklist</span>
                        <h4 className="font-bold text-slate-900 text-sm">Top 5 Areas for First-Time Home Buyers</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">Safety, proximity to transport nodes, and low down-payment support areas analyzed for new buyers.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-50">
                        <span>PDF Available</span>
                        <Link href="/about?guide=first-time" className="text-trust-blue hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow transition-shadow flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border rounded">Yield Report</span>
                        <h4 className="font-bold text-slate-900 text-sm">Best Rental Yield Locations in Lucknow</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">Check out areas offering high rental multipliers from corporate hubs and major shopping avenues.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-50">
                        <span>5 Min Read</span>
                        <Link href="/about?guide=buying" className="text-trust-blue hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow transition-shadow flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border rounded">Market Pulse</span>
                        <h4 className="font-bold text-slate-900 text-sm">Emerging Growth Corridors for 2026</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">Infrastructure shifts like new roads and highways are bringing massive appreciation opportunities.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-50">
                        <span>Download Report</span>
                        <Link href="/about?guide=buying" className="text-trust-blue hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow transition-shadow flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border rounded">Comparison Study</span>
                        <h4 className="font-bold text-slate-900 text-sm">Plot vs Apartment Investment Comparison</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">Evaluating liquidity, average maintenance costs, boundary safety factors, and ROI trends.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-50">
                        <span>Academic Grade</span>
                        <Link href="/about" className="text-trust-blue hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        );

      case 'footer':
        const companyInfo = cmsData?.footer?.companyInfo || "Lucid property search meets independent market intelligence. Making verified real estate data accessible to families and investors.";
        const contactPhone = cmsData?.footer?.contactPhone || "+91 (522) 400-AURA";
        const contactEmail = cmsData?.footer?.contactEmail || "support@auraestates.com";
        const socials = typeof cmsData?.footer?.socialsJson === 'string' ? JSON.parse(cmsData.footer.socialsJson) : cmsData?.footer?.socialsJson || {};
        const parsedLinks = typeof cmsData?.footer?.linksJson === 'string' ? JSON.parse(cmsData.footer.linksJson) : cmsData?.footer?.linksJson || {};

        return (
          <footer key="footer" className="bg-slate-950 text-slate-400 pt-20 pb-8 border-t border-slate-900 text-left">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-12">
              <div className="col-span-2 space-y-6">
                <h3 className="text-xl font-black text-white">Aura Estates</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{companyInfo}</p>
                <div className="text-xs space-y-2 text-slate-400">
                  <p className="flex items-center gap-2"><Mail size={12} className="text-slate-500" /> {contactEmail}</p>
                  <p className="flex items-center gap-2"><Phone size={12} className="text-slate-500" /> {contactPhone}</p>
                </div>
              </div>

              {parsedLinks.properties ? (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Properties</h4>
                  <ul className="space-y-2 text-xs">
                    {parsedLinks.properties.map((link: any, idx: number) => (
                      <li key={idx}><Link href={link.url} className="hover:text-white transition-colors">{link.label}</Link></li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Properties</h4>
                  <ul className="space-y-2 text-xs">
                    <li><Link href="/plots" className="hover:text-white transition-colors">Plot & Land listings</Link></li>
                    <li><Link href="/residencies" className="hover:text-white transition-colors">Villas & Residencies</Link></li>
                    <li><Link href="/apartments" className="hover:text-white transition-colors">Apartments discovery</Link></li>
                    <li><span className="text-slate-600">Commercial Zoned</span></li>
                  </ul>
                </div>
              )}

              {parsedLinks.intelligence ? (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Decision Intelligence</h4>
                  <ul className="space-y-2 text-xs">
                    {parsedLinks.intelligence.map((link: any, idx: number) => (
                      <li key={idx}><Link href={link.url} className="hover:text-white transition-colors">{link.label}</Link></li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Decision Intelligence</h4>
                  <ul className="space-y-2 text-xs">
                    <li><Link href="/investment-intelligence" className="hover:text-white transition-colors">Market Reports</Link></li>
                    <li><Link href="/investment-intelligence" className="hover:text-white transition-colors">Area Analysis</Link></li>
                    <li><Link href="/investment-intelligence" className="hover:text-white transition-colors">Price Trends</Link></li>
                    <li><Link href="/about" className="hover:text-white transition-colors">Documentation checklist</Link></li>
                  </ul>
                </div>
              )}

              {parsedLinks.tools ? (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Tools & Calculators</h4>
                  <ul className="space-y-2 text-xs">
                    {parsedLinks.tools.map((link: any, idx: number) => (
                      <li key={idx}><Link href={link.url} className="hover:text-white transition-colors">{link.label}</Link></li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Tools & Calculators</h4>
                  <ul className="space-y-2 text-xs">
                    <li><Link href="/tools?tab=emi" className="hover:text-white transition-colors">EMI Calculator</Link></li>
                    <li><Link href="/tools?tab=yield" className="hover:text-white transition-colors">Rental Yield Estimator</Link></li>
                    <li><Link href="/tools?tab=compare" className="hover:text-white transition-colors">Property Comparison</Link></li>
                    <li><Link href="/tools?tab=affordability" className="hover:text-white transition-colors">Affordability Check</Link></li>
                  </ul>
                </div>
              )}
            </div>

            {/* popular sub-links */}
            <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-900 text-xs space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="block font-bold text-slate-300 mb-2 uppercase tracking-wider text-[10px]">Popular Localities</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link href="/areas/gomti-nagar" className="hover:text-white transition-colors">Gomti Nagar</Link>
                    <span>•</span>
                    <Link href="/areas/indira-nagar" className="hover:text-white transition-colors">Indira Nagar</Link>
                    <span>•</span>
                    <Link href="/areas/hazratganj" className="hover:text-white transition-colors">Hazratganj</Link>
                    <span>•</span>
                    <Link href="/areas/aliganj" className="hover:text-white transition-colors">Aliganj</Link>
                  </div>
                </div>
                <div>
                  <span className="block font-bold text-slate-300 mb-2 uppercase tracking-wider text-[10px]">Property Guides</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link href="/about?guide=buying" className="hover:text-white transition-colors">Home Buying Guide</Link>
                    <span>•</span>
                    <Link href="/about?guide=investment" className="hover:text-white transition-colors">Investment Guide</Link>
                    <span>•</span>
                    <Link href="/about?guide=first-time" className="hover:text-white transition-colors">First-Time Buyer Guide</Link>
                  </div>
                </div>
                <div>
                  <span className="block font-bold text-slate-300 mb-2 uppercase tracking-wider text-[10px]">Support desk</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link href="/contact?faq=true" className="hover:text-white transition-colors">FAQ & Help Center</Link>
                    <span>•</span>
                    <Link href="/contact" className="hover:text-white transition-colors">Open Support Ticket</Link>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-500">
                <p>© 2026 Aura Estates. All rights reserved. Registered real estate decision support partner.</p>
                <p>Premium Prop-Tech V2 Layout • Fast & Data Verified</p>
              </div>
            </div>
          </footer>
        );

      default:
        return null;
    }
  };

  // Sections configured layout sequence
  const homepageSections = cmsData?.sections && cmsData.sections.length > 0
    ? cmsData.sections.filter((s: any) => s.visible === true)
    : [
        { id: 'hero' },
        { id: 'trust-bar' },
        { id: 'categories' },
        { id: 'how-we-help' },
        { id: 'investment' },
        { id: 'tools' },
        { id: 'featured' },
        { id: 'localities' },
        { id: 'testimonials' },
        { id: 'research' },
        { id: 'footer' }
      ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-trust-blue/10 selection:text-trust-blue text-center">
      <Navbar />

      {/* Dynamic Announcement Banner */}
      {cmsData?.banner?.visible && (
        <div className="bg-trust-blue text-white text-xs py-2 px-4 text-center font-bold tracking-wider relative z-50 mt-16">
          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] mr-2 uppercase">{cmsData.banner.title}</span>
          {cmsData.banner.description}
          {cmsData.banner.ctaText && (
            <Link href={cmsData.banner.ctaUrl} className="underline ml-2 hover:text-slate-200">
              {cmsData.banner.ctaText} →
            </Link>
          )}
        </div>
      )}

      {/* Render layout segments */}
      {homepageSections.map((sect: any) => renderCmsSection(sect.id))}
    </div>
  );
}
