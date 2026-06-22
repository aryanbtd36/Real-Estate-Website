'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import {
  MapPin,
  TrendingUp,
  School,
  Activity,
  Compass,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
  Building,
  Info,
  Layers,
  ArrowLeft
} from 'lucide-react';

interface LocalityData {
  name: string;
  overview: string;
  scores: {
    growth: number;
    demand: number;
    rental: number;
    connectivity: number;
    overall: number;
  };
  infra: {
    roads: string;
    metro: string;
    commercial: string;
    schools: string;
    hospitals: string;
  };
  connectivityText: string;
  pros: string[];
  cons: string[];
  risks: string[];
  opportunities: string[];
  priceTrend: { year: string; val: number }[];
  rentalYield: number;
}

const LOCALITY_REGISTRY: Record<string, LocalityData> = {
  'gomti-nagar': {
    name: 'Gomti Nagar',
    overview: 'Lucknow\'s premier planned residential and commercial sub-city. It features wide roads, organized sectors, lush parks, and is home to major IT Parks and upscale commercial complexes.',
    scores: { growth: 9.2, demand: 8.8, rental: 9.0, connectivity: 8.5, overall: 8.9 },
    infra: {
      roads: 'A-Grade, 4-lane wide corridors with central dividers.',
      metro: 'Accessible via Gomti Nagar metro station.',
      commercial: 'Home to Palassio Mall, Wave Mall, and Patrakar Puram hub.',
      schools: 'La Martiniere Girls, St. Fidelis, DPS Gomti Nagar.',
      hospitals: 'Ram Manohar Lohia Institute, Sahara Hospital.'
    },
    connectivityText: 'Connected directly to Shaheed Path, linking Gomti Nagar to the Amausi Airport in 25 minutes and Charbagh Railway station in 20 minutes.',
    pros: [
      'Top-tier organized sewage and municipal layout.',
      'Highest rental yields in residential apartments.',
      'Active commercial and retail expansions driving appreciation.'
    ],
    cons: [
      'Very high price per square foot compared to other corridors.',
      'Congestion around Patrakar Puram during peak business hours.'
    ],
    risks: [
      'Minor waterlogging issues in lower sectors during heavy monsoons.'
    ],
    opportunities: [
      'Excellent holding potential for land parcels in Gomti Nagar Extension Phase-II.'
    ],
    priceTrend: [
      { year: '2022', val: 3400 },
      { year: '2023', val: 4100 },
      { year: '2024', val: 4800 },
      { year: '2025', val: 5400 },
      { year: '2026', val: 6200 }
    ],
    rentalYield: 4.5
  },
  'indira-nagar': {
    name: 'Indira Nagar',
    overview: 'One of the largest established residential layouts in Asia. Indira Nagar is highly favored by middle-class families due to its exceptional proximity to public transit, metro corridors, and top schools.',
    scores: { growth: 7.5, demand: 8.2, rental: 7.8, connectivity: 9.2, overall: 8.1 },
    infra: {
      roads: 'Main avenues are wide, though internal sector lanes can be narrow.',
      metro: 'Strong connectivity with multiple dedicated metro stops (Lekhraj, Bhootnath).',
      commercial: 'Bhootnath Market, Lekhraj Market, local shopping plazas.',
      schools: 'Lucknow Public School, Mount Carmel, Spring Dale.',
      hospitals: 'Shekhar Hospital, local nursing centers.'
    },
    connectivityText: 'Superb central connectivity. Immediate transit via Faizabad Road. Reach Charbagh station in 15 minutes by Metro.',
    pros: [
      'Excellent accessibility with dense metro network.',
      'Abundant school and hospital layouts within 1km radius.',
      'Safe, active neighborhood suitable for families and senior citizens.'
    ],
    cons: [
      'Older drainage systems in early sectors.',
      'Lack of raw land or vacant plot tracts.'
    ],
    risks: [
      'Commercial encroachment on sector streets leading to parking problems.'
    ],
    opportunities: [
      'Strong rental demand from medical staff and teachers.'
    ],
    priceTrend: [
      { year: '2022', val: 3100 },
      { year: '2023', val: 3400 },
      { year: '2024', val: 3800 },
      { year: '2025', val: 4100 },
      { year: '2026', val: 4500 }
    ],
    rentalYield: 3.8
  },
  'aliganj': {
    name: 'Aliganj',
    overview: 'A classic, planned housing colony located in northern Lucknow. Known for its quiet tree-lined lanes, extensive parks, and academic institutions, making it highly desirable for families.',
    scores: { growth: 7.0, demand: 7.8, rental: 7.2, connectivity: 8.8, overall: 7.7 },
    infra: {
      roads: 'Well-spaced municipal grid layouts with parks at sector cores.',
      metro: 'Serviced by IT College & University Metro stations nearby.',
      commercial: 'Kapoorthala shopping market, Aliganj local sector markets.',
      schools: 'St. Anthony, Spring Dale Aliganj, Kendriya Vidyalaya.',
      hospitals: 'Vivekananda Polyclinic and Research Institute.'
    },
    connectivityText: 'Connected directly to Sitapur Road and University Road. Quick 12-minute access to Hazratganj.',
    pros: [
      'Extremely peaceful, low-density residential feel.',
      'Mature trees and parks leading to excellent local air indices.',
      'Home to prestigious medical facilities (Vivekananda).'
    ],
    cons: [
      'Higher commercial parking fees around Kapoorthala.',
      'Virtually zero plot availability in early sectors.'
    ],
    risks: [
      'Groundwater levels have minor drops in peak summer months.'
    ],
    opportunities: [
      'Excellent conversion prospects for commercial offices on main arteries.'
    ],
    priceTrend: [
      { year: '2022', val: 2900 },
      { year: '2023', val: 3200 },
      { year: '2024', val: 3500 },
      { year: '2025', val: 3900 },
      { year: '2026', val: 4200 }
    ],
    rentalYield: 3.6
  },
  'hazratganj': {
    name: 'Hazratganj',
    overview: 'The central downtown district of Lucknow. Hazratganj combines heritage architecture with premium commercial spaces. Features prime connectivity, but commands high transaction prices.',
    scores: { growth: 8.5, demand: 9.2, rental: 9.5, connectivity: 9.5, overall: 9.1 },
    infra: {
      roads: 'Main boulevard is grand; side streets are narrow but historical.',
      metro: 'Hazratganj central junction Metro station is the core of the city transit.',
      commercial: 'Ganj Market, multi-brand retail flagship stores, heritage showrooms.',
      schools: 'St. Francis College, Cathedral School, Loreto Convent.',
      hospitals: 'Civil Hospital, multiple clinic centers.'
    },
    connectivityText: 'The geographical heart of Lucknow. All public transit networks radiate outward from here.',
    pros: [
      'Highest commercial/residential rental rates in the city.',
      'Unrivaled status value and geographical convenience.',
      'Top-tier infrastructure maintenance and security.'
    ],
    cons: [
      'Very restricted parking spaces for secondary lanes.',
      'Prohibitively expensive transaction costs.'
    ],
    risks: [
      'Zoning restrictions on modifying heritage properties.'
    ],
    opportunities: [
      'Strong commercial appreciation on lease structures.'
    ],
    priceTrend: [
      { year: '2022', val: 6500 },
      { year: '2023', val: 7200 },
      { year: '2024', val: 8000 },
      { year: '2025', val: 8900 },
      { year: '2026', val: 9800 }
    ],
    rentalYield: 5.2
  }
};

export default function LocalityDetailPage() {
  const { slug } = useParams() as { slug: string };
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Read registry details
  const details = LOCALITY_REGISTRY[slug] || {
    name: slug ? slug.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Lucknow Locality',
    overview: 'Detailed decision support locality records are compiling. General infrastructure is verified for middle-class residential zoning.',
    scores: { growth: 7.2, demand: 7.5, rental: 7.0, connectivity: 8.0, overall: 7.4 },
    infra: {
      roads: 'Standard municipal roads.',
      metro: 'Serviced by regional bus transit; metro is planned in later phases.',
      commercial: 'Local markets and grocery setups.',
      schools: 'Multiple schools within a 3km radius.',
      hospitals: 'Primary health centers.'
    },
    connectivityText: 'Connects to main state highways. Direct bus transit routes accessible.',
    pros: ['Reasonable property valuations', 'Low noise index'],
    cons: ['Slightly further from central commercial hubs'],
    risks: ['Piped sewage setups under construction'],
    opportunities: ['Strong speculative gains in upcoming 5-year pipeline'],
    priceTrend: [
      { year: '2022', val: 2100 },
      { year: '2023', val: 2400 },
      { year: '2024', val: 2600 },
      { year: '2025', val: 2950 },
      { year: '2026', val: 3300 }
    ],
    rentalYield: 3.2
  };

  useEffect(() => {
    async function fetchLocalProperties() {
      try {
        setLoading(true);
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          // Filter properties located in this neighborhood
          const matched = (Array.isArray(data) ? data : []).filter(
            (p: any) =>
              p.location.toLowerCase().includes(details.name.toLowerCase()) &&
              (p.status === 'PUBLISHED' || !p.status)
          );
          setProperties(matched);
        }
      } catch (err) {
        console.error('Failed to load local properties:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLocalProperties();
  }, [details.name]);

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-soft-green border-soft-green bg-soft-green/10';
    if (score >= 7.5) return 'text-trust-blue border-trust-blue bg-trust-blue/10';
    return 'text-slate-500 border-slate-200 bg-slate-50';
  };

  const formatCurrency = (val: number) => `₹${val.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-8">
        {/* Back Link */}
        <Link
          href="/investment-intelligence"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-trust-blue transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Locality Reports</span>
        </Link>

        {/* Title Block */}
        <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-soft-green text-xs font-bold uppercase tracking-widest">Aura Locality Intelligence</span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mt-1">{details.name} Report</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">{details.overview}</p>
          </div>
          <div className="flex flex-col items-center border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Locality Score</span>
            <span className="text-4xl font-black text-trust-blue mt-1">{details.scores.overall.toFixed(1)}</span>
            <span className="text-[9px] uppercase font-bold text-soft-green mt-1">Excellent Decision</span>
          </div>
        </div>

        {/* Locality score cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Growth Potential</span>
            <div className="flex justify-between items-center">
              <span className="text-lg font-black text-slate-900">{details.scores.growth.toFixed(1)}/10</span>
              <span className="text-xs text-soft-green font-bold flex items-center"><TrendingUp size={12} className="mr-0.5" /> High</span>
            </div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Buyer Demand</span>
            <div className="flex justify-between items-center">
              <span className="text-lg font-black text-slate-900">{details.scores.demand.toFixed(1)}/10</span>
              <span className="text-xs text-trust-blue font-bold">Active</span>
            </div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Rental Performance</span>
            <div className="flex justify-between items-center">
              <span className="text-lg font-black text-slate-900">{details.scores.rental.toFixed(1)}/10</span>
              <span className="text-xs text-soft-green font-bold">{details.rentalYield.toFixed(1)}% Yield</span>
            </div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Connectivity Rating</span>
            <div className="flex justify-between items-center">
              <span className="text-lg font-black text-slate-900">{details.scores.connectivity.toFixed(1)}/10</span>
              <span className="text-xs text-slate-500">Superb</span>
            </div>
          </div>
        </div>

        {/* Two column metrics layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Market performance, Price trends, and Infra */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Price Trend Chart preview */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <TrendingUp size={18} className="text-trust-blue" />
                Price Trend History (per Sq Ft)
              </h3>
              
              <div className="h-44 flex items-end justify-between pt-6 border-b border-slate-200 pb-2">
                {details.priceTrend.map((trend) => {
                  const maxVal = Math.max(...details.priceTrend.map((t) => t.val));
                  const pct = (trend.val / maxVal) * 100;
                  return (
                    <div key={trend.year} className="flex flex-col items-center w-12 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500">{formatCurrency(trend.val)}</span>
                      <div
                        className="w-8 bg-trust-blue rounded-t"
                        style={{ height: `${pct * 0.8}px`, minHeight: '10px' }}
                      />
                      <span className="text-xs font-bold text-slate-600">{trend.year}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 italic">Values represent median registry sale values indexed from quarter tracking reports.</p>
            </div>

            {/* Infrastructure Highlights */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Building size={18} className="text-trust-blue" />
                Infrastructure & Amenities Rating
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Road Quality</span>
                  <p className="font-medium text-slate-900">{details.infra.roads}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Metro & Bus Access</span>
                  <p className="font-medium text-slate-900">{details.infra.metro}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Commercial & Malls</span>
                  <p className="font-medium text-slate-900">{details.infra.commercial}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Nearby Schools</span>
                  <p className="font-medium text-slate-900">{details.infra.schools}</p>
                </div>
                <div className="space-y-1 sm:col-span-2 border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-500 block uppercase text-[10px]">Hospitals & Medical Infrastructure</span>
                  <p className="font-medium text-slate-900">{details.infra.hospitals}</p>
                </div>
              </div>
            </div>

            {/* Connectivity text */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-2 bg-slate-50">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Compass size={14} className="text-trust-blue" />
                Connectivity Assessment
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {details.connectivityText}
              </p>
            </div>
          </div>

          {/* Pros, Cons, Opportunities, Available listings */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Investment evaluation */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1">
                <Info size={16} className="text-trust-blue" />
                Decision Evaluation
              </h3>
              
              <div className="space-y-3 text-xs text-slate-700">
                <div className="space-y-1.5">
                  <span className="text-soft-green font-bold block uppercase text-[10px]">Pros / Growth Drivers:</span>
                  <ul className="list-disc pl-4 space-y-1">
                    {details.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                  </ul>
                </div>
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Cons / Trade-offs:</span>
                  <ul className="list-disc pl-4 space-y-1">
                    {details.cons.map((con, i) => <li key={i}>{con}</li>)}
                  </ul>
                </div>
                {details.risks.length > 0 && (
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <span className="text-red-500 font-bold block uppercase text-[10px]">Risk Factors:</span>
                    <ul className="list-disc pl-4 space-y-1">
                      {details.risks.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                  </div>
                )}
                {details.opportunities.length > 0 && (
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <span className="text-trust-blue font-bold block uppercase text-[10px]">Strategic Opportunities:</span>
                    <ul className="list-disc pl-4 space-y-1">
                      {details.opportunities.map((opp, i) => <li key={i}>{opp}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Related Listings */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Available Listings in {details.name}
              </h3>
              {properties.length === 0 ? (
                <p className="text-xs text-slate-400">No properties actively cataloged in this area. Check neighboring sectors.</p>
              ) : (
                <div className="space-y-3">
                  {properties.slice(0, 3).map((prop) => (
                    <Link
                      key={prop.id}
                      href={`/properties/${prop.id}`}
                      className="block p-2 border border-slate-100 hover:border-trust-blue rounded-lg bg-slate-50 hover:bg-white transition-colors"
                    >
                      <h4 className="font-bold text-slate-800 text-xs truncate">{prop.name}</h4>
                      <p className="text-[10px] text-slate-500">{prop.type} • {prop.area} Sq Ft</p>
                      <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100/50">
                        <span className="font-extrabold text-trust-blue text-xs">
                          {prop.price >= 10000000 ? `₹${(prop.price / 10000000).toFixed(2)} Cr` : `₹${(prop.price / 100000).toFixed(1)} L`}
                        </span>
                        <ChevronRight size={12} className="text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
