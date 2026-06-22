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
    let style = 'border-slate-200 bg-slate-50 text-slate-500';

    switch (act) {
      case 'LOGIN':
        icon = LogIn;
        style = 'border-emerald-250 bg-emerald-50 text-emerald-700';
        break;
      case 'LOGOUT':
        icon = LogOut;
        style = 'border-slate-200 bg-slate-50 text-slate-500';
        break;
      case 'PROPERTY_VIEW':
        icon = Eye;
        style = 'border-sky-200 bg-sky-50 text-sky-700';
        break;
      case 'PROPERTY_SAVE':
        icon = Star;
        style = 'border-amber-250 bg-amber-50 text-amber-700';
        break;
      case 'PROPERTY_UNSAVE':
        icon = X;
        style = 'border-rose-250 bg-rose-50 text-rose-700';
        break;
      case 'INQUIRY_CREATE':
        icon = Mail;
        style = 'border-purple-200 bg-purple-50 text-purple-750';
        break;
      case 'APPOINTMENT_CREATE':
        icon = Calendar;
        style = 'border-teal-200 bg-teal-50 text-teal-700';
        break;
      case 'APPOINTMENT_UPDATE':
        icon = Activity;
        style = 'border-cyan-205 bg-cyan-50 text-cyan-700';
        break;
      case 'USER_SUSPEND':
        icon = UserX;
        style = 'border-rose-250 bg-rose-50 text-rose-700';
        break;
      case 'USER_RESTORE':
        icon = UserCheck;
        style = 'border-emerald-255 bg-emerald-50 text-emerald-700';
        break;
      case 'ROLE_PROMOTE':
        icon = ShieldCheck;
        style = 'border-blue-200 bg-blue-50 text-[#0B4C8C]';
        break;
      case 'ROLE_REVOKE':
        icon = ShieldAlert;
        style = 'border-orange-250 bg-orange-50 text-orange-700';
        break;
      case 'PASSWORD_RESET_REQUEST':
      case 'PASSWORD_RESET_COMPLETE':
        icon = Key;
        style = 'border-pink-205 bg-pink-50 text-pink-700';
        break;
      case 'EMAIL_VERIFIED':
        icon = BadgeCheck;
        style = 'border-indigo-200 bg-indigo-50 text-indigo-700';
        break;
    }

    const Icon = icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border text-[10px] rounded-md uppercase font-extrabold shadow-3xs ${style}`}>
        <Icon size={10} />
        <span>{act.replace('_', ' ')}</span>
      </span>
    );
  };

  return (
    <div className="space-y-8 relative text-[#0F172A]">
      {/* Welcome Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Security Operations</span>
        <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Audit Trail Explorer</h1>
        <p className="text-xs text-slate-500 mt-1">Platform operations, system-wide triggers, and authorization metrics.</p>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-[24px] border border-slate-200/80 shadow-sm">
        <div className="md:col-span-8 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search descriptions, actors, target emails..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none transition-all h-10 font-semibold"
          />
        </div>
        <div className="md:col-span-4">
          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="w-full px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-[#0B4C8C] hover:border-slate-350 focus:outline-none transition-all h-10 font-semibold appearance-none text-center"
          >
            <option value="">All Actions</option>
            {ACTIVITY_ACTIONS.map(act => (
              <option key={act} value={act}>{act.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-[24px] border border-slate-200/80 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs uppercase tracking-widest text-slate-450 font-semibold font-mono">Syncing audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-slate-500 font-semibold italic">No audit records found matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/85 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action Trigger</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Actor</th>
                  <th className="py-4 px-6">Affected Target</th>
                  <th className="py-4 px-6 text-right">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-750 font-medium">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap text-slate-450 font-semibold">
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
                          <p className="font-bold text-slate-900">{log.actor.name || 'Anonymous'}</p>
                          <p className="text-[10px] text-slate-450 font-semibold">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System / Visitor</span>
                      )}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {log.targetUser ? (
                        <div>
                          <p className="font-bold text-slate-900">{log.targetUser.name || 'Anonymous'}</p>
                          <p className="text-[10px] text-slate-450 font-semibold">{log.targetUser.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedDetails({ action: log.action, details: log.details })}
                          className="px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 hover:text-[#0B4C8C] rounded-md flex items-center gap-1 text-[10px] font-extrabold transition-all ml-auto focus:outline-none shadow-3xs"
                        >
                          <Code size={11} />
                          <span>View JSON</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">No metadata</span>
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Showing {logs.length} of {total} records (Page {page} of {totalPages})</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-extrabold hover:bg-slate-50 disabled:opacity-35 transition-all text-slate-700 shadow-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-extrabold hover:bg-slate-50 disabled:opacity-35 transition-all text-slate-700 shadow-xs"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white border border-slate-200 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-2">
                  <Code className="text-[#0B4C8C]" size={16} />
                  <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Event Context: {selectedDetails.action}</h3>
                </div>
                <button 
                  onClick={() => setSelectedDetails(null)}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-650 transition-colors border border-slate-200 shadow-3xs"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Code Panel */}
              <div className="p-5 overflow-y-auto flex-1 bg-slate-950 border-y border-slate-200 text-xs text-emerald-400 font-mono leading-relaxed custom-scrollbar">
                <pre>{JSON.stringify(selectedDetails.details, null, 2)}</pre>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50/50 text-right">
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 border border-[#0B4C8C]/20 rounded-lg text-xs font-extrabold text-white transition-colors focus:outline-none shadow-xs"
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
