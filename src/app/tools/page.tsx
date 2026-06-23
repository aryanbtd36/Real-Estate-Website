'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import {
  Calculator,
  Percent,
  Layers,
  TrendingUp,
  DollarSign,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  Check
} from 'lucide-react';

function ToolsHubContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'emi';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with search parameters if provided
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // EMI Calculator State
  const [emiPrincipal, setEmiPrincipal] = useState(4500000);
  const [emiRate, setEmiRate] = useState(8.5);
  const [emiTenure, setEmiTenure] = useState(20);

  // Affordability Calculator State
  const [affGrossIncome, setAffGrossIncome] = useState(120000);
  const [affDebts, setAffDebts] = useState(20000);
  const [affRate, setAffRate] = useState(8.5);
  const [affTenure, setAffTenure] = useState(20);

  // Rental Yield Calculator State
  const [yieldPrice, setYieldPrice] = useState(5000000);
  const [yieldRent, setYieldRent] = useState(18000);
  const [yieldMaintenance, setYieldMaintenance] = useState(24000); // annual
  const [yieldTax, setYieldTax] = useState(12000); // annual

  // Investment Return Calculator State
  const [retPrice, setRetPrice] = useState(4000000);
  const [retPeriod, setRetPeriod] = useState(5);
  const [retAppr, setRetAppr] = useState(8.0); // CAGR %

  // Area Converter State
  const [convVal, setConvVal] = useState(1000);
  const [convFrom, setConvFrom] = useState('sqft');
  const [convTo, setConvTo] = useState('sqyard');
  const [convResult, setConvResult] = useState<number | null>(null);

  // Property Comparison State
  const [compareProp1, setCompareProp1] = useState('1');
  const [compareProp2, setCompareProp2] = useState('2');
  const [compareProp3, setCompareProp3] = useState('3');

  // EMI Math
  const calculateEMI = () => {
    const P = emiPrincipal;
    const r = (emiRate / 12) / 100;
    const n = emiTenure * 12;
    if (r === 0) return { emi: P / n, total: P, interest: 0 };
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    const interest = total - P;
    return { emi: Math.round(emi), total: Math.round(total), interest: Math.round(interest) };
  };
  const emiRes = calculateEMI();

  // Affordability Math
  const calculateAffordability = () => {
    const maxEmiAllowed = Math.max(0, (affGrossIncome * 0.45) - affDebts);
    const r = (affRate / 12) / 100;
    const n = affTenure * 12;
    if (maxEmiAllowed <= 0) return { loan: 0, budget: 0, monthly: 0 };

    let loanAmount = 0;
    if (r === 0) {
      loanAmount = maxEmiAllowed * n;
    } else {
      loanAmount = (maxEmiAllowed * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
    }
    const maxBudget = loanAmount / 0.8;
    return { loan: Math.round(loanAmount), budget: Math.round(maxBudget), monthly: Math.round(maxEmiAllowed) };
  };
  const affRes = calculateAffordability();

  // Yield Math
  const calculateYield = () => {
    const grossAnnual = yieldRent * 12;
    const grossYield = (grossAnnual / yieldPrice) * 100;
    const netAnnual = grossAnnual - yieldMaintenance - yieldTax;
    const netYield = (netAnnual / yieldPrice) * 100;
    return { gross: grossYield, net: Math.max(0, netYield) };
  };
  const yieldRes = calculateYield();

  // Return Math
  const calculateReturns = () => {
    const finalPrice = retPrice * Math.pow(1 + (retAppr / 100), retPeriod);
    const gains = finalPrice - retPrice;
    return { final: Math.round(finalPrice), gains: Math.round(gains) };
  };
  const retRes = calculateReturns();

  // Area conversion factors relative to Sq Ft
  const CONV_RATES: Record<string, number> = {
    sqft: 1,
    sqyard: 9,
    gaj: 9, 
    marla: 272.25,
    bigha: 27000, 
    acre: 43560,
    guntha: 1089,
    sqmeter: 10.7639
  };

  useEffect(() => {
    const fromRate = CONV_RATES[convFrom];
    const toRate = CONV_RATES[convTo];
    if (fromRate && toRate) {
      const sqftVal = convVal * fromRate;
      const res = sqftVal / toRate;
      setConvResult(parseFloat(res.toFixed(4)));
    }
  }, [convVal, convFrom, convTo]);

  // Mock properties for compare tool
  const COMPARE_PROPS = {
    '1': { name: 'Indira Nagar Duplex', price: 8200000, area: 3800, location: 'Sector 14, Indira Nagar', yieldVal: '3.8%', score: '8.1/10', amenities: 'Paved road, Metro access, municipal water line' },
    '2': { name: 'Gomti Nagar Villa', price: 18900000, area: 8400, location: 'Vibhuti Khand, Gomti Nagar', yieldVal: '4.8%', score: '8.9/10', amenities: 'Wide avenues, Sahara Hospital proximity, gated security' },
    '3': { name: 'Aliganj heights flat', price: 14000000, area: 4500, location: 'Sector H, Aliganj', yieldVal: '3.6%', score: '7.7/10', amenities: 'Elevator, backup generator, community hall access' },
    '4': { name: 'Jankipuram Retreat Land', price: 6800000, area: 2900, location: 'Sector 6, Jankipuram', yieldVal: '3.2%', score: '7.4/10', amenities: 'Piped water boundary layout, quiet streets' }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-8">
        
        {/* Title */}
        <div className="border-b border-slate-200/60 pb-6 text-left">
          <span className="text-trust-blue text-xs font-bold uppercase tracking-widest block">Decision Support Suite</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Real Estate Analytics Hub</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium font-sans">Run mathematical models to calculate land values, rental yields, affordability, and loan repayments.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200/60 pb-2">
          {[
            { id: 'emi', label: 'EMI Estimator', icon: Calculator },
            { id: 'affordability', label: 'Affordability Index', icon: DollarSign },
            { id: 'yield', label: 'Rental Yield', icon: Percent },
            { id: 'returns', label: 'Appreciation Projector', icon: TrendingUp },
            { id: 'compare', label: 'Comparison Matrix', icon: Layers },
            { id: 'converter', label: 'Area Converter', icon: Compass }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-trust-blue text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-250/60'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Containers */}
        <div className="bg-white p-6 md:p-8 rounded-[24px] border border-slate-200/60 shadow-premium min-h-[400px] text-left">
          
          {/* TAB: EMI CALCULATOR */}
          {activeTab === 'emi' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7 space-y-6">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Calculator className="text-trust-blue" size={20} />
                  Home Loan EMI Estimator
                </h3>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Loan Principal Amount</span>
                      <span className="text-slate-900 font-extrabold">₹{emiPrincipal.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="500000"
                      max="30000000"
                      step="100000"
                      value={emiPrincipal}
                      onChange={(e) => setEmiPrincipal(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Interest Rate (p.a.)</span>
                      <span className="text-slate-900 font-extrabold">{emiRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="5.0"
                      max="15.0"
                      step="0.1"
                      value={emiRate}
                      onChange={(e) => setEmiRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Loan Tenure</span>
                      <span className="text-slate-900 font-extrabold">{emiTenure} Years</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="1"
                      value={emiTenure}
                      onChange={(e) => setEmiTenure(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Calculations Result */}
              <div className="md:col-span-5 bg-slate-50 border border-slate-200/60 p-6 rounded-xl space-y-6">
                <div className="text-center space-y-1 border-b border-slate-200/40 pb-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Monthly EMI Commitment</span>
                  <div className="text-3xl font-black text-trust-blue">₹{emiRes.emi.toLocaleString()}</div>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Loan Principal</span>
                    <span className="text-slate-950 font-bold">₹{emiPrincipal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Total Interest Outflow</span>
                    <span className="text-slate-950 font-bold">₹{emiRes.interest.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200/60 pt-3.5 text-sm">
                    <span>Cumulative Outflow</span>
                    <span className="text-trust-blue">₹{emiRes.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg text-[10px] text-slate-400 italic leading-relaxed border border-slate-200/40 shadow-2xs">
                  * Dynamic estimates calculated using standard monthly compounding models. Tax indices are extra.
                </div>
              </div>
            </div>
          )}

          {/* TAB: AFFORDABILITY */}
          {activeTab === 'affordability' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7 space-y-6">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <DollarSign className="text-trust-blue" size={20} />
                  Home Purchase Affordability Index
                </h3>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Monthly Net Income</span>
                      <span className="text-slate-900 font-extrabold">₹{affGrossIncome.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="20000"
                      max="500000"
                      step="5000"
                      value={affGrossIncome}
                      onChange={(e) => setAffGrossIncome(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Monthly Repayments/Debts</span>
                      <span className="text-slate-900 font-extrabold">₹{affDebts.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150005"
                      step="2000"
                      value={affDebts}
                      onChange={(e) => setAffDebts(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Expected Bank Interest Rate</span>
                      <span className="text-slate-900 font-extrabold">{affRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="15"
                      step="0.1"
                      value={affRate}
                      onChange={(e) => setAffRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Loan tenure</span>
                      <span className="text-slate-900 font-extrabold">{affTenure} Years</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="1"
                      value={affTenure}
                      onChange={(e) => setAffTenure(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Calculations Result */}
              <div className="md:col-span-5 bg-slate-50 border border-slate-200/60 p-6 rounded-xl space-y-6">
                <div className="text-center space-y-1 border-b border-slate-200/40 pb-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Maximum Property Valuation</span>
                  <div className="text-3xl font-black text-soft-green">₹{affRes.budget.toLocaleString()}</div>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Affordable monthly EMI limit</span>
                    <span className="text-slate-950 font-bold">₹{affRes.monthly.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Projected Loan Principal</span>
                    <span className="text-slate-950 font-bold">₹{affRes.loan.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200/60 pt-3.5 text-sm">
                    <span>Required Down Payment (20%)</span>
                    <span className="text-trust-blue">₹{Math.round(affRes.budget * 0.2).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg text-[10px] text-slate-400 italic leading-relaxed border border-slate-200/40 shadow-2xs">
                  * Assumes a maximum 45% debt-to-income margin target to guarantee financial cushion constraints.
                </div>
              </div>
            </div>
          )}

          {/* TAB: RENTAL YIELD */}
          {activeTab === 'yield' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7 space-y-6">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Percent className="text-trust-blue" size={20} />
                  Net Rental Yield Projector
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Property Purchase Price</label>
                    <input
                      type="number"
                      value={yieldPrice}
                      onChange={(e) => setYieldPrice(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Monthly Rent</label>
                    <input
                      type="number"
                      value={yieldRent}
                      onChange={(e) => setYieldRent(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Annual Maintenance / Society Cost</label>
                    <input
                      type="number"
                      value={yieldMaintenance}
                      onChange={(e) => setYieldMaintenance(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Annual Property Taxes</label>
                    <input
                      type="number"
                      value={yieldTax}
                      onChange={(e) => setYieldTax(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Calculations Result */}
              <div className="md:col-span-5 bg-slate-50 border border-slate-200/60 p-6 rounded-xl space-y-6">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-200/40 pb-4 text-center">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Yield</span>
                    <div className="text-2xl font-black text-trust-blue">{yieldRes.gross.toFixed(2)}%</div>
                  </div>
                  <div className="space-y-1 border-l border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Yield</span>
                    <div className="text-2xl font-black text-soft-green">{yieldRes.net.toFixed(2)}%</div>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Gross Annual Revenue</span>
                    <span className="text-slate-950 font-bold">₹{(yieldRent * 12).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Total Annual Expenses</span>
                    <span className="text-slate-950 font-bold">₹{(yieldMaintenance + yieldTax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200/60 pt-3.5 text-sm">
                    <span>Net Annual Revenue</span>
                    <span className="text-soft-green">₹{((yieldRent * 12) - yieldMaintenance - yieldTax).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INVESTMENT RETURN */}
          {activeTab === 'returns' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7 space-y-6">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <TrendingUp className="text-trust-blue" size={20} />
                  Appreciation return Projection
                </h3>
                
                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Initial Value</label>
                    <input
                      type="number"
                      value={retPrice}
                      onChange={(e) => setRetPrice(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Holding Period</span>
                      <span className="text-slate-900 font-extrabold">{retPeriod} Years</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={retPeriod}
                      onChange={(e) => setRetPeriod(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Expected Neighborhood CAGR Growth (%)</span>
                      <span className="text-slate-900 font-extrabold">{retAppr}%</span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="18.0"
                      step="0.5"
                      value={retAppr}
                      onChange={(e) => setRetAppr(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 accent-trust-blue rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Calculations Result */}
              <div className="md:col-span-5 bg-slate-50 border border-slate-200/60 p-6 rounded-xl space-y-6">
                <div className="text-center space-y-1 border-b border-slate-200/40 pb-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Projected Valuation</span>
                  <div className="text-3xl font-black text-trust-blue">₹{retRes.final.toLocaleString()}</div>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Principal</span>
                    <span className="text-slate-950 font-bold">₹{retPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-normal text-slate-400">Appreciation gain</span>
                    <span className="text-slate-950 font-bold">₹{retRes.gains.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200/60 pt-3.5 text-sm">
                    <span>Appreciation Multiple</span>
                    <span className="text-trust-blue">{(retRes.final / retPrice).toFixed(2)}x Return</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROPERTY COMPARISON TOOL */}
          {activeTab === 'compare' && (
            <div className="space-y-6">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Layers className="text-trust-blue" size={20} />
                Side-by-Side Property Comparison Matrix
              </h3>

              {/* Selector toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Select Property 1</label>
                  <select
                    value={compareProp1}
                    onChange={(e) => setCompareProp1(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue font-semibold cursor-pointer"
                  >
                    <option value="1">Indira Nagar Duplex</option>
                    <option value="2">Gomti Nagar Villa</option>
                    <option value="3">Aliganj Heights Apartment</option>
                    <option value="4">Jankipuram Retreat Land</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Select Property 2</label>
                  <select
                    value={compareProp2}
                    onChange={(e) => setCompareProp2(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue font-semibold cursor-pointer"
                  >
                    <option value="2">Gomti Nagar Villa</option>
                    <option value="1">Indira Nagar Duplex</option>
                    <option value="3">Aliganj Heights Apartment</option>
                    <option value="4">Jankipuram Retreat Land</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Select Property 3</label>
                  <select
                    value={compareProp3}
                    onChange={(e) => setCompareProp3(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue font-semibold cursor-pointer"
                  >
                    <option value="3">Aliganj Heights Apartment</option>
                    <option value="1">Indira Nagar Duplex</option>
                    <option value="2">Gomti Nagar Villa</option>
                    <option value="4">Jankipuram Retreat Land</option>
                  </select>
                </div>
              </div>

              {/* Comparison table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-xs">
                <table className="w-full text-left border-collapse text-xs bg-white">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50">
                      <th className="py-3.5 px-4">Feature</th>
                      <th className="py-3.5 px-4 text-trust-blue">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.name}</th>
                      <th className="py-3.5 px-4 text-trust-blue">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.name}</th>
                      <th className="py-3.5 px-4 text-trust-blue">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.name}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-slate-400 bg-slate-50/50">Price</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">₹{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.price.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">₹{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.price.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">₹{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.price.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-slate-400 bg-slate-50/50">Area Dimensions</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.area} Sq Ft</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.area} Sq Ft</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.area} Sq Ft</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-slate-400 bg-slate-50/50">Neighborhood Sector</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.location}</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.location}</td>
                      <td className="py-3.5 px-4">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.location}</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-slate-400 bg-slate-50/50">Lease Yield Index</td>
                      <td className="py-3.5 px-4 text-soft-green font-bold">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.yieldVal}</td>
                      <td className="py-3.5 px-4 text-soft-green font-bold">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.yieldVal}</td>
                      <td className="py-3.5 px-4 text-soft-green font-bold">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.yieldVal}</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-bold text-slate-400 bg-slate-50/50">Zoning Details</td>
                      <td className="py-3.5 px-4 text-[11px] leading-relaxed font-normal">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.amenities}</td>
                      <td className="py-3.5 px-4 text-[11px] leading-relaxed font-normal">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.amenities}</td>
                      <td className="py-3.5 px-4 text-[11px] leading-relaxed font-normal">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.amenities}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-700 bg-slate-100">Overall Score</td>
                      <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_PROPS[compareProp1 as keyof typeof COMPARE_PROPS]?.score}</td>
                      <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_PROPS[compareProp2 as keyof typeof COMPARE_PROPS]?.score}</td>
                      <td className="py-3.5 px-4 font-extrabold text-trust-blue">{COMPARE_PROPS[compareProp3 as keyof typeof COMPARE_PROPS]?.score}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: AREA UNIT CONVERTER */}
          {activeTab === 'converter' && (
            <div className="space-y-6 max-w-xl mx-auto text-left">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Compass className="text-trust-blue" size={20} />
                Indian Area Unit Converter (Bigha, Gaj, Sq Ft, Acre)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Value to Convert</label>
                  <input
                    type="number"
                    value={convVal}
                    onChange={(e) => setConvVal(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-trust-blue text-slate-700 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Source Unit (From)</label>
                  <select
                    value={convFrom}
                    onChange={(e) => setConvFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue font-semibold cursor-pointer"
                  >
                    <option value="sqft">Sq Feet (Sq Ft)</option>
                    <option value="sqyard">Sq Yards</option>
                    <option value="gaj">Gaj</option>
                    <option value="marla">Marla</option>
                    <option value="bigha">Bigha (UP)</option>
                    <option value="acre">Acre</option>
                    <option value="guntha">Guntha</option>
                    <option value="sqmeter">Sq Meter</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Target Unit (To)</label>
                  <select
                    value={convTo}
                    onChange={(e) => setConvTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs text-slate-700 outline-none focus:border-trust-blue font-semibold cursor-pointer"
                  >
                    <option value="sqyard">Sq Yards</option>
                    <option value="sqft">Sq Feet (Sq Ft)</option>
                    <option value="gaj">Gaj</option>
                    <option value="marla">Marla</option>
                    <option value="bigha">Bigha (UP)</option>
                    <option value="acre">Acre</option>
                    <option value="guntha">Guntha</option>
                    <option value="sqmeter">Sq Meter</option>
                  </select>
                </div>
              </div>

              {convResult !== null && (
                <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-xl text-center space-y-2 shadow-2xs mt-4">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Converted Area Result</span>
                  <div className="text-2xl font-black text-trust-blue">
                    {convVal} {convFrom.toUpperCase()} = {convResult} {convTo.toUpperCase()}
                  </div>
                  <p className="text-[10px] text-slate-400 italic mt-2 leading-relaxed">
                    * Conversion definitions: 1 Acre = 43,560 sq ft, 1 Bigha (UP) = 27,000 sq ft, 1 Gaj/Sq Yard = 9 sq ft, 1 Marla = 272.25 sq ft.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ToolsHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trust-blue"></div>
        <p className="text-xs text-slate-500 mt-4 font-bold uppercase tracking-wider">Loading Decision Tools...</p>
      </div>
    }>
      <ToolsHubContent />
    </Suspense>
  );
}
