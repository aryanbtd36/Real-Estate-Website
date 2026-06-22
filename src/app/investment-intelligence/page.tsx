'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import {
  TrendingUp,
  MapPin,
  Percent,
  Activity,
  Layers,
  CheckCircle2,
  Compass,
  ArrowRight,
  TrendingDown,
  Building,
  Info,
  DollarSign,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface CompLocal {
  id: string;
  name: string;
  price: number; // per sq ft
  yieldVal: number;
  demand: number; // out of 10
  appreciation: number; // % CAGR
  connectivity: number; // out of 10
  overall: number; // out of 10
}

export default function InvestmentIntelligencePage() {
  // Area comparison selector states
  const [compArea1, setCompArea1] = useState('gomti');
  const [compArea2, setCompArea2] = useState('indira');
  const [compArea3, setCompArea3] = useState('hazrat');

  const COMPARE_DATABASE: Record<string, CompLocal> = {
    gomti: { id: 'gomti', name: 'Gomti Nagar', price: 6200, yieldVal: 4.5, demand: 8.8, appreciation: 12.2, connectivity: 8.5, overall: 8.9 },
    indira: { id: 'indira', name: 'Indira Nagar', price: 4500, yieldVal: 3.8, demand: 8.2, appreciation: 9.5, connectivity: 9.2, overall: 8.1 },
    hazrat: { id: 'hazrat', name: 'Hazratganj', price: 9800, yieldVal: 5.2, demand: 9.2, appreciation: 8.5, connectivity: 9.5, overall: 9.1 },
    aliganj: { id: 'aliganj', name: 'Aliganj', price: 4200, yieldVal: 3.6, demand: 7.8, appreciation: 7.0, connectivity: 8.8, overall: 7.7 },
    janki: { id: 'janki', name: 'Jankipuram', price: 3300, yieldVal: 3.2, demand: 7.2, appreciation: 6.8, connectivity: 8.0, overall: 7.4 }
  };

  const getScoreBadge = (overall: number) => {
    if (overall >= 8.5) return 'text-soft-green bg-soft-green/10';
    if (overall >= 7.5) return 'text-trust-blue bg-trust-blue/10';
    return 'text-slate-500 bg-slate-100';
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-10">
        
        {/* Title */}
        <div className="border-b border-slate-100 pb-4">
          <span className="text-soft-green text-xs font-bold uppercase tracking-widest">Decision Support Platform</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Investment Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            Data-backed indicators, yield calculators, and appreciation reports derived from localized transaction records.
          </p>
        </div>

        {/* Market snapshot metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Avg City Price</span>
            <div className="text-lg font-black text-slate-900 mt-1">₹4,850/sq ft</div>
            <span className="text-[9px] text-soft-green font-bold flex items-center mt-0.5">
              <TrendingUp size={10} className="mr-0.5" /> +8.2% YoY
            </span>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Avg Plot Rate</span>
            <div className="text-lg font-black text-slate-900 mt-1">₹3,200/sq ft</div>
            <span className="text-[9px] text-soft-green font-bold flex items-center mt-0.5">
              <TrendingUp size={10} className="mr-0.5" /> +10.5% YoY
            </span>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Avg Apartment Rate</span>
            <div className="text-lg font-black text-slate-900 mt-1">₹5,400/sq ft</div>
            <span className="text-[9px] text-soft-green font-bold flex items-center mt-0.5">
              <TrendingUp size={10} className="mr-0.5" /> +6.8% YoY
            </span>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Top Local Yield</span>
            <div className="text-lg font-black text-slate-900 mt-1">5.2% Yield</div>
            <span className="text-[9px] text-slate-400 font-bold mt-0.5">Hazratganj Central</span>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Fastest Growth Corridor</span>
            <div className="text-lg font-black text-slate-900 mt-1">+12.2% CAGR</div>
            <span className="text-[9px] text-slate-400 font-bold mt-0.5">Gomti Nagar Ext</span>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-400">Median Rental Yield</span>
            <div className="text-lg font-black text-slate-900 mt-1">4.1% Net</div>
            <span className="text-[9px] text-slate-400 font-bold mt-0.5">Citywide Average</span>
          </div>
        </div>

        {/* Top appreciation & yield listings grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top appreciating areas */}
          <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <TrendingUp className="text-soft-green" size={20} />
              Top Appreciating Areas
            </h2>
            <div className="space-y-4">
              {[
                { name: 'Gomti Nagar Extension', slug: 'gomti-nagar', growth: '12.2% CAGR', score: 9.2, price: '₹6,200/Sq Ft', trend: 'Strong infrastructure expansions, Metro Phase corridor' },
                { name: 'Sultanpur Road Corridor', slug: 'sultanpur-road', growth: '10.5% CAGR', score: 8.8, price: '₹4,500/Sq Ft', trend: 'IT Hub extensions, upcoming Ring Road connections' },
                { name: 'Faizabad Road Expressway', slug: 'faizabad-road', growth: '9.5% CAGR', score: 8.2, price: '₹3,800/Sq Ft', trend: 'Piped utilities setups, dense housing developments' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-slate-300 bg-slate-50">
                  <div className="space-y-1">
                    <Link href={`/areas/${item.slug}`} className="font-bold text-slate-900 text-sm hover:underline">{item.name}</Link>
                    <p className="text-xs text-slate-500">{item.trend}</p>
                    <div className="flex gap-4 text-[10px] text-slate-400 font-semibold uppercase">
                      <span>Rate: {item.price}</span>
                      <span>Score: {item.score}/10</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1.5 bg-soft-green/10 text-soft-green font-black rounded-lg text-xs tracking-wider block">
                      {item.growth}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best rental yield areas */}
          <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Percent className="text-trust-blue" size={20} />
              Best Rental Yield Areas
            </h2>
            <div className="space-y-4">
              {[
                { name: 'Hazratganj Central', slug: 'hazratganj', yieldVal: '5.2% Yield', occupancy: '95%', price: '₹22,000 - ₹35,000/mo', trend: 'Corporate banking hubs, retail storefront layouts' },
                { name: 'Gomti Nagar (Vibhuti Khand)', slug: 'gomti-nagar', yieldVal: '4.8% Yield', occupancy: '92%', price: '₹18,000 - ₹28,000/mo', trend: 'IT Park employee housing, commercial towers' },
                { name: 'Mahanagar Sector Blocks', slug: 'mahanagar', yieldVal: '4.2% Yield', occupancy: '89%', price: '₹15,000 - ₹24,000/mo', trend: 'Professional clinics, educational staff housing' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-slate-300 bg-slate-50">
                  <div className="space-y-1">
                    <Link href={`/areas/${item.slug}`} className="font-bold text-slate-900 text-sm hover:underline">{item.name}</Link>
                    <p className="text-xs text-slate-500">{item.trend}</p>
                    <div className="flex gap-4 text-[10px] text-slate-400 font-semibold uppercase">
                      <span>Rent Range: {item.price}</span>
                      <span>Occupancy: {item.occupancy}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1.5 bg-trust-blue/10 text-trust-blue font-black rounded-lg text-xs tracking-wider block">
                      {item.yieldVal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Emerging & Undervalued localities section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Emerging Localities */}
          <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm bg-slate-50/50">
            <h2 className="text-lg font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <Compass className="text-trust-blue" size={20} />
              Emerging Zoned Corridors
            </h2>
            <div className="space-y-4">
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">Deva Road Extension (Mati Corridor)</h3>
                <p className="text-xs text-slate-500">Prices remain relatively low. Growth driven by direct outer ring road extensions and upcoming central warehouse complexes.</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-2 uppercase">
                  <span>Development: Medium</span>
                  <span className="text-soft-green font-extrabold">Price Index: ₹1.8K/Sq Ft</span>
                </div>
              </div>
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">Sultanpur Road (IT City Corridor)</h3>
                <p className="text-xs text-slate-500">Appreciating rapidly. Development driven by government cancer hospital setup, IT city extensions, and major private townships.</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-2 uppercase">
                  <span>Development: High</span>
                  <span className="text-soft-green font-extrabold">Price Index: ₹3.5K/Sq Ft</span>
                </div>
              </div>
            </div>
          </div>

          {/* Undervalued Areas index */}
          <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm bg-slate-50/50">
            <h2 className="text-lg font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <DollarSign className="text-soft-green" size={20} />
              Undervalued Corridors
            </h2>
            <div className="space-y-4">
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-sm">Jankipuram Extension (Sector 6)</h3>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-bold rounded">15% Discount</span>
                </div>
                <p className="text-xs text-slate-500">Valuations lag 15-20% behind neighbouring Aliganj sectors, despite similar metro connectivity within 3km. Excellent middle-class buyer entry.</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-2 uppercase">
                  <span>Demand: Moderate</span>
                  <span className="text-trust-blue font-extrabold">Rate: ₹2.8K/Sq Ft</span>
                </div>
              </div>
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-sm">Mati Residential Belt</h3>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-bold rounded">25% Discount</span>
                </div>
                <p className="text-xs text-slate-500">Land prices are 25% lower than the main Faizabad Highway corridors, despite municipal water zoning recently reaching sector lines.</p>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-2 uppercase">
                  <span>Demand: Stable</span>
                  <span className="text-trust-blue font-extrabold">Rate: ₹1.5K/Sq Ft</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Area Comparison Engine */}
        <div className="border border-slate-200 p-6 rounded-xl space-y-6 shadow-sm">
          <div>
            <span className="text-trust-blue text-xs font-bold uppercase tracking-widest">Compare & Choose</span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">Area Comparison Engine</h2>
            <p className="text-xs text-slate-500 mt-1">Select up to three neighborhoods to compare price and infrastructure scores.</p>
          </div>

          {/* Selectors grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Area 1</label>
              <select
                value={compArea1}
                onChange={(e) => setCompArea1(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue"
              >
                <option value="gomti">Gomti Nagar</option>
                <option value="indira">Indira Nagar</option>
                <option value="hazrat">Hazratganj</option>
                <option value="aliganj">Aliganj</option>
                <option value="janki">Jankipuram</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Area 2</label>
              <select
                value={compArea2}
                onChange={(e) => setCompArea2(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue"
              >
                <option value="indira">Indira Nagar</option>
                <option value="gomti">Gomti Nagar</option>
                <option value="hazrat">Hazratganj</option>
                <option value="aliganj">Aliganj</option>
                <option value="janki">Jankipuram</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Area 3</label>
              <select
                value={compArea3}
                onChange={(e) => setCompArea3(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue"
              >
                <option value="hazrat">Hazratganj</option>
                <option value="gomti">Gomti Nagar</option>
                <option value="indira">Indira Nagar</option>
                <option value="aliganj">Aliganj</option>
                <option value="janki">Jankipuram</option>
              </select>
            </div>
          </div>

          {/* Comparison results table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-3 px-4">Metric</th>
                  <th className="py-3 px-4 text-trust-blue">{COMPARE_DATABASE[compArea1]?.name}</th>
                  <th className="py-3 px-4 text-trust-blue">{COMPARE_DATABASE[compArea2]?.name}</th>
                  <th className="py-3 px-4 text-trust-blue">{COMPARE_DATABASE[compArea3]?.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-500">Average Rate (/Sq Ft)</td>
                  <td className="py-3.5 px-4">₹{COMPARE_DATABASE[compArea1]?.price.toLocaleString()}</td>
                  <td className="py-3.5 px-4">₹{COMPARE_DATABASE[compArea2]?.price.toLocaleString()}</td>
                  <td className="py-3.5 px-4">₹{COMPARE_DATABASE[compArea3]?.price.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-500">Rental Yield</td>
                  <td className="py-3.5 px-4 text-soft-green font-extrabold">{COMPARE_DATABASE[compArea1]?.yieldVal.toFixed(1)}%</td>
                  <td className="py-3.5 px-4 text-soft-green font-extrabold">{COMPARE_DATABASE[compArea2]?.yieldVal.toFixed(1)}%</td>
                  <td className="py-3.5 px-4 text-soft-green font-extrabold">{COMPARE_DATABASE[compArea3]?.yieldVal.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-500">Demand Index</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea1]?.demand}/10</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea2]?.demand}/10</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea3]?.demand}/10</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-500">Appreciation CAGR</td>
                  <td className="py-3.5 px-4 font-bold">{COMPARE_DATABASE[compArea1]?.appreciation.toFixed(1)}%</td>
                  <td className="py-3.5 px-4 font-bold">{COMPARE_DATABASE[compArea2]?.appreciation.toFixed(1)}%</td>
                  <td className="py-3.5 px-4 font-bold">{COMPARE_DATABASE[compArea3]?.appreciation.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-500">Connectivity Access</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea1]?.connectivity}/10</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea2]?.connectivity}/10</td>
                  <td className="py-3.5 px-4">{COMPARE_DATABASE[compArea3]?.connectivity}/10</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-700">Overall Score</td>
                  <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_DATABASE[compArea1]?.overall}/10</td>
                  <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_DATABASE[compArea2]?.overall}/10</td>
                  <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_DATABASE[compArea3]?.overall}/10</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Links to Locality report guides */}
        <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm bg-slate-50/20">
          <h3 className="text-base font-extrabold text-slate-900">Locality Intelligence Guides</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/areas/gomti-nagar" className="p-4 border border-slate-100 bg-white hover:border-trust-blue rounded-lg shadow-sm transition-all flex justify-between items-center group">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Gomti Nagar</h4>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rating: A+ Excellent</p>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-trust-blue transition-colors" />
            </Link>
            <Link href="/areas/indira-nagar" className="p-4 border border-slate-100 bg-white hover:border-trust-blue rounded-lg shadow-sm transition-all flex justify-between items-center group">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Indira Nagar</h4>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rating: A Stable</p>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-trust-blue transition-colors" />
            </Link>
            <Link href="/areas/aliganj" className="p-4 border border-slate-100 bg-white hover:border-trust-blue rounded-lg shadow-sm transition-all flex justify-between items-center group">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Aliganj</h4>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rating: B+ Mature</p>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-trust-blue transition-colors" />
            </Link>
            <Link href="/areas/hazratganj" className="p-4 border border-slate-100 bg-white hover:border-trust-blue rounded-lg shadow-sm transition-all flex justify-between items-center group">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Hazratganj</h4>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rating: A+ Premium</p>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-trust-blue transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
