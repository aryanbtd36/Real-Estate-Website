'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  Clock,
  User,
  Activity,
  Globe,
  Monitor,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  KeyRound,
  FileText
} from 'lucide-react';

function SecurityTimelineContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const sessionIdParam = searchParams.get('sessionId');

  const [userId, setUserId] = useState(userIdParam || '');
  const [sessionId, setSessionId] = useState(sessionIdParam || '');
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userIdParam || sessionIdParam) {
      loadTimeline();
    }
  }, [userIdParam, sessionIdParam]);

  const loadTimeline = async () => {
    if (!userId && !sessionId) {
      setError('Please provide a User ID or Session ID');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/security/timeline?userId=${userId}&sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setTimelineData(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch timeline');
      }
    } catch (err) {
      console.error(err);
      setError('Internal server error loading timeline data.');
    } finally {
      setLoading(false);
    }
  };

  const getEventIconAndStyle = (type: string, severity: string) => {
    const isCritical = severity === 'CRITICAL' || severity === 'HIGH';
    switch (type) {
      case 'SECURITY_ALERT':
        return {
          icon: AlertTriangle,
          border: 'border-red-500/20 bg-red-500/[0.02]',
          iconColor: 'text-red-500',
        };
      case 'SECURITY_EVENT':
        return {
          icon: ShieldAlert,
          border: isCritical ? 'border-red-500/20 bg-red-500/[0.02]' : 'border-amber-500/20 bg-amber-500/[0.02]',
          iconColor: isCritical ? 'text-red-500' : 'text-amber-500',
        };
      case 'ADMIN_ACTION':
        return {
          icon: Activity,
          border: 'border-blue-500/15 bg-blue-500/[0.02]',
          iconColor: 'text-blue-400',
        };
      case 'LOGIN_ATTEMPT':
        return {
          icon: KeyRound,
          border: 'border-purple-500/15 bg-purple-500/[0.02]',
          iconColor: 'text-purple-400',
        };
      default:
        return {
          icon: Clock,
          border: 'border-slate-200/80 bg-[#141414]',
          iconColor: 'text-slate-500',
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/security"
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-light tracking-wide flex items-center gap-2">
              <Activity className="text-[#0B4C8C]" size={20} />
              SOC Incident Investigation Timeline
            </h1>
            <p className="text-[10px] text-slate-500">Reconstruct step-by-step logs and session audits.</p>
          </div>
        </div>
      </div>

      {/* Query Filter panel */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="uuid-of-user..."
            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Session ID</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="uuid-of-session..."
            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
          />
        </div>
        <button
          onClick={loadTimeline}
          disabled={loading}
          className="px-5 py-2.5 bg-[#0B4C8C] hover:bg-[#093d70] text-white font-bold uppercase tracking-wider text-[10px] rounded transition-colors flex items-center gap-1.5"
        >
          {loading ? <RefreshCw className="animate-spin" size={12} /> : <Search size={12} />}
          Investigate
        </button>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-3 rounded">{error}</div>}

      {/* Timeline output */}
      {timelineData && (
        <div className="space-y-6">
          {/* User metadata header */}
          <div className="bg-gradient-to-r from-[#0B4C8C]/5 to-transparent border border-slate-200/80 p-4 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0B4C8C]">
              <User size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-800">Target profile: {timelineData.email || 'Anonymous'}</span>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">User ID: {timelineData.userId}</div>
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="relative border-l border-slate-200/80 pl-6 ml-3 space-y-6">
            {timelineData.timeline.length === 0 ? (
              <div className="text-center py-16 text-slate-450 text-xs">No records available for this search criteria.</div>
            ) : (
              timelineData.timeline.map((ev: any, index: number) => {
                const style = getEventIconAndStyle(ev.type, ev.severity);
                const Icon = style.icon;
                return (
                  <div key={index} className="relative">
                    {/* Node Dot */}
                    <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border bg-slate-50 flex items-center justify-center ${style.iconColor} border-slate-200`}>
                      <Icon size={10} />
                    </div>

                    <div className={`p-4 rounded-xl border ${style.border} space-y-2`}>
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{ev.title}</span>
                          <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border border-slate-200 ${
                          ev.severity === 'CRITICAL' ? 'bg-red-950/20 text-red-400' : 'bg-slate-50 text-slate-650'
                        }`}>
                          {ev.type}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-700 leading-relaxed">{ev.description}</p>

                      {/* Expanded properties */}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded p-2.5 font-mono text-[9px] text-slate-650 space-y-1">
                          {Object.entries(ev.metadata).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4">
                              <span className="text-slate-450">{k}:</span>
                              <span className="text-slate-650 truncate max-w-[200px]">{JSON.stringify(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecurityTimelinePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="w-8 h-8 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SecurityTimelineContent />
    </Suspense>
  );
}
