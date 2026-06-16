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
      <div className="space-y-6 animate-pulse py-8">
        <div className="h-6 w-32 bg-white/5 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl" />)}
        </div>
        <div className="h-96 bg-white/5 rounded-xl" />
      </div>
    );
  }

  const { liveMonitoring, adminPerformance, leaderboard, governanceScorecard } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <Compass className="text-[#D4AF37] animate-pulse" size={28} />
            Super Admin Command Center
          </h1>
          <p className="text-sm text-white/45 mt-1.5">
            Single-pane control portal for ownership oversight, SOC metrics, and financial audits.
          </p>
        </div>
        <button
          onClick={loadCommandCenterData}
          disabled={refreshing}
          className="p-2.5 bg-[#161616] hover:bg-white/5 border border-white/10 rounded text-white/60 hover:text-white transition-colors shrink-0"
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
          <div key={i} className="bg-[#161616] border border-white/5 p-4 rounded-xl space-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-lg" />
            <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold block">{c.label}</span>
            <div className="text-lg font-semibold text-[#D4AF37] tracking-tight truncate">{c.val}</div>
            <span className="text-[8px] text-white/30 block mt-0.5">{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Tab Menu Options */}
      <div className="flex border-b border-white/5 overflow-x-auto shrink-0 pb-1 scrollbar-thin">
        {(['governance', 'live', 'leaderboard', 'financials', 'audit', 'sessions', 'reviews'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 border-b-2 text-xs uppercase tracking-wider font-semibold transition-all shrink-0 ${
              activeTab === tab
                ? 'border-[#D4AF37] text-[#F5D67B] bg-[#D4AF37]/5'
                : 'border-transparent text-white/40 hover:text-white'
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
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Administrative Scorecards</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                    <th className="pb-3 font-semibold">Administrator</th>
                    <th className="pb-3 font-semibold">Efficiency Grade</th>
                    <th className="pb-3 font-semibold">Index Score</th>
                    <th className="pb-3 font-semibold">Leads Won</th>
                    <th className="pb-3 font-semibold">Tasks Completed</th>
                    <th className="pb-3 font-semibold">Revenue attributed</th>
                    <th className="pb-3 text-right font-semibold">Clearance Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminPerformance.map((admin: any) => (
                    <tr key={admin.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 font-semibold text-white">{admin.name}</td>
                      <td className="py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${
                          admin.grade === 'ELITE' ? 'bg-[#D4AF37]/15 text-[#F5D67B] border border-[#D4AF37]/20' :
                          admin.grade === 'EXCELLENT' ? 'bg-green-500/10 text-green-400' :
                          'bg-white/5 text-white/50'
                        }`}>
                          {admin.grade}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-[#D4AF37]">{admin.score}/100</td>
                      <td className="py-4">{admin.leadsWon} deals won</td>
                      <td className="py-4">{admin.followUpsCompleted} follow-ups</td>
                      <td className="py-4 font-semibold text-green-400">{formatIndianRealEstatePrice(admin.revenue)}</td>
                      <td className="py-4 text-right">
                        <Link
                          href={`/admin/admins/${admin.id}`}
                          className="px-2.5 py-1.5 bg-white/5 border border-white/5 hover:border-[#D4AF37]/30 text-[10px] font-bold text-white hover:text-[#F5D67B] rounded uppercase tracking-wider transition-colors"
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
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Live Monitor Feed</h3>
              <p className="text-[10px] text-white/40 mt-1">Updates admin tracing actions instantly using recent log trails.</p>
            </div>
            {liveMonitoring.length === 0 ? (
              <div className="text-center py-12 text-white/40">No active administrator sessions detected.</div>
            ) : (
              <div className="space-y-4">
                {liveMonitoring.map((live: any, i: number) => (
                  <div key={i} className="p-4 bg-black/20 border border-white/5 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                      <span className="font-semibold text-white text-xs block">{live.adminName}</span>
                      <span className="text-[9px] text-white/40 font-mono mt-0.5 block">{live.email} ({live.role})</span>
                      <div className="flex items-center gap-2.5 text-[9px] text-white/30 font-mono mt-2 flex-wrap">
                        <div>Host IP: {live.ip} ({live.location})</div>
                        <div>Duration: {live.duration}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] uppercase tracking-widest text-[#D4AF37] font-mono block">Current Action</span>
                      <span className="text-xs font-semibold text-white block mt-0.5">{live.currentAction}</span>
                      <span className="text-[8px] uppercase tracking-widest text-white/40 font-mono block mt-1">Module: {live.module}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#161616] border border-white/5 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                <Award size={13} className="text-[#D4AF37]" />
                Top Closers (Sales Wins)
              </h3>
              <div className="space-y-2">
                {leaderboard.topClosers.map((a: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded bg-black/20 border border-white/5">
                    <div>
                      <span className="text-xs font-semibold text-white">{a.name}</span>
                      <span className="text-[9px] text-white/40 block mt-0.5">{a.email}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-sm font-bold text-[#D4AF37] block">{a.leadsWon}</span>
                      <span className="text-[8px] uppercase text-white/30 block">Wins</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#161616] border border-white/5 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                <DollarSign size={13} className="text-[#D4AF37]" />
                Revenue Leaders
              </h3>
              <div className="space-y-2">
                {leaderboard.highestRevenues.map((a: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded bg-black/20 border border-white/5">
                    <div>
                      <span className="text-xs font-semibold text-white">{a.name}</span>
                      <span className="text-[9px] text-white/40 block mt-0.5">{a.email}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-sm font-bold text-green-400 block">{formatIndianRealEstatePrice(a.revenue)}</span>
                      <span className="text-[8px] uppercase text-white/30 block">Attributed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Revenue & Attributed pipeline</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                    <th className="pb-3 font-semibold">Administrator</th>
                    <th className="pb-3 font-semibold">Won Deals</th>
                    <th className="pb-3 font-semibold">Average Value</th>
                    <th className="pb-3 font-semibold">Active Pipeline value</th>
                    <th className="pb-3 font-semibold">Revenue closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminPerformance.map((admin: any) => (
                    <tr key={admin.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 font-semibold text-white">{admin.name}</td>
                      <td className="py-4 font-mono">{admin.wonDealsCount} Won</td>
                      <td className="py-4 font-mono">{formatIndianRealEstatePrice(admin.averageDealValue)}</td>
                      <td className="py-4 font-mono text-amber-500">{formatIndianRealEstatePrice(admin.pipelineValue)}</td>
                      <td className="py-4 font-mono font-bold text-green-400">{formatIndianRealEstatePrice(admin.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Unified Audit Explorer</h3>
                <p className="text-[10px] text-white/40 mt-1">Search or query system logs with detailed filters.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadAuditLogs}
                  className="py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] uppercase font-bold text-white tracking-wider transition-colors flex items-center gap-1"
                >
                  <Search size={12} />
                  Execute query
                </button>
                <button
                  onClick={handleCSVExport}
                  className="py-1.5 px-3 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/20 rounded text-[10px] uppercase font-bold text-[#F5D67B] tracking-wider transition-colors flex items-center gap-1"
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
                  className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2 pl-9 rounded text-xs outline-none text-white transition-colors"
                />
                <Search className="absolute left-3 top-2.5 text-white/40" size={12} />
              </div>
              
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
                className="bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-white text-[11px] outline-none cursor-pointer"
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
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-white/30">No audit logs located. Trigger a query.</div>
            ) : (
              <div className="overflow-y-auto max-h-[300px] border border-white/5 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0A0A0A] sticky top-0">
                    <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] p-2.5">
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Actor</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/10">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.01]">
                        <td className="p-2.5 font-mono text-[10px] text-[#D4AF37]">{log.action}</td>
                        <td className="p-2.5 font-mono text-[10px] text-white/50">{log.actorId || 'System'}</td>
                        <td className="p-2.5 text-white/80">{log.description}</td>
                        <td className="p-2.5 font-mono text-[10px] text-white/35">
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
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Active Sessions Monitor</h3>
              <p className="text-[10px] text-white/40 mt-1">Emergency connection controls and forced logouts.</p>
            </div>

            {sessionsLoading ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-white/30">No active sessions tracked.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Host / IP</th>
                      <th className="pb-3 font-semibold">Browser details</th>
                      <th className="pb-3 font-semibold">Login time</th>
                      <th className="pb-3 text-right font-semibold">Emergency revocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sessions.map((s: any) => (
                      <tr key={s.id} className="hover:bg-white/[0.01]">
                        <td className="py-4">
                          <span className="font-semibold text-white block">{s.user?.name || 'Anonymous User'}</span>
                          <span className="text-[10px] text-white/40 block font-mono mt-0.5">{s.user?.email}</span>
                        </td>
                        <td className="py-4 font-mono text-[10px]">
                          {s.ipAddress} ({s.location})
                        </td>
                        <td className="py-4 text-white/70">
                          {s.browser} on {s.operatingSystem}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-white/50">
                          {new Date(s.loginAt).toLocaleString()}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSessionAction('TERMINATE_SESSION', s.id)}
                              title="Force logout specific session"
                              className="p-1.5 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-white/60 hover:text-red-400 rounded transition-colors"
                            >
                              <LogOut size={13} />
                            </button>
                            <button
                              onClick={() => handleSessionAction('LOCK_ACCOUNT', s.user.id)}
                              title="Lock Account and suspend credentials"
                              className="p-1.5 bg-white/5 hover:bg-red-600/15 border border-white/5 hover:border-red-600/40 text-red-500/60 hover:text-red-500 rounded transition-colors"
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
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Staff Performance reviews log</h3>
            <div className="space-y-4">
              {adminPerformance.map((admin: any) => (
                <div key={admin.id} className="p-4 bg-black/20 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <span className="font-semibold text-white block">{admin.name}</span>
                    <span className="text-[10px] text-white/40 block font-mono mt-0.5">{admin.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/40">Efficiency Rating</span>
                    <div className="flex bg-[#1E1E1E] px-3 py-1.5 border border-white/5 rounded font-mono text-xs">
                      <span className="text-[#D4AF37] font-bold">{admin.score}/100</span>
                    </div>
                    <Link
                      href={`/admin/admins/${admin.id}`}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white/5 border border-white/10 hover:border-[#D4AF37]/30 text-[10px] font-bold text-white hover:text-[#F5D67B] rounded uppercase tracking-wider transition-colors"
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
