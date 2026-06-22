'use client';

import React, { useState, useEffect } from 'react';
import {
  Compass,
  Activity,
  Award,
  DollarSign,
  Clock,
  Shield,
  Monitor,
  Star,
  Download,
  Search,
  RefreshCw,
  X,
  FileSpreadsheet,
  Ban,
  KeyRound,
  LogOut,
  ThumbsUp,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { formatIndianRealEstatePrice } from '@/lib/currency';

type TabType = 'governance' | 'live' | 'leaderboard' | 'financials' | 'audit' | 'sessions' | 'reviews';

export default function SuperAdminCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabType>('governance');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Audit explorer states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // Active Sessions control states
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    loadCommandCenterData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'sessions') {
      loadSessions();
    }
  }, [activeTab, auditAction]);

  const loadCommandCenterData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/super-admin/governance');
      if (res.ok) {
        const resData = await res.json();
        setData(resData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const url = `/api/admin/audit-logs?search=${encodeURIComponent(auditSearch)}&action=${auditAction}&limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const auditData = await res.json();
        setAuditLogs(auditData.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await fetch('/api/admin/security/sessions?active=true');
      if (res.ok) {
        const sessionData = await res.json();
        setSessions(sessionData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSessionAction = async (action: string, id: string) => {
    if (!confirm('Execute emergency session action?')) return;
    try {
      const payload: any = { action };
      if (action === 'TERMINATE_SESSION') {
        payload.sessionId = id;
      } else {
        payload.targetUserId = id;
      }

      const res = await fetch('/api/admin/security/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        loadSessions();
        loadCommandCenterData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CSV Export trigger
  const handleCSVExport = () => {
    if (auditLogs.length === 0) {
      alert('No logs loaded to export');
      return;
    }

    const headers = ['Log ID', 'Actor ID', 'Action', 'Description', 'Timestamp'];
    const rows = auditLogs.map(l => [
      l.id,
      l.actorId || 'System',
      l.action,
      `"${l.description.replace(/"/g, '""')}"`,
      new Date(l.createdAt).toLocaleString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aura_audit_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8 text-slate-800">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white border border-slate-200 rounded-[24px]" />)}
        </div>
        <div className="h-96 bg-white border border-slate-200 rounded-[24px]" />
      </div>
    );
  }

  const { liveMonitoring, adminPerformance, leaderboard, governanceScorecard } = data;

  return (
    <div className="space-y-8 pb-12 text-[#0F172A]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2 text-slate-900">
            <Compass className="text-[#0B4C8C]" size={28} />
            Super Admin Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-semibold">
            Single-pane control portal for ownership oversight, SOC metrics, and financial audits.
          </p>
        </div>
        <button
          onClick={loadCommandCenterData}
          disabled={refreshing}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-250 rounded-lg text-slate-550 hover:text-[#0B4C8C] transition-all shrink-0 shadow-xs"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Governance Scorecard Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Security Score', val: `${governanceScorecard.securityScore}%`, desc: 'SOC Threats status' },
          { label: 'Health score', val: `${governanceScorecard.performanceScore}%`, desc: 'Average staff productivity' },
          { label: 'Integrity Index', val: `${governanceScorecard.dataIntegrityScore}%`, desc: 'Data assignment mapping' },
          { label: 'Total Revenue', val: formatIndianRealEstatePrice(governanceScorecard.totalRevenue), desc: 'All win deals value' },
          { label: 'Staff Admins', val: governanceScorecard.totalAdmins, desc: 'Clearance users' },
          { label: 'Total Leads', val: governanceScorecard.totalLeads, desc: 'Sales CRM volume' },
          { label: 'Clients Roster', val: governanceScorecard.totalUsers, desc: 'Registered accounts' },
          { label: 'SOC Alert log', val: governanceScorecard.securityAlerts || '0 Issues', desc: 'Active warnings' }
        ].map((c, i) => (
          <div key={i} className="bg-white border border-slate-200/85 p-4 rounded-xl space-y-1 relative overflow-hidden group shadow-3xs">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-b from-[#0B4C8C]/5 to-transparent rounded-full blur-md" />
            <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">{c.label}</span>
            <div className="text-sm font-extrabold text-[#0B4C8C] tracking-tight truncate">{c.val}</div>
            <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Tab Menu Options */}
      <div className="flex border-b border-slate-200 overflow-x-auto shrink-0 pb-1 scrollbar-thin">
        {(['governance', 'live', 'leaderboard', 'financials', 'audit', 'sessions', 'reviews'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 border-b-2 text-xs uppercase tracking-wider font-extrabold transition-all shrink-0 ${
              activeTab === tab
                ? 'border-[#0B4C8C] text-[#0B4C8C] bg-[#0B4C8C]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab === 'governance' && '💼 Staff Scorecard'}
            {tab === 'live' && '📡 Live Track'}
            {tab === 'leaderboard' && '🏆 Leaderboard'}
            {tab === 'financials' && '📈 Financials'}
            {tab === 'audit' && '🔍 Audit Explorer'}
            {tab === 'sessions' && '🖥 Sessions'}
            {tab === 'reviews' && '📝 Reviews Log'}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {activeTab === 'governance' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-550">Administrative Scorecards</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[9px] uppercase tracking-widest font-bold text-slate-500 pb-3">
                    <th className="py-2.5 px-3 font-bold">Administrator</th>
                    <th className="py-2.5 px-3 font-bold">Efficiency Grade</th>
                    <th className="py-2.5 px-3 font-bold">Index Score</th>
                    <th className="py-2.5 px-3 font-bold">Leads Won</th>
                    <th className="py-2.5 px-3 font-bold">Tasks Completed</th>
                    <th className="py-2.5 px-3 font-bold">Revenue attributed</th>
                    <th className="py-2.5 px-3 text-right font-bold">Clearance Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {adminPerformance.map((admin: any) => (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-3 font-bold text-slate-900">{admin.name}</td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-extrabold uppercase tracking-widest shadow-3xs ${
                          admin.grade === 'ELITE' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
                          admin.grade === 'EXCELLENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                          'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {admin.grade}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-mono text-[#0B4C8C]">{admin.score}/100</td>
                      <td className="py-4 px-3">{admin.leadsWon} deals won</td>
                      <td className="py-4 px-3">{admin.followUpsCompleted} follow-ups</td>
                      <td className="py-4 px-3 font-bold text-emerald-700">{formatIndianRealEstatePrice(admin.revenue)}</td>
                      <td className="py-4 px-3 text-right">
                        <Link
                          href={`/admin/admins/${admin.id}`}
                          className="px-2.5 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 text-[10px] font-extrabold text-[#0B4C8C] rounded-lg uppercase tracking-wider transition-all shadow-xs"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-550">Live Monitor Feed</h3>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Updates admin tracing actions instantly using recent log trails.</p>
            </div>
            {liveMonitoring.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-semibold italic">No active administrator sessions detected.</div>
            ) : (
              <div className="space-y-4">
                {liveMonitoring.map((live: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-3xs">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{live.adminName}</span>
                      <span className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5 block">{live.email} ({live.role})</span>
                      <div className="flex items-center gap-2.5 text-[9px] text-slate-450 font-semibold font-mono mt-2 flex-wrap">
                        <div>Host IP: {live.ip} ({live.location})</div>
                        <div>Duration: {live.duration}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] uppercase tracking-widest text-[#0B4C8C] font-mono font-bold block">Current Action</span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">{live.currentAction}</span>
                      <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono font-bold block mt-1">Module: {live.module}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-5 space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800 flex items-center gap-1.5">
                <Award size={13} className="text-[#0B4C8C]" />
                Top Closers (Sales Wins)
              </h3>
              <div className="space-y-2">
                {leaderboard.topClosers.map((a: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-3xs">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{a.name}</span>
                      <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">{a.email}</span>
                    </div>
                    <div className="text-right font-mono font-semibold">
                      <span className="text-sm font-bold text-[#0B4C8C] block">{a.leadsWon}</span>
                      <span className="text-[8px] uppercase text-slate-450 block">Wins</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-5 space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800 flex items-center gap-1.5">
                <DollarSign size={13} className="text-[#0B4C8C]" />
                Revenue Leaders
              </h3>
              <div className="space-y-2">
                {leaderboard.highestRevenues.map((a: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-3xs">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{a.name}</span>
                      <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">{a.email}</span>
                    </div>
                    <div className="text-right font-mono font-semibold">
                      <span className="text-sm font-bold text-emerald-700 block">{formatIndianRealEstatePrice(a.revenue)}</span>
                      <span className="text-[8px] uppercase text-slate-450 block">Attributed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-550">Revenue & Attributed pipeline</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-205 bg-slate-50 text-[9px] uppercase tracking-widest font-bold text-slate-555 pb-3">
                    <th className="py-2.5 px-3 font-bold">Administrator</th>
                    <th className="py-2.5 px-3 font-bold">Won Deals</th>
                    <th className="py-2.5 px-3 font-bold">Average Value</th>
                    <th className="py-2.5 px-3 font-bold">Active Pipeline value</th>
                    <th className="py-2.5 px-3 font-bold">Revenue closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {adminPerformance.map((admin: any) => (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-3 font-bold text-slate-900">{admin.name}</td>
                      <td className="py-4 px-3 font-mono">{admin.wonDealsCount} Won</td>
                      <td className="py-4 px-3 font-mono">{formatIndianRealEstatePrice(admin.averageDealValue)}</td>
                      <td className="py-4 px-3 font-mono text-amber-600 font-bold">{formatIndianRealEstatePrice(admin.pipelineValue)}</td>
                      <td className="py-4 px-3 font-mono font-extrabold text-emerald-700">{formatIndianRealEstatePrice(admin.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800">Unified Audit Explorer</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Search or query system logs with detailed filters.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadAuditLogs}
                  className="py-1.5 px-3 bg-white border border-slate-250 text-slate-750 hover:bg-slate-50 rounded-lg text-[10px] uppercase font-extrabold tracking-wider transition-all flex items-center gap-1 shadow-xs"
                >
                  <Search size={12} />
                  Execute query
                </button>
                <button
                  onClick={handleCSVExport}
                  className="py-1.5 px-3 bg-white border border-slate-250 text-[#0B4C8C] hover:bg-slate-50 rounded-lg text-[10px] uppercase font-extrabold tracking-wider transition-all flex items-center gap-1 shadow-xs"
                >
                  <FileSpreadsheet size={12} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by description/keywords..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 p-2 pl-9 rounded-lg text-xs outline-none text-slate-800 transition-all h-9"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={12} />
              </div>
              
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                className="bg-white border border-slate-200 p-2 rounded-lg text-slate-700 text-[11px] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-all h-9 appearance-none text-center"
              >
                <option value="">All Actions Types</option>
                <option value="PROPERTY_DELETE">Deletions Only</option>
                <option value="USER_SUSPEND">Client Suspensions</option>
                <option value="ADMIN_PROMOTED">Staff Promotions</option>
                <option value="ADMIN_REVOKED">Clearance Revocations</option>
                <option value="PERMISSION_GRANTED">Permission Grants</option>
                <option value="SESSION_TERMINATED">Session Logouts</option>
              </select>
            </div>

            {auditLoading ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 border border-slate-105 rounded animate-pulse" />)}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-semibold italic">No audit logs located. Trigger a query.</div>
            ) : (
              <div className="overflow-y-auto max-h-[300px] border border-slate-200 rounded-[24px] shadow-3xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200/85 text-slate-500 font-bold text-[9px] uppercase tracking-widest">
                    <tr>
                      <th className="p-3">Action</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-750 font-medium">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono text-[10px] text-[#0B4C8C] font-bold">{log.action}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-500 font-semibold">{log.actorId || 'System'}</td>
                        <td className="p-3 text-slate-800 font-semibold">{log.description}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-450 font-semibold">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-800">Active Sessions Monitor</h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Emergency connection controls and forced logouts.</p>
            </div>

            {sessionsLoading ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 border border-slate-105 rounded animate-pulse" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-semibold italic">No active sessions tracked.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[9px] uppercase tracking-widest font-bold text-slate-500 pb-3">
                      <th className="pb-3 px-2 font-bold">User</th>
                      <th className="pb-3 px-2 font-bold">Host / IP</th>
                      <th className="pb-3 px-2 font-bold">Browser details</th>
                      <th className="pb-3 px-2 font-bold">Login time</th>
                      <th className="pb-3 px-2 text-right font-bold">Emergency revocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                    {sessions.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-2">
                          <span className="font-bold text-slate-900 block">{s.user?.name || 'Anonymous User'}</span>
                          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{s.user?.email}</span>
                        </td>
                        <td className="py-4 px-2 font-mono text-[10px]">
                          {s.ipAddress} ({s.location})
                        </td>
                        <td className="py-4 px-2 text-slate-700 font-medium">
                          {s.browser} on {s.operatingSystem}
                        </td>
                        <td className="py-4 px-2 font-mono text-[10px] text-slate-450 font-semibold">
                          {new Date(s.loginAt).toLocaleString()}
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSessionAction('TERMINATE_SESSION', s.id)}
                              title="Force logout specific session"
                              className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-700 rounded-lg shadow-3xs transition-all"
                            >
                              <LogOut size={13} />
                            </button>
                            <button
                              onClick={() => handleSessionAction('LOCK_ACCOUNT', s.user.id)}
                              title="Lock Account and suspend credentials"
                              className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 hover:text-rose-800 rounded-lg shadow-3xs transition-all"
                            >
                              <Ban size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-550">Staff Performance reviews log</h3>
            <div className="space-y-4">
              {adminPerformance.map((admin: any) => (
                <div key={admin.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 shadow-3xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{admin.name}</span>
                    <span className="text-[10px] text-slate-500 font-semibold block font-mono mt-0.5">{admin.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-bold">Efficiency Rating</span>
                    <div className="flex bg-white px-3 py-1.5 border border-slate-200 rounded-lg font-mono text-xs shadow-3xs">
                      <span className="text-[#0B4C8C] font-extrabold">{admin.score}/100</span>
                    </div>
                    <Link
                      href={`/admin/admins/${admin.id}`}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white border border-slate-250 hover:bg-slate-50 text-[10px] font-extrabold text-[#0B4C8C] hover:text-[#0B4C8C] rounded-lg uppercase tracking-wider transition-all shadow-xs"
                    >
                      Conduct review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
