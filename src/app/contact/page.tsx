'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/navbar';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

const PropertyViewMap = dynamic(() => import('@/components/property-view-map-wrapper'), { ssr: false });

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email && message) {
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    }
  };

  const FAQS = [
    { q: 'How does Aura Estates verify properties?', a: 'Our local survey teams physically visit every site, check boundary points, and cross-reference records with Lucknow registration offices.' },
    { q: 'Can I post my plot or apartment for sale?', a: 'Yes. Registered clients can submit their properties via the dashboard. Listings are published after documentation audits.' },
    { q: 'Are there any registration fees or hidden charges?', a: 'No. Aura Estates is an open property discovery and decision platform. We charge zero catalog fees.' }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-16">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-24 space-y-12">
        {/* Header */}
        <div className="border-b border-slate-100 pb-4 text-center">
          <span className="text-trust-blue text-xs font-bold uppercase tracking-widest"> Lucknow Helpdesk</span>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mt-1">Contact Office & Support</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
            Get assistance with registry checks, stamp duty questions, or listing validation requests.
          </p>
        </div>

        {/* Layout grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Contact Details & Inquiry Form */}
          <div className="lg:col-span-7 space-y-8">
            <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm bg-white">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <MessageSquare className="text-trust-blue" size={18} />
                Send An Inquiry Ticket
              </h3>

              {submitted ? (
                <div className="p-4 bg-soft-green/10 border border-soft-green/20 text-soft-green text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Your support ticket has been logged successfully. Our localized desk will review within 24 hours.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Message / Request *</label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 outline-none focus:border-trust-blue font-medium resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-trust-blue text-white hover:bg-trust-blue-hover rounded-lg font-semibold shadow-sm transition-colors text-xs uppercase tracking-wider"
                  >
                    Submit Inquiry
                  </button>
                </form>
              )}
            </div>

            {/* FAQ widget */}
            <div className="border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm bg-white">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <HelpCircle className="text-trust-blue" size={18} />
                Frequently Answered Questions
              </h3>
              <div className="space-y-4">
                {FAQS.map((faq, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-soft-green shrink-0" />
                      {faq.q}
                    </h4>
                    <p className="text-xs text-slate-500 pl-4">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Details & Leaflet Office Map */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-slate-200 p-6 rounded-xl bg-slate-50 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
                Office Information
              </h3>
              <div className="text-xs space-y-3 text-slate-600 font-medium">
                <p className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-trust-blue shrink-0 mt-0.5" />
                  <span>Aura Estates Office, Patrakar Puram, Gomti Nagar, Lucknow, UP - 226010</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Phone size={16} className="text-trust-blue shrink-0" />
                  <span>+91 (522) 400-AURA (Office lines)</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Mail size={16} className="text-trust-blue shrink-0" />
                  <span>support@auraestates.com</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Clock size={16} className="text-trust-blue shrink-0" />
                  <span>Mon - Sat: 9:30 AM to 6:30 PM IST</span>
                </p>
              </div>
            </div>

            {/* Office Coordinates Map */}
            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50 shadow-sm space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Office Location Map</span>
              <div className="h-[280px]">
                <PropertyViewMap
                  latitude={26.8620}
                  longitude={80.9850}
                  boundary={null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
