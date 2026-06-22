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
    upcomingVisits: [],
    upcomingFollowUps: [],
    overdueFollowUps: [],
    recentlyUpdatedLeads: []
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
      case 'LOGIN': return <UsersIcon className="text-blue-600" size={14} />;
      case 'LOGOUT': return <UsersIcon className="text-slate-400" size={14} />;
      case 'PROPERTY_VIEW': return <Compass className="text-purple-600" size={14} />;
      case 'PROPERTY_SAVE': return <Sparkles className="text-amber-600" size={14} />;
      case 'PROPERTY_CREATE': return <Plus className="text-emerald-600" size={14} />;
      case 'PROPERTY_UPDATE': return <FileText className="text-cyan-600" size={14} />;
      case 'PROPERTY_DELETE': return <ShieldAlert className="text-rose-600" size={14} />;
      case 'PROPERTY_PUBLISH': return <CheckCircle className="text-emerald-600" size={14} />;
      case 'PROPERTY_ARCHIVE': return <Clock className="text-yellow-600" size={14} />;
      case 'PROPERTY_RESTORE': return <ArrowRight className="text-emerald-600" size={14} />;
      case 'INQUIRY_CREATE': return <Mail className="text-pink-600" size={14} />;
      case 'APPOINTMENT_CREATE': return <Calendar className="text-teal-600" size={14} />;
      default: return <Activity className="text-slate-400" size={14} />;
    }
  };

  const cardData = [
    { title: 'Total Properties', value: stats.totalProperties, subtitle: 'Total listings in portfolio', icon: <Building className="text-slate-500" size={18} /> },
    { title: 'Published Properties', value: stats.publishedProperties, subtitle: 'Live on user platform', icon: <CheckCircle className="text-emerald-600" size={18} /> },
    { title: 'Draft Properties', value: stats.draftProperties, subtitle: 'Under compilation/review', icon: <FileText className="text-amber-600" size={18} /> },
    { title: 'Archived Properties', value: stats.archivedProperties, subtitle: 'Temporarily deactivated', icon: <Clock className="text-rose-600" size={18} /> },
    { title: 'Total Inquiries', value: stats.totalInquiries, subtitle: 'General concierge leads', icon: <Mail className="text-slate-500" size={18} /> },
    { title: 'Total Appointments', value: stats.totalAppointments, subtitle: 'Site visits scheduled', icon: <Calendar className="text-slate-500" size={18} /> },
    { title: 'Total Users', value: stats.totalUsers, subtitle: 'Registered platform clients', icon: <UsersIcon className="text-slate-500" size={18} /> },
    { title: 'Active Users', value: stats.activeUsers, subtitle: 'Clients with ACTIVE status', icon: <UsersIcon className="text-emerald-600" size={18} /> },
    { title: 'Conversion Rate', value: `${stats.conversionRate}%`, subtitle: 'Visit approval percentage', icon: <TrendingUp className="text-[#0B4C8C]" size={18} /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#F6F8FB]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Loading Dashboard Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 bg-[#F6F8FB] text-[#0F172A]">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Administrative Portal</span>
          <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Operational Overview</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time platform activity and key portfolio statistics.</p>
        </div>
        <Link 
          href="/admin/search"
          className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs uppercase tracking-widest font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all"
        >
          <Search size={14} className="text-[#0B4C8C]" />
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
            className="bg-white border border-slate-200/80 p-6 rounded-[24px] space-y-2 relative overflow-hidden group hover:border-[#0B4C8C]/30 hover:shadow-md transition-all shadow-xs"
          >
            <div className="absolute top-4 right-4 text-slate-300 group-hover:text-[#0B4C8C]/20 transition-colors">
              {card.icon}
            </div>
            <span className="text-slate-400 text-[10px] uppercase tracking-widest block font-extrabold">{card.title}</span>
            <span className="text-3xl font-light text-slate-950 block">{card.value}</span>
            <span className="text-[10px] text-slate-400 block border-t border-slate-100 pt-2">{card.subtitle}</span>
          </motion.div>
        ))}
      </div>

      {/* Primary widgets layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Activity Feed and Quick Actions */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Quick Actions Panel */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Quick Commands</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Link href="/admin/properties?add=true" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <Building size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">Add Property</span>
              </Link>
              <Link href="/admin/search" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <Search size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">Universal Search</span>
              </Link>
              <Link href="/admin/audit-logs" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <Activity size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">Audit Explorer</span>
              </Link>
              <Link href="/admin/users" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <UsersIcon size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">Manage Users</span>
              </Link>
              <Link href="/admin/appointments" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <Calendar size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">View Bookings</span>
              </Link>
              <Link href="/admin/inquiries" className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-center hover:border-[#0B4C8C]/35 transition-all group">
                <Mail size={16} className="mx-auto mb-2 text-[#0B4C8C]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 group-hover:text-slate-900 font-semibold block">Inquiries</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2">
                <Activity size={16} className="text-[#0B4C8C]" />
                <span>Recent Platform Activity</span>
              </h3>
              <Link href="/admin/audit-logs" className="text-[10px] text-[#0B4C8C] uppercase tracking-widest hover:underline flex items-center gap-1 font-bold">
                <span>View Full Log</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentActivities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs">No activity logged yet.</div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {stats.recentActivities.map((log: any) => (
                  <div key={log.id} className="flex gap-4 items-start text-xs border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-800">{log.description}</span>
                        <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
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
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Clock size={16} className="text-[#0B4C8C]" />
              <span>Upcoming Site Visits</span>
            </h3>
            {stats.upcomingVisits.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">No upcoming site visits.</div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingVisits.map((visit: any) => (
                  <div key={visit.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{visit.name}</span>
                      <span className="text-[9px] uppercase font-bold text-[#0B4C8C] px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded">
                        {visit.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{visit.property?.name || 'Property Listing'}</p>
                    <p className="text-[9px] text-slate-400">{visit.date} • {visit.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Registered Clients Widget */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Latest Registered Users</h3>
              <Link href="/admin/users" className="text-[10px] text-[#0B4C8C] uppercase tracking-widest hover:underline flex items-center gap-1 font-bold">
                <span>All Users</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentUsers.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">No clients registered.</div>
            ) : (
              <div className="space-y-3">
                {stats.recentUsers.map((usr: any) => (
                  <div key={usr.id} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-150 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{usr.name || 'Anonymous Client'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{usr.email}</p>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                      usr.status === 'ACTIVE' 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600' 
                        : 'border-rose-200 bg-rose-50 text-rose-600'
                    }`}>
                      {usr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Concierge Inquiries Widget */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Latest Inquiries</h3>
              <Link href="/admin/inquiries" className="text-[10px] text-[#0B4C8C] uppercase tracking-widest hover:underline flex items-center gap-1 font-bold">
                <span>View all</span>
                <ArrowRight size={10} />
              </Link>
            </div>
            {stats.recentInquiries.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">No inquiries submitted.</div>
            ) : (
              <div className="space-y-3">
                {stats.recentInquiries.map((lead: any) => (
                  <div key={lead.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-800">{lead.name}</h4>
                        <p className="text-[9px] text-slate-400">{lead.email}</p>
                      </div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-400">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic line-clamp-2">"{lead.message}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming CRM Follow-Ups Widget */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-[#0B4C8C]" />
              <span>Upcoming CRM Tasks</span>
            </h3>
            {(!stats.upcomingFollowUps || stats.upcomingFollowUps.length === 0) ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">No upcoming follow-ups scheduled.</div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingFollowUps.map((task: any) => (
                  <div key={task.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{task.title}</span>
                      <Link href={`/admin/leads/${task.leadId}`} className="text-[9px] text-[#0B4C8C] hover:underline uppercase tracking-wider font-bold">
                        View Lead
                      </Link>
                    </div>
                    {task.description && <p className="text-[10px] text-slate-500 truncate">{task.description}</p>}
                    <div className="flex justify-between text-[9px] text-slate-400 border-t border-slate-100 pt-1.5 mt-1.5">
                      <span>Lead: {task.lead?.name}</span>
                      <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue CRM Follow-Ups Widget */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Clock size={16} className="text-rose-500 animate-pulse" />
              <span className="text-rose-600">Overdue Tasks Alert</span>
            </h3>
            {(!stats.overdueFollowUps || stats.overdueFollowUps.length === 0) ? (
              <div className="p-4 text-center text-emerald-600/80 italic text-xs border border-emerald-100 bg-emerald-50 rounded-xl">All tasks completed or up to date!</div>
            ) : (
              <div className="space-y-3">
                {stats.overdueFollowUps.map((task: any) => (
                  <div key={task.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-rose-800">{task.title}</span>
                      <Link href={`/admin/leads/${task.leadId}`} className="text-[9px] text-rose-600 hover:underline uppercase tracking-widest font-bold">
                        Resolve
                      </Link>
                    </div>
                    <p className="text-[10px] text-rose-700/60 truncate">{task.lead?.name || 'Inquiry'}</p>
                    <p className="text-[9px] text-rose-600">Overdue since: {new Date(task.dueDate).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recently Updated Leads Widget */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Activity size={16} className="text-[#0B4C8C]" />
              <span>CRM Lead Pipeline Feed</span>
            </h3>
            {(!stats.recentlyUpdatedLeads || stats.recentlyUpdatedLeads.length === 0) ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">No active pipeline leads.</div>
            ) : (
              <div className="space-y-3">
                {stats.recentlyUpdatedLeads.map((lead: any) => (
                  <div key={lead.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                    <div className="flex justify-between text-xs items-center">
                      <Link href={`/admin/leads/${lead.id}`} className="font-medium text-slate-800 hover:text-[#0B4C8C] transition-colors">
                        {lead.name}
                      </Link>
                      <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${
                        lead.status === 'WON' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        lead.status === 'LOST' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        lead.status === 'NEGOTIATION' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Owner: {lead.assignedTo ? (lead.assignedTo.name || lead.assignedTo.email) : 'Unassigned'}</span>
                      <span>Priority: {lead.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
