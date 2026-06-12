'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Activity, 
  Eye, 
  Star, 
  Mail, 
  Calendar, 
  LogIn, 
  LogOut, 
  Key, 
  BadgeCheck, 
  UserX, 
  UserCheck, 
  ShieldCheck, 
  ShieldAlert, 
  X,
  Clock,
  Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Available action types from Prisma enum
const ACTIVITY_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'PROPERTY_VIEW',
  'PROPERTY_SAVE',
  'PROPERTY_UNSAVE',
  'PROPERTY_CREATE',
  'PROPERTY_UPDATE',
  'PROPERTY_DELETE',
  'INQUIRY_CREATE',
  'INQUIRY_UPDATE',
  'INQUIRY_DELETE',
  'APPOINTMENT_CREATE',
  'APPOINTMENT_UPDATE',
  'APPOINTMENT_DELETE',
  'USER_SUSPEND',
  'USER_RESTORE',
  'ROLE_PROMOTE',
  'ROLE_REVOKE',
  'PASSWORD_RESET_REQUEST',
  'PASSWORD_RESET_COMPLETE',
  'EMAIL_VERIFIED',
  'SYSTEM_EVENT'
];

interface AuditLog {
  id: string;
  action: string;
  description: string;
  details: any;
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
  targetUser?: { id: string; name: string; email: string; role: string } | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        search,
        action,
        page: page.toString(),
        limit: '20',
      });
      const res = await fetch(`/api/admin/audit-logs?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, action, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Match enums to beautiful styled icons
  const getActionBadge = (act: string) => {
    let icon = Clock;
    let style = 'border-slate-500/30 bg-slate-500/5 text-slate-400';

    switch (act) {
      case 'LOGIN':
        icon = LogIn;
        style = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
        break;
      case 'LOGOUT':
        icon = LogOut;
        style = 'border-slate-500/20 bg-slate-500/5 text-slate-400';
        break;
      case 'PROPERTY_VIEW':
        icon = Eye;
        style = 'border-sky-500/20 bg-sky-500/5 text-sky-400';
        break;
      case 'PROPERTY_SAVE':
        icon = Star;
        style = 'border-amber-500/20 bg-amber-500/5 text-amber-400';
        break;
      case 'PROPERTY_UNSAVE':
        icon = X;
        style = 'border-rose-500/20 bg-rose-500/5 text-rose-400';
        break;
      case 'INQUIRY_CREATE':
        icon = Mail;
        style = 'border-purple-500/20 bg-purple-500/5 text-purple-400';
        break;
      case 'APPOINTMENT_CREATE':
        icon = Calendar;
        style = 'border-teal-500/20 bg-teal-500/5 text-teal-400';
        break;
      case 'APPOINTMENT_UPDATE':
        icon = Activity;
        style = 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400';
        break;
      case 'USER_SUSPEND':
        icon = UserX;
        style = 'border-rose-500/35 bg-rose-500/5 text-rose-500';
        break;
      case 'USER_RESTORE':
        icon = UserCheck;
        style = 'border-green-500/20 bg-green-500/5 text-green-400';
        break;
      case 'ROLE_PROMOTE':
        icon = ShieldCheck;
        style = 'border-yellow-500/35 bg-yellow-500/5 text-[#F5D67B]';
        break;
      case 'ROLE_REVOKE':
        icon = ShieldAlert;
        style = 'border-orange-500/20 bg-orange-500/5 text-orange-400';
        break;
      case 'PASSWORD_RESET_REQUEST':
      case 'PASSWORD_RESET_COMPLETE':
        icon = Key;
        style = 'border-pink-500/20 bg-pink-500/5 text-pink-400';
        break;
      case 'EMAIL_VERIFIED':
        icon = BadgeCheck;
        style = 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400';
        break;
    }

    const Icon = icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border text-[10px] rounded uppercase font-semibold ${style}`}>
        <Icon size={10} />
        <span>{act.replace('_', ' ')}</span>
      </span>
    );
  };

  return (
    <div className="space-y-8 relative">
      {/* Welcome Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Security Operations</span>
        <h1 className="text-3xl font-light tracking-tight mt-1">Audit Trail Explorer</h1>
        <p className="text-xs text-white/50 mt-1">Platform operations, system-wide triggers, and authorization metrics.</p>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#161616] p-4 rounded-xl border border-white/5">
        <div className="md:col-span-8 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input
            type="text"
            placeholder="Search descriptions, actors, target emails..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="md:col-span-4">
          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          >
            <option value="">All Actions</option>
            {ACTIVITY_ACTIONS.map(act => (
              <option key={act} value={act}>{act.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#161616] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs uppercase tracking-widest text-white/40">Syncing audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-white/40 italic">No audit records found matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] uppercase tracking-widest text-white/45 font-semibold">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action Trigger</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Actor</th>
                  <th className="py-4 px-6">Affected Target</th>
                  <th className="py-4 px-6 text-right">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-white/70">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.005] transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap text-white/40">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-4 px-6 leading-relaxed max-w-[280px]">
                      {log.description}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {log.actor ? (
                        <div>
                          <p className="font-semibold text-white">{log.actor.name || 'Anonymous'}</p>
                          <p className="text-[10px] text-white/40">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-white/30 italic">System / Visitor</span>
                      )}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {log.targetUser ? (
                        <div>
                          <p className="font-semibold text-white">{log.targetUser.name || 'Anonymous'}</p>
                          <p className="text-[10px] text-white/40">{log.targetUser.email}</p>
                        </div>
                      ) : (
                        <span className="text-white/20">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedDetails({ action: log.action, details: log.details })}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center gap-1 text-[10px] text-white/75 hover:text-[#D4AF37] transition-all ml-auto focus:outline-none"
                        >
                          <Code size={11} />
                          <span>View JSON</span>
                        </button>
                      ) : (
                        <span className="text-white/20 italic text-[10px]">No metadata</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <span className="text-xs text-white/45">Showing {logs.length} of {total} records (Page {page} of {totalPages})</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || loading}
                className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10 hover:border-white/20 disabled:opacity-35 transition-all text-white"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || loading}
                className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10 hover:border-white/20 disabled:opacity-35 transition-all text-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata JSON Modal */}
      <AnimatePresence>
        {selectedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#161616] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <div className="flex items-center space-x-2">
                  <Code className="text-[#D4AF37]" size={16} />
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Event Context: {selectedDetails.action}</h3>
                </div>
                <button 
                  onClick={() => setSelectedDetails(null)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Code Panel */}
              <div className="p-5 overflow-y-auto flex-1 bg-[#0A0A0A] border-y border-white/5 text-xs text-emerald-400 font-mono leading-relaxed custom-scrollbar">
                <pre>{JSON.stringify(selectedDetails.details, null, 2)}</pre>
              </div>

              {/* Footer */}
              <div className="p-4 bg-white/[0.01] text-right">
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded text-xs font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-colors focus:outline-none"
                >
                  Close Context
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
