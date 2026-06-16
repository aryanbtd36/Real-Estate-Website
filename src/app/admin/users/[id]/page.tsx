'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UserCheck,
  Eye,
  Heart,
  MessageSquare,
  Calendar,
  Clock,
  Edit3,
  X,
  Check,
  Download,
  AlertCircle,
  TrendingUp,
  Activity,
  LogIn,
  LogOut,
  Key,
  BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/currency';

interface UserOverview {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  lastLogin: string | null;
  lastActivity: string | null;
}

interface EngagementMetrics {
  viewsCount: number;
  savesCount: number;
  inquiriesCount: number;
  appointmentsCount: number;
  engagementScore: number;
  engagementCategory: 'VIP' | 'High' | 'Medium' | 'Low' | 'Inactive';
}

interface SavedProperty {
  id: string;
  createdAt: string;
  property: {
    id: string;
    name: string;
    type: string;
    price: number;
    images: string;
  };
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  message: string | null;
  property: {
    id: string;
    name: string;
    type: string;
  };
}

interface Inquiry {
  id: string;
  status: string;
  priority: string;
  source: string;
  message: string;
  createdAt: string;
  assignedTo: {
    name: string | null;
  } | null;
}

interface RoleHistoryItem {
  id: string;
  previousRole: string;
  newRole: string;
  createdAt: string;
  changedBy: {
    name: string | null;
    email: string;
  } | null;
}

interface StatusHistoryItem {
  id: string;
  previousStatus: string;
  newStatus: string;
  reason: string | null;
  createdAt: string;
  changedBy: {
    name: string | null;
    email: string;
  } | null;
}

interface ProfileHistoryItem {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedBy: {
    name: string | null;
    email: string;
  } | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  details?: any;
}

export default function UserProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  // Data states
  const [user, setUser] = useState<UserOverview | null>(null);
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [roleHistory, setRoleHistory] = useState<RoleHistoryItem[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentActorId = (session?.user as any)?.id;

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      // Parallel data fetching
      const [detailsRes, timelineRes] = await Promise.all([
        fetch(`/api/admin/users/${id}`),
        fetch(`/api/admin/users/${id}/history`),
      ]);

      if (!detailsRes.ok) {
        if (detailsRes.status === 404) {
          throw new Error('User profile not found or soft-deleted.');
        }
        throw new Error('Failed to retrieve user intelligence data.');
      }

      const detailsData = await detailsRes.json();
      setUser(detailsData.user);
      setMetrics(detailsData.metrics);
      setSavedProperties(detailsData.savedProperties || []);
      setAppointments(detailsData.appointments || []);
      setInquiries(detailsData.inquiries || []);
      setRoleHistory(detailsData.roleHistory || []);
      setStatusHistory(detailsData.statusHistory || []);
      setProfileHistory(detailsData.profileHistory || []);

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        setTimeline(timelineData.timeline || []);
      }

      // Populate edit form
      if (detailsData.user) {
        setEditForm({
          name: detailsData.user.name || '',
          email: detailsData.user.email || '',
          phone: detailsData.user.phone || '',
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while loading profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchAllData();
    }
  }, [id, fetchAllData]);

  // Handle name/email/phone modifications
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setUpdating(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      setSuccessMsg('Profile information updated successfully.');
      setShowEditModal(false);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply profile edits.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Suspend/Restore
  const handleToggleStatus = async () => {
    if (!user) return;
    const targetStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      setUpdating(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          status: targetStatus,
          reason: targetStatus === 'SUSPENDED' ? suspendReason : 'Restored by Admin',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change user status.');

      setSuccessMsg(`User successfully ${targetStatus === 'SUSPENDED' ? 'suspended' : 'restored'}.`);
      setShowSuspendModal(false);
      setSuspendReason('');
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user status.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Promote/Revoke Admin
  const handleToggleRole = async () => {
    if (!user) return;
    const targetRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      setUpdating(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to modify role privileges.');

      setSuccessMsg(`User role modified to ${targetRole} successfully.`);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user role.');
    } finally {
      setUpdating(false);
    }
  };

  // Helper to map icon names to Lucide icons
  const renderTimelineIcon = (iconName: string) => {
    switch (iconName) {
      case 'Shield':
        return <Shield className="text-yellow-400" size={14} />;
      case 'UserMinus':
        return <UserX className="text-rose-400" size={14} />;
      case 'UserCheck':
        return <UserCheck className="text-emerald-400" size={14} />;
      case 'User':
        return <User className="text-indigo-400" size={14} />;
      case 'Heart':
        return <Heart className="text-rose-400 animate-pulse" size={14} />;
      case 'Eye':
        return <Eye className="text-sky-400" size={14} />;
      case 'MessageSquare':
        return <MessageSquare className="text-purple-400" size={14} />;
      case 'Calendar':
        return <Calendar className="text-teal-400" size={14} />;
      case 'LogIn':
        return <LogIn className="text-emerald-400" size={14} />;
      case 'LogOut':
        return <LogOut className="text-slate-400" size={14} />;
      case 'Key':
        return <Key className="text-pink-400" size={14} />;
      case 'BadgeCheck':
        return <BadgeCheck className="text-indigo-400" size={14} />;
      default:
        return <Activity className="text-slate-400" size={14} />;
    }
  };

  const getTimelineBadgeStyle = (type: string) => {
    switch (type) {
      case 'ROLE_CHANGE':
        return 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]';
      case 'STATUS_CHANGE':
        return 'border-rose-500/20 bg-rose-500/5 text-rose-400';
      case 'PROFILE_UPDATE':
        return 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400';
      case 'PROPERTY_SAVE':
        return 'border-pink-500/20 bg-pink-500/5 text-pink-400';
      case 'PROPERTY_VIEW':
        return 'border-sky-500/20 bg-sky-500/5 text-sky-400';
      case 'INQUIRY':
        return 'border-purple-500/20 bg-purple-500/5 text-purple-400';
      case 'APPOINTMENT':
        return 'border-teal-500/20 bg-teal-500/5 text-teal-400';
      default:
        return 'border-white/10 bg-white/5 text-white/50';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'VIP':
        return 'text-[#F5D67B] border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]';
      case 'High':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
      case 'Medium':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
      case 'Low':
        return 'text-slate-400 border-white/15 bg-white/5';
      case 'Inactive':
      default:
        return 'text-white/40 border-white/5 bg-white/[0.01]';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest text-white/40">Syncing Intelligence Matrix...</p>
      </div>
    );
  }

  if (errorMsg && !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white p-8 flex flex-col justify-center items-center">
        <AlertCircle className="text-rose-500 mb-4" size={48} />
        <h2 className="text-2xl font-light mb-2">Error Encountered</h2>
        <p className="text-white/60 mb-6 max-w-md text-center">{errorMsg}</p>
        <button
          onClick={() => router.push('/admin/users')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Directory</span>
        </button>
      </div>
    );
  }

  if (!user || !metrics) return null;

  // Conversion rate: Appointments / Inquiries
  const conversionRate = metrics.inquiriesCount > 0
    ? ((metrics.appointmentsCount / metrics.inquiriesCount) * 100).toFixed(1)
    : '0.0';

  // SVG Radial Gauge Calculations
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const maxScoreScale = 250;
  const pct = Math.min(100, (metrics.engagementScore / maxScoreScale) * 100);
  const strokeOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white space-y-8 pb-20 relative">
      {/* Notifications banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex justify-between items-center"
          >
            <span className="flex items-center gap-2">
              <Check size={14} />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg('')} className="opacity-60 hover:opacity-100"><X size={14} /></button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex justify-between items-center"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={14} />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg('')} className="opacity-60 hover:opacity-100"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 transition-all text-white/70 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">User Intelligence Suite</span>
            <h1 className="text-3xl font-light tracking-tight mt-0.5">360° Profile Matrix</h1>
          </div>
        </div>
        
        {/* CSV export trigger for current user */}
        <button
          onClick={() => {
            window.location.href = '/api/admin/users/export';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/10 hover:bg-[#D4AF37] border border-[#D4AF37]/35 text-[#F5D67B] hover:text-black font-semibold rounded-lg text-xs tracking-wider uppercase transition-all"
        >
          <Download size={14} />
          <span>Export Master CSV</span>
        </button>
      </div>

      {/* Top Section Layout: Overview and Intelligence Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Section 1: User Overview Card (7 cols) */}
        <div className="lg:col-span-7 bg-[#161616] border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between">
          <div className="absolute right-6 top-6 flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-white/70 hover:text-white transition-all"
              title="Edit Profile Fields"
            >
              <Edit3 size={14} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#F5D67B] font-semibold text-2xl shadow-xl">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-xl font-medium text-white tracking-wide">{user.name || 'Anonymous Client'}</h2>
                <p className="text-xs text-white/40 font-mono mt-0.5">{user.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                    user.status === 'ACTIVE'
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
                  }`}>
                    {user.status}
                  </span>
                  <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase tracking-wider ${
                    user.role === 'ADMIN'
                      ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]'
                      : 'border-white/10 bg-white/5 text-white/50'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile fields detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-b border-white/5 py-5 text-xs text-white/60">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="opacity-70">Email Address:</span>
                  <span className="text-white font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Phone Number:</span>
                  <span className="text-white font-medium">{user.phone || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="opacity-70">Registration Date:</span>
                  <span className="text-white font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Last Log In:</span>
                  <span className="text-white font-medium">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions (Suspend, Promote) */}
          <div className="mt-6 flex flex-wrap gap-3 pt-2">
            {user.id !== currentActorId ? (
              <>
                {user.status === 'ACTIVE' ? (
                  <button
                    onClick={() => setShowSuspendModal(true)}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    <UserX size={14} />
                    <span>Suspend User</span>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleStatus}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    <UserCheck size={14} />
                    <span>Restore Account</span>
                  </button>
                )}

                {user.role === 'ADMIN' ? (
                  <button
                    onClick={handleToggleRole}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    <ShieldAlert size={14} />
                    <span>Revoke Admin Role</span>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleRole}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-[#D4AF37]/35 text-[#F5D67B] hover:bg-[#D4AF37] hover:text-black transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    <ShieldCheck size={14} />
                    <span>Promote to Admin</span>
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-white/30 italic py-2">Self modifications are disabled on this administrative profile.</span>
            )}
          </div>
        </div>

        {/* Section 2 & 6: Engagement Analytics Panel (5 cols) */}
        <div className="lg:col-span-5 bg-[#161616] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-4">Intelligence & Scoring</h3>
            
            <div className="flex items-center justify-between gap-6">
              {/* Radial score gauge */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Background track */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Active gauge */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke={metrics.engagementCategory === 'VIP' ? '#D4AF37' : metrics.engagementCategory === 'High' ? '#F59E0B' : metrics.engagementCategory === 'Medium' ? '#3B82F6' : '#6B7280'}
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-light tracking-tight">{metrics.engagementScore}</span>
                  <span className="text-[9px] uppercase tracking-wider text-white/40">Score</span>
                </div>
              </div>

              {/* Engagement details */}
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Category:</span>
                  <span className={`px-2.5 py-0.5 border text-[10px] rounded-md font-semibold tracking-wide ${getCategoryColor(metrics.engagementCategory)}`}>
                    {metrics.engagementCategory}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Client Win Rate:</span>
                  <span className="text-white font-medium">{conversionRate}%</span>
                </div>
                <p className="text-[10px] text-white/30 italic leading-relaxed pt-1.5 border-t border-white/5">
                  Calculated based on search views, bookmarks, inquiries, and scheduled viewing appointments.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI cards */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center space-y-0.5">
              <Eye className="text-sky-400 mx-auto opacity-70" size={14} />
              <span className="text-lg font-light text-white block">{metrics.viewsCount}</span>
              <span className="text-[9px] text-white/30 uppercase tracking-widest block">Views</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center space-y-0.5">
              <Heart className="text-rose-400 mx-auto opacity-70" size={14} />
              <span className="text-lg font-light text-white block">{metrics.savesCount}</span>
              <span className="text-[9px] text-white/30 uppercase tracking-widest block">Saves</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center space-y-0.5">
              <MessageSquare className="text-purple-400 mx-auto opacity-70" size={14} />
              <span className="text-lg font-light text-white block">{metrics.inquiriesCount}</span>
              <span className="text-[9px] text-white/30 uppercase tracking-widest block">Leads</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-center space-y-0.5">
              <Calendar className="text-teal-400 mx-auto opacity-70" size={14} />
              <span className="text-lg font-light text-white block">{metrics.appointmentsCount}</span>
              <span className="text-[9px] text-white/30 uppercase tracking-widest block">Visits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bottom Section: CRM Details Grid and Timeline Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (8 cols): Property, CRM and History Details */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 3: Saved Properties */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Saved Properties</h3>
              <span className="text-xs text-white/40">{savedProperties.length} favorites bookmarked</span>
            </div>

            {savedProperties.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4">No bookmarked properties.</p>
            ) : (
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                {savedProperties.map((sp) => (
                  <div key={sp.id} className="py-3 flex justify-between items-center gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white">{sp.property.name}</h4>
                      <p className="text-[10px] text-white/40 mt-0.5">{sp.property.type} &bull; {formatCurrency(sp.property.price)}</p>
                    </div>
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(sp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Inquiry History (CRM Linkage) */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Inquiry History</h3>
              <span className="text-xs text-white/40">{inquiries.length} submissions</span>
            </div>

            {inquiries.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4">No active lead submissions recorded.</p>
            ) : (
              <div className="divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="py-3.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                          inq.status === 'WON' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
                          inq.status === 'LOST' ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' :
                          'border-yellow-500/20 bg-yellow-500/5 text-yellow-400'
                        }`}>
                          {inq.status}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-white/40">{inq.source}</span>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono">{new Date(inq.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed italic">"{inq.message}"</p>
                    <div className="flex justify-between items-center text-[10px] text-white/45">
                      <span>Priority: <span className="font-semibold text-white/70">{inq.priority}</span></span>
                      <span>Owner Admin: <span className="font-semibold text-[#D4AF37]">{inq.assignedTo?.name || 'Unassigned'}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Appointment History */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Appointments & Showings</h3>
              <span className="text-xs text-white/40">{appointments.length} tours scheduled</span>
            </div>

            {appointments.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4">No scheduled viewings.</p>
            ) : (
              <div className="divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar">
                {appointments.map((appt) => (
                  <div key={appt.id} className="py-3.5 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-white">{appt.property.name}</h4>
                      <p className="text-[10px] text-white/45 flex items-center gap-1">
                        <Calendar size={10} />
                        {appt.date} at {appt.time}
                      </p>
                      {appt.message && <p className="text-[10px] text-white/40 italic mt-0.5">"{appt.message}"</p>}
                    </div>
                    <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                      appt.status === 'COMPLETED' || appt.status === 'CONFIRMED' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
                      appt.status === 'CANCELLED' ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' :
                      'border-white/10 bg-white/5 text-white/60'
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6-8: History Trails (Role, Status, Profile Updates) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Section 6: Role History */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold border-b border-white/5 pb-2">Role History</h4>
              {roleHistory.length === 0 ? (
                <p className="text-[10px] text-white/30 italic">No role history.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-white/50">
                  {roleHistory.map((rh) => (
                    <div key={rh.id} className="p-2 bg-white/[0.01] rounded border border-white/5 space-y-0.5">
                      <div className="flex justify-between text-white/70">
                        <span>{rh.previousRole} &rarr; {rh.newRole}</span>
                        <span>{new Date(rh.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9px] text-[#D4AF37] truncate">By: {rh.changedBy?.name || rh.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 7: Status History */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold border-b border-white/5 pb-2">Status Trail</h4>
              {statusHistory.length === 0 ? (
                <p className="text-[10px] text-white/30 italic">No status updates.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-white/50">
                  {statusHistory.map((sh) => (
                    <div key={sh.id} className="p-2 bg-white/[0.01] rounded border border-white/5 space-y-0.5">
                      <div className="flex justify-between text-white/70">
                        <span>{sh.previousStatus} &rarr; {sh.newStatus}</span>
                        <span>{new Date(sh.createdAt).toLocaleDateString()}</span>
                      </div>
                      {sh.reason && <p className="text-[9px] text-white/40 italic truncate">"Reason: {sh.reason}"</p>}
                      <p className="text-[9px] text-[#D4AF37] truncate">By: {sh.changedBy?.name || sh.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 8: Profile Field Updates */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold border-b border-white/5 pb-2">Profile Audits</h4>
              {profileHistory.length === 0 ? (
                <p className="text-[10px] text-white/30 italic">No profile edits recorded.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-white/50">
                  {profileHistory.map((ph) => (
                    <div key={ph.id} className="p-2 bg-white/[0.01] rounded border border-white/5 space-y-0.5">
                      <div className="flex justify-between text-white/70 font-semibold">
                        <span className="uppercase text-[9px] text-indigo-400">{ph.fieldName}</span>
                        <span>{new Date(ph.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9px] text-white/40 truncate">"{ph.oldValue || 'none'}" &rarr; "{ph.newValue || 'none'}"</p>
                      <p className="text-[9px] text-[#D4AF37] truncate">By: {ph.changedBy?.name || ph.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right Column (5 cols) — Section 9: Unified User 360° Timeline */}
        <div className="lg:col-span-5 bg-[#161616] border border-white/5 rounded-2xl p-6 flex flex-col space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-white">User 360° Timeline</h3>
            <p className="text-[10px] text-white/40 mt-0.5">Unified chronological activity logs</p>
          </div>

          {timeline.length === 0 ? (
            <p className="text-xs text-white/40 italic py-8 text-center bg-white/[0.01] rounded-xl border border-white/5">
              No historical timeline entries found.
            </p>
          ) : (
            <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6 flex-1 max-h-[750px] overflow-y-auto custom-scrollbar">
              {timeline.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Icon Circle */}
                  <div className="absolute -left-[35px] top-0 w-7.5 h-7.5 rounded-full border border-white/5 bg-[#1A1A1A] flex items-center justify-center shrink-0 shadow-lg group-hover:border-[#D4AF37]/45 transition-colors">
                    {renderTimelineIcon(item.icon)}
                  </div>

                  {/* Timeline Event Details */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className={`px-2 py-0.5 border text-[8px] font-bold rounded uppercase tracking-wider ${getTimelineBadgeStyle(item.type)}`}>
                        {item.badge}
                      </span>
                      <span className="text-[9px] text-white/30">
                        {new Date(item.date).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white/90 group-hover:text-[#D4AF37] transition-colors">{item.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: Edit Profile Fields (Name, Email, Phone) */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Edit Profile Metadata</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-white/40 block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/40 block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/40 block">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2 border border-white/10 rounded-lg font-semibold uppercase tracking-wider text-white/60 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-lg uppercase tracking-wider disabled:opacity-40 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Suspend Reason Modal */}
      <AnimatePresence>
        {showSuspendModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Suspend Client Account</h3>
                <button
                  onClick={() => setShowSuspendModal(false)}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-white/60 leading-relaxed">
                  Suspending this account will restrict the user from executing any search bookmarks, saving properties, scheduling showings, or accessing client dashboards.
                </p>
                
                <div className="space-y-1.5">
                  <label className="text-white/40 block">Suspension Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide justification or reason for this audit event..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(false)}
                    className="flex-1 py-2 border border-white/10 rounded-lg font-semibold uppercase tracking-wider text-white/60 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={updating}
                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg uppercase tracking-wider disabled:opacity-40 transition-all"
                  >
                    Confirm Suspension
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
