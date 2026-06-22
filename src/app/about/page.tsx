'use client';

import React from 'react';
import { Navbar } from '@/components/navbar';
import {
  ShieldCheck,
  CheckCircle2,
  Users,
  Compass,
  Layers,
  HelpCircle,
  Mail,
  Info,
  DollarSign
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 pt-24 space-y-12">
        {/* Header */}
        <div className="border-b border-slate-100 pb-4 text-center">
          <span className="text-soft-green text-xs font-bold uppercase tracking-widest">Our Story & Mission</span>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mt-1">About Aura Estates</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
            Providing transparent transaction metrics, verified boundary surveys, and locality analytics to empower middle-class home buyers.
          </p>
        </div>

        {/* Mission / Vision Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-200 p-6 rounded-xl space-y-3 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Compass className="text-trust-blue" size={18} />
              Our Mission
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We believe every family has the right to purchase real estate with complete clarity. By compiling official municipal land registries, boundary coordinates, and historical pricing CAGR, we eliminate the traditional information gap in secondary property transactions.
            </p>
          </div>

          <div className="border border-slate-200 p-6 rounded-xl space-y-3 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="text-soft-green" size={18} />
              Our Core Vision
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              To establish Aura Estates as the most trustworthy decision-support portal in Lucknow, prioritizing facts, calculators, and verified layouts over commercial developer showrooms or high-society advertisement.
            </p>
          </div>
        </div>

        {/* Verification Checklist */}
        <div className="border border-slate-200 p-8 rounded-2xl space-y-6 bg-white shadow-sm">
          <h2 className="text-xl font-extrabold text-slate-900 text-center">Our 4-Point Verification Guarantee</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 text-xs text-slate-700">
            <div className="flex gap-3">
              <CheckCircle2 className="text-soft-green shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="font-bold text-slate-900">1. Boundary Zonal Audit</h4>
                <p className="text-slate-500 mt-0.5">Every plot undergoes a physical coordinates survey using localized GIS markers to ensure boundary details match government map lines.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="text-soft-green shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="font-bold text-slate-900">2. Registry & Title Checks</h4>
                <p className="text-slate-500 mt-0.5">We check registration titles, stamp duty filings, and clearance certificates at sub-registrar offices before cataloging.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="text-soft-green shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="font-bold text-slate-900">3. Independent Valuations</h4>
                <p className="text-slate-500 mt-0.5">We project fair valuations based on true secondary transaction history instead of inflated developer pricing list values.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="text-soft-green shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="font-bold text-slate-900">4. Infrastructure Audits</h4>
                <p className="text-slate-500 mt-0.5">We rate road width, municipal water connections, metro plans, and hospital indices to verify locality quality claims.</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Guides Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold text-slate-900 text-center">Free Property Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 p-6 rounded-xl hover:shadow-sm transition-shadow bg-white text-center space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">Home Buying Guide</h3>
              <p className="text-xs text-slate-500">A complete handbook on checking registration deeds, stamp duty calculations, and bank home loans.</p>
              <button className="text-xs text-trust-blue hover:underline font-bold mt-2">Download Guide (PDF) →</button>
            </div>

            <div className="border border-slate-200 p-6 rounded-xl hover:shadow-sm transition-shadow bg-white text-center space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">Investment Guide</h3>
              <p className="text-xs text-slate-500">Learn how to evaluate CAGR appreciation, identify undervalued corridors, and analyze rental yields.</p>
              <button className="text-xs text-trust-blue hover:underline font-bold mt-2">Download Guide (PDF) →</button>
            </div>

            <div className="border border-slate-200 p-6 rounded-xl hover:shadow-sm transition-shadow bg-white text-center space-y-2">
              <h3 className="font-bold text-slate-900 text-sm">First-Time Buyer Guide</h3>
              <p className="text-xs text-slate-500">A simple, friendly manual for first-time buyers explaining affordability benchmarks and budgets.</p>
              <button className="text-xs text-trust-blue hover:underline font-bold mt-2">Download Guide (PDF) →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
