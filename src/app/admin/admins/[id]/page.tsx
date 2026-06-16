'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Shield,
  Star,
  Activity,
  Calendar,
  Briefcase,
  TrendingUp,
  MapPin,
  Clock,
  Compass,
  FileText,
  User,
  Sparkles,
  Lock,
  Plus,
  ThumbsUp
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: adminId } = use(params);
  const { data: session } = useSession();
  const currentUserRole = (session?.user as any)?.role;
  const isSuperAdminCaller = currentUserRole === 'SUPER_ADMIN';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [adminId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/admins/${adminId}`);
      if (res.ok) {
        const profileData = await res.json();
        setData(profileData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      const res = await fetch(`/api/admin/admins/${adminId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, notes: reviewNotes })
      });
      if (res.ok) {
        setReviewNotes('');
        setReviewRating(5);
        fetchProfile();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to submit review');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8">
        <div className="h-6 w-32 bg-white/5 rounded" />
        <div className="h-28 bg-white/5 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-white/5 rounded-xl" />
          <div className="h-96 bg-white/5 rounded-xl col-span-2" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 border border-white/5 rounded-xl bg-[#161616]">
        <Shield size={48} className="text-white/20 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">Administrator Not Found</h3>
        <p className="text-xs text-white/45 mt-1">This user is not registered or does not have admin privileges.</p>
        <Link href="/admin/admins" className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline mt-4">
          <ArrowLeft size={12} /> Back to Directory
        </Link>
      </div>
    );
  }

  const { profile, productivity, leads, appointments, reviews, timeline } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Back Link */}
      <Link
        href="/admin/admins"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-[#D4AF37] transition-colors font-semibold"
      >
        <ArrowLeft size={12} />
        Back to staff roster
      </Link>

      {/* Staff Profile Header */}
      <div className="bg-gradient-to-r from-[#161616] to-[#1E1E1E]/50 border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5D67B] text-2xl font-light">
            {profile.name?.charAt(0) || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-light text-white">{profile.name || 'Anonymous User'}</h1>
              <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold ${
                profile.role === 'SUPER_ADMIN'
                  ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#F5D67B]'
                  : 'bg-white/5 border border-white/10 text-white/60'
              }`}>
                {profile.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-white/40 font-mono mt-1">{profile.email}</p>
            <div className="flex items-center gap-4 text-[10px] text-white/30 mt-3 font-mono">
              <div>Joined: {new Date(profile.createdAt).toLocaleDateString()}</div>
              <div>Status: <span className={profile.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}>{profile.status}</span></div>
            </div>
          </div>
        </div>

        {/* Dynamic score summary badge */}
        <div className="bg-black/30 border border-white/5 px-6 py-4 rounded-xl text-center shrink-0 min-w-[150px]">
          <span className="text-[9px] uppercase tracking-widest text-white/40 block font-medium">Performance Grade</span>
          <span className="text-4xl font-light text-[#D4AF37] block mt-1 leading-none">{productivity.grade}</span>
          <span className="text-[10px] text-white/30 block mt-2 font-mono">Score: {productivity.score}/100</span>
        </div>
      </div>

      {/* Grid Layout for Analytics and CRM Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Productivity Metrics */}
        <div className="space-y-6">
          <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-[#D4AF37]" />
              Efficiency Index
            </h3>
            
            <div className="space-y-4">
              {[
                { label: 'Leads Win-Rate', score: productivity.breakdown.leadPerformance, weight: '30%', color: 'from-[#D4AF37] to-[#F5D67B]' },
                { label: 'Showing Completed', score: productivity.breakdown.appointmentCompletion, weight: '20%', color: 'from-blue-500 to-indigo-500' },
                { label: 'Follow-Ups Done', score: productivity.breakdown.followUpCompletion, weight: '20%', color: 'from-emerald-500 to-teal-500' },
                { label: 'Property Operations', score: productivity.breakdown.propertyOperations, weight: '15%', color: 'from-purple-500 to-pink-500' },
                { label: 'Estimate Response', score: productivity.breakdown.responseTime, weight: '15%', color: 'from-orange-500 to-amber-500' }
              ].map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-white/60">{m.label} <span className="text-white/35 font-light">({m.weight})</span></span>
                    <span className="font-mono text-[#D4AF37] font-semibold">{m.score}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${m.color} rounded-full`}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Performance Overview metrics */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5 text-center">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-white/30 block">Leads Won</span>
                <span className="text-lg font-semibold text-white mt-0.5 block">{productivity.metrics.leadsWon}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-widest text-white/30 block">Appts Scheduled</span>
                <span className="text-lg font-semibold text-white mt-0.5 block">{productivity.metrics.appointmentsTotal}</span>
              </div>
            </div>
          </div>

          {/* Super Admin Review Section */}
          {isSuperAdminCaller && (
            <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                <Star size={14} className="text-[#D4AF37]" />
                Governance Review
              </h3>
              
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-white/45 block">Evaluation Rating</label>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          size={18}
                          className={star <= reviewRating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/20'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-white/45 block">Performance Comments</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter review observations and feedback..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2.5 rounded-lg text-xs outline-none text-white resize-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#F5D67B] text-black font-semibold rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  Submit Rating
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Timelines, CRM and Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* CRM Leads and Showings Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#161616] border border-white/5 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                <Briefcase size={13} className="text-[#D4AF37]" />
                Leads Handled
              </h3>
              {leads.length === 0 ? (
                <p className="text-[11px] text-white/40 py-4">No leads assigned currently.</p>
              ) : (
                <div className="space-y-2.5">
                  {leads.map((l: any) => (
                    <div key={l.id} className="flex justify-between items-center p-2 rounded bg-black/20 border border-white/5">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white truncate block">{l.name}</span>
                        <span className="text-[9px] text-white/40 font-mono mt-0.5 block">{l.email}</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-widest text-[#F5D67B] font-mono shrink-0">
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#161616] border border-white/5 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
                <Calendar size={13} className="text-[#D4AF37]" />
                Showings Conducted
              </h3>
              {appointments.length === 0 ? (
                <p className="text-[11px] text-white/40 py-4">No appointments assigned currently.</p>
              ) : (
                <div className="space-y-2.5">
                  {appointments.map((a: any) => (
                    <div key={a.id} className="flex justify-between items-center p-2 rounded bg-black/20 border border-white/5">
                      <div>
                        <span className="text-xs font-semibold text-white block">{a.name}</span>
                        <span className="text-[9px] text-white/40 block mt-0.5">{a.date} at {a.time}</span>
                      </div>
                      <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        a.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-white/5 text-white/60'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Historical Reviews log */}
          <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60">Performance Reviews</h3>
            {reviews.length === 0 ? (
              <p className="text-[11px] text-white/40 text-center py-6">No historical performance reviews logged yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="p-4 bg-black/20 border border-white/5 rounded-xl space-y-3 relative">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            className={star <= r.rating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/10'}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-white/40 font-mono">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed font-light">{r.notes}</p>
                    <div className="text-[9px] text-white/30 text-right">Evaluator: {r.reviewer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Activity Timeline */}
          <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-6">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-white/60 flex items-center gap-1.5">
              <Activity size={14} className="text-[#D4AF37]" />
              Staff Activity Timeline
            </h3>

            {timeline.length === 0 ? (
              <p className="text-[11px] text-white/40 text-center py-6">No activity records logged in the audit stream.</p>
            ) : (
              <div className="relative border-l border-white/5 ml-3 pl-6 space-y-6">
                {timeline.map((event: any, index: number) => (
                  <div key={index} className="relative">
                    {/* Event node bullet */}
                    <span className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-[#161616] border border-[#D4AF37] z-10" />
                    
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{event.description}</span>
                        <span className="text-[9px] text-white/35 font-mono">{new Date(event.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-widest font-mono text-[#D4AF37]">
                        {event.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
