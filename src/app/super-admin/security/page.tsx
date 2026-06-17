'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  RefreshCw,
  Users,
  Lock,
  Compass,
  Download,
  Calendar,
  Globe,
  FileText,
  Activity,
  ArrowRight,
  UserCheck,
  Zap,
  MapPin,
  Flame,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuperAdminSecuritySOCPage() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [selectedReportType, setSelectedReportType] = useState('threat');
  const [selectedReportFormat, setSelectedReportFormat] = useState('csv');

  const refreshInterval = useRef<any>(null);

  useEffect(() => {
    loadSocData();
    
    // Set 30-second real-time auto-refresh
    refreshInterval.current = setInterval(() => {
      loadSocData(true);
    }, 30000);

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [timeFilter]);

  const loadSocData = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const [statsRes, alertsRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/security/stats?filter=${timeFilter}`),
        fetch('/api/admin/security/alerts'),
        fetch(`/api/admin/security/events?filter=${timeFilter}&limit=10`)
      ]);

      if (statsRes.ok && alertsRes.ok && eventsRes.ok) {
        setStats(await statsRes.json());
        setAlerts(await alertsRes.json());
        setEvents(await eventsRes.json());
      }
    } catch (err) {
      console.error('[SOC Dashboard Load Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleResolveAlert = async (alertId: string, status = 'RESOLVED') => {
    try {
      const res = await fetch('/api/admin/security/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, status })
      });
      if (res.ok) {
        loadSocData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadReport = () => {
    window.open(`/api/admin/security/reports?type=${selectedReportType}&format=${selectedReportFormat}&filter=${timeFilter}`);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8 min-h-screen bg-black text-white p-6">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/5 rounded-xl border border-white/5" />)}
        </div>
        <div className="h-96 bg-white/5 rounded-xl border border-white/5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">
            <Zap size={10} className="animate-pulse" /> Real-time 30s Auto Refresh Active
          </div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2 mt-1">
            <ShieldAlert className="text-red-500" size={28} />
            Enterprise SOC Control Port
          </h1>
          <p className="text-xs text-white/45 mt-1.5">
            Geosecurity impossible travel metrics, device intelligence state registries, and admin behavior intelligence.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Filter Tabs */}
          <div className="flex bg-black border border-white/10 rounded p-0.5">
            {[
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id as any)}
                className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all ${
                  timeFilter === t.id
                    ? 'bg-[#D4AF37] text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadSocData()}
            disabled={refreshing}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Level Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Security Score Widget */}
        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-xl" />
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Platform Security Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-4xl font-extralight text-[#D4AF37]">{stats?.securityScore}</div>
            <div className="text-xs uppercase font-extrabold text-[#D4AF37]/65">{stats?.securityGrade}</div>
          </div>
          <span className="text-[10px] text-white/30 block mt-2">Aggregated risk, alerts, & MFA adoption rates</span>
        </div>

        {/* Failed Logins Counter */}
        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Failed Logins ({timeFilter})</span>
          <div className="text-4xl font-extralight text-orange-400 mt-2">{stats?.failedLogins || 0}</div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.lockedAccounts || 0} accounts locked currently</span>
        </div>

        {/* Active Alerts */}
        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Active Alerts</span>
          <div className="text-4xl font-extralight text-red-500 mt-2">{stats?.activeAlerts || 0}</div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.openCriticalAlerts || 0} critical priority threats pending</span>
        </div>

        {/* Geosecurity Anomaly Counters */}
        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Geosecurity Violations</span>
          <div className="text-4xl font-extralight text-amber-500 mt-2">
            {(stats?.locationChanges || 0) + (stats?.accountTakeovers || 0)}
          </div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.accountTakeovers || 0} ATO high risk patterns detected</span>
        </div>
      </div>

      {/* Middle Row — Attacks, Distribution, Report builder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Replay, CSRF, Rate Limit, ATO widget lists */}
        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">SOC Attack Prevention Counters</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Replay Blocks', val: stats?.replayBlocks, icon: ShieldCheck, color: 'text-green-400' },
              { label: 'CSRF Blocks', val: stats?.csrfBlocks, icon: ShieldCheck, color: 'text-green-400' },
              { label: 'Rate Limits', val: stats?.rateLimitViolations, icon: ShieldCheck, color: 'text-yellow-400' },
              { label: 'Brute Force Attempts', val: stats?.bruteForceAttempts, icon: Flame, color: 'text-red-400' }
            ].map((c, i) => (
              <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">{c.label}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <c.icon size={13} className={c.color} />
                  <span className="text-lg font-mono font-bold text-white">{c.val || 0}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Risk Distribution */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-2">Session Risk Distribution</span>
              <div className="flex items-center gap-2">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((lvl) => {
                  const count = stats?.riskDistribution?.[lvl] || 0;
                  const color = lvl === 'LOW' ? 'bg-green-500' : lvl === 'MEDIUM' ? 'bg-yellow-500' : lvl === 'HIGH' ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div key={lvl} className="flex-1 bg-white/5 border border-white/10 rounded p-2 text-center">
                      <div className="text-xs font-mono font-bold text-white">{count}</div>
                      <div className="text-[8px] uppercase tracking-widest text-white/40 font-semibold mt-1">{lvl}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session Health Overview */}
            <div className="flex flex-col justify-end space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block">Active Sessions Health</span>
              <div className="text-xs flex justify-between border-b border-white/5 pb-1">
                <span className="text-white/45">Total Active sessions:</span>
                <span className="font-mono text-green-400">{stats?.activeSessions || 0}</span>
              </div>
              <div className="text-xs flex justify-between">
                <span className="text-white/45">Suspicious sessions active:</span>
                <span className="font-mono text-red-400">{stats?.suspiciousSessions || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Reporting Widget */}
        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1">
            <Download size={13} className="text-[#D4AF37]" />
            SOC Report Generator
          </h3>
          <p className="text-[10px] text-white/40">
            Export standard security compliance documents or raw activity logging histories instantly.
          </p>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/50 block mb-1">Report Category</label>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="threat">Threat Detection Report</option>
                <option value="risk">Risk Engine Audit Report</option>
                <option value="geosecurity">Impossible Travel & Location Report</option>
                <option value="admin">Administrator Mutations Report</option>
                <option value="incident">Critical Incident Audit Report</option>
                <option value="session">Session Intelligence Lifecycle</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/50 block mb-1">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {['csv', 'excel', 'pdf'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedReportFormat(fmt)}
                    className={`p-2 border rounded text-[10px] uppercase font-mono font-bold tracking-wider transition-colors ${
                      selectedReportFormat === fmt
                        ? 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadReport}
              className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#C29E30] text-black font-bold uppercase tracking-wider text-[10px] rounded transition-colors mt-2"
            >
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Application Security Section */}
      <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="text-sm uppercase tracking-widest font-semibold text-[#D4AF37] flex items-center gap-2">
            <ShieldCheck size={16} />
            Application Security Hardening & Runtime Resilience
          </h3>
          <p className="text-[10px] text-white/45 mt-1">
            Real-time status of XSS, SSTI defenses, ReDoS (regex safety checks), Cloudinary upload protection, and event loop metrics.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">XSS Payloads Blocked</span>
            <div className="text-xl font-bold font-mono text-green-400">{stats?.xssFindings || 0}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">SSTI Attempts Blocked</span>
            <div className="text-xl font-bold font-mono text-green-400">{stats?.sstiFindings || 0}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">Unsafe Regex Patterns</span>
            <div className="text-xl font-bold font-mono text-yellow-400">{stats?.unsafeRegexCount || 0}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">Upload Threats Prevented</span>
            <div className="text-xl font-bold font-mono text-green-400">{stats?.uploadThreats || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-4">
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">Secret Exposure Scan</span>
              <span className="text-xs font-bold text-white mt-1 block">Leaked credentials: {stats?.secretExposureFindings || 0}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
              stats?.secretExposureFindings > 0 ? 'bg-red-950/20 text-red-400 border border-red-500/20' : 'bg-green-950/20 text-green-400 border border-green-500/20'
            }`}>
              {stats?.secretExposureFindings > 0 ? 'FAIL' : 'CLEAN'}
            </span>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">Static Code Audit Status</span>
              <span className="text-xs font-bold text-white mt-1 block">Static check baseline status</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
              stats?.codeAuditStatus === 'PASSED' ? 'bg-green-950/20 text-green-400 border border-green-500/20' : 'bg-yellow-950/20 text-yellow-400 border border-yellow-500/20'
            }`}>
              {stats?.codeAuditStatus || 'UNKNOWN'}
            </span>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold block">Event Loop Lag</span>
              <span className="text-xs font-bold text-white mt-1 block">{stats?.eventLoopLag || 0} ms delay</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
              stats?.runtimeHealth === 'HEALTHY' ? 'bg-green-950/20 text-green-400 border border-green-500/20' : 'bg-red-950/20 text-red-400 border border-red-500/20'
            }`}>
              {stats?.runtimeHealth || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Alerts and Threat Event logs lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Alert Log */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/70">Security Incidents Alerts Log</h3>
              <p className="text-[9px] text-white/40">Warnings flagged for review.</p>
            </div>
            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded font-mono text-white/50">
              {alerts.length} Total Alerts
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">Zero security alerts triggered.</div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border flex justify-between items-center gap-4 transition-all ${
                    alert.status === 'RESOLVED'
                      ? 'border-white/5 bg-black/15 opacity-60'
                      : 'border-red-500/20 bg-red-500/[0.02]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{alert.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                        alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/30 font-mono mt-1">
                      <div>Type: {alert.type || 'Anomaly'}</div>
                      <div>•</div>
                      <div>At: {new Date(alert.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/super-admin/security/timeline?userId=${alert.adminId || ''}`}
                      className="py-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold uppercase rounded"
                    >
                      Timeline
                    </Link>
                    {alert.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="py-1 px-2 bg-green-500/10 hover:bg-green-500/25 border border-green-500/20 hover:border-green-500/40 text-[9px] font-bold text-green-400 rounded uppercase"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Threat Event Feed */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/70">Real-time Telemetry Event Feed</h3>
              <p className="text-[9px] text-white/40">Raw log trace of all security indicators.</p>
            </div>
            <span className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-mono font-bold">
              LIVE FEED
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs">No events logged in this window.</div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="p-3 bg-black/35 border border-white/5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#D4AF37]">{e.title}</span>
                    <span className="text-[8px] bg-white/5 px-2 py-0.5 border border-white/10 rounded font-mono text-white/50">
                      {e.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/70">{e.description}</p>
                  <div className="flex justify-between items-center text-[9px] text-white/30 font-mono">
                    <div>IP: {e.ipAddress} ({e.city}, {e.country})</div>
                    <div>{new Date(e.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
