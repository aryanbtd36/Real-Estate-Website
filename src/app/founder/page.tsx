'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ShieldAlert,
  Users,
  Activity,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Lock,
  Unlock,
  Radio,
  Eye,
  Settings,
  HardDrive,
  Heart,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  LogOut,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FounderConsolePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // State Management
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'governance' | 'soc' | 'integrity' | 'emergency'>('governance');
  
  // Promotion form state
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Control action state
  const [lockdownLoading, setLockdownLoading] = useState(false);

  // Fetch summary stats
  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/admin/governance/summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errJson = await res.json();
        setError(errJson.error || 'Failed to fetch governance summary.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch standard admins list for promotion dropdown
  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/users?role=ADMIN&limit=100');
      if (res.ok) {
        const json = await res.json();
        setAdminsList(json.users || []);
      }
    } catch (err) {
      console.error('Failed to load admins list:', err);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session && !(session.user as any).isFounder) {
      // Forbidden access for non-founders
      router.push('/admin');
      return;
    }

    if (sessionStatus === 'authenticated') {
      fetchSummary();
      fetchAdmins();
    }
  }, [session, sessionStatus]);

  // Handle Promotion
  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminId) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/governance/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedAdminId,
          action: 'PROMOTE',
          reason: actionReason || 'Promoted via Founder Command Center',
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSelectedAdminId('');
        setActionReason('');
        await fetchSummary();
        await fetchAdmins();
      } else {
        alert(json.error || 'Promotion failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Promotion failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Demotion
  const handleDemote = async (targetUserId: string) => {
    if (!confirm('Are you sure you want to demote this Primary Super Administrator back to Admin status?')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/governance/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          action: 'DEMOTE',
          reason: 'Demoted via Founder Command Center',
        }),
      });

      const json = await res.json();
      if (res.ok) {
        await fetchSummary();
        await fetchAdmins();
      } else {
        alert(json.error || 'Demotion failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Demotion failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle system settings change (Lockdown, Read Only, Maintenance)
  const handleSystemSettingToggle = async (settingName: 'lockdown' | 'readOnly' | 'maintenanceMode', currentValue: boolean) => {
    setLockdownLoading(true);
    try {
      const res = await fetch('/api/admin/governance/lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [settingName]: !currentValue,
          reason: `Toggled ${settingName} via Founder Controls`,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        await fetchSummary();
      } else {
        alert(json.error || 'Failed to update system settings.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating settings.');
    } finally {
      setLockdownLoading(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest text-slate-500">Authenticating Immortal Access...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-6">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold tracking-wider uppercase">Governance Connection Refused</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-md text-center">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] border border-slate-200 text-xs uppercase font-bold tracking-widest rounded"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8">
      {/* Header Banner */}
      <div className="border border-slate-200/80 bg-[#121212]/50 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/30 rounded-full filter blur-[80px] -z-10 pointer-events-none" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-[#0B4C8C] text-[9px] font-bold uppercase tracking-widest rounded-full">
              👑 Immortal
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Founder Console</span>
          </div>
          <h1 className="text-3xl font-light tracking-tight">Supreme Platform Control</h1>
          <p className="text-xs text-slate-800/50">Permanent platform ownership, operational governance & security override.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            className="p-2.5 bg-[#1C1C1C] hover:bg-[#252525] border border-slate-200/80 hover:border-slate-200 rounded-lg text-slate-800/60 hover:text-slate-800 transition-all"
            title="Refresh Governance State"
          >
            <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#252525] border border-slate-200/80 text-xs uppercase tracking-widest font-semibold rounded-lg transition-all"
          >
            Exit Console
          </button>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-slate-800/5 group-hover:text-[#0B4C8C]/10 transition-colors">
            <Shield size={20} />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">System Integrity</span>
          <span className="text-2xl font-light text-green-400 mt-2 block">
            {data?.systemIntegrity?.founderStatus?.lockEnabled ? 'SECURE' : 'COMPROMISED'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-2 border-t border-slate-200/80 pt-2">Governance Lock Enforced</span>
        </div>

        <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-slate-800/5 group-hover:text-[#0B4C8C]/10 transition-colors">
            <Users size={20} />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Primary Super Admins</span>
          <span className="text-2xl font-light text-[#0B4C8C] mt-2 block">{data?.stats?.totalPrimarySAs} Active</span>
          <span className="text-[10px] text-slate-500 block mt-2 border-t border-slate-200/80 pt-2">Operational SAs registered</span>
        </div>

        <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-slate-800/5 group-hover:text-red-500/10 transition-colors">
            <ShieldAlert size={20} />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Security Threat Alerts</span>
          <span className={`text-2xl font-light mt-2 block ${data?.securityAlerts?.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {data?.securityAlerts?.length || 0} Alerts
          </span>
          <span className="text-[10px] text-slate-500 block mt-2 border-t border-slate-200/80 pt-2">SOC Threat Registry feed</span>
        </div>

        <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-slate-800/5 group-hover:text-[#0B4C8C]/10 transition-colors">
            <Activity size={20} />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Platform Mode</span>
          <span className={`text-2xl font-light mt-2 block ${data?.settings?.global_lockdown ? 'text-red-500 animate-pulse' : 'text-[#0B4C8C]'}`}>
            {data?.settings?.global_lockdown ? '🔒 LOCKDOWN' : '🟢 ACTIVE'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-2 border-t border-slate-200/80 pt-2">Global system mutability</span>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200/80 gap-2 mb-8 overflow-x-auto">
        {[
          { id: 'governance', label: 'Governance Center', icon: <Shield size={14} /> },
          { id: 'soc', label: 'Security Operations (SOC)', icon: <ShieldAlert size={14} /> },
          { id: 'integrity', label: 'System Integrity Check', icon: <HardDrive size={14} /> },
          { id: 'emergency', label: 'Emergency Controls', icon: <AlertTriangle size={14} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 border-b-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#0B4C8C] text-slate-800 bg-white/[0.02]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-8">
        {activeTab === 'governance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Primary Super Admin Registry */}
            <div className="lg:col-span-8 bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-6">
              <h2 className="text-lg font-light tracking-wide border-b border-slate-200/80 pb-3 flex items-center gap-2">
                <Users className="text-[#0B4C8C]" size={18} />
                <span>Primary Super Administrator Registry</span>
              </h2>

              <div className="space-y-4">
                {data?.primarySAs?.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-xs border border-slate-200/80 rounded-lg">
                    No Primary Super Administrators registered.
                  </div>
                ) : (
                  data?.primarySAs?.map((sa: any) => (
                    <div key={sa.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-200 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{sa.name || 'Anonymous Admin'}</span>
                          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[8px] uppercase tracking-wider rounded">
                            PRIMARY SA
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{sa.email}</p>
                        <p className="text-[9px] text-slate-400 mt-2">
                          Promoted at: {new Date(sa.promotedAt).toLocaleDateString()} by {sa.promotedBy?.name || 'Founder'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDemote(sa.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 border border-red-500/20 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] uppercase font-bold tracking-widest rounded transition-all flex items-center gap-1.5"
                      >
                        <UserMinus size={12} />
                        <span>Demote to Admin</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Promotion Form */}
              <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-xl space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-bold">Appoint Primary Super Admin</h3>
                <form onSubmit={handlePromote} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Select Administrator</label>
                      <select
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200/80 rounded px-3 py-2 text-xs text-slate-800/80 focus:border-[#0B4C8C]/45 focus:outline-none"
                      >
                        <option value="">-- Choose Admin User --</option>
                        {adminsList.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name || 'Admin'} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Promotion Justification Reason</label>
                      <input
                        type="text"
                        placeholder="E.g. Assigning operational governance limits"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="w-full bg-white border border-slate-200/80 rounded px-3 py-2 text-xs text-slate-800/80 focus:border-[#0B4C8C]/45 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading || !selectedAdminId}
                    className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase tracking-widest font-bold rounded transition-colors disabled:opacity-50"
                  >
                    Promote user
                  </button>
                </form>
              </div>
            </div>

            {/* Governance Timeline */}
            <div className="lg:col-span-4 bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800/80 border-b border-slate-200/80 pb-2">
                Governance Audit Log
              </h2>
              {data?.governanceHistory?.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-xs">No records available.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {data?.governanceHistory?.map((log: any) => (
                    <div key={log.id} className="text-xs border-b border-slate-200/80 pb-3 last:border-0 last:pb-0 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-[#0B4C8C]">{log.reason || 'Governance Action'}</span>
                        <span className="text-[9px] text-slate-500">{new Date(log.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-800/60">
                        Actor ID: <code className="text-slate-500 bg-white/5 px-1 rounded">{log.actorId}</code>
                      </p>
                      <div className="flex gap-2 text-[9px]">
                        <span className="text-slate-500">Previous: {log.previousRole || 'NONE'}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-blue-400">New: {log.newRole}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'soc' && (
          <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-6">
            <h2 className="text-lg font-light tracking-wide border-b border-slate-200/80 pb-3 flex items-center gap-2">
              <ShieldAlert className="text-red-500 animate-pulse" size={18} />
              <span>Security Operations Center (SOC) Threat Console</span>
            </h2>

            {data?.securityAlerts?.length === 0 ? (
              <div className="p-12 text-center text-green-400 italic text-xs border border-green-500/10 bg-green-500/5 rounded-lg">
                No active threats detected. Platform integrity verified.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.securityAlerts?.map((alert: any) => (
                  <div key={alert.id} className="p-4 bg-[#110505] border border-red-500/25 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] uppercase tracking-wider font-extrabold rounded">
                        {alert.severity} THREAT
                      </span>
                      <span className="text-[10px] text-slate-500">{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-red-200">{alert.description}</h4>
                      <p className="text-[10px] text-slate-500">Type: {alert.type}</p>
                    </div>
                    <div className="text-[10px] text-slate-800/50 border-t border-red-500/10 pt-2 flex justify-between">
                      <span>Target user: {alert.admin?.name || 'SYSTEM'}</span>
                      <span>Actor email: {alert.admin?.email || 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'integrity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* System Status Dashboard */}
            <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-6">
              <h2 className="text-lg font-light tracking-wide border-b border-slate-200/80 pb-3 flex items-center gap-2">
                <Heart className="text-green-500" size={18} />
                <span>Founder Account Health Check</span>
              </h2>

              <div className="space-y-4">
                {[
                  { label: 'Founder Account Existence', status: data?.systemIntegrity?.founderStatus?.exists },
                  { label: 'Founder Profile Role intact', status: data?.systemIntegrity?.founderStatus?.roleIntact },
                  { label: 'Founder Account status ACTIVE', status: data?.systemIntegrity?.founderStatus?.active },
                  { label: 'Governance Lock active', status: data?.systemIntegrity?.founderStatus?.lockEnabled },
                  { label: 'Granular permissions verified', status: data?.systemIntegrity?.founderStatus?.permissionsIntact }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <span className="text-xs text-slate-800/80">{item.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.status ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'
                    }`}>
                      {item.status ? 'VERIFIED' : 'REPAIR REQUIRED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Health Diagnostic */}
            <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-6">
              <h2 className="text-lg font-light tracking-wide border-b border-slate-200/80 pb-3 flex items-center gap-2">
                <Settings className="text-[#0B4C8C]" size={18} />
                <span>Governance Integrity Matrix</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">Founder Email</span>
                    <code className="text-slate-500">{data?.systemIntegrity?.founderStatus?.email}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">Active Primary Super Admins</span>
                    <span className="text-[#0B4C8C]">{data?.systemIntegrity?.primarySACount} active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">Integrity validation status</span>
                    <span className="text-green-400">PASSED</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/30 border border-blue-200 rounded-lg text-slate-800/70 space-y-2">
                  <h4 className="font-bold text-[#0B4C8C] text-xs flex items-center gap-1">
                    <Info size={14} />
                    <span>Governance Validation Policy</span>
                  </h4>
                  <p className="text-[10px] leading-relaxed">
                    The platform owner (Aryan Mishra) is assigned permanent IMMORTAL protections. 
                    Any corruption or removal of Founder permissions will trigger the bootstrap self-repair hook 
                    on startup, logging the correction in Governance Timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'emergency' && (
          <div className="bg-[#121212] border border-slate-200/80 p-6 rounded-xl space-y-6">
            <h2 className="text-lg font-light tracking-wide border-b border-slate-200/80 pb-3 flex items-center gap-2">
              <AlertTriangle className="text-red-500 animate-bounce" size={18} />
              <span>Platform Emergency Controls Console</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Lockdown Mode Card */}
              <div className="p-6 bg-[#180B0B] border border-red-500/20 rounded-xl space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-red-400 text-xs uppercase tracking-widest">Global Lockdown</span>
                    {data?.settings?.global_lockdown ? (
                      <Lock size={16} className="text-red-500" />
                    ) : (
                      <Unlock size={16} className="text-slate-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-800/60 leading-relaxed">
                    Completely suspends logins for all standard users and admins. Disables all API mutation operations 
                    (POST, PUT, DELETE) and halts lead CRM flow completely. Only the Founder can bypass this.
                  </p>
                </div>
                <button
                  disabled={lockdownLoading}
                  onClick={() => handleSystemSettingToggle('lockdown', data?.settings?.global_lockdown)}
                  className={`w-full py-2.5 rounded text-[10px] uppercase tracking-widest font-extrabold border transition-all ${
                    data?.settings?.global_lockdown
                      ? 'bg-transparent border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500'
                      : 'bg-red-500 border-red-500 text-slate-800 hover:bg-red-600 hover:border-red-600'
                  }`}
                >
                  {data?.settings?.global_lockdown ? 'Deactivate Lockdown' : 'Activate Lockdown'}
                </button>
              </div>

              {/* Read-Only Mode Card */}
              <div className="p-6 bg-[#0E1524] border border-blue-500/20 rounded-xl space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-blue-400 text-xs uppercase tracking-widest">Read-Only Mode</span>
                    <Eye size={16} className={data?.settings?.read_only ? 'text-blue-500' : 'text-slate-500'} />
                  </div>
                  <p className="text-[10px] text-slate-800/60 leading-relaxed">
                    Disables all create, update, and delete actions platform-wide, allowing users to browse property 
                    listings, directories, and profiles while preventing database updates.
                  </p>
                </div>
                <button
                  disabled={lockdownLoading}
                  onClick={() => handleSystemSettingToggle('readOnly', data?.settings?.read_only)}
                  className={`w-full py-2.5 rounded text-[10px] uppercase tracking-widest font-extrabold border transition-all ${
                    data?.settings?.read_only
                      ? 'bg-transparent border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500'
                      : 'bg-blue-500 border-blue-500 text-slate-800 hover:bg-blue-600 hover:border-blue-600'
                  }`}
                >
                  {data?.settings?.read_only ? 'Disable Read-Only' : 'Enable Read-Only'}
                </button>
              </div>

              {/* Maintenance Mode Card */}
              <div className="p-6 bg-[#1C160B] border border-amber-500/20 rounded-xl space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-amber-400 text-xs uppercase tracking-widest">Maintenance Mode</span>
                    <Radio size={16} className={data?.settings?.maintenance_mode ? 'text-amber-500 animate-pulse' : 'text-slate-500'} />
                  </div>
                  <p className="text-[10px] text-slate-800/60 leading-relaxed">
                    Redirects standard traffic to a maintenance placeholder view. Admins and Founder bypass this 
                    redirect to complete repairs, patches, or verification.
                  </p>
                </div>
                <button
                  disabled={lockdownLoading}
                  onClick={() => handleSystemSettingToggle('maintenanceMode', data?.settings?.maintenance_mode)}
                  className={`w-full py-2.5 rounded text-[10px] uppercase tracking-widest font-extrabold border transition-all ${
                    data?.settings?.maintenance_mode
                      ? 'bg-transparent border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500'
                      : 'bg-amber-500 border-amber-500 text-slate-800 hover:bg-amber-600 hover:border-amber-600'
                  }`}
                >
                  {data?.settings?.maintenance_mode ? 'Disable Maintenance' : 'Enable Maintenance'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
