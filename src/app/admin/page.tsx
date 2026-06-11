'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Building,
  Calendar,
  Users as UsersIcon,
  Mail,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>({
    totalProperties: 0,
    totalUsers: 0,
    totalAppointments: 0,
    totalInquiries: 0,
    totalVisits: 0,
    pendingAppointments: 0,
    featuredProperties: 0,
    availableProperties: 0,
    soldProperties: 0,
    mostViewedProperty: null,
    mostScheduledProperty: null,
    recentProperties: [],
    recentInquiries: [],
    recentAppointments: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Dashboard Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Administrative Portal</span>
        <h1 className="text-3xl font-light tracking-tight mt-1">Operational Overview</h1>
        <p className="text-xs text-white/50 mt-1">Real-time platform activity and portfolio metrics.</p>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/25 transition-all">
          <div className="absolute top-4 right-4 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors">
            <Building size={24} />
          </div>
          <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Total Properties</span>
          <span className="text-4xl font-light text-[#D4AF37]">{stats.totalProperties}</span>
          <div className="pt-2 text-[10px] text-white/45 border-t border-white/5 flex gap-2">
            <span>{stats.availableProperties} Available</span>
            <span>•</span>
            <span>{stats.soldProperties} Sold</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/25 transition-all">
          <div className="absolute top-4 right-4 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors">
            <UsersIcon size={24} />
          </div>
          <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Registered Clients</span>
          <span className="text-4xl font-light text-[#D4AF37]">{stats.totalUsers}</span>
          <div className="pt-2 text-[10px] text-white/45 border-t border-white/5">
            <span>Client directory & profiles</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/25 transition-all">
          <div className="absolute top-4 right-4 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors">
            <Mail size={24} />
          </div>
          <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Total Inquiries</span>
          <span className="text-4xl font-light text-[#D4AF37]">{stats.totalInquiries}</span>
          <div className="pt-2 text-[10px] text-white/45 border-t border-white/5">
            <span>Public concierge leads</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/25 transition-all">
          <div className="absolute top-4 right-4 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors">
            <Calendar size={24} />
          </div>
          <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Appointments</span>
          <span className="text-4xl font-light text-[#D4AF37]">{stats.totalAppointments}</span>
          <div className="pt-2 text-[10px] text-white/45 border-t border-white/5 flex gap-2">
            <span className="text-yellow-400">{stats.pendingAppointments} Pending</span>
            <span>•</span>
            <span className="text-green-400">{stats.totalVisits} Active</span>
          </div>
        </div>
      </div>

      {/* Analytics Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <TrendingUp className="text-[#D4AF37]" size={16} />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Most Viewed Residence</h3>
          </div>
          {stats.mostViewedProperty ? (
            <div className="space-y-3">
              <div>
                <p className="text-xl font-light text-white">{stats.mostViewedProperty.name}</p>
                <p className="text-xs text-white/50">{stats.mostViewedProperty.location}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light text-[#D4AF37]">{stats.mostViewedProperty.views}</span>
                <span className="text-xs text-white/40">cumulative page views</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 italic">No view metrics recorded yet.</p>
          )}
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Calendar className="text-[#D4AF37]" size={16} />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Most Scheduled Residence</h3>
          </div>
          {stats.mostScheduledProperty ? (
            <div className="space-y-3">
              <div>
                <p className="text-xl font-light text-white">{stats.mostScheduledProperty.name}</p>
                <p className="text-xs text-white/50">Price: ${(stats.mostScheduledProperty.price / 1000000).toFixed(1)}M</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light text-[#D4AF37]">{stats.mostScheduledProperty.count}</span>
                <span className="text-xs text-white/40">site visits booked</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 italic">No scheduled appointments yet.</p>
          )}
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Recent Inquiries */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium tracking-wide">Recent Inquiries</h2>
            <Link href="/admin/inquiries" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentInquiries.length === 0 ? (
            <div className="bg-[#161616]/40 border border-white/5 p-8 text-center rounded-xl">
              <p className="text-xs text-white/40 italic">No recent inquiries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentInquiries.map((lead: any) => (
                <div key={lead.id} className="bg-[#161616] border border-white/5 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{lead.name}</h4>
                      <p className="text-[10px] text-white/40">{lead.email} • {lead.phone || 'No Phone'}</p>
                    </div>
                    <span className={`px-2 py-0.5 border text-[9px] rounded uppercase font-semibold ${
                      lead.status === 'PENDING'
                        ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
                        : lead.status === 'CONTACTED'
                        ? 'border-blue-500/30 bg-blue-500/5 text-blue-400'
                        : 'border-white/10 bg-white/5 text-white/45'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 line-clamp-2 italic">"{lead.message}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Appointments */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium tracking-wide">Recent Appointments</h2>
            <Link href="/admin/appointments" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentAppointments.length === 0 ? (
            <div className="bg-[#161616]/40 border border-white/5 p-8 text-center rounded-xl">
              <p className="text-xs text-white/40 italic">No recent appointments.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAppointments.map((app: any) => (
                <div key={app.id} className="bg-[#161616] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{app.name}</h4>
                    <p className="text-[10px] text-white/50">{app.property?.name || 'Residence'}</p>
                    <span className="text-[9px] text-white/40">{app.date} slot</span>
                  </div>
                  <span className={`px-2 py-0.5 border text-[9px] rounded uppercase font-semibold ${
                    app.status === 'CONFIRMED' || app.status === 'APPROVED'
                      ? 'border-green-500/30 bg-green-500/5 text-green-400'
                      : app.status === 'PENDING'
                      ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
                      : 'border-white/10 bg-white/5 text-white/45'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
