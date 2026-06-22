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
  CRITICAL: 'bg-rose-50 text-rose-750 border-rose-200',
  HIGH: 'bg-orange-50 text-orange-755 border-orange-200',
  MEDIUM: 'bg-amber-50 text-amber-750 border-amber-200',
  LOW: 'bg-blue-50 text-[#0B4C8C] border-blue-200',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
  INVESTIGATING: 'bg-amber-50 text-amber-705 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-250',
  FALSE_POSITIVE: 'bg-slate-50 text-slate-500 border-slate-200',
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
      <div className="space-y-6 animate-pulse py-8 min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-[24px] border border-slate-200" />)}
        </div>
        <div className="h-96 bg-white rounded-[24px] border border-slate-200" />
      </div>
    );
  }

  // Compute max bar height for event trend chart
  const maxEventsInHour = Math.max(1, ...(stats?.eventsPerHour || []).map((h: any) => h.count));

  return (
    <div className="text-[#0F172A] space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#0B4C8C] font-extrabold">
            <Zap size={10} className="animate-pulse text-[#0B4C8C]" /> SOC Dashboard • Auto Refresh Active
          </div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2 mt-1 text-slate-900">
            <ShieldAlert className="text-rose-600" size={28} />
            Security Operations Center (SOC)
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold">
            Real-time session logging, threat telemetry, and administrative operations audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-white border border-slate-205 rounded-xl p-0.5 shadow-3xs">
            {[
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id as any)}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase font-extrabold tracking-wider transition-all ${
                  timeFilter === t.id
                    ? 'bg-[#0B4C8C] text-white shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Link
            href="/admin/security/sessions"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg text-[10px] uppercase font-extrabold tracking-wider text-slate-700 shadow-xs"
          >
            Monitor sessions
          </Link>

          <button
            onClick={() => loadSocData()}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg text-slate-500 hover:text-[#0B4C8C] transition-all shadow-xs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200/80 p-5 rounded-[24px] shadow-sm relative overflow-hidden group">
          <span className="text-[9px] uppercase tracking-widest text-slate-550 font-bold block">Platform Security Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-4xl font-extralight text-[#0B4C8C]">{stats?.securityScore}</div>
            <div className="text-xs uppercase font-extrabold text-[#0B4C8C]/65">{stats?.securityGrade}</div>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-2">Overall platform configuration health</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-[24px] shadow-sm relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-slate-550 font-bold block">Failed Logins ({timeFilter})</span>
          <div className="text-4xl font-extralight text-orange-600 mt-2">{stats?.failedLogins || 0}</div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-2">{stats?.lockedAccounts || 0} locked accounts</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-[24px] shadow-sm relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-slate-550 font-bold block">Active Alerts</span>
          <div className="text-4xl font-extralight text-rose-600 mt-2">{stats?.activeAlerts || 0}</div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-2">{stats?.openCriticalAlerts || 0} critical priority threats</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-[24px] shadow-sm relative overflow-hidden">
          <span className="text-[9px] uppercase tracking-widest text-slate-550 font-bold block">Geosecurity Violations</span>
          <div className="text-4xl font-extralight text-amber-600 mt-2">
            {(stats?.locationChanges || 0) + (stats?.accountTakeovers || 0)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold block mt-2">{stats?.accountTakeovers || 0} ATO anomalies flagged</span>
        </div>
      </div>

      {/* SOC Intelligence Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Per Hour Trend */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800 flex items-center gap-1.5">
            <BarChart3 size={13} className="text-[#0B4C8C]" />
            Event Activity Trend (Last 24H)
          </h3>
          <div className="flex items-end gap-[3px] h-[100px]">
            {(stats?.eventsPerHour || []).map((h: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-[#0B4C8C]/30 hover:bg-[#0B4C8C]/60 rounded-t transition-all min-h-[2px]"
                  style={{ height: `${Math.max(2, (h.count / maxEventsInHour) * 90)}px` }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-900 text-[8px] px-1.5 py-0.5 rounded text-white whitespace-nowrap z-10 transition-opacity">
                  {h.hour}: {h.count} events
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 font-mono font-semibold">
            <span>{(stats?.eventsPerHour || [])[0]?.hour || '—'}</span>
            <span>NOW</span>
          </div>
        </div>

        {/* Top Event Types + Top IPs + Resolution Stats */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] shadow-sm space-y-5">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-850 flex items-center gap-1.5 mb-3">
              <TrendingUp size={13} className="text-[#0B4C8C]" />
              SOC Intelligence
            </h3>

            {/* Top Event Types */}
            <div className="space-y-1.5 mb-4">
              <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Top Event Types</span>
              {(stats?.topEventTypes || []).map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[10px] font-semibold text-slate-700">
                  <span className="truncate mr-2">{t.eventType}</span>
                  <span className="font-mono text-[#0B4C8C] font-bold shrink-0">{t.count}</span>
                </div>
              ))}
              {(!stats?.topEventTypes || stats.topEventTypes.length === 0) && (
                <div className="text-[10px] text-slate-400 font-semibold">No events in this window.</div>
              )}
            </div>

            {/* Top Source IPs */}
            <div className="space-y-1.5 mb-4 border-t border-slate-100 pt-3">
              <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Top Source IPs</span>
              {(stats?.topSourceIPs || []).map((ip: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[10px] font-semibold text-slate-700">
                  <span className="font-mono">{ip.ipAddress}</span>
                  <span className="font-mono text-[#0B4C8C] font-bold">{ip.count}</span>
                </div>
              ))}
              {(!stats?.topSourceIPs || stats.topSourceIPs.length === 0) && (
                <div className="text-[10px] text-slate-400 font-semibold">No IP data in this window.</div>
              )}
            </div>

            {/* Alert Resolution Stats */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Alert Resolution</span>
              <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                <span>Open</span>
                <span className="font-mono text-rose-600 font-bold">{stats?.alertResolutionStats?.openCount || 0}</span>
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                <span>Resolved ({timeFilter})</span>
                <span className="font-mono text-emerald-600 font-bold">{stats?.alertResolutionStats?.resolvedCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800">SOC Attack Prevention Counters</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Replay Blocks', val: stats?.replayBlocks, icon: ShieldCheck, color: 'text-emerald-600' },
              { label: 'CSRF Blocks', val: stats?.csrfBlocks, icon: ShieldCheck, color: 'text-emerald-600' },
              { label: 'Rate Limits', val: stats?.rateLimitViolations, icon: ShieldCheck, color: 'text-amber-600' },
              { label: 'Brute Force Attempts', val: stats?.bruteForceAttempts, icon: ShieldCheck, color: 'text-rose-600' }
            ].map((c, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">{c.label}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <c.icon size={13} className={c.color} />
                  <span className="text-lg font-mono font-extrabold text-slate-900">{c.val || 0}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2">Session Risk Distribution</span>
              <div className="flex items-center gap-2">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((lvl) => {
                  const count = stats?.riskDistribution?.[lvl] || 0;
                  return (
                    <div key={lvl} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center shadow-3xs">
                      <div className="text-xs font-mono font-extrabold text-slate-850">{count}</div>
                      <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold mt-1">{lvl}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Active Sessions Health</span>
              <div className="text-xs flex justify-between border-b border-slate-100 pb-1 font-semibold text-slate-650">
                <span>Total Active sessions:</span>
                <span className="font-mono text-emerald-600 font-bold">{stats?.activeSessions || 0}</span>
              </div>
              <div className="text-xs flex justify-between font-semibold text-slate-655">
                <span>Suspicious sessions:</span>
                <span className="font-mono text-rose-600 font-bold">{stats?.suspiciousSessions || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] shadow-sm space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800 flex items-center gap-1">
            <Download size={13} className="text-[#0B4C8C]" />
            SOC Report Generator
          </h3>
          <p className="text-[10px] text-slate-500 font-semibold">
            Generate and export security compliance reports.
          </p>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Report Category</label>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none cursor-pointer font-semibold"
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
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {['csv', 'excel', 'pdf'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedReportFormat(fmt)}
                    className={`p-2 border rounded-lg text-[10px] uppercase font-mono font-extrabold tracking-wider transition-colors shadow-3xs ${
                      selectedReportFormat === fmt
                        ? 'border-[#0B4C8C] text-[#0B4C8C] bg-[#0B4C8C]/5'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadReport}
              className="w-full py-2 bg-[#0B4C8C] hover:bg-[#0B4C8C]/95 text-white font-extrabold uppercase tracking-wider text-[10px] rounded-lg transition-all shadow-xs mt-2"
            >
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Application Security Section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] shadow-sm space-y-6">
        <div>
          <h3 className="text-sm uppercase tracking-widest font-extrabold text-[#0B4C8C] flex items-center gap-2">
            <ShieldCheck size={16} />
            Application Security Hardening & Runtime Resilience
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 font-semibold">
            Real-time status of XSS, SSTI defenses, ReDoS (regex safety checks), Cloudinary upload protection, and event loop metrics.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">XSS Payloads Blocked</span>
            <div className="text-xl font-bold font-mono text-emerald-600">{stats?.xssFindings || 0}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">SSTI Attempts Blocked</span>
            <div className="text-xl font-bold font-mono text-emerald-600">{stats?.sstiFindings || 0}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Unsafe Regex Patterns</span>
            <div className="text-xl font-bold font-mono text-amber-600">{stats?.unsafeRegexCount || 0}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Upload Threats Prevented</span>
            <div className="text-xl font-bold font-mono text-emerald-600">{stats?.uploadThreats || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Secret Exposure Scan</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">Leaked credentials: {stats?.secretExposureFindings || 0}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold ${
              stats?.secretExposureFindings > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-250'
            }`}>
              {stats?.secretExposureFindings > 0 ? 'FAIL' : 'CLEAN'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Static Code Audit Status</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">Static check baseline status</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold ${
              stats?.codeAuditStatus === 'PASSED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-amber-50 text-amber-700 border border-amber-250'
            }`}>
              {stats?.codeAuditStatus || 'UNKNOWN'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Event Loop Lag</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">{stats?.eventLoopLag || 0} ms delay</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold ${
              stats?.runtimeHealth === 'HEALTHY' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {stats?.runtimeHealth || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Management Panel */}
      <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800 flex items-center gap-1.5">
              <AlertOctagon size={13} className="text-rose-600" />
              Alert Management Console
            </h3>
            <p className="text-[9px] text-slate-500 font-semibold">Lifecycle management: Acknowledge → Investigate → Resolve / False Positive.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-650 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-mono font-bold">
              {alerts.filter((a: any) => a.status === 'OPEN').length} OPEN
            </span>
            <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded font-mono font-bold">
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
              className={`px-2.5 py-1 rounded-lg text-[9px] uppercase font-extrabold tracking-wider transition-all border ${
                alertSeverityFilter === sev
                  ? 'bg-blue-50 text-[#0B4C8C] border-blue-200 shadow-3xs'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-3xs'
              }`}
            >
              {sev || 'ALL'}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-[24px]">
              <ShieldCheck size={36} className="text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm text-emerald-700 font-semibold">Zero active security alerts triggered. System health optimal.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE'
                    ? 'border-slate-100 bg-slate-50/50 opacity-60'
                    : alert.severity === 'CRITICAL'
                    ? 'border-rose-250 bg-rose-50/[0.15]'
                    : alert.status === 'INVESTIGATING'
                    ? 'border-amber-250 bg-amber-50/[0.15]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">{alert.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold font-mono border ${SEVERITY_COLORS[alert.severity] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {alert.severity}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold font-mono border ${STATUS_COLORS[alert.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">{alert.type}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-450 font-mono mt-1.5 flex-wrap">
                      <div>Triggered: {new Date(alert.createdAt).toLocaleString()}</div>
                      {alert.assignedTo && (
                        <div className="text-amber-705 font-semibold">Assigned: {alert.assignedTo.name || alert.assignedTo.email}</div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
                    {alert.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                          className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[9px] font-extrabold text-amber-700 rounded-lg uppercase tracking-wider shadow-3xs transition-all"
                          title="Acknowledge & assign for investigation"
                        >
                          <Eye size={10} className="inline mr-1" />
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          className="py-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-[9px] font-extrabold text-emerald-700 rounded-lg uppercase tracking-wider shadow-3xs transition-all"
                        >
                          <CheckCircle2 size={10} className="inline mr-1" />
                          Resolve
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'false_positive')}
                          className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-250 text-[9px] font-extrabold text-slate-500 rounded-lg uppercase tracking-wider shadow-3xs transition-all"
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
                          className="py-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-[9px] font-extrabold text-emerald-700 rounded-lg uppercase tracking-wider shadow-3xs transition-all"
                        >
                          <CheckCircle2 size={10} className="inline mr-1" />
                          Resolve
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'false_positive', { notes: 'False positive after investigation' })}
                          className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-250 text-[9px] font-extrabold text-slate-500 rounded-lg uppercase tracking-wider shadow-3xs transition-all"
                        >
                          <XCircle size={10} className="inline mr-1" />
                          False +
                        </button>
                      </>
                    )}
                    {(alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE') && (
                      <span className="text-[9px] uppercase tracking-widest text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 border border-emerald-250 rounded-lg">
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
      <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800">Security Telemetry Events Feed</h3>
            <p className="text-[9px] text-slate-500 font-semibold">Raw log trace of all security indicators.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-blue-50 text-[#0B4C8C] border border-blue-200 px-2 py-0.5 rounded-lg font-mono font-extrabold shadow-3xs animate-pulse">
              LIVE FEED
            </span>
            <span className="text-[9px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg font-mono font-bold">
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
                className={`px-2.5 py-1 rounded-lg text-[8px] uppercase font-extrabold tracking-wider transition-all border shadow-3xs ${
                  categoryFilter === cat.id
                    ? 'bg-blue-50 text-[#0B4C8C] border-blue-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
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
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] text-slate-800 placeholder:text-slate-400 outline-none w-40 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 transition-all font-semibold"
            />
            <button
              onClick={handleEventSearch}
              className="p-1 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg text-slate-500 hover:text-[#0B4C8C] transition-all shadow-3xs"
            >
              <Search size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-semibold text-xs">No events logged in this window.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#0B4C8C]">{e.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider font-extrabold border ${SEVERITY_COLORS[e.severity] || 'bg-slate-50 text-slate-550 border-slate-200'}`}>
                      {e.severity}
                    </span>
                    <span className="text-[8px] bg-white px-2 py-0.5 border border-slate-200 rounded font-mono text-slate-500 font-semibold">
                      {e.category}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-700 font-medium">{e.description}</p>
                <div className="flex justify-between items-center text-[9px] text-slate-450 font-mono font-semibold">
                  <div>IP: {e.ipAddress || '—'} {e.city && e.country ? `(${e.city}, ${e.country})` : ''}</div>
                  <div>{new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {eventsTotalCount > 15 && (
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-[9px] text-slate-500 font-mono font-semibold">
              Showing {eventsOffset + 1}–{Math.min(eventsOffset + 15, eventsTotalCount)} of {eventsTotalCount}
            </span>
            <div className="flex gap-2">
              <button
                disabled={eventsOffset === 0}
                onClick={() => setEventsOffset(Math.max(0, eventsOffset - 15))}
                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[9px] font-extrabold text-slate-750 uppercase disabled:opacity-30 transition-all shadow-xs"
              >
                Prev
              </button>
              <button
                disabled={eventsOffset + 15 >= eventsTotalCount}
                onClick={() => setEventsOffset(eventsOffset + 15)}
                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[9px] font-extrabold text-slate-750 uppercase disabled:opacity-30 transition-all shadow-xs"
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
