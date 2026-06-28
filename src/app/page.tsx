'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import 'leaflet/dist/leaflet.css';
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
  CheckCircle,
  Eye,
  Sparkles,
  Database,
  FileText,
  TrendingDown
} from 'lucide-react';
import { formatIndianRealEstatePrice } from '@/lib/currency';
import { handleImageError } from '@/lib/images';

// Lightweight frame loop counter hook for real-time calculation animations
function useAnimatedCounter(targetValue: number, duration: number = 400) {
  const [count, setCount] = useState(targetValue);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = count;

    if (startValue === targetValue) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const easeProgress = progress * (2 - progress);
      const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);

      setCount(currentValue);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return count;
}

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

  // Interactive Mini Tools state
  const [miniEmiPrincipal, setMiniEmiPrincipal] = useState(5000000);
  const [miniEmiRate, setMiniEmiRate] = useState(8.5);
  const [miniEmiTenure, setMiniEmiTenure] = useState(20);
  const [miniYieldPrice, setMiniYieldPrice] = useState(6000000);
  const [miniYieldRent, setMiniYieldRent] = useState(22000);

  // Testimonials Tab state
  const [activeTestimonialTab, setActiveTestimonialTab] = useState<'family' | 'investor' | 'firsttime'>('family');

  // Signature Feature: Radar locality state
  const [radarLocality, setRadarLocality] = useState<'gomti-nagar' | 'shaheed-path' | 'indira-nagar' | 'hazratganj'>('gomti-nagar');
  const [hoveredRadarPillar, setHoveredRadarPillar] = useState<string | null>(null);

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

  useEffect(() => {
    if (cmsData?.seo) {
      document.title = cmsData.seo.metaTitle || 'Aura Estates';

      const setMetaTag = (attrName: string, attrVal: string, content: string) => {
        let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attrName, attrVal);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };

      const setLinkTag = (rel: string, href: string) => {
        let el = document.querySelector(`link[rel="${rel}"]`);
        if (!el) {
          el = document.createElement('link');
          el.setAttribute('rel', rel);
          document.head.appendChild(el);
        }
        el.setAttribute('href', href);
      };

      setMetaTag('name', 'description', cmsData.seo.metaDescription || '');
      setMetaTag('name', 'keywords', cmsData.seo.keywords || '');
      setMetaTag('property', 'og:title', cmsData.seo.metaTitle || '');
      setMetaTag('property', 'og:description', cmsData.seo.metaDescription || '');

      if (cmsData.seo.ogImage) {
        setMetaTag('property', 'og:image', cmsData.seo.ogImage);
      }
      if (cmsData.seo.canonicalUrl) {
        setLinkTag('canonical', cmsData.seo.canonicalUrl);
      }
    }
  }, [cmsData]);

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Crore`;
    }
    return `₹${(price / 100000).toFixed(1)} Lakh`;
  };

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

  const animatedEmiResult = useAnimatedCounter(calculateMiniEMI());

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

  const fallbackApartments: Property[] = [
    {
      id: 'mock-apt-1',
      name: 'Faizabad Road Luxury 3 BHK flat',
      location: 'Faizabad Road, Lucknow',
      price: 7200000,
      bedrooms: 3,
      area: 1650,
      areaUnit: 'Sq Ft',
      type: 'Apartment',
      availability: 'AVAILABLE',
      featured: true,
      images: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80'
    }
  ];

  const getFeaturedCollection = () => {
    if (properties.length === 0) return [...fallbackPlots, ...fallbackResidencies, ...fallbackApartments];

    if (cmsData?.featuredConfig?.mode === 'MANUAL' && Array.isArray(cmsData.featuredConfig.manualIds) && cmsData.featuredConfig.manualIds.length > 0) {
      const manual = properties.filter(p => cmsData.featuredConfig.manualIds.includes(p.id));
      if (manual.length > 0) return manual;
    }

    const featured = properties.filter(p => p.featured);
    return featured.length > 0 ? featured : properties;
  };

  const featuredCollection = getFeaturedCollection();
  const spotlightProperty = featuredCollection[0] || fallbackResidencies[0];
  const carouselProperties = featuredCollection.slice(1).length > 0 ? featuredCollection.slice(1) : fallbackPlots;

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
      { id: '4', title: 'Registry Checked', value: '100', suffix: '%' }
    ];
  };

  const getLocalitiesScorecards = () => {
    if (cmsData?.localities && cmsData.localities.length > 0) {
      return cmsData.localities;
    }
    return [
      { id: '1', areaName: 'Gomti Nagar', investmentRating: 'A+', growthScore: 92, connectivityScore: 95, demandScore: 92, yieldPct: 4.8 },
      { id: '2', areaName: 'Indira Nagar', investmentRating: 'A', growthScore: 84, connectivityScore: 90, demandScore: 84, yieldPct: 3.8 },
      { id: '3', areaName: 'Shaheed Path', investmentRating: 'A+', growthScore: 96, connectivityScore: 88, demandScore: 96, yieldPct: 4.5 },
      { id: '4', areaName: 'Hazratganj', investmentRating: 'A+', growthScore: 88, connectivityScore: 96, demandScore: 91, yieldPct: 5.2 }
    ];
  };

  const getTestimonialList = () => {
    if (cmsData?.testimonials && cmsData.testimonials.length > 0) {
      return cmsData.testimonials;
    }
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

  const RADAR_BENCHMARKS = {
    'gomti-nagar': { growth: 92, demand: 88, connectivity: 85, yield: 90, infra: 94, verification: 98, cagr: '12.2%', rating: 'A+' },
    'shaheed-path': { growth: 96, demand: 96, connectivity: 88, yield: 85, infra: 90, verification: 95, cagr: '14.5%', rating: 'A+' },
    'indira-nagar': { growth: 84, demand: 84, connectivity: 92, yield: 78, infra: 88, verification: 97, cagr: '8.2%', rating: 'A' },
    'hazratganj': { growth: 88, demand: 91, connectivity: 95, yield: 95, infra: 92, verification: 96, cagr: '7.8%', rating: 'A+' }
  };

  const getRadarPath = (data: typeof RADAR_BENCHMARKS['gomti-nagar']) => {
    const center = 100;
    const rScale = 0.8;
    const points = [
      { angle: 0, val: data.growth },
      { angle: 60, val: data.demand },
      { angle: 120, val: data.connectivity },
      { angle: 180, val: data.yield },
      { angle: 240, val: data.infra },
      { angle: 300, val: data.verification }
    ];

    return points.map(pt => {
      const rad = (pt.angle * Math.PI) / 180;
      const dist = (pt.val / 100) * 80 * rScale;
      const x = center + dist * Math.sin(rad);
      const y = center - dist * Math.cos(rad);
      return `${x},${y}`;
    }).join(' ');
  };

  const currentRadarData = RADAR_BENCHMARKS[radarLocality];

  const chartTrends = {
    gomti: [4200, 4900, 5600, 7100, 8900],
    indira: [5100, 5400, 5900, 6400, 7000],
    shaheed: [3100, 4200, 5800, 7900, 10200]
  };

  const parseCoordinatesPath = (dataPoints: number[]) => {
    const width = 400;
    const height = 150;
    const maxVal = 11000;
    const minVal = 2000;

    return dataPoints.map((val, index) => {
      const x = (index / (dataPoints.length - 1)) * width;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 20) - 10;
      return { x, y };
    });
  };

  const generateSvgCurve = (dataPoints: number[]) => {
    const coords = parseCoordinatesPath(dataPoints);
    if (coords.length === 0) return '';
    return coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = coords[idx - 1];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }, '');
  };

  const renderCmsSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        if (cmsData?.hero && !cmsData.hero.visible) return null;

        return (
          <section key="hero" className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-16" style={{ background: 'radial-gradient(circle at top, rgba(37, 99, 235, 0.12), transparent 45%), #F8FAFC' }}>

            {/* ══ Z-1: Lucknow SVG map — true full-bleed background ══ */}
            <div
              className="absolute inset-0 pointer-events-none select-none overflow-hidden"
              style={{ zIndex: 1 }}
            >
              <img
                src="/maps/lucknow-map.svg"
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '100%',
                  height: '100%',
                  minWidth: '100%',
                  minHeight: '100%',
                  objectFit: 'cover',
                  transform: 'translate(-50%, -50%) scale(1.35)',
                  transformOrigin: 'center center',
                  opacity: 0.42,
                  filter: 'saturate(0.55) contrast(1.15) brightness(1.02) drop-shadow(0 0 32px rgba(37,99,235,0.1))',
                  display: 'block',
                }}
              />
            </div>

            {/* ══ Z-2: Light colour wash — tints map to match hero bg, keeps it elegant ══ */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 2, background: 'rgba(248,250,252,0.28)' }}
            />

            {/* ══ Z-3: Soft edge vignette — gentle fade at perimeter only ══ */}
            {/* Top fade (into navbar) */}
            <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ zIndex: 3, height: '90px', background: 'linear-gradient(to bottom, rgba(248,250,252,0.95) 0%, transparent 100%)' }} />
            {/* Bottom fade (into next section) */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 3, height: '80px', background: 'linear-gradient(to top, rgba(248,250,252,0.90) 0%, transparent 100%)' }} />
            {/* Left fade */}
            <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ zIndex: 3, width: '80px', background: 'linear-gradient(to right, rgba(248,250,252,0.75) 0%, transparent 100%)' }} />
            {/* Right fade */}
            <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ zIndex: 3, width: '80px', background: 'linear-gradient(to left, rgba(248,250,252,0.75) 0%, transparent 100%)' }} />

            {/* ══ Z-10: Locality markers — pushed to outer ring, away from centre text ══ */}

            {/* TOP-LEFT: Indira Nagar — Blue / Verified locality */}
            <div className="absolute hidden sm:flex flex-col items-center gap-1" style={{ zIndex: 10, top: '14%', left: '14%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="absolute rounded-full bg-blue-400/20 animate-ping" style={{ width: 28, height: 28, top: -8, left: -8, animationDuration: '2.6s' }} />
                <span className="relative w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-lg" style={{ boxShadow: '0 0 10px 2px rgba(37,99,235,0.35)' }} />
                <span className="text-[9px] font-bold text-blue-800 bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap tracking-wide mt-0.5">
                  Indira Nagar
                </span>
              </div>
            </div>

            {/* TOP-RIGHT: Gomti Nagar — Blue / Verified locality */}
            <div className="absolute flex flex-col items-center gap-1" style={{ zIndex: 10, top: '12%', right: '14%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="absolute rounded-full bg-blue-400/20 animate-ping" style={{ width: 32, height: 32, top: -10, left: -10, animationDuration: '2.2s' }} />
                <span className="relative w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-lg" style={{ boxShadow: '0 0 12px 3px rgba(37,99,235,0.40)' }} />
                <span className="text-[9px] font-bold text-blue-800 bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap tracking-wide mt-0.5">
                  Gomti Nagar
                </span>
              </div>
            </div>

            {/* RIGHT: Vibhuti Khand — Blue / Verified locality */}
            <div className="absolute hidden lg:flex flex-col items-center gap-1" style={{ zIndex: 10, top: '38%', right: '7%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="relative w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-md" style={{ boxShadow: '0 0 8px 2px rgba(37,99,235,0.28)' }} />
                <span className="text-[8px] font-semibold text-blue-700 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap mt-0.5">
                  Vibhuti Khand
                </span>
              </div>
            </div>

            {/* FAR RIGHT: Chinhat — Orange / Commercial hub */}
            <div className="absolute hidden lg:flex flex-col items-center gap-1" style={{ zIndex: 10, top: '26%', right: '5%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="absolute rounded-full bg-orange-400/20 animate-ping" style={{ width: 26, height: 26, top: -7, left: -7, animationDuration: '3.0s' }} />
                <span className="relative w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white shadow-md" style={{ boxShadow: '0 0 8px 2px rgba(234,88,12,0.30)' }} />
                <span className="text-[8px] font-semibold text-orange-700 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap mt-0.5">
                  Chinhat
                </span>
              </div>
            </div>

            {/* BOTTOM-LEFT: Shaheed Path — Green / High growth */}
            <div className="absolute hidden sm:flex flex-col items-center gap-1" style={{ zIndex: 10, bottom: '16%', left: '16%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="absolute rounded-full bg-emerald-400/20 animate-ping" style={{ width: 30, height: 30, top: -9, left: -9, animationDuration: '2.9s' }} />
                <span className="relative w-3 h-3 rounded-full bg-emerald-600 border-2 border-white shadow-lg" style={{ boxShadow: '0 0 10px 2px rgba(5,150,105,0.35)' }} />
                <span className="text-[9px] font-bold text-emerald-800 bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap tracking-wide mt-0.5">
                  Shaheed Path
                </span>
              </div>
            </div>

            {/* BOTTOM-CENTER: Sushant Golf City — Green / High growth */}
            <div className="absolute hidden sm:flex flex-col items-center gap-1" style={{ zIndex: 10, bottom: '12%', left: '52%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-md" style={{ boxShadow: '0 0 8px 2px rgba(5,150,105,0.28)' }} />
                <span className="text-[8px] font-semibold text-emerald-700 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap mt-0.5">
                  Sushant Golf City
                </span>
              </div>
            </div>

            {/* Hazratganj — Purple / Premium — bottom right, away from centre */}
            <div className="absolute hidden sm:flex flex-col items-center gap-1" style={{ zIndex: 10, bottom: '20%', right: '18%' }}>
              <div className="group relative flex flex-col items-center gap-1">
                <span className="absolute rounded-full bg-purple-400/18 animate-ping" style={{ width: 28, height: 28, top: -8, left: -8, animationDuration: '3.2s' }} />
                <span className="relative w-3 h-3 rounded-full bg-purple-600 border-2 border-white shadow-lg" style={{ boxShadow: '0 0 10px 2px rgba(124,58,237,0.32)' }} />
                <span className="text-[9px] font-bold text-purple-800 bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap tracking-wide mt-0.5">
                  Hazratganj
                </span>
              </div>
            </div>

            {/* ══ Z-20: Hero content — centred, clear of all markers ══ */}
            <div className="relative flex flex-col items-center text-center px-6 max-w-3xl mx-auto" style={{ zIndex: 20, paddingTop: '5vh', paddingBottom: '6vh' }}>

              {/* Frosted halo — subtle glow behind the text block so it reads cleanly over the map */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: '-48px -80px',
                  background: 'radial-gradient(ellipse 80% 75% at 50% 50%, rgba(248,250,252,0.72) 0%, transparent 100%)',
                  filter: 'blur(24px)',
                  zIndex: -1,
                }}
              />

              {/* Eyebrow pill */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 mb-10 bg-white/80 backdrop-blur-md border border-slate-200/70 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.20em] text-slate-500 uppercase">
                  YOUR TRUSTED REAL ESTATE PARTNER
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-[36px] sm:text-[52px] lg:text-[60px] font-black tracking-tight leading-[1.08] text-slate-900 mb-7">
                Discover Properties That Feel Like Home
                <br />
                <span className="text-blue-600">Across Lucknow</span>
              </h1>

              {/* Subtitle */}
              <p className="text-[15px] sm:text-base text-slate-650 max-w-xl leading-relaxed font-medium mb-12">
                Whether you are buying your first home, searching for the perfect family space, or exploring investment opportunities, Aura Estates helps you discover verified properties with trusted guidance.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Link
                  href="/properties"
                  className="px-9 py-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200 inline-block text-center"
                >
                  Explore Properties
                </Link>
                <Link
                  href="/investment-intelligence"
                  className="px-9 py-4 text-slate-700 text-[13px] font-bold uppercase tracking-widest rounded-xl transition-all duration-200 border border-slate-200 bg-white hover:bg-slate-50 shadow-sm inline-block text-center"
                >
                  Explore Market Insights
                </Link>
              </div>

            </div>
          </section>
        );

    case 'trust-bar':
        return (
          <section key="trust-bar" className="bg-white border-y border-slate-200/50 py-12">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-slate-200/70">
              {getTrustMetrics().map((m: any) => (
                <div key={m.id} className="first:pl-0 pl-6">
                  <div className="text-3xl font-black text-blue-600 tracking-tight">{m.value}{m.suffix}</div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black mt-1.5">{m.title}</div>
                </div>
              ))}
            </div>
          </section>
        );

      case 'categories':
        return (
          <section key="categories" className="py-28 border-b border-slate-200/60 bg-[#F1F5F9]">
            <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
              <div className="space-y-2">
                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">Structural asset classes</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Intelligence Catalog Categories</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Link href="/plots" className="group relative h-96 rounded-[24px] overflow-hidden shadow-premium hover:shadow-premium-hover transition-all block">
                  <Image src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80" alt="Plots" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] bg-emerald-500 px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">Appreciation Focus</span>
                      <span className="text-[10px] text-emerald-400 font-bold">12-14% CAGR</span>
                    </div>
                    <h3 className="text-xl font-bold">Residential & Land Plots</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">Zoned agricultural plots, commercial tracts, and residential land layouts.</p>
                  </div>
                </Link>

                <Link href="/residencies" className="group relative h-96 rounded-[24px] overflow-hidden shadow-premium hover:shadow-premium-hover transition-all block">
                  <Image src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80" alt="Residencies" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] bg-trust-blue px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">Residencies</span>
                      <span className="text-[10px] text-blue-400 font-bold">Stable Returns</span>
                    </div>
                    <h3 className="text-xl font-bold">Luxury Villas & Independent Homes</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">Independent row houses, gated estate duplex layouts, and luxury villas.</p>
                  </div>
                </Link>

                <Link href="/apartments" className="group relative h-96 rounded-[24px] overflow-hidden shadow-premium hover:shadow-premium-hover transition-all block">
                  <Image src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80" alt="Apartments" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] bg-sky-500 px-2.5 py-0.5 font-bold uppercase tracking-wider rounded-full">Lease Yield</span>
<span className="text-[10px] text-sky-400 font-bold">4.5% Yield</span>
                    </div>
                    <h3 className="text-xl font-bold">Modern Flats & Apartments</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">High-rise housing societies, 2/3 BHK flats, and premium condominiums.</p>
                  </div>
                </Link>
              </div>
            </div>
          </section>
        );

      case 'how-we-help':
        return (
          <section key="how-we-help" className="py-28 border-b border-slate-200/60 bg-[#F1F5F9]">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5 text-left space-y-6">
                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">Signature Experience</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  The Aura Intelligence Radar
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Hover or select a neighborhood benchmark to examine visual metrics. Our database dynamically indexes connectivity, appreciation growth index, land boundary checks, and registry auditing records.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    { id: 'gomti-nagar', label: 'Gomti Nagar' },
                    { id: 'shaheed-path', label: 'Shaheed Path' },
                    { id: 'indira-nagar', label: 'Indira Nagar' },
                    { id: 'hazratganj', label: 'Hazratganj' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setRadarLocality(btn.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wider ${radarLocality === btn.id
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/15'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                        }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[9px]">Growth Index</span>
                    <span className="text-sm font-extrabold text-slate-900">{currentRadarData.growth}/100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[9px]">Historical CAGR</span>
                    <span className="text-sm font-extrabold text-green-600">{currentRadarData.cagr}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[9px]">Lease Yield</span>
                    <span className="text-sm font-extrabold text-blue-600">{currentRadarData.yield === 90 ? '4.8%' : currentRadarData.yield === 95 ? '5.2%' : currentRadarData.yield === 85 ? '4.5%' : '3.8%'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[9px]">Risk Assessment</span>
                    <span className="text-sm font-extrabold text-violet-600">{currentRadarData.rating} Stable</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 flex justify-center relative">
                <div className="w-80 h-80 sm:w-96 sm:h-96 bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200/70 p-6 shadow-sm flex items-center justify-center relative overflow-hidden radar-sweep-active">
                  <svg className="w-full h-full relative z-10" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="60" fill="none" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />

                    {[0, 60, 120, 180, 240, 300].map(angle => {
                      const rad = (angle * Math.PI) / 180;
                      const x2 = 100 + 80 * Math.sin(rad);
                      const y2 = 100 - 80 * Math.cos(rad);
                      return <line key={angle} x1="100" y1="100" x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="0.5" />;
                    })}

                    <polygon
                      points={getRadarPath(currentRadarData)}
                      fill="rgba(37, 99, 235, 0.15)"
                      stroke="var(--color-trust-blue)"
                      strokeWidth="1.5"
                      className="transition-all duration-500 ease-in-out"
                    />

                    {getRadarPath(currentRadarData).split(' ').map((coord, idx) => {
                      const [x, y] = coord.split(',').map(Number);
                      const labels = ['Growth', 'Demand', 'Connectivity', 'Yield', 'Infrastructure', 'Verification'];
                      return (
                        <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredRadarPillar(labels[idx])} onMouseLeave={() => setHoveredRadarPillar(null)}>
                          <circle cx={x} cy={y} r="3.5" fill="var(--color-trust-blue)" stroke="#ffffff" strokeWidth="1" />
                          {hoveredRadarPillar === labels[idx] && (
                            <text x={x} y={y - 8} textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
                              {labels[idx]} ({Object.values(currentRadarData)[idx]})
                            </text>
                          )}
                        </g>
                      );
                    })}

                    <text x="100" y="12" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#64748b">GROWTH</text>
                    <text x="180" y="55" textAnchor="start" fontSize="6.5" fontWeight="bold" fill="#64748b">DEMAND</text>
                    <text x="180" y="152" textAnchor="start" fontSize="6.5" fontWeight="bold" fill="#64748b">TRANSIT</text>
                    <text x="100" y="192" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#64748b">YIELD</text>
                    <text x="20" y="152" textAnchor="end" fontSize="6.5" fontWeight="bold" fill="#64748b">INFRA</text>
                    <text x="20" y="55" textAnchor="end" fontSize="6.5" fontWeight="bold" fill="#64748b">VERIFIED</text>
                  </svg>
                </div>
              </div>
            </div>
          </section>
        );

      case 'why-trust':
        return (
          <section key="why-trust" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC]">
            <div className="max-w-6xl mx-auto px-6 text-center space-y-12">
              <div className="space-y-2">
                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">Veracity Framework</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Decide with Empirical Certainty</h2>
                <p className="text-sm text-slate-600 max-w-xl mx-auto font-medium leading-relaxed">
                  We verify coordinates and registry deeds before cataloging.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: 'Verified Properties',
                    desc: 'Every property goes through careful verification so you can make decisions with confidence.',
                    icon: <ShieldCheck size={22} className="text-blue-600" />
                  },
                  {
                    title: 'Transparent Process',
                    desc: 'Clear information, honest communication, and a simple buying journey.',
                    icon: <MapPin size={22} className="text-blue-600" />
                  },
                  {
                    title: 'Trusted Guidance',
                    desc: 'Support from discovery to decision, helping you choose the right property.',
                    icon: <Users size={22} className="text-blue-600" />
                  },
                  {
                    title: 'Local Expertise',
                    desc: 'Deep understanding of Lucknow\'s neighborhoods, opportunities, and growth areas.',
                    icon: <TrendingUp size={22} className="text-blue-600" />
                  }
                ].map((pillar, idx) => (
                  <div key={idx} className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-6 rounded-[24px] text-left hover:-translate-y-1 transition-all shadow-sm hover:shadow-md flex flex-col justify-between h-64">
                    <div className="space-y-4">
                      <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200/70 shadow-2xs">{pillar.icon}</div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{pillar.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">{pillar.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'investment':
        return (
          <section key="investment" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC] text-slate-900">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="flex justify-between items-end border-b border-slate-200/60 pb-4">
                <div>
                  <span className="text-emerald-600 text-xs font-bold uppercase tracking-widest">Bloomberg Meets Zillow</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Market Appreciation Dashboard</h2>
                </div>
                <Link href="/investment-intelligence" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  <span>Open Market Intelligence</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 bg-white/80 backdrop-blur-xl p-6 rounded-[24px] border border-slate-200/70 shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center flex-wrap gap-2 text-xs font-bold">
                    <div className="text-slate-600">Corridor Price Indexes (5 Yr Registry History)</div>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Gomti Nagar (+28%)
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-2 h-2 bg-slate-500 rounded-full"></span> Indira Nagar (+17%)
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="w-2 h-2 bg-emerald-600 rounded-full"></span> Shaheed Path (+35%)
                      </span>
                    </div>
                  </div>

                  <div className="h-64 bg-slate-50/50 rounded-xl border border-slate-200/70 p-4 relative">
                    <svg className="w-full h-full text-blue-500" viewBox="0 0 400 150" preserveAspectRatio="none">
                      <line x1="0" y1="30" x2="400" y2="30" stroke="rgba(15, 23, 42, 0.05)" strokeDasharray="3" />
                      <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(15, 23, 42, 0.05)" strokeDasharray="3" />
                      <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(15, 23, 42, 0.05)" strokeDasharray="3" />

                      <path d={generateSvgCurve(chartTrends.gomti)} fill="none" stroke="var(--color-trust-blue)" strokeWidth="2.5" />
                      <path d={generateSvgCurve(chartTrends.indira)} fill="none" stroke="#64748b" strokeWidth="2" />
                      <path d={generateSvgCurve(chartTrends.shaheed)} fill="none" stroke="var(--color-soft-green)" strokeWidth="2.5" />

                      {(() => {
                        const gCoords = parseCoordinatesPath(chartTrends.gomti);
                        const iCoords = parseCoordinatesPath(chartTrends.indira);
                        const sCoords = parseCoordinatesPath(chartTrends.shaheed);
                        return (
                          <>
                            <circle cx={gCoords[gCoords.length - 1].x} cy={gCoords[gCoords.length - 1].y} r="3.5" fill="var(--color-trust-blue)" />
                            <circle cx={iCoords[iCoords.length - 1].x} cy={iCoords[iCoords.length - 1].y} r="3" fill="#64748b" />
                            <circle cx={sCoords[sCoords.length - 1].x} cy={sCoords[sCoords.length - 1].y} r="3.5" fill="var(--color-soft-green)" />
                          </>
                        );
                      })()}
                    </svg>
                    <div className="absolute top-4 left-4 p-2 bg-white border border-slate-200/70 text-slate-700 rounded text-[8px] font-mono leading-relaxed space-y-0.5 shadow-xs">
                      <div>REGISTRY STATS ACTIVE</div>
                      <div>TRACKED COMMITTED TRACTS: {properties.length}</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4 text-left">
                  <div className="p-4 bg-white/80 border border-slate-200/70 rounded-xl flex gap-3 shadow-xs hover:border-slate-350 transition-all">
                    <div className="w-9 h-9 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/50"><Star size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Demand Catalyst Locality</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Vibhuti Khand holds average growth multiplier scores of 9.2.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/80 border border-slate-200/70 rounded-xl flex gap-3 shadow-xs hover:border-slate-350 transition-all">
                    <div className="w-9 h-9 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/50"><TrendingUp size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Transit Corridor Surge</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Shaheed Path corridor has appreciated +35% in total transaction index rates.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/80 border border-slate-200/70 rounded-xl flex gap-3 shadow-xs hover:border-slate-350 transition-all">
                    <div className="w-9 h-9 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/50"><Percent size={16} /></div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Yield Core Zones</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Central commercial corridors in Indira Nagar return 3.8% annual net yields.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'tools':
        return (
          <section key="tools" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-center">
                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">SaaS decision tools</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Interactive Financial Simulators</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="border border-slate-200/70 p-6 rounded-[24px] bg-white/80 backdrop-blur-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calculator size={18} /></div>
                      <h3 className="font-extrabold text-slate-900 text-sm">EMI Estimator</h3>
                    </div>
                    <p className="text-[11px] text-slate-600">Estimate monthly outgoings. Drag the slider to test loan size variations.</p>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Principal Amount</span>
                        <span>₹{(miniEmiPrincipal / 100000).toFixed(0)} Lakh</span>
                      </div>
                      <input
                        type="range" min="1000000" max="15000000" step="500000"
                        value={miniEmiPrincipal}
                        onChange={(e) => setMiniEmiPrincipal(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-slate-200 accent-blue-600 rounded-lg cursor-pointer"
                      />
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-center shadow-2xs">
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Estimated Outflow</span>
                        <span className="text-sm font-extrabold text-blue-600">₹{animatedEmiResult.toLocaleString()}/mo</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=emi" className="text-[11px] text-blue-600 font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Configure Advanced Parameters</span><ArrowRight size={12} />
                  </Link>
                </div>

                <div className="border border-slate-200/70 p-6 rounded-[24px] bg-white/80 backdrop-blur-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Percent size={18} /></div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Rental Yield Estimator</h3>
                    </div>
                    <p className="text-[11px] text-slate-600">Determine yield outcomes based on neighborhood monthly lease rates.</p>
                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase">Cost (Lakh)</label>
                          <input
                            type="number"
                            value={miniYieldPrice / 100000}
                            onChange={(e) => setMiniYieldPrice((parseFloat(e.target.value) || 0) * 100000)}
                            className="w-full bg-slate-50 border border-slate-200/70 p-1.5 rounded text-xs text-slate-700 font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase">Rent/mo</label>
                          <input
                            type="number"
                            value={miniYieldRent}
                            onChange={(e) => setMiniYieldRent(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-slate-50 border border-slate-200/70 p-1.5 rounded text-xs text-slate-700 font-bold outline-none"
                          />
                        </div>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-center shadow-2xs">
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Gross Return Yield</span>
                        <span className="text-sm font-extrabold text-green-600">{calculateMiniYield()}% Yield</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=yield" className="text-[11px] text-blue-600 font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Configure Annual Expenses</span><ArrowRight size={12} />
                  </Link>
                </div>

                <div className="border border-slate-200/70 p-6 rounded-[24px] bg-white/80 backdrop-blur-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><Layers size={18} /></div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Comparison Portal</h3>
                    </div>
                    <p className="text-[11px] text-slate-600">Direct comparison index comparing up to 3 selected properties side-by-side.</p>
                    <div className="space-y-2 pt-1 text-[11px] text-slate-650 font-medium">
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200/70 shadow-2xs">
                        <Check size={12} className="text-green-600 shrink-0" />
                        <span className="truncate">Compare Square Yards to Bigha / Gaj</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200/70 shadow-2xs">
                        <Check size={12} className="text-green-600 shrink-0" />
                        <span className="truncate">Assess Locality Scores dynamically</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools?tab=compare" className="text-[11px] text-blue-600 font-bold flex items-center gap-1 hover:underline pt-2">
                    <span>Launch Compare Matrix</span><ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        );

      case 'featured':
        const imageUrl = spotlightProperty.images ? spotlightProperty.images.split(',')[0] : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80';
        return (
          <section key="featured" className="py-28 border-b border-slate-200/60 bg-white">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-left">
                <span className="text-green-600 text-xs font-bold uppercase tracking-widest block">High Conviction Picks</span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Editor's Verification Picks</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200/70 shadow-sm overflow-hidden items-stretch text-left">
                <div className="lg:col-span-7 relative min-h-[300px]">
                  <Image
                    src={imageUrl}
                    alt={spotlightProperty.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 58vw"
                  />
                  <div className="absolute top-4 left-4 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    High Conviction
                  </div>
                </div>

                <div className="lg:col-span-5 p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-500 bg-slate-200/50 px-2 py-1 rounded">
                      {spotlightProperty.type} Report
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{spotlightProperty.name}</h3>
                    <div className="flex items-center text-xs text-slate-650 gap-1">
                      <MapPin size={14} className="text-slate-400" />
                      <span>{spotlightProperty.location}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200/60 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500 font-normal">Indexed Price</span>
                      <span className="font-bold text-blue-600">{formatPrice(spotlightProperty.price)}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500 font-normal">Boundary Checked Size</span>
                      <span>{spotlightProperty.area} {spotlightProperty.areaUnit || 'Sq Ft'}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500 font-normal">Expected Yield</span>
                      <span className="text-green-600 font-bold">4.2% - 4.8% Yield</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500 font-normal">Locality Score</span>
                      <span className="text-blue-600 font-bold">A+ Stable</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Link
                      href={`/properties/${spotlightProperty.id}`}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl text-center shadow-lg shadow-blue-600/15 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Open Investment Prospectus</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-left">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-500">Additional Verified Opportunities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {carouselProperties.map((prop) => (
                    <Link
                      href={`/properties/${prop.id}`}
                      key={prop.id}
                      className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-48 hover:border-slate-300/80"
                    >
                      <div>
                        <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500">
                          <span>{prop.type}</span>
                          <span className="text-green-600 font-extrabold">Verified</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-3 line-clamp-1">{prop.name}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{prop.location}</p>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-xs font-bold mt-4">
                        <span className="text-blue-600">{formatPrice(prop.price)}</span>
                        <span className="text-[10px] bg-slate-200/40 px-2 py-0.5 rounded text-slate-600">{prop.area} Sq Ft</span>
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
          <section key="localities" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-slate-200/60 pb-4 text-left">
                <div>
                  <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">Locality Scoreboards</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Locality Decision Index</h2>
                </div>
                <Link href="/investment-intelligence" className="text-xs font-bold text-blue-600 hover:underline">
                  Compare Lucknow Neighborhoods
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
                {getLocalitiesScorecards().map((loc: any) => (
                  <Link
                    href={`/areas/${loc.areaName.toLowerCase().replace(/ /g, '-')}`}
                    key={loc.id}
                    className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-6 rounded-[24px] shadow-sm hover:shadow-md transition-all space-y-4 block"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-extrabold text-slate-900 text-base">{loc.areaName}</h3>
                      <span className="text-xs font-black text-green-600">{loc.investmentRating} Rating</span>
                    </div>
                    <div className="space-y-2.5 text-xs font-semibold text-slate-500">
                      <div className="flex justify-between">
                        <span className="font-normal">Growth Score</span>
                        <span className="text-slate-800 font-bold">{loc.growthScore} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-normal">Connectivity</span>
                        <span className="text-slate-800 font-bold">{loc.connectivityScore} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-normal">Expected Yield</span>
                        <span className="text-slate-800 font-bold">{loc.yieldPct ? `${loc.yieldPct}%` : '4.2%'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-blue-600 font-bold block pt-2 border-t border-slate-200/60">View Area Audit Report →</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );

      case 'testimonials':
        return (
          <section key="testimonials" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC]">
            <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
              <div className="space-y-2">
                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest block">Real Buyer feedback</span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Verified Buyer Testimonials</h2>
              </div>

              <div className="flex justify-center border-b border-slate-200 pb-2 gap-2">
                {[
                  { id: 'family', label: 'Family Buyers' },
                  { id: 'investor', label: 'Investors' },
                  { id: 'firsttime', label: 'First-Time Buyers' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTestimonialTab(tab.id as any)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-all ${activeTestimonialTab === tab.id ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/15' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-8 rounded-[24px] shadow-sm min-h-[220px] flex flex-col justify-between text-left">
                <AnimatePresence mode="wait">
                  {filteredTestimonials.length > 0 ? (
                    <motion.div
                      key={activeTestimonialTab}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4"
                    >
                      <div className="flex text-amber-500">
                        {[...Array(filteredTestimonials[0].rating || 5)].map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                      </div>
                      <blockquote className="text-sm md:text-base text-slate-700 italic leading-relaxed font-normal">
                        "{filteredTestimonials[0].review}"
                      </blockquote>
                      <cite className="block text-xs font-bold text-slate-800 not-italic border-t border-slate-200/60 pt-3 mt-4">
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
          <section key="research" className="py-28 border-b border-slate-200/60 bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="space-y-2 text-center">
                <span className="text-green-600 text-xs font-bold uppercase tracking-widest block">Prop-Tech Journal</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Independent Research & Guides</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                {cmsData?.articles && cmsData.articles.length > 0 ? (
                  cmsData.articles.slice(0, 4).map((art: any) => (
                    <div key={art.id} className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200/70 rounded">
                          {art.author || 'Research Team'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs line-clamp-2">{art.title}</h4>
                        <p className="text-[11px] text-slate-650 leading-relaxed line-clamp-3 font-normal">
                          {art.content.replace(/[#*`_-]/g, '').slice(0, 120)}...
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold pt-4 border-t border-slate-200/60">
                        <span>{new Date(art.publishedDate).toLocaleDateString()}</span>
                        <Link href="/about" className="text-blue-600 hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200/70 rounded">Buying Checklist</span>
                        <h4 className="font-bold text-slate-900 text-xs">Top 5 Areas for First-Time Home Buyers</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 font-normal">Safety, proximity to transit nodes, and low down-payment support areas analyzed for new buyers.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold pt-4 border-t border-slate-200/60">
                        <span>PDF Available</span>
                        <Link href="/about?guide=first-time" className="text-blue-600 hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200/70 rounded">Yield Report</span>
                        <h4 className="font-bold text-slate-900 text-xs">Best Rental Yield Locations in Lucknow</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 font-normal">Check out areas offering high rental multipliers from corporate hubs and major shopping avenues.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold pt-4 border-t border-slate-200/60">
                        <span>5 Min Read</span>
                        <Link href="/about?guide=buying" className="text-blue-600 hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200/70 rounded">Market Pulse</span>
                        <h4 className="font-bold text-slate-900 text-xs">Emerging Growth Corridors for 2026</h4>
                        <p className="text-[11px] text-slate-650 leading-relaxed line-clamp-3 font-normal">Infrastructure shifts like new roads and highways are bringing massive appreciation opportunities.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold pt-4 border-t border-slate-200/60">
                        <span>Download Report</span>
                        <Link href="/about?guide=buying" className="text-blue-600 hover:underline">Read Guide →</Link>
                      </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/70 p-5 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-64">
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200/70 rounded">Comparison Study</span>
                        <h4 className="font-bold text-slate-900 text-xs">Plot vs Apartment Investment Comparison</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 font-normal">Evaluating liquidity, average maintenance costs, boundary safety factors, and ROI trends.</p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold pt-4 border-t border-slate-200/60">
                        <span>Academic Grade</span>
                        <Link href="/about" className="text-blue-600 hover:underline">Read Guide →</Link>
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
        const parsedLinks = typeof cmsData?.footer?.linksJson === 'string' ? JSON.parse(cmsData.footer.linksJson) : cmsData?.footer?.linksJson || {};

        return (
          <footer key="footer" className="bg-[#0F172A] text-slate-450 border-t border-slate-800 text-left">
            {/* Final CTA block */}
            <div className="bg-[#1E293B] text-white py-20 border-b border-slate-800">
              <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
                <h2 className="text-3xl font-extrabold tracking-tight">Find a place that feels like home.</h2>
                <p className="text-slate-350 max-w-xl mx-auto text-sm leading-relaxed">
                  Whether you are buying your first home, searching for your family space, or exploring investment opportunities, Aura Estates helps you move forward with confidence.
                </p>
                <div className="flex justify-center gap-4 pt-2">
                  <Link href="/properties" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/15">
                    Explore Properties
                  </Link>
                  <Link href="/contact" className="px-6 py-3 bg-transparent border border-slate-600 text-slate-200 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm">
                    Talk To Our Team
                  </Link>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-12">
              <div className="col-span-2 space-y-6">
                <h3 className="text-xl font-bold text-white tracking-tight">Aura Estates</h3>
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
                <p>PropTech Intel Overhaul V3 • Certified Fast & Secured</p>
              </div>
            </div>
          </footer>
        );

      default:
        return null;
    }
  };

  const homepageSections = cmsData?.sections && cmsData.sections.length > 0
    ? cmsData.sections.filter((s: any) => s.visible === true)
    : [
      { id: 'hero' },
      { id: 'trust-bar' },
      { id: 'categories' },
      { id: 'how-we-help' },
      { id: 'why-trust' },
      { id: 'featured' },
      { id: 'localities' },
      { id: 'investment' },
      { id: 'tools' },
      { id: 'testimonials' },
      { id: 'research' },
      { id: 'footer' }
    ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased overflow-x-hidden selection:bg-trust-blue/10 selection:text-trust-blue text-center">
      <Navbar />

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

      {homepageSections.map((sect: any) => renderCmsSection(sect.id))}
    </div>
  );
}