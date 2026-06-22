'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  TrendingDown,
  Building,
  Users,
  Calendar,
  Mail,
  Clock,
  Activity,
  IndianRupee,
  Compass,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Award,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  ChevronRight,
  BarChart2,
  PieChart,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIndianRealEstatePrice, formatCurrency } from '@/lib/currency';

// Load Leaflet Map dynamically
const AnalyticsMap = dynamic(() => import('@/components/analytics-map'), { ssr: false });

export default function AdminAnalyticsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Active Tab selection
  const [activeTab, setActiveTab] = useState<'executive' | 'crm' | 'properties' | 'operations' | 'geography' | 'revenue'>('executive');
  
  // State for all analytics datasets
  const [loading, setLoading] = useState(true);
  const [executive, setExecutive] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [properties, setProperties] = useState<any>(null);
  const [appointments, setAppointments] = useState<any>(null);
  const [users, setUsers] = useState<any>(null);
  const [followups, setFollowups] = useState<any>(null);
  const [communications, setCommunications] = useState<any>(null);
  const [geography, setGeography] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [forecasting, setForecasting] = useState<any>(null);

  // Selected sub-map view
  const [mapType, setMapType] = useState<'demand' | 'interest'>('demand');

  // Load all reports data
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        resExec,
        resLeads,
        resProps,
        resAppts,
        resUsers,
        resFollows,
        resComms,
        resGeog,
        resRev,
        resFore
      ] = await Promise.all([
        fetch('/api/admin/analytics/executive'),
        fetch('/api/admin/analytics/leads'),
        fetch('/api/admin/analytics/properties'),
        fetch('/api/admin/analytics/appointments'),
        fetch('/api/admin/analytics/users'),
        fetch('/api/admin/analytics/followups'),
        fetch('/api/admin/analytics/communications'),
        fetch('/api/admin/analytics/geography'),
        fetch('/api/admin/analytics/revenue'),
        fetch('/api/admin/analytics/forecasting')
      ]);

      if (resExec.ok) setExecutive(await resExec.json());
      if (resLeads.ok) setLeads(await resLeads.json());
      if (resProps.ok) setProperties(await resProps.json());
      if (resAppts.ok) setAppointments(await resAppts.json());
      if (resUsers.ok) setUsers(await resUsers.json());
      if (resFollows.ok) setFollowups(await resFollows.json());
      if (resComms.ok) setCommunications(await resComms.json());
      if (resGeog.ok) setGeography(await resGeog.json());
      if (resRev.ok) setRevenue(await resRev.json());
      if (resFore.ok) setForecasting(await resFore.json());

    } catch (err) {
      console.error('Failed to fetch BI analytics datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      console.log(`[PAGE DIAGNOSTIC] Path: /admin/analytics, Status: unauthenticated`);
      router.push('/login');
    } else if (sessionStatus === 'authenticated') {
      const role = (session?.user as any)?.role;
      const isAuthorized = role === 'ADMIN' || role === 'SUPER_ADMIN';
      console.log(`[PAGE DIAGNOSTIC] Path: /admin/analytics, Role: ${role}, Authorized: ${isAuthorized}`);
      if (!isAuthorized) {
        router.push('/');
      } else {
        loadAllData();
      }
    }
  }, [sessionStatus, session]);

  if (loading || !executive) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#F6F8FB]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Generating Real-Time BI Audit...</p>
        </div>
      </div>
    );
  }

  // Quick statistics destructuring
  const health = executive.healthScore;

  const tabs = [
    { id: 'executive', name: 'Executive Suite', icon: Award },
    { id: 'crm', name: 'Lead & CRM Funnel', icon: Users },
    { id: 'properties', name: 'Property Insights', icon: Building },
    { id: 'operations', name: 'Operations & Tasks', icon: Calendar },
    { id: 'geography', name: 'Geographic Density', icon: Compass },
    { id: 'revenue', name: 'Revenue & Forecasting (INR)', icon: IndianRupee },
  ] as const;

  return (
    <div className="space-y-8 pb-12 bg-[#F6F8FB] text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">BI Executive Hub</span>
          <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Analytics & Business Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">Commercial-grade real estate pipeline metrics and forecast engines.</p>
        </div>
        <button
          onClick={loadAllData}
          className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#0B4C8C] text-xs uppercase tracking-widest font-bold rounded-lg shadow-xs transition-all"
        >
          Refresh Snapshot
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-4 text-xs font-semibold uppercase tracking-widest border-b-2 transition-all ${
                active
                  ? 'border-[#0B4C8C] text-[#0B4C8C] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              <Icon size={14} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Views */}
      <div className="min-h-[50vh]">
        <AnimatePresence mode="wait">
          {activeTab === 'executive' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Executive summary cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Health Score Gauge */}
                <div className="lg:col-span-4 bg-white border border-slate-200 p-6 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-[#0B4C8C]/30 hover:shadow-md transition-all rounded-[24px] shadow-xs">
                  <div className="space-y-1 w-full text-left">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">Aura Health Score</span>
                    <h3 className="text-sm font-semibold uppercase text-slate-800">Business Performance</h3>
                  </div>
                  
                  {/* Gauge Drawing */}
                  <div className="relative w-44 h-44 my-4 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="rgba(15,23,42,0.03)" strokeWidth="8" fill="transparent" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#0B4C8C"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * health.score) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-4xl font-light text-[#0B4C8C]">{health.score}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 border ${
                        health.grade === 'EXCELLENT' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        health.grade === 'HEALTHY' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {health.grade}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic px-4">Weighted calculations across CRM stages, retention metrics, and activity logs.</p>
                </div>

                {/* Score breakdown metrics list */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Health Metrics Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {[
                      { name: 'Lead Conversion Rate', val: health.breakdown.leadConversionRate, w: '25%' },
                      { name: 'Appointment Completion Rate', val: health.breakdown.appointmentCompletionRate, w: '20%' },
                      { name: 'Follow-Up Task Completion', val: health.breakdown.followUpCompletionRate, w: '15%' },
                      { name: 'Property Interactive Engagement', val: health.breakdown.propertyEngagement, w: '15%' },
                      { name: 'Weekly Growth Speed', val: health.breakdown.growthRateScore, w: '15%' },
                      { name: 'Active User Retention Frequency', val: health.breakdown.userActivityRate, w: '10%' },
                    ].map((metric) => (
                      <div key={metric.name} className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-650">{metric.name}</span>
                          <span className="text-[#0B4C8C]">{metric.val}% <span className="text-[9px] text-slate-400 font-normal">(Weight: {metric.w})</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 border border-slate-200/50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-[#0B4C8C]" style={{ width: `${metric.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPI Cards Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: 'Portfolio Listings',
                    metrics: [
                      { label: 'Total Residences', val: executive.properties.total },
                      { label: 'Published / Live', val: executive.properties.published },
                      { label: 'Archived Storage', val: executive.properties.archived }
                    ],
                    icon: Building,
                    growth: executive.growth.properties.monthly
                  },
                  {
                    title: 'CRM Lead Pipeline',
                    metrics: [
                      { label: 'Total Inquiries', val: executive.leads.total },
                      { label: 'Active Pipeline', val: executive.leads.active },
                      { label: 'Closed & Won', val: executive.leads.won }
                    ],
                    icon: Users,
                    growth: executive.growth.leads.monthly
                  },
                  {
                    title: 'Visit Scheduling',
                    metrics: [
                      { label: 'Total Bookings', val: executive.appointments.total },
                      { label: 'Upcoming Visits', val: executive.appointments.upcoming },
                      { label: 'Completed Visits', val: executive.appointments.completed }
                    ],
                    icon: Calendar,
                    growth: null
                  },
                  {
                    title: 'Client Database',
                    metrics: [
                      { label: 'Registered Clients', val: executive.users.total },
                      { label: 'Active Users', val: executive.users.active },
                      { label: 'Returning Users', val: executive.users.returning }
                    ],
                    icon: Award,
                    growth: executive.growth.users.monthly
                  }
                ].map((card, idx) => {
                  const CardIcon = card.icon;
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-[24px] p-6 relative overflow-hidden group hover:border-[#0B4C8C]/30 hover:shadow-md transition-all shadow-xs space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{card.title}</h4>
                        <CardIcon size={16} className="text-[#0B4C8C]" />
                      </div>
                      <div className="space-y-2">
                        {card.metrics.map((m) => (
                          <div key={m.label} className="flex justify-between text-xs items-center">
                            <span className="text-slate-500">{m.label}</span>
                            <span className="font-semibold text-slate-800">{m.val}</span>
                          </div>
                        ))}
                      </div>
                      {card.growth !== null && (
                        <div className="border-t border-slate-100 pt-2 flex items-center gap-1.5 text-[10px]">
                          {card.growth >= 0 ? (
                            <>
                              <TrendingUp size={12} className="text-emerald-600" />
                              <span className="text-emerald-600 font-bold">+{card.growth}%</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown size={12} className="text-rose-600" />
                              <span className="text-rose-600 font-bold">{card.growth}%</span>
                            </>
                          )}
                          <span className="text-slate-400">Growth Month-on-Month</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Growth Metrics panel */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Periodic Growth Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Leads Acquisition', g: executive.growth.leads },
                    { label: 'Users Registrations', g: executive.growth.users },
                    { label: 'Property Listings', g: executive.growth.properties },
                  ].map((row) => (
                    <div key={row.label} className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
                      <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">{row.label}</span>
                      <div className="space-y-1 text-xs">
                        {[
                          { key: 'Daily', val: row.g.daily },
                          { key: 'Weekly', val: row.g.weekly },
                          { key: 'Monthly', val: row.g.monthly },
                        ].map((item) => (
                          <div key={item.key} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                            <span className="text-slate-500">{item.key}</span>
                            <span className={`font-semibold ${item.val >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.val >= 0 ? `+${item.val}%` : `${item.val}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'crm' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Interactive Funnel Visualization */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">CRM Sales Funnel (Conversion & Drop-off)</h3>
                
                {/* SVG Visual Funnel blocks */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                  <div className="lg:col-span-8 flex flex-col space-y-2">
                    {leads?.conversions?.stages?.map((item: any, idx: number) => {
                      const precedingWidth = idx === 0 ? 100 : leads.conversions.stages[idx - 1].stageConversionRate;
                      const currentWidth = 40 + (item.conversionRate * 0.6); // scale between 40% and 100% width
                      return (
                        <div key={item.stage} className="flex items-center space-x-4">
                          <div className="w-32 text-right text-xs uppercase tracking-wider font-semibold text-slate-500 truncate" title={item.label}>
                            {item.label}
                          </div>
                          <div className="flex-1">
                            <div className="h-10 bg-slate-50 border border-slate-200 rounded relative overflow-hidden group hover:border-[#0B4C8C]/30 transition-colors">
                              <div
                                className="h-full bg-gradient-to-r from-blue-100 to-blue-200/50 flex items-center px-4 justify-between"
                                style={{ width: `${currentWidth}%` }}
                              >
                                <span className="text-[10px] font-bold text-[#0B4C8C] uppercase tracking-wider">{item.count} Leads</span>
                                <span className="text-[10px] text-slate-700 font-mono font-bold">{item.conversionRate}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="w-24 text-xs text-slate-400">
                            {idx > 0 && (
                              <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-2 py-0.5 border border-rose-200 rounded">
                                -{item.dropOffRate.toFixed(1)}% Drop
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
                    <span className="text-[#0B4C8C] uppercase tracking-widest font-extrabold block border-b border-slate-200 pb-1">Funnel Summary</span>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Active pipeline:</span>
                        <span className="font-semibold text-slate-800">{leads?.conversions?.summary?.totalActiveLeads}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Global Win Ratio:</span>
                        <span className="font-semibold text-emerald-600">+{leads?.conversions?.summary?.winRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Global Loss Ratio:</span>
                        <span className="font-semibold text-rose-600">{leads?.conversions?.summary?.lostRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead source performance & priority distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Source Table */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Lead Source Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px] font-extrabold">
                          <th className="py-2.5">Source Channel</th>
                          <th className="py-2.5 text-center">Total</th>
                          <th className="py-2.5 text-center">Won</th>
                          <th className="py-2.5 text-center">Win Rate</th>
                          <th className="py-2.5 text-right">Avg Deal Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads?.sourcePerformance?.map((row: any) => (
                          <tr key={row.source} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="py-3 font-semibold text-slate-700 uppercase tracking-widest text-[10px]">{row.source.replace('_', ' ')}</td>
                            <td className="py-3 text-center font-mono text-slate-600">{row.totalLeads}</td>
                            <td className="py-3 text-center font-mono text-slate-600">{row.convertedLeads}</td>
                            <td className="py-3 text-center font-semibold font-mono text-[#0B4C8C]">{row.conversionRate}%</td>
                            <td className="py-3 text-right font-mono text-slate-400">{(row.averageDealTimeHours / 24).toFixed(1)} Days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Priority distribution */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">CRM Priority Distributions</h3>
                    <div className="space-y-4 pt-4">
                      {leads?.priorityPerformance?.map((row: any) => (
                        <div key={row.priority} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-500 uppercase tracking-widest text-[9px]">{row.priority} Priority</span>
                            <span className="text-slate-600">{row.totalLeads} Leads <span className="text-[#0B4C8C] font-mono font-semibold ml-2">({row.conversionRate}% Won)</span></span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${
                              row.priority === 'URGENT' ? 'bg-rose-500' :
                              row.priority === 'HIGH' ? 'bg-amber-500' :
                              row.priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`} style={{ width: `${(row.totalLeads / (leads.sourcePerformance.reduce((a: any, b: any) => a + b.totalLeads, 0) || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Distribution */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Sales Rep Assignment Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {leads?.assignmentPerformance?.map((rep: any) => (
                    <div key={rep.adminId} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 hover:border-[#0B4C8C]/35 transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-slate-700 truncate block max-w-[120px]">{rep.adminName}</span>
                        <span className="text-[10px] font-mono font-bold text-[#0B4C8C] bg-blue-50 px-2 py-0.5 border border-blue-100 rounded">
                          {rep.conversionRate}% Won
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="bg-white border border-slate-100 p-1.5 rounded">
                          <span className="text-slate-400 block">Assigned</span>
                          <span className="font-bold text-slate-700 font-mono">{rep.assignedLeads}</span>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100 p-1.5 rounded">
                          <span className="text-emerald-600 block font-semibold">Won</span>
                          <span className="font-bold text-emerald-700 font-mono">{rep.wonLeads}</span>
                        </div>
                        <div className="bg-rose-50/50 border border-rose-100 p-1.5 rounded">
                          <span className="text-rose-600 block font-semibold">Lost</span>
                          <span className="font-bold text-rose-700 font-mono">{rep.lostLeads}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'properties' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Top Performing properties */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Top Performing Listings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Most viewed */}
                  <div className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0B4C8C]">Most Viewed Listings</span>
                    <div className="space-y-2 text-xs">
                      {properties?.topPerforming?.mostViewed?.map((item: any) => (
                        <div key={item.propertyId} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                          <span className="text-slate-700 font-light truncate max-w-[200px]">{item.propertyName}</span>
                          <span className="font-mono text-slate-600 font-bold">{item.views} views</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Saved */}
                  <div className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0B4C8C]">Most Saved Listings</span>
                    <div className="space-y-2 text-xs">
                      {properties?.topPerforming?.mostSaved?.map((item: any) => (
                        <div key={item.propertyId} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                          <span className="text-slate-700 font-light truncate max-w-[200px]">{item.propertyName}</span>
                          <span className="font-mono text-slate-600 font-bold">{item.saves} saves</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Inquired */}
                  <div className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0B4C8C]">Most Inquired Listings</span>
                    <div className="space-y-2 text-xs">
                      {properties?.topPerforming?.mostInquired?.map((item: any) => (
                        <div key={item.propertyId} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                          <span className="text-slate-700 font-light truncate max-w-[200px]">{item.propertyName}</span>
                          <span className="font-mono text-slate-600 font-bold">{item.inquiries} inquiries</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Scheduled */}
                  <div className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0B4C8C]">Most Scheduled Visits</span>
                    <div className="space-y-2 text-xs">
                      {properties?.topPerforming?.mostScheduled?.map((item: any) => (
                        <div key={item.propertyId} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                          <span className="text-slate-700 font-light truncate max-w-[200px]">{item.propertyName}</span>
                          <span className="font-mono text-slate-600 font-bold">{item.appointments} bookings</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Property conversion funnel */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Listing Conversion Funnel</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-2">
                  {properties?.conversionFunnel?.map((item: any, idx: number) => (
                    <div key={item.stage} className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2 relative group hover:border-[#0B4C8C]/30 transition-colors">
                      <span className="text-[10px] uppercase font-bold text-slate-400">{item.stage}</span>
                      <h4 className="text-2xl font-light text-[#0B4C8C]">{item.count}</h4>
                      <div className="text-[9px] text-slate-500 space-y-1">
                        <p>Conv: {item.conversionRate}%</p>
                        {idx > 0 && <p className="text-rose-650 font-semibold">Drop: -{item.dropOffRate.toFixed(1)}%</p>}
                      </div>
                      {idx < 4 && (
                        <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-20 text-[#0B4C8C]/40">
                          <ChevronRight size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* General Property List Performance Table */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Listing Performance Index</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px] font-extrabold">
                        <th className="py-2.5">Residence Title</th>
                        <th className="py-2.5 text-center">Views</th>
                        <th className="py-2.5 text-center">Saves</th>
                        <th className="py-2.5 text-center">Inquiries</th>
                        <th className="py-2.5 text-center">Visits</th>
                        <th className="py-2.5 text-right">Deals Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {properties?.performance?.map((row: any) => (
                        <tr key={row.propertyId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="py-3 font-medium text-slate-855">{row.propertyName}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{row.views}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{row.saves}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{row.inquiries}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{row.appointments}</td>
                          <td className="py-3 text-right font-semibold font-mono text-emerald-600">{row.wonDeals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'operations' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Visit booking and follow up aggregates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visit status cards */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Site Visits Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'Scheduled', val: appointments?.overview?.scheduled, color: 'text-[#0B4C8C]' },
                      { key: 'Completed', val: appointments?.overview?.completed, color: 'text-emerald-600' },
                      { key: 'Cancelled', val: appointments?.overview?.cancelled, color: 'text-rose-600' },
                      { key: 'Rescheduled', val: appointments?.overview?.rescheduled, color: 'text-indigo-650' },
                    ].map((st) => (
                      <div key={st.key} className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">{st.key}</span>
                        <span className={`text-3xl font-light ${st.color}`}>{st.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Visit Outcomes breakdown */}
                  <div className="border-t border-slate-150 pt-4 space-y-3">
                    <span className="text-xs font-semibold text-slate-700 block">Visit Outcomes Analytics</span>
                    <div className="grid grid-cols-3 gap-3 text-center text-[10px]">
                      <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                        <span className="text-emerald-700 block font-bold">Converted</span>
                        <span className="text-slate-850 font-mono font-bold text-sm block mt-1">{appointments?.outcomes?.converted}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                        <span className="text-amber-700 block font-bold">Follow-Up Needed</span>
                        <span className="text-slate-855 font-mono font-bold text-sm block mt-1">{appointments?.outcomes?.followUpNeeded}</span>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                        <span className="text-rose-700 block font-bold">Not Interested</span>
                        <span className="text-slate-850 font-mono font-bold text-sm block mt-1">{appointments?.outcomes?.notInterested}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow ups performance */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">CRM Follow-Up Pipeline</h3>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                        <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block">Total Tasks</span>
                        <span className="text-2xl font-light text-slate-800">{followups?.total}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                        <span className="text-[9px] text-emerald-600 block font-bold tracking-wider">Completed</span>
                        <span className="text-2xl font-light text-emerald-600">{followups?.completed}</span>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center">
                        <span className="text-[9px] text-rose-600 block font-bold tracking-wider">Overdue Alerts</span>
                        <span className="text-2xl font-light text-rose-600">{followups?.overdue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-4 space-y-3">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Follow-Up Completion Speed Ratio:</span>
                      <span className="text-[#0B4C8C] font-mono">{followups?.completionRate}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Reminder Sweeper Effectiveness Rate:</span>
                      <span className="text-[#0B4C8C] font-mono">{followups?.reminderEffectiveness}%</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Follow-Up Conversion Success Rate:</span>
                      <span className="text-[#0B4C8C] font-mono">{followups?.successRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Communication log Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Breakdown list */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 lg:col-span-1 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Channel Volume</h3>
                  <div className="space-y-3 pt-2">
                    {[
                      { label: 'Voice Calls', val: communications?.breakdown?.calls, c: 'bg-emerald-500' },
                      { label: 'Emails', val: communications?.breakdown?.emails, c: 'bg-blue-500' },
                      { label: 'WhatsApp Chat', val: communications?.breakdown?.whatsapp, c: 'bg-teal-500' },
                      { label: 'SMS Texts', val: communications?.breakdown?.sms, c: 'bg-amber-500' },
                      { label: 'Scheduled Meetings', val: communications?.breakdown?.meetings, c: 'bg-purple-500' },
                      { label: 'Others', val: communications?.breakdown?.other, c: 'bg-gray-500' },
                    ].map((ch) => (
                      <div key={ch.label} className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${ch.c}`} />
                          <span className="text-slate-600">{ch.label}</span>
                        </div>
                        <span className="font-mono text-slate-700 font-bold">{ch.val} logs</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 flex justify-between">
                    <span>Average per Lead:</span>
                    <span className="text-[#0B4C8C] font-bold font-mono">{communications?.avgInteractionsPerLead} logs</span>
                  </div>
                </div>

                {/* Communication volume trends */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 lg:col-span-2 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Interaction Volume Trends</h3>
                  <div className="h-44 flex items-end justify-between pt-4 gap-2">
                    {communications?.volumeTrends?.map((pt: any) => {
                      const maxCount = Math.max(...communications.volumeTrends.map((t: any) => t.count)) || 1;
                      const pct = (pt.count / maxCount) * 100;
                      return (
                        <div key={pt.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div className="w-full bg-slate-50 border border-slate-200 rounded h-32 relative overflow-hidden flex items-end">
                            <div
                              className="w-full bg-gradient-to-t from-blue-600 to-[#0B4C8C] hover:opacity-85 transition-all rounded-t"
                              style={{ height: `${pct}%` }}
                            />
                            <div className="absolute inset-x-0 top-1 text-[9px] text-center text-slate-700 font-mono font-bold">
                              {pt.count}
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">{pt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'geography' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Map switcher */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800">Interactive Geographic Analytics</h3>
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                    <button
                      onClick={() => setMapType('demand')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                        mapType === 'demand' ? 'bg-[#0B4C8C] text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-705'
                      }`}
                    >
                      Demand Heatmap
                    </button>
                    <button
                      onClick={() => setMapType('interest')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                        mapType === 'interest' ? 'bg-[#0B4C8C] text-white' : 'bg-slate-50 text-slate-505 hover:text-slate-705'
                      }`}
                    >
                      Property Interest
                    </button>
                  </div>
                </div>

                {/* Map frame */}
                <div className="bg-slate-100 border border-slate-250 p-1 rounded-xl">
                  {geography?.demandHeatmap && (
                    <AnalyticsMap
                      points={mapType === 'demand' ? geography.demandHeatmap : geography.interestMap}
                      type={mapType}
                    />
                  )}
                </div>
              </div>

              {/* Demand Rankings lists */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: 'Top Cities ranking', list: geography?.rankings?.cities },
                  { title: 'Top Regions / Areas', list: geography?.rankings?.areas },
                  { title: 'Top Localities', list: geography?.rankings?.localities },
                ].map((col, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-[24px] p-5 space-y-4 shadow-xs">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1">{col.title}</h4>
                    <div className="space-y-3">
                      {col?.list?.slice(0, 5).map((row: any, rIdx: number) => (
                        <div key={row.name} className="flex justify-between items-start text-xs border-b border-slate-100 last:border-0 pb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-750 truncate">{row.name}</p>
                            <p className="text-[9px] text-slate-400 font-normal">Views: {row.views} • Inquiries: {row.inquiries}</p>
                          </div>
                          <span className="font-bold text-[#0B4C8C] font-mono text-[11px]">#{rIdx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'revenue' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Financial pipeline totals cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Revenue Won (INR)', val: revenue?.wonRevenue, c: 'text-emerald-605', desc: 'Closed won deals value' },
                  { label: 'Revenue Pipeline (INR)', val: revenue?.pipelineValue, c: 'text-[#0B4C8C]', desc: 'Active advanced deals value' },
                  { label: 'Potential Revenue (INR)', val: revenue?.potentialRevenue, c: 'text-blue-500', desc: 'All active inquiries value' },
                  { label: 'Revenue Lost (INR)', val: revenue?.lostRevenue, c: 'text-rose-600', desc: 'Closed lost deals value' },
                ].map((card) => (
                  <div key={card.label} className="bg-white border border-slate-205 rounded-[24px] p-6 space-y-2 hover:border-[#0B4C8C]/35 hover:shadow-md shadow-xs transition-all">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">{card.label}</span>
                    <h3 className={`text-2xl font-semibold ${card.c}`}>{formatIndianRealEstatePrice(card.val || 0)}</h3>
                    <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-100">{card.desc}</p>
                  </div>
                ))}
              </div>

              {/* Forecasting Linear Regression widget */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Regression Forecasts (Next-Month Projections)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {[
                    {
                      label: 'Expected Monthly Leads',
                      val: `${forecasting?.leadForecast?.expectedMonthlyLeads} Leads`,
                      trend: forecasting?.leadForecast?.trendDirection,
                      conf: forecasting?.leadForecast?.confidence
                    },
                    {
                      label: 'Expected Monthly Revenue',
                      val: formatIndianRealEstatePrice(forecasting?.revenueForecast?.expectedMonthlyRevenue || 0),
                      trend: forecasting?.revenueForecast?.trendDirection,
                      conf: forecasting?.revenueForecast?.confidence
                    },
                    {
                      label: 'Expected Win Ratio',
                      val: `${forecasting?.conversionForecast?.expectedLeadToWinRatio}% Ratio`,
                      trend: forecasting?.conversionForecast?.trendDirection,
                      conf: forecasting?.conversionForecast?.confidence
                    },
                  ].map((fc, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">{fc.label}</span>
                      <h4 className="text-xl font-semibold text-[#0B4C8C]">{fc.val}</h4>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-150 pt-2 mt-2">
                        <span>Confidence: {fc.conf}%</span>
                        <div className="flex items-center gap-1">
                          <span>Trend:</span>
                          <span className={`font-bold ${fc.trend === 'UP' ? 'text-emerald-600' : fc.trend === 'DOWN' ? 'text-rose-600' : 'text-slate-500'}`}>
                            {fc.trend}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Trends and Averages breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue trends chart (Bar graph) */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Revenue Trends (Monthly Won Split)</h3>
                  <div className="h-44 flex items-end justify-between pt-4 gap-2">
                    {revenue?.trends?.monthly?.map((pt: any) => {
                      const maxRev = Math.max(...revenue.trends.monthly.map((t: any) => t.revenue)) || 1;
                      const pct = (pt.revenue / maxRev) * 100;
                      return (
                        <div key={pt.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div className="w-full bg-slate-50 border border-slate-200 rounded h-32 relative overflow-hidden flex items-end">
                            <div
                              className="w-full bg-gradient-to-t from-blue-600 to-[#0B4C8C] hover:opacity-85 transition-all rounded-t"
                              style={{ height: `${pct}%` }}
                            />
                            <div className="absolute inset-x-0 top-1 text-[9px] text-center text-slate-700 font-mono font-bold">
                              {formatIndianRealEstatePrice(pt.revenue)}
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">{pt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Average deal values table */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Average Deal Value Indexes</h3>
                  <div className="grid grid-cols-2 gap-6 pt-2">
                    {/* Per Source */}
                    <div className="space-y-3">
                      <span className="text-[10px] text-slate-450 uppercase font-bold tracking-widest block border-b border-slate-100 pb-1">Per Source Channel</span>
                      <div className="space-y-2 text-xs">
                        {revenue?.averages?.perSource?.map((row: any) => (
                          <div key={row.category} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                            <span className="text-slate-500 uppercase tracking-widest text-[9px]">{row.category.replace('_', ' ')}</span>
                            <span className="font-bold text-slate-700 font-mono">{formatIndianRealEstatePrice(row.avgValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per Admin */}
                    <div className="space-y-3">
                      <span className="text-[10px] text-[#0B4C8C] uppercase font-bold tracking-widest block border-b border-slate-100 pb-1">Per Sales Admin</span>
                      <div className="space-y-2 text-xs">
                        {revenue?.averages?.perAdmin?.map((row: any) => (
                          <div key={row.category} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                            <span className="text-slate-600 truncate max-w-[90px]">{row.category}</span>
                            <span className="font-bold text-slate-700 font-mono">{formatIndianRealEstatePrice(row.avgValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dashboard Report Access audit log log */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-4 shadow-xs">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-2">Dashboard Report Access Log</h3>
        <p className="text-[10px] text-slate-400">Audit trail verifying BI compilation requests and administrative security monitor events.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-40 overflow-y-auto space-y-3">
          <div className="flex gap-4 items-center text-xs border-b border-slate-150 pb-2 last:border-0 last:pb-0">
            <div className="p-1.5 bg-blue-50 border border-blue-100 rounded text-[#0B4C8C]">
              <Clock size={12} />
            </div>
            <div className="flex-1 flex justify-between">
              <span className="text-slate-700 font-medium">Business Intelligence compiled by {session?.user?.name || session?.user?.email}</span>
              <span className="text-[10px] text-slate-450 font-mono">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
