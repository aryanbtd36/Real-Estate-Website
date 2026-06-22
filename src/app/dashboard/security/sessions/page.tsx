'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Monitor,
  MapPin,
  Clock,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function UserSessionsDashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/security/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else {
        setMessage({ type: 'error', text: 'Failed to retrieve active sessions.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Network connection issue. Please retry.' });
    } finally {
      setLoading(false);
    }
  };

  const getCsrfToken = () => {
    if (typeof document === 'undefined') return '';
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf-token='))
      ?.split('=')[1] || '';
  };

  const handleAction = async (action: 'LOGOUT_CURRENT' | 'LOGOUT_SESSION' | 'LOGOUT_ALL', sessionId?: string) => {
    const loaderId = sessionId || action;
    try {
      setActionLoading(loaderId);
      setMessage(null);

      const csrfToken = getCsrfToken();
      const res = await fetch('/api/security/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ action, sessionId }),
      });

      if (res.ok) {
        setMessage({
          type: 'success',
          text: action === 'LOGOUT_ALL' ? 'Logged out of all other sessions.' : 'Session terminated successfully.',
        });
        if (action === 'LOGOUT_CURRENT') {
          // Redirect to login / logout since current session is revoked
          window.location.href = '/login';
        } else {
          await fetchSessions();
        }
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Failed to complete action.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error contacting security server.' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8 max-w-4xl mx-auto px-4">
        <div className="h-6 w-48 bg-white/5 rounded" />
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-64 bg-white/5 rounded-xl" />
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-light text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-[#0B4C8C]" size={24} />
            Session Intelligence & Security
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review and manage all active browser sessions currently authenticated to your account.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-slate-200 rounded text-[10px] uppercase tracking-wider font-semibold transition-all text-slate-800/80 hover:text-slate-800"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg border text-xs leading-relaxed ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Session Panel */}
      {currentSession && (
        <div className="border border-blue-200 bg-blue-50/10 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#0B4C8C] text-[8px] uppercase tracking-widest font-semibold">
                Current Session
              </span>
              <h2 className="text-base font-light text-slate-800 mt-2 flex items-center gap-2">
                {currentSession.device === 'Mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                {currentSession.browser} on {currentSession.operatingSystem}
              </h2>
            </div>
            <button
              onClick={() => handleAction('LOGOUT_CURRENT')}
              disabled={actionLoading !== null}
              className="py-1.5 px-3 border border-red-500/30 hover:bg-red-500/15 text-[10px] font-semibold text-red-400 rounded uppercase tracking-wider transition-all disabled:opacity-40"
            >
              Sign out of this device
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px] text-slate-800/50 border-t border-slate-200/80 pt-4">
            <div className="space-y-1">
              <span className="text-slate-400 uppercase tracking-wider block">IP Address</span>
              <span className="font-mono text-slate-800/80">{currentSession.ipAddress}</span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 uppercase tracking-wider block">Location</span>
              <span className="flex items-center gap-1 text-slate-800/80">
                <MapPin size={10} className="text-[#0B4C8C]" />
                {currentSession.location}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 uppercase tracking-wider block">Login Time</span>
              <span className="text-slate-800/80">{new Date(currentSession.loginAt).toLocaleString()}</span>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 uppercase tracking-wider block">Risk Assessment</span>
              <span className={`font-semibold ${currentSession.riskScore >= 50 ? 'text-amber-500' : 'text-green-500'}`}>
                {currentSession.riskScore >= 50 ? 'Medium Risk' : 'Low Risk'} ({currentSession.riskScore})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Other Active Devices list */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800/80">Other Active Devices</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Sessions currently logged in to other browsers/devices.</p>
          </div>
          {otherSessions.length > 0 && (
            <button
              onClick={() => handleAction('LOGOUT_ALL')}
              disabled={actionLoading !== null}
              className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] font-bold text-red-400 rounded uppercase tracking-wider transition-all disabled:opacity-40"
            >
              Sign out of all other devices
            </button>
          )}
        </div>

        {otherSessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200/80 rounded-xl">
            <Info size={28} className="text-slate-800/20 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No other active devices detected. You are only signed in on this browser.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {otherSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex gap-3 min-w-0">
                  <div className="p-2 bg-white/5 border border-slate-200 rounded-lg text-slate-800/60 shrink-0 self-start">
                    {s.device === 'Mobile' ? <Smartphone size={18} /> : <Monitor size={18} />}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-xs font-semibold text-slate-800">
                      {s.browser} on {s.operatingSystem}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono">
                      <div className="flex items-center gap-1">
                        <MapPin size={8} />
                        {s.location}
                      </div>
                      <div>IP: {s.ipAddress}</div>
                      <div>Activity: {new Date(s.lastActivityAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded font-mono ${
                    s.riskScore >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-white/5 text-slate-500 border border-slate-200/80'
                  }`}>
                    Risk: {s.riskScore}
                  </span>
                  <button
                    onClick={() => handleAction('LOGOUT_SESSION', s.id)}
                    disabled={actionLoading !== null}
                    className="py-1.5 px-3 bg-[#1F1F1F] hover:bg-red-500/10 border border-slate-200/80 hover:border-red-500/30 text-[10px] text-slate-800/70 hover:text-red-400 rounded uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <LogOut size={10} />
                    Terminate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
