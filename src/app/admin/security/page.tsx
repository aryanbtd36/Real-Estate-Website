'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  Clock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Ban,
  Activity,
  ArrowRight,
  Eye,
  RefreshCw,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SecurityDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setRefreshing(true);
      const [statsRes, alertsRes] = await Promise.all([
        fetch('/api/admin/security/stats'),
        fetch('/api/admin/security/alerts')
      ]);

      if (statsRes.ok && alertsRes.ok) {
        const statsData = await statsRes.json();
        const alertsData = await alertsRes.json();
        setStats(statsData);
        setAlerts(alertsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/admin/security/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      });
      if (res.ok) {
        loadSecurityData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resolve alert');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8">
        <div className="h-6 w-32 bg-white/5 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/5 rounded-xl" />)}
        </div>
        <div className="h-96 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <ShieldAlert className="text-red-500" size={28} />
            Security Operations Center (SOC)
          </h1>
          <p className="text-sm text-white/45 mt-1.5">
            Real-time session logging, threat analytics, and administrator operations audit logs.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/security/sessions"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs uppercase tracking-wider font-semibold transition-colors"
          >
            Monitor sessions
          </Link>
          <button
            onClick={loadSecurityData}
            disabled={refreshing}
            className="p-2.5 bg-[#161616] hover:bg-white/5 border border-white/10 rounded text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Sessions', val: stats.activeSessions, desc: 'Logged-in administrators', border: 'border-white/5' },
            { label: 'Failed Logins (24h)', val: stats.failedLogins, desc: 'Plaintext/invalid attempts', border: 'border-white/5', valColor: stats.failedLogins > 3 ? 'text-amber-500' : 'text-[#D4AF37]' },
            { label: 'Active Alerts', val: stats.securityAlerts, desc: 'Behavior anomaly issues', border: stats.securityAlerts > 0 ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/5', valColor: stats.securityAlerts > 0 ? 'text-red-500 font-bold' : 'text-[#D4AF37]' },
            { label: 'Sensitive Actions (7d)', val: stats.sensitiveActions, desc: 'Logouts, revokes, status edits', border: 'border-white/5' }
          ].map((c, i) => (
            <div key={i} className={`p-5 rounded-xl space-y-1 relative overflow-hidden border ${c.border}`}>
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">{c.label}</span>
              <div className={`text-3xl font-light ${c.valColor || 'text-[#D4AF37]'}`}>{c.val}</div>
              <span className="text-[10px] text-white/30 block mt-1 leading-snug">{c.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Real-time security logs feed */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-semibold text-white/80">Security Threat Alert Log</h3>
            <p className="text-[10px] text-white/40 mt-1">Warnings generated automatically by behavior analytics modules.</p>
          </div>
          <span className="text-[10px] text-white/45 bg-black/40 border border-white/5 px-2 py-0.5 rounded font-mono">
            {alerts.length} Total Alerts
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/5 rounded-xl">
            <CheckCircle size={36} className="text-green-500/50 mx-auto mb-2" />
            <p className="text-sm text-green-400">Zero active security alerts triggered. System health optimal.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  alert.resolved
                    ? 'border-white/5 bg-black/10 opacity-60'
                    : alert.severity === 'CRITICAL'
                    ? 'border-red-500/30 bg-red-500/[0.03]'
                    : alert.severity === 'HIGH'
                    ? 'border-orange-500/30 bg-orange-500/[0.03]'
                    : 'border-white/10 bg-[#1A1A1A]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-1 shrink-0">
                    {alert.resolved ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? (
                      <AlertTriangle size={18} className="text-red-500 animate-bounce" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">{alert.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold font-mono ${
                        alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                        alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/5 text-white/50'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/45 mt-1 leading-relaxed">{alert.type}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/30 font-mono mt-2 flex-wrap">
                      <div>Admin: {alert.admin?.name || alert.admin?.email || 'System'}</div>
                      <div>Triggered: {new Date(alert.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {!alert.resolved ? (
                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      className="py-1.5 px-3 bg-white/5 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 text-[10px] font-bold text-white hover:text-green-400 rounded uppercase tracking-wider transition-all"
                    >
                      Resolve alert
                    </button>
                  ) : (
                    <span className="text-[9px] uppercase tracking-widest text-green-500 font-bold bg-green-500/5 px-2 py-0.5 border border-green-500/20 rounded">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
