'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Users,
  Lock,
  Download,
  Globe,
  FileText,
  Activity,
  ArrowRight,
  UserCheck,
  Zap,
  Search,
  ChevronDown,
  Eye,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  TrendingUp,
  BarChart3,
  Wifi
} from 'lucide-react';

const CATEGORY_FILTERS = [
  { id: '', label: 'ALL' },
  { id: 'AUTHENTICATION', label: 'AUTH' },
  { id: 'SESSION', label: 'SESSION' },
  { id: 'ADMIN', label: 'ADMIN' },
  { id: 'SECURITY', label: 'SECURITY' },
  { id: 'GOVERNANCE', label: 'GOVERNANCE' },
  { id: 'COMPLIANCE', label: 'COMPLIANCE' },
  { id: 'SYSTEM', label: 'SYSTEM' },
  { id: 'EXPORT', label: 'EXPORT' },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-500/15 text-red-400 border-red-500/20',
  INVESTIGATING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  RESOLVED: 'bg-green-500/15 text-green-400 border-green-500/20',
  FALSE_POSITIVE: 'bg-white/10 text-white/50 border-white/10',
};

export default function AdminSecuritySOCPage() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsTotalCount, setEventsTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [selectedReportType, setSelectedReportType] = useState('threat');
  const [selectedReportFormat, setSelectedReportFormat] = useState('csv');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('');
  const [eventsOffset, setEventsOffset] = useState(0);
  const [eventSearch, setEventSearch] = useState('');

  const refreshInterval = useRef<any>(null);

  useEffect(() => {
    loadSocData();
    
    // 30-second auto-refresh
    refreshInterval.current = setInterval(() => {
      loadSocData(true);
    }, 30000);

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [timeFilter]);

  useEffect(() => {
    loadEvents();
  }, [categoryFilter, eventsOffset, timeFilter]);

  const loadSocData = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const [statsRes, alertsRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/security/stats?filter=${timeFilter}`),
        fetch(`/api/admin/security/alerts${alertSeverityFilter ? `?severity=${alertSeverityFilter}` : ''}`),
        fetch(`/api/admin/security/events?filter=${timeFilter}&limit=15&offset=${eventsOffset}${categoryFilter ? `&category=${categoryFilter}` : ''}${eventSearch ? `&search=${encodeURIComponent(eventSearch)}` : ''}`)
      ]);

      if (statsRes.ok && alertsRes.ok && eventsRes.ok) {
        setStats(await statsRes.json());
        setAlerts(await alertsRes.json());
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || eventsData);
        setEventsTotalCount(eventsData.totalCount || 0);
      }
    } catch (err) {
      console.error('[Admin SOC Load Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadEvents = async () => {
    try {
      const eventsRes = await fetch(
        `/api/admin/security/events?filter=${timeFilter}&limit=15&offset=${eventsOffset}${categoryFilter ? `&category=${categoryFilter}` : ''}${eventSearch ? `&search=${encodeURIComponent(eventSearch)}` : ''}`
      );
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || eventsData);
        setEventsTotalCount(eventsData.totalCount || 0);
      }
    } catch (err) {
      console.error('[Event Fetch Error]', err);
    }
  };

  const handleAlertAction = async (alertId: string, action: string, extra: any = {}) => {
    try {
      const res = await fetch('/api/admin/security/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action, ...extra })
      });
      if (res.ok) {
        loadSocData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/admin/security/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, status: 'RESOLVED' })
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

  const handleEventSearch = () => {
    setEventsOffset(0);
    loadEvents();
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

  // Compute max bar height for event trend chart
  const maxEventsInHour = Math.max(1, ...(stats?.eventsPerHour || []).map((h: any) => h.count));

  return (
    <div className="bg-[#0A0A0A] text-white p-6 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">
            <Zap size={10} className="animate-pulse" /> SOC Dashboard • Auto Refresh Active
          </div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2 mt-1">
            <ShieldAlert className="text-red-500" size={28} />
            Security Operations Center (SOC)
          </h1>
          <p className="text-xs text-white/45 mt-1.5">
            Real-time session logging, threat telemetry, and administrative operations audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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

          <Link
            href="/admin/security/sessions"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] uppercase font-bold tracking-wider text-white"
          >
            Monitor sessions
          </Link>

          <button
            onClick={() => loadSocData()}
            disabled={refreshing}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Platform Security Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-4xl font-extralight text-[#D4AF37]">{stats?.securityScore}</div>
            <div className="text-xs uppercase font-extrabold text-[#D4AF37]/65">{stats?.securityGrade}</div>
          </div>
          <span className="text-[10px] text-white/30 block mt-2">Overall platform configuration health</span>
        </div>

        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Failed Logins ({timeFilter})</span>
          <div className="text-4xl font-extralight text-orange-400 mt-2">{stats?.failedLogins || 0}</div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.lockedAccounts || 0} locked accounts</span>
        </div>

        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Active Alerts</span>
          <div className="text-4xl font-extralight text-red-500 mt-2">{stats?.activeAlerts || 0}</div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.openCriticalAlerts || 0} critical priority threats</span>
        </div>

        <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block">Geosecurity Violations</span>
          <div className="text-4xl font-extralight text-amber-500 mt-2">
            {(stats?.locationChanges || 0) + (stats?.accountTakeovers || 0)}
          </div>
          <span className="text-[10px] text-white/30 block mt-2">{stats?.accountTakeovers || 0} ATO anomalies flagged</span>
        </div>
      </div>

      {/* SOC Intelligence Widgets (Wave 7C.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Per Hour Trend */}
        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
            <BarChart3 size={13} className="text-[#D4AF37]" />
            Event Activity Trend (Last 24H)
          </h3>
          <div className="flex items-end gap-[3px] h-[100px]">
            {(stats?.eventsPerHour || []).map((h: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-[#D4AF37]/30 hover:bg-[#D4AF37]/60 rounded-t transition-all min-h-[2px]"
                  style={{ height: `${Math.max(2, (h.count / maxEventsInHour) * 90)}px` }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-black border border-white/10 text-[8px] px-1.5 py-0.5 rounded text-white/80 whitespace-nowrap z-10 transition-opacity">
                  {h.hour}: {h.count} events
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-white/25 font-mono">
            <span>{(stats?.eventsPerHour || [])[0]?.hour || '—'}</span>
            <span>NOW</span>
          </div>
        </div>

        {/* Top Event Types + Top IPs + Resolution Stats */}
        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5 mb-3">
              <TrendingUp size={13} className="text-[#D4AF37]" />
              SOC Intelligence
            </h3>

            {/* Top Event Types */}
            <div className="space-y-1.5 mb-4">
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Top Event Types</span>
              {(stats?.topEventTypes || []).map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[10px]">
                  <span className="text-white/70 truncate mr-2">{t.eventType}</span>
                  <span className="font-mono text-[#D4AF37] font-bold shrink-0">{t.count}</span>
                </div>
              ))}
              {(!stats?.topEventTypes || stats.topEventTypes.length === 0) && (
                <div className="text-[10px] text-white/25">No events in this window.</div>
              )}
            </div>

            {/* Top Source IPs */}
            <div className="space-y-1.5 mb-4 border-t border-white/5 pt-3">
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Top Source IPs</span>
              {(stats?.topSourceIPs || []).map((ip: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[10px]">
                  <span className="text-white/70 font-mono">{ip.ipAddress}</span>
                  <span className="font-mono text-[#D4AF37] font-bold">{ip.count}</span>
                </div>
              ))}
              {(!stats?.topSourceIPs || stats.topSourceIPs.length === 0) && (
                <div className="text-[10px] text-white/25">No IP data in this window.</div>
              )}
            </div>

            {/* Alert Resolution Stats */}
            <div className="border-t border-white/5 pt-3 space-y-1.5">
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Alert Resolution</span>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/50">Open</span>
                <span className="font-mono text-red-400 font-bold">{stats?.alertResolutionStats?.openCount || 0}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/50">Resolved ({timeFilter})</span>
                <span className="font-mono text-green-400 font-bold">{stats?.alertResolutionStats?.resolvedCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">SOC Attack Prevention Counters</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Replay Blocks', val: stats?.replayBlocks, icon: ShieldCheck, color: 'text-green-400' },
              { label: 'CSRF Blocks', val: stats?.csrfBlocks, icon: ShieldCheck, color: 'text-green-400' },
              { label: 'Rate Limits', val: stats?.rateLimitViolations, icon: ShieldCheck, color: 'text-yellow-400' },
              { label: 'Brute Force Attempts', val: stats?.bruteForceAttempts, icon: ShieldCheck, color: 'text-red-400' }
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
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-2">Session Risk Distribution</span>
              <div className="flex items-center gap-2">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((lvl) => {
                  const count = stats?.riskDistribution?.[lvl] || 0;
                  return (
                    <div key={lvl} className="flex-1 bg-white/5 border border-white/10 rounded p-2 text-center">
                      <div className="text-xs font-mono font-bold text-white">{count}</div>
                      <div className="text-[8px] uppercase tracking-widest text-white/40 font-semibold mt-1">{lvl}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block">Active Sessions Health</span>
              <div className="text-xs flex justify-between border-b border-white/5 pb-1">
                <span className="text-white/45">Total Active sessions:</span>
                <span className="font-mono text-green-400">{stats?.activeSessions || 0}</span>
              </div>
              <div className="text-xs flex justify-between">
                <span className="text-white/45">Suspicious sessions:</span>
                <span className="font-mono text-red-400">{stats?.suspiciousSessions || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#121212] border border-white/5 p-6 rounded-2xl space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1">
            <Download size={13} className="text-[#D4AF37]" />
            SOC Report Generator
          </h3>
          <p className="text-[10px] text-white/40 font-light">
            Generate and export security compliance reports.
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
                <option value="geosecurity">GeoSecurity Report</option>
                <option value="admin">Admin Activity Report</option>
                <option value="incident">Security Incident Report</option>
                <option value="session">Session Intelligence Report</option>
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
              className="w-full py-2 bg-[#D4AF37] hover:bg-[#C29E30] text-black font-bold uppercase tracking-wider text-[10px] rounded transition-colors mt-2"
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

      {/* Alert Management Panel (Wave 7C.1) */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/70 flex items-center gap-1.5">
              <AlertOctagon size={13} className="text-red-500" />
              Alert Management Console
            </h3>
            <p className="text-[9px] text-white/40">Lifecycle management: Acknowledge → Investigate → Resolve / False Positive.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/45 bg-black/40 border border-white/5 px-2 py-0.5 rounded font-mono">
              {alerts.filter((a: any) => a.status === 'OPEN').length} OPEN
            </span>
            <span className="text-[9px] text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/10 px-2 py-0.5 rounded font-mono">
              {alerts.filter((a: any) => a.status === 'INVESTIGATING').length} INVESTIGATING
            </span>
          </div>
        </div>

        {/* Alert Severity Filter */}
        <div className="flex gap-1.5 flex-wrap">
          {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => { setAlertSeverityFilter(sev); loadSocData(true); }}
              className={`px-2.5 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-all border ${
                alertSeverityFilter === sev
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                  : 'bg-black/30 text-white/40 border-white/5 hover:text-white/60'
              }`}
            >
              {sev || 'ALL'}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/5 rounded-xl">
              <ShieldCheck size={36} className="text-green-500/50 mx-auto mb-2" />
              <p className="text-sm text-green-400">Zero active security alerts triggered. System health optimal.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE'
                    ? 'border-white/5 bg-black/10 opacity-50'
                    : alert.severity === 'CRITICAL'
                    ? 'border-red-500/30 bg-red-500/[0.03]'
                    : alert.status === 'INVESTIGATING'
                    ? 'border-yellow-500/20 bg-yellow-500/[0.02]'
                    : 'border-white/10 bg-[#1A1A1A]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white truncate">{alert.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold font-mono border ${SEVERITY_COLORS[alert.severity] || 'bg-white/5 text-white/50 border-white/10'}`}>
                        {alert.severity}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold font-mono border ${STATUS_COLORS[alert.status] || 'bg-white/5 text-white/50 border-white/10'}`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/45 mt-1">{alert.type}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/30 font-mono mt-1.5 flex-wrap">
                      <div>Triggered: {new Date(alert.createdAt).toLocaleString()}</div>
                      {alert.assignedTo && (
                        <div className="text-yellow-400/60">Assigned: {alert.assignedTo.name || alert.assignedTo.email}</div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
                    {alert.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                          className="py-1 px-2.5 bg-yellow-500/5 hover:bg-yellow-500/15 border border-yellow-500/20 text-[9px] font-bold text-yellow-400 rounded uppercase tracking-wider transition-all"
                          title="Acknowledge & assign for investigation"
                        >
                          <Eye size={10} className="inline mr-1" />
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          className="py-1 px-2.5 bg-green-500/5 hover:bg-green-500/15 border border-green-500/20 text-[9px] font-bold text-green-400 rounded uppercase tracking-wider transition-all"
                        >
                          <CheckCircle2 size={10} className="inline mr-1" />
                          Resolve
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'false_positive')}
                          className="py-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold text-white/50 rounded uppercase tracking-wider transition-all"
                        >
                          <XCircle size={10} className="inline mr-1" />
                          False +
                        </button>
                      </>
                    )}
                    {alert.status === 'INVESTIGATING' && (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'resolve', { notes: 'Resolved after investigation' })}
                          className="py-1 px-2.5 bg-green-500/5 hover:bg-green-500/15 border border-green-500/20 text-[9px] font-bold text-green-400 rounded uppercase tracking-wider transition-all"
                        >
                          <CheckCircle2 size={10} className="inline mr-1" />
                          Resolve
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'false_positive', { notes: 'False positive after investigation' })}
                          className="py-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold text-white/50 rounded uppercase tracking-wider transition-all"
                        >
                          <XCircle size={10} className="inline mr-1" />
                          False +
                        </button>
                      </>
                    )}
                    {(alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE') && (
                      <span className="text-[9px] uppercase tracking-widest text-green-500/70 font-bold bg-green-500/5 px-2 py-0.5 border border-green-500/15 rounded">
                        {alert.status === 'FALSE_POSITIVE' ? 'False Positive' : 'Resolved'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Telemetry Events Feed with Filters */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/70">Security Telemetry Events Feed</h3>
            <p className="text-[9px] text-white/40">Raw log trace of all security indicators.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-mono font-bold">
              LIVE FEED
            </span>
            <span className="text-[9px] text-white/40 bg-black/40 border border-white/5 px-2 py-0.5 rounded font-mono">
              {eventsTotalCount} total
            </span>
          </div>
        </div>

        {/* Category Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 flex-wrap flex-1">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategoryFilter(cat.id); setEventsOffset(0); }}
                className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider transition-all border ${
                  categoryFilter === cat.id
                    ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                    : 'bg-black/30 text-white/40 border-white/5 hover:text-white/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEventSearch()}
              placeholder="Search events..."
              className="bg-black border border-white/10 rounded px-2.5 py-1 text-[10px] text-white placeholder:text-white/25 outline-none w-40 focus:border-[#D4AF37]/40"
            />
            <button
              onClick={handleEventSearch}
              className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/50 hover:text-white transition-colors"
            >
              <Search size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-xs">No events logged in this window.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="p-3 bg-black/35 border border-white/5 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#D4AF37]">{e.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider font-bold border ${SEVERITY_COLORS[e.severity] || 'bg-white/5 text-white/50 border-white/10'}`}>
                      {e.severity}
                    </span>
                    <span className="text-[8px] bg-white/5 px-2 py-0.5 border border-white/10 rounded font-mono text-white/50">
                      {e.category}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-white/70">{e.description}</p>
                <div className="flex justify-between items-center text-[9px] text-white/30 font-mono">
                  <div>IP: {e.ipAddress || '—'} {e.city && e.country ? `(${e.city}, ${e.country})` : ''}</div>
                  <div>{new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {eventsTotalCount > 15 && (
          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <span className="text-[9px] text-white/35 font-mono">
              Showing {eventsOffset + 1}–{Math.min(eventsOffset + 15, eventsTotalCount)} of {eventsTotalCount}
            </span>
            <div className="flex gap-2">
              <button
                disabled={eventsOffset === 0}
                onClick={() => setEventsOffset(Math.max(0, eventsOffset - 15))}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white/50 uppercase disabled:opacity-30 transition-all"
              >
                Prev
              </button>
              <button
                disabled={eventsOffset + 15 >= eventsTotalCount}
                onClick={() => setEventsOffset(eventsOffset + 15)}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white/50 uppercase disabled:opacity-30 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
