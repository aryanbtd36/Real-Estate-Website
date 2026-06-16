'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  Search,
  LogOut,
  Lock,
  RefreshCw,
  Unlock,
  KeyRound,
  ShieldAlert,
  Monitor,
  Laptop,
  Smartphone,
  Globe,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SessionMonitoringPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [filterActiveOnly]);

  const fetchSessions = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/admin/security/sessions?active=${filterActiveOnly}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAction = async (action: 'TERMINATE_SESSION' | 'TERMINATE_ALL' | 'LOCK_ACCOUNT' | 'FORCE_PASSWORD_RESET', id: string) => {
    const confirmMessage = 
      action === 'LOCK_ACCOUNT' ? 'Are you sure you want to SUSPEND this admin and force-logout all active sessions immediately?' :
      action === 'FORCE_PASSWORD_RESET' ? 'Are you sure you want to invalidate their password and force them to execute a password reset flow?' :
      action === 'TERMINATE_ALL' ? 'Force logout ALL sessions for this user?' :
      'Terminate this specific session?';

    if (!confirm(confirmMessage)) return;

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
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Operation failed');
      } else {
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getDeviceIcon = (device: string) => {
    if (device?.toLowerCase()?.includes('mobile') || device?.toLowerCase()?.includes('phone')) {
      return <Smartphone size={16} className="text-white/40" />;
    }
    if (device?.toLowerCase()?.includes('tablet')) {
      return <Smartphone size={16} className="text-white/40" />;
    }
    return <Laptop size={16} className="text-white/40" />;
  };

  const filteredSessions = sessions.filter((s) => {
    const text = (s.user?.name || '') + ' ' + (s.user?.email || '') + ' ' + (s.ipAddress || '') + ' ' + (s.location || '');
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/admin/security"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-[#D4AF37] transition-colors font-semibold"
      >
        <ArrowLeft size={12} />
        Back to SOC dashboard
      </Link>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <Monitor className="text-[#D4AF37] animate-pulse" size={28} />
            Active Session Control
          </h1>
          <p className="text-sm text-white/45 mt-1.5">
            Monitor real-time active connections, trace remote host locations, and execute forced logouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#161616] p-0.5 border border-white/5 rounded-lg shrink-0 text-xs">
            <button
              onClick={() => setFilterActiveOnly(true)}
              className={`px-3 py-1.5 rounded uppercase font-semibold transition-colors ${
                filterActiveOnly ? 'bg-[#D4AF37]/15 text-[#F5D67B]' : 'text-white/40'
              }`}
            >
              Active Only
            </button>
            <button
              onClick={() => setFilterActiveOnly(false)}
              className={`px-3 py-1.5 rounded uppercase font-semibold transition-colors ${
                !filterActiveOnly ? 'bg-[#D4AF37]/15 text-[#F5D67B]' : 'text-white/40'
              }`}
            >
              All History
            </button>
          </div>
          <button
            onClick={fetchSessions}
            disabled={refreshing}
            className="p-2.5 bg-[#161616] hover:bg-white/5 border border-white/10 rounded text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search and Table Directory */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h3 className="text-sm uppercase tracking-wider font-semibold text-white/80">Logged-in Administrators</h3>
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search by name, email, IP, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2 pl-9 rounded-lg text-xs outline-none transition-colors"
            />
            <Search className="absolute left-3 top-2.5 text-white/40" size={12} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/5 rounded-lg">
            <Globe size={36} className="text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/45">No session records found matching filter parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                  <th className="pb-3 font-semibold">User Details</th>
                  <th className="pb-3 font-semibold">Connection Details</th>
                  <th className="pb-3 font-semibold">Login / Last Activity</th>
                  <th className="pb-3 font-semibold">Access State</th>
                  <th className="pb-3 text-right font-semibold">Emergency Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 pr-3">
                      <span className="font-semibold text-white block">{s.user?.name || 'Anonymous User'}</span>
                      <span className="text-[10px] text-white/40 font-mono mt-0.5 block">{s.user?.email}</span>
                      <span className="text-[8px] uppercase tracking-wider text-[#D4AF37] mt-1 inline-block font-mono">
                        {s.user?.role}
                      </span>
                    </td>
                    <td className="py-4 pr-3 space-y-1">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(s.device)}
                        <span className="text-white/80">{s.browser} on {s.operatingSystem}</span>
                      </div>
                      <div className="text-[10px] text-white/40 font-mono">
                        Host IP: {s.ipAddress || 'Internal'} ({s.location})
                      </div>
                    </td>
                    <td className="py-4 pr-3 space-y-1 font-mono text-[10px] text-white/50">
                      <div>Login: {new Date(s.loginAt).toLocaleString()}</div>
                      <div>Active: {new Date(s.lastActivityAt).toLocaleString()}</div>
                    </td>
                    <td className="py-4">
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-extrabold font-mono text-green-400 bg-green-500/5 px-2 py-0.5 border border-green-500/20 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-extrabold font-mono text-white/30 bg-white/5 px-2 py-0.5 border border-transparent rounded">
                          Logged out
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      {s.isActive ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAction('TERMINATE_SESSION', s.id)}
                            title="Force terminate this session"
                            className="p-1.5 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-white/60 hover:text-red-400 rounded transition-colors"
                          >
                            <LogOut size={13} />
                          </button>
                          <button
                            onClick={() => handleAction('TERMINATE_ALL', s.user.id)}
                            title="Force logout all sessions for this user"
                            className="p-1.5 bg-white/5 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 text-white/60 hover:text-orange-400 rounded transition-colors"
                          >
                            <LogOut size={13} className="rotate-185" />
                          </button>
                          <button
                            onClick={() => handleAction('FORCE_PASSWORD_RESET', s.user.id)}
                            title="Force account password reset"
                            className="p-1.5 bg-white/5 hover:bg-yellow-500/10 border border-white/5 hover:border-yellow-500/30 text-white/60 hover:text-yellow-400 rounded transition-colors"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            onClick={() => handleAction('LOCK_ACCOUNT', s.user.id)}
                            title="Suspend user account"
                            className="p-1.5 bg-white/5 hover:bg-red-600/15 border border-white/5 hover:border-red-600/40 text-red-500/60 hover:text-red-500 rounded transition-colors"
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/20 font-mono">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
