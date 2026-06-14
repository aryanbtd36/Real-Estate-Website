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
  FileText,
  Activity,
  Plus,
  Search,
  Clock,
  Compass,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>({
    totalProperties: 0,
    publishedProperties: 0,
    draftProperties: 0,
    archivedProperties: 0,
    totalInquiries: 0,
    totalAppointments: 0,
    totalUsers: 0,
    activeUsers: 0,
    conversionRate: 0,
    recentProperties: [],
    recentInquiries: [],
    recentAppointments: [],
    recentUsers: [],
    recentActivities: [],
    upcomingVisits: []
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

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <UsersIcon className="text-blue-400" size={14} />;
      case 'LOGOUT': return <UsersIcon className="text-white/40" size={14} />;
      case 'PROPERTY_VIEW': return <Compass className="text-purple-400" size={14} />;
      case 'PROPERTY_SAVE': return <Sparkles className="text-amber-400" size={14} />;
      case 'PROPERTY_CREATE': return <Plus className="text-green-400" size={14} />;
      case 'PROPERTY_UPDATE': return <FileText className="text-cyan-400" size={14} />;
      case 'PROPERTY_DELETE': return <ShieldAlert className="text-red-400" size={14} />;
      case 'PROPERTY_PUBLISH': return <CheckCircle className="text-green-500" size={14} />;
      case 'PROPERTY_ARCHIVE': return <Clock className="text-yellow-500" size={14} />;
      case 'PROPERTY_RESTORE': return <ArrowRight className="text-green-400" size={14} />;
      case 'INQUIRY_CREATE': return <Mail className="text-pink-400" size={14} />;
      case 'APPOINTMENT_CREATE': return <Calendar className="text-teal-400" size={14} />;
      default: return <Activity className="text-white/50" size={14} />;
    }
  };

  const cardData = [
    { title: 'Total Properties', value: stats.totalProperties, subtitle: 'Total listings in portfolio', icon: <Building size={18} /> },
    { title: 'Published Properties', value: stats.publishedProperties, subtitle: 'Live on user platform', icon: <CheckCircle className="text-green-400" size={18} /> },
    { title: 'Draft Properties', value: stats.draftProperties, subtitle: 'Under compilation/review', icon: <FileText className="text-yellow-400" size={18} /> },
    { title: 'Archived Properties', value: stats.archivedProperties, subtitle: 'Temporarily deactivated', icon: <Clock className="text-red-400" size={18} /> },
    { title: 'Total Inquiries', value: stats.totalInquiries, subtitle: 'General concierge leads', icon: <Mail size={18} /> },
    { title: 'Total Appointments', value: stats.totalAppointments, subtitle: 'Site visits scheduled', icon: <Calendar size={18} /> },
    { title: 'Total Users', value: stats.totalUsers, subtitle: 'Registered platform clients', icon: <UsersIcon size={18} /> },
    { title: 'Active Users', value: stats.activeUsers, subtitle: 'Clients with ACTIVE status', icon: <UsersIcon className="text-green-400" size={18} /> },
    { title: 'Conversion Rate', value: `${stats.conversionRate}%`, subtitle: 'Visit approval percentage', icon: <TrendingUp className="text-[#D4AF37]" size={18} /> },
  ];

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
    <div className="space-y-8 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Administrative Portal</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Operational Overview</h1>
          <p className="text-xs text-white/50 mt-1">Real-time platform activity and key portfolio statistics.</p>
        </div>
        <Link 
          href="/admin/search"
          className="px-4 py-2 bg-[#1E1E1E] hover:bg-[#252525] border border-white/5 hover:border-white/10 text-white text-xs uppercase tracking-widest font-semibold rounded flex items-center gap-2 transition-all"
        >
          <Search size={14} className="text-[#D4AF37]" />
          <span>Global Search</span>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cardData.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2 relative overflow-hidden group hover:border-[#D4AF37]/25 transition-all"
          >
            <div className="absolute top-4 right-4 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors">
              {card.icon}
            </div>
            <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">{card.title}</span>
            <span className="text-3xl font-light text-[#D4AF37] block">{card.value}</span>
            <span className="text-[10px] text-white/40 block border-t border-white/5 pt-2">{card.subtitle}</span>
          </motion.div>
        ))}
      </div>

      {/* Primary widgets layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Activity Feed and Quick Actions */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Quick Actions Panel */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 border-b border-white/5 pb-2">Quick Commands</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Link href="/admin/properties?add=true" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <Building size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">Add Property</span>
              </Link>
              <Link href="/admin/search" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <Search size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">Universal Search</span>
              </Link>
              <Link href="/admin/audit-logs" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <Activity size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">Audit Explorer</span>
              </Link>
              <Link href="/admin/users" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <UsersIcon size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">Manage Users</span>
              </Link>
              <Link href="/admin/appointments" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <Calendar size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">View Bookings</span>
              </Link>
              <Link href="/admin/inquiries" className="p-3 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded-lg text-center hover:border-[#D4AF37]/35 transition-colors group">
                <Mail size={16} className="mx-auto mb-2 text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 group-hover:text-white block">Inquiries</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 flex items-center gap-2">
                <Activity size={16} className="text-[#D4AF37]" />
                <span>Recent Platform Activity</span>
              </h3>
              <Link href="/admin/audit-logs" className="text-[10px] text-[#D4AF37] uppercase tracking-wider hover:underline flex items-center gap-1">
                <span>View Full Log</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentActivities.length === 0 ? (
              <div className="p-8 text-center text-white/40 italic text-xs">No activity logged yet.</div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {stats.recentActivities.map((log: any) => (
                  <div key={log.id} className="flex gap-4 items-start text-xs border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="p-2 bg-[#0A0A0A] border border-white/5 rounded">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-white/90">{log.description}</span>
                        <span className="text-[10px] text-white/40">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-white/50">
                        Actor: {log.actor ? `${log.actor.name} (${log.actor.email})` : 'System Daemon'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Other Widgets */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Upcoming Visits Widget */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 border-b border-white/5 pb-2 flex items-center gap-2">
              <Clock size={16} className="text-[#D4AF37]" />
              <span>Upcoming Site Visits</span>
            </h3>
            {stats.upcomingVisits.length === 0 ? (
              <div className="p-4 text-center text-white/40 italic text-xs">No upcoming site visits.</div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingVisits.map((visit: any) => (
                  <div key={visit.id} className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-white">{visit.name}</span>
                      <span className="text-[9px] uppercase font-bold text-[#D4AF37] px-1.5 py-0.5 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded">
                        {visit.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 truncate">{visit.property?.name || 'Property Listing'}</p>
                    <p className="text-[9px] text-white/40">{visit.date} • {visit.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Registered Clients Widget */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Latest Registered Users</h3>
              <Link href="/admin/users" className="text-[10px] text-[#D4AF37] uppercase tracking-wider hover:underline flex items-center gap-1">
                <span>All Users</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentUsers.length === 0 ? (
              <div className="p-4 text-center text-white/40 italic text-xs">No clients registered.</div>
            ) : (
              <div className="space-y-3">
                {stats.recentUsers.map((usr: any) => (
                  <div key={usr.id} className="flex justify-between items-center p-2 bg-[#0A0A0A] border border-white/5 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/90 truncate">{usr.name || 'Anonymous Client'}</p>
                      <p className="text-[10px] text-white/40 truncate">{usr.email}</p>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                      usr.status === 'ACTIVE' 
                        ? 'border-green-500/25 bg-green-500/5 text-green-400' 
                        : 'border-red-500/25 bg-red-500/5 text-red-400'
                    }`}>
                      {usr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Concierge Inquiries Widget */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Latest Inquiries</h3>
              <Link href="/admin/inquiries" className="text-[10px] text-[#D4AF37] uppercase tracking-wider hover:underline flex items-center gap-1">
                <span>View all</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentInquiries.length === 0 ? (
              <div className="p-4 text-center text-white/40 italic text-xs">No inquiries submitted.</div>
            ) : (
              <div className="space-y-3">
                {stats.recentInquiries.map((lead: any) => (
                  <div key={lead.id} className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-semibold text-white">{lead.name}</h4>
                        <p className="text-[9px] text-white/40">{lead.email}</p>
                      </div>
                      <span className="text-[8px] uppercase tracking-wider text-white/30">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 italic line-clamp-2">"{lead.message}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Reminders Widget (CRM placeholder) */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4 relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 text-white/5 group-hover:scale-110 transition-transform duration-500">
              <Sparkles size={120} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 border-b border-white/5 pb-2">CRM Reminders</h3>
            <div className="p-4 bg-[#0A0A0A]/50 border border-dashed border-white/10 rounded-lg text-center space-y-2">
              <Sparkles className="mx-auto text-[#D4AF37]" size={20} />
              <p className="text-[11px] text-white/70">Intelligence Follow-up Scheduler</p>
              <p className="text-[9px] text-white/40 uppercase tracking-widest">Integrating in Wave 2</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
