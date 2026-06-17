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
          border: 'border-white/5 bg-[#141414]',
          iconColor: 'text-white/40',
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/security"
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-light tracking-wide flex items-center gap-2">
              <Activity className="text-[#D4AF37]" size={20} />
              SOC Incident Investigation Timeline
            </h1>
            <p className="text-[10px] text-white/40">Reconstruct step-by-step logs and session audits.</p>
          </div>
        </div>
      </div>

      {/* Query Filter panel */}
      <div className="bg-[#121212] border border-white/5 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[9px] uppercase tracking-wider text-white/40 font-bold block">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="uuid-of-user..."
            className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white outline-none focus:border-[#D4AF37]"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[9px] uppercase tracking-wider text-white/40 font-bold block">Session ID</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="uuid-of-session..."
            className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white outline-none focus:border-[#D4AF37]"
          />
        </div>
        <button
          onClick={loadTimeline}
          disabled={loading}
          className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#BCA035] text-black font-bold uppercase tracking-wider text-[10px] rounded transition-colors flex items-center gap-1.5"
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
          <div className="bg-gradient-to-r from-[#D4AF37]/5 to-transparent border border-white/5 p-4 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
              <User size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-white">Target profile: {timelineData.email || 'Anonymous'}</span>
              <div className="text-[9px] text-white/40 font-mono mt-0.5">User ID: {timelineData.userId}</div>
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="relative border-l border-white/5 pl-6 ml-3 space-y-6">
            {timelineData.timeline.length === 0 ? (
              <div className="text-center py-16 text-white/35 text-xs">No records available for this search criteria.</div>
            ) : (
              timelineData.timeline.map((ev: any, index: number) => {
                const style = getEventIconAndStyle(ev.type, ev.severity);
                const Icon = style.icon;
                return (
                  <div key={index} className="relative">
                    {/* Node Dot */}
                    <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border bg-black flex items-center justify-center ${style.iconColor} border-white/10`}>
                      <Icon size={10} />
                    </div>

                    <div className={`p-4 rounded-xl border ${style.border} space-y-2`}>
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="text-xs font-bold text-white block">{ev.title}</span>
                          <span className="text-[9px] text-white/40 font-mono block mt-0.5">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border border-white/10 ${
                          ev.severity === 'CRITICAL' ? 'bg-red-950/20 text-red-400' : 'bg-white/5 text-white/50'
                        }`}>
                          {ev.type}
                        </span>
                      </div>

                      <p className="text-[11px] text-white/70 leading-relaxed">{ev.description}</p>

                      {/* Expanded properties */}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="bg-black/25 border border-white/5 rounded p-2.5 font-mono text-[9px] text-white/50 space-y-1">
                          {Object.entries(ev.metadata).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4">
                              <span className="text-white/35">{k}:</span>
                              <span className="text-white/60 truncate max-w-[200px]">{JSON.stringify(v)}</span>
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SecurityTimelineContent />
    </Suspense>
  );
}
