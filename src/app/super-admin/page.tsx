'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Users,
  Lock,
  Globe,
  Activity,
  Flame,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Terminal
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    loadDashboardData();
  }, [timeFilter]);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      const [statsRes, alertsRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/security/stats?filter=${timeFilter}`),
        fetch('/api/admin/security/alerts'),
        fetch(`/api/admin/security/events?filter=${timeFilter}&limit=20`)
      ]);

      if (statsRes.ok && alertsRes.ok && eventsRes.ok) {
        const stats = await statsRes.json();
        const alerts = await alertsRes.json();
        const eventsData = await eventsRes.json();
        setData({ stats, alerts, events: eventsData.events || eventsData });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl border border-white/5" />)}
        </div>
        <div className="h-96 bg-white/5 rounded-xl border border-white/5" />
      </div>
    );
  }

  const { stats, alerts, events } = data;

  // Filters for GeoSecurity and Behavior Analytics feeds
  const geoEvents = events.filter((e: any) => e.eventType === 'IMPOSSIBLE_TRAVEL' || e.eventType === 'LOCATION_ANOMALY');
  const behaviorEvents = events.filter((e: any) => e.eventType === 'BEHAVIORAL_ANOMALY');

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <Compass className="text-[#D4AF37] animate-pulse" size={28} />
            Super Admin Command Center
          </h1>
          <p className="text-xs text-white/45 mt-1.5">
            Executive control center for geosecurity feeds, behavior analytics tracking, and administrative risk management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/security"
            className="py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] hover:text-[#F5D67B] transition-colors"
          >
            Launch Security SOC
          </Link>
          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="p-2.5 bg-[#161616] hover:bg-white/5 border border-white/10 rounded text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Security Scorecard row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Security Score', val: `${stats.securityScore}%`, desc: `Grade: ${stats.securityGrade}` },
          { label: 'Open Incidents', val: stats.activeAlerts, desc: `${stats.openCriticalAlerts} Critical Priority` },
          { label: 'MFA Adoption', val: `${stats.mfaAdoption}%`, desc: 'Admin accounts covered' },
          { label: 'Active Sessions', val: stats.activeSessions, desc: `${stats.suspiciousSessions} suspicious session flags` }
        ].map((c, i) => (
          <div key={i} className="bg-[#121212] border border-white/5 p-4 rounded-xl space-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-lg" />
            <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold block">{c.label}</span>
            <div className="text-2xl font-semibold text-[#D4AF37] tracking-tight truncate">{c.val}</div>
            <span className="text-[9px] text-white/30 block mt-0.5">{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat feed and incidents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Admin Risk Rankings */}
          <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <UserCheck size={13} className="text-[#D4AF37]" />
              Staff Admin Trust & Risk Rankings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                    <th className="pb-3 font-semibold">Administrator</th>
                    <th className="pb-3 font-semibold">Clearance Role</th>
                    <th className="pb-3 font-semibold">Trust Index</th>
                    <th className="pb-3 text-right font-semibold">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.adminRiskRankings?.map((adm: any) => (
                    <tr key={adm.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 font-semibold text-white">{adm.name}</td>
                      <td className="py-3 font-mono text-[10px] text-white/50">{adm.role}</td>
                      <td className="py-3 font-mono text-green-400 font-semibold">{adm.trustScore}/100</td>
                      <td className="py-3 text-right font-mono text-red-400 font-semibold">{adm.riskScore}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Threat Feed */}
          <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-red-500 animate-pulse" />
              Real-time Threat & Attack Feed
            </h3>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-xl text-xs text-white/40">
                  Zero active threats recorded.
                </div>
              ) : (
                alerts.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="p-3 bg-black/35 border border-white/5 rounded-xl flex justify-between items-center gap-3">
                    <div>
                      <span className="text-xs font-semibold text-white block">{a.description}</span>
                      <span className="text-[9px] text-white/30 font-mono mt-0.5 block">
                        Source: {a.type} | At: {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                      a.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {a.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Side Panel: Geosecurity feed & Behavioral Analytics */}
        <div className="space-y-6">
          {/* GeoSecurity Feed */}
          <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <Globe size={13} className="text-blue-400" />
              GeoSecurity Anomaly Feed
            </h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {geoEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-white/30">Zero geo anomalies flagged.</div>
              ) : (
                geoEvents.map((e: any) => (
                  <div key={e.id} className="p-2.5 bg-black/25 border border-white/5 rounded-lg space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono text-white/40">
                      <span>{e.eventType}</span>
                      <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-white/80">{e.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Behavior Analytics Feed */}
          <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <Activity size={13} className="text-yellow-500" />
              Behavior Analytics Feed
            </h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {behaviorEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-white/30">No behavioral anomalies found.</div>
              ) : (
                behaviorEvents.map((e: any) => (
                  <div key={e.id} className="p-2.5 bg-black/25 border border-white/5 rounded-lg space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono text-white/40">
                      <span>BEHAVIOR CHECK</span>
                      <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-white/80">{e.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
