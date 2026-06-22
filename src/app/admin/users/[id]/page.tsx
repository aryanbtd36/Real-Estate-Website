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
        return <Shield className="text-amber-600" size={14} />;
      case 'UserMinus':
        return <UserX className="text-rose-600" size={14} />;
      case 'UserCheck':
        return <UserCheck className="text-emerald-600" size={14} />;
      case 'User':
        return <User className="text-indigo-600" size={14} />;
      case 'Heart':
        return <Heart className="text-rose-600 animate-pulse" size={14} />;
      case 'Eye':
        return <Eye className="text-sky-600" size={14} />;
      case 'MessageSquare':
        return <MessageSquare className="text-purple-600" size={14} />;
      case 'Calendar':
        return <Calendar className="text-teal-600" size={14} />;
      case 'LogIn':
        return <LogIn className="text-emerald-600" size={14} />;
      case 'LogOut':
        return <LogOut className="text-slate-500" size={14} />;
      case 'Key':
        return <Key className="text-pink-600" size={14} />;
      case 'BadgeCheck':
        return <BadgeCheck className="text-indigo-600" size={14} />;
      default:
        return <Activity className="text-slate-500" size={14} />;
    }
  };

  const getTimelineBadgeStyle = (type: string) => {
    switch (type) {
      case 'ROLE_CHANGE':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'STATUS_CHANGE':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'PROFILE_UPDATE':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'PROPERTY_SAVE':
        return 'border-pink-200 bg-pink-50 text-pink-700';
      case 'PROPERTY_VIEW':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'INQUIRY':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'APPOINTMENT':
        return 'border-teal-200 bg-teal-50 text-teal-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-500';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'VIP':
        return 'text-amber-700 border-amber-300 bg-amber-50 shadow-xs';
      case 'High':
        return 'text-orange-700 border-orange-200 bg-orange-50';
      case 'Medium':
        return 'text-[#0B4C8C] border-blue-200 bg-blue-50';
      case 'Low':
        return 'text-slate-650 border-slate-200 bg-slate-50';
      case 'Inactive':
      default:
        return 'text-slate-400 border-slate-150 bg-slate-100/60';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-mono">Syncing Intelligence Matrix...</p>
      </div>
    );
  }

  if (errorMsg && !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-8 flex flex-col justify-center items-center">
        <AlertCircle className="text-rose-500 mb-4" size={48} />
        <h2 className="text-2xl font-light mb-2">Error Encountered</h2>
        <p className="text-slate-500 mb-6 max-w-md text-center">{errorMsg}</p>
        <button
          onClick={() => router.push('/admin/users')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
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
  const radiusCircle = 36;
  const circumference = 2 * Math.PI * radiusCircle;
  const maxScoreScale = 250;
  const pct = Math.min(100, (metrics.engagementScore / maxScoreScale) * 100);
  const strokeOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-8 pb-20 relative text-slate-800">
      {/* Notifications banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex justify-between items-center shadow-xs font-semibold"
          >
            <span className="flex items-center gap-2">
              <Check size={14} className="text-emerald-600" />
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
            className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex justify-between items-center shadow-xs font-semibold"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-600" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg('')} className="opacity-60 hover:opacity-100"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2.5 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-all text-slate-650 shadow-xs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#0B4C8C] font-extrabold">User Intelligence Suite</span>
            <h1 className="text-3xl font-light tracking-tight mt-0.5 text-slate-900">360° Profile Matrix</h1>
          </div>
        </div>
        
        {/* CSV export trigger for current user */}
        <button
          onClick={() => {
            window.location.href = '/api/admin/users/export';
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-250 text-[#0B4C8C] font-extrabold rounded-lg text-xs tracking-wider uppercase transition-all shadow-xs"
        >
          <Download size={14} />
          <span>Export Master CSV</span>
        </button>
      </div>

      {/* Top Section Layout: Overview and Intelligence Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Section 1: User Overview Card (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 relative flex flex-col justify-between">
          <div className="absolute right-6 top-6 flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-all shadow-xs"
              title="Edit Profile Fields"
            >
              <Edit3 size={14} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-[#0B4C8C]/10 border border-[#0B4C8C]/20 flex items-center justify-center text-[#0B4C8C] font-semibold text-2xl shadow-xs">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 tracking-wide">{user.name || 'Anonymous Client'}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{user.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                    user.status === 'ACTIVE'
                      ? 'border-emerald-250 bg-emerald-50 text-emerald-700'
                      : 'border-rose-250 bg-rose-50 text-rose-700'
                  }`}>
                    {user.status}
                  </span>
                  <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase tracking-wider ${
                    user.role === 'ADMIN'
                      ? 'border-blue-200 bg-blue-50 text-[#0B4C8C]'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile fields detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-b border-slate-100 py-5 text-xs text-slate-600">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="opacity-80">Email Address:</span>
                  <span className="text-slate-900 font-semibold">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Phone Number:</span>
                  <span className="text-slate-900 font-semibold">{user.phone || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="opacity-80">Registration Date:</span>
                  <span className="text-slate-900 font-semibold">{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Last Log In:</span>
                  <span className="text-slate-900 font-semibold">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
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
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40 shadow-xs"
                  >
                    <UserX size={14} className="text-rose-600" />
                    <span>Suspend User</span>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleStatus}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40 shadow-xs"
                  >
                    <UserCheck size={14} className="text-emerald-600" />
                    <span>Restore Account</span>
                  </button>
                )}

                {user.role === 'ADMIN' ? (
                  <button
                    onClick={handleToggleRole}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40 shadow-xs"
                  >
                    <ShieldAlert size={14} className="text-orange-600" />
                    <span>Revoke Admin Role</span>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleRole}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 text-[#0B4C8C] hover:bg-blue-100 hover:border-blue-300 transition-all rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-40 shadow-xs"
                  >
                    <ShieldCheck size={14} className="text-blue-600" />
                    <span>Promote to Admin</span>
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400 italic py-2">Self modifications are disabled on this administrative profile.</span>
            )}
          </div>
        </div>

        {/* Section 2: Engagement Analytics Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold mb-4">Intelligence & Scoring</h3>
            
            <div className="flex items-center justify-between gap-6">
              {/* Radial score gauge */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Background track */}
                  <circle
                     cx="48"
                     cy="48"
                     r={radiusCircle}
                     stroke="rgba(15,23,42,0.05)"
                     strokeWidth="7"
                     fill="transparent"
                  />
                  {/* Active gauge */}
                  <circle
                    cx="48"
                    cy="48"
                    r={radiusCircle}
                    stroke={metrics.engagementCategory === 'VIP' ? '#10B981' : metrics.engagementCategory === 'High' ? '#F59E0B' : metrics.engagementCategory === 'Medium' ? '#0B4C8C' : '#64748B'}
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-semibold tracking-tight text-slate-800">{metrics.engagementScore}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-450 font-bold">Score</span>
                </div>
              </div>

              {/* Engagement details */}
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold">Category:</span>
                  <span className={`px-2.5 py-0.5 border text-[10px] rounded-md font-extrabold tracking-wide ${getCategoryColor(metrics.engagementCategory)}`}>
                    {metrics.engagementCategory}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Client Win Rate:</span>
                  <span className="text-slate-800 font-bold">{conversionRate}%</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed pt-1.5 border-t border-slate-100 mt-1">
                  Calculated based on search views, bookmarks, inquiries, and scheduled viewing appointments.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI cards */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center space-y-0.5 shadow-xs">
              <Eye className="text-sky-650 mx-auto opacity-80" size={14} />
              <span className="text-lg font-bold text-slate-900 block">{metrics.viewsCount}</span>
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest block">Views</span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center space-y-0.5 shadow-xs">
              <Heart className="text-rose-600 mx-auto opacity-80" size={14} />
              <span className="text-lg font-bold text-slate-900 block">{metrics.savesCount}</span>
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest block">Saves</span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center space-y-0.5 shadow-xs">
              <MessageSquare className="text-purple-650 mx-auto opacity-80" size={14} />
              <span className="text-lg font-bold text-slate-900 block">{metrics.inquiriesCount}</span>
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest block">Leads</span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center space-y-0.5 shadow-xs">
              <Calendar className="text-teal-650 mx-auto opacity-80" size={14} />
              <span className="text-lg font-bold text-slate-900 block">{metrics.appointmentsCount}</span>
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest block">Visits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bottom Section: CRM Details Grid and Timeline Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (7 cols): Property, CRM and History Details */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 3: Saved Properties */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Saved Properties</h3>
              <span className="text-xs text-slate-500 font-semibold">{savedProperties.length} favorites bookmarked</span>
            </div>

            {savedProperties.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No bookmarked properties.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                {savedProperties.map((sp) => (
                  <div key={sp.id} className="py-3 flex justify-between items-center gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">{sp.property.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{sp.property.type} &bull; {formatCurrency(sp.property.price)}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      <Clock size={10} />
                      {new Date(sp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Inquiry History (CRM Linkage) */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Inquiry History</h3>
              <span className="text-xs text-slate-500 font-semibold">{inquiries.length} submissions</span>
            </div>

            {inquiries.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No active lead submissions recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="py-3.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 border text-[9px] font-extrabold rounded-full uppercase tracking-wider ${
                          inq.status === 'WON' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          inq.status === 'LOST' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                          'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                          {inq.status}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{inq.source}</span>
                      </div>
                      <span className="text-[10px] text-slate-450 font-semibold font-mono">{new Date(inq.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed italic bg-slate-50/50 p-2.5 rounded-lg border border-slate-150">"{inq.message}"</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                      <span>Priority: <span className="font-bold text-slate-700">{inq.priority}</span></span>
                      <span>Owner Admin: <span className="font-bold text-[#0B4C8C]">{inq.assignedTo?.name || 'Unassigned'}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Appointment History */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Appointments & Showings</h3>
              <span className="text-xs text-slate-500 font-semibold">{appointments.length} tours scheduled</span>
            </div>

            {appointments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No scheduled viewings.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                {appointments.map((appt) => (
                  <div key={appt.id} className="py-3.5 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-900">{appt.property.name}</h4>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                        <Calendar size={10} className="text-[#0B4C8C]" />
                        {appt.date} at {appt.time}
                      </p>
                      {appt.message && <p className="text-[10px] text-slate-500 italic mt-0.5">"{appt.message}"</p>}
                    </div>
                    <span className={`px-2 py-0.5 border text-[9px] font-extrabold rounded-full uppercase tracking-wider ${
                      appt.status === 'COMPLETED' || appt.status === 'CONFIRMED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                      appt.status === 'CANCELLED' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                      'border-slate-205 bg-slate-50 text-slate-600'
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
            <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold border-b border-slate-100 pb-2">Role History</h4>
              {roleHistory.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No role history.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-slate-600">
                  {roleHistory.map((rh) => (
                    <div key={rh.id} className="p-2.5 bg-slate-50/50 rounded-lg border border-slate-200/60 space-y-0.5 shadow-2xs">
                      <div className="flex justify-between text-slate-700 font-semibold">
                        <span>{rh.previousRole} &rarr; {rh.newRole}</span>
                        <span className="text-slate-450 font-normal">{new Date(rh.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9px] text-[#0B4C8C] font-bold truncate">By: {rh.changedBy?.name || rh.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 7: Status History */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold border-b border-slate-100 pb-2">Status Trail</h4>
              {statusHistory.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No status updates.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-slate-600">
                  {statusHistory.map((sh) => (
                    <div key={sh.id} className="p-2.5 bg-slate-50/50 rounded-lg border border-slate-200/60 space-y-0.5 shadow-2xs">
                      <div className="flex justify-between text-slate-700 font-semibold">
                        <span>{sh.previousStatus} &rarr; {sh.newStatus}</span>
                        <span className="text-slate-450 font-normal">{new Date(sh.createdAt).toLocaleDateString()}</span>
                      </div>
                      {sh.reason && <p className="text-[9px] text-slate-500 italic truncate">"Reason: {sh.reason}"</p>}
                      <p className="text-[9px] text-[#0B4C8C] font-bold truncate">By: {sh.changedBy?.name || sh.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 8: Profile Field Updates */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-5 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold border-b border-slate-100 pb-2">Profile Audits</h4>
              {profileHistory.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No profile edits recorded.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-slate-600">
                  {profileHistory.map((ph) => (
                    <div key={ph.id} className="p-2.5 bg-slate-50/50 rounded-lg border border-slate-200/60 space-y-0.5 shadow-2xs">
                      <div className="flex justify-between text-slate-700 font-bold">
                        <span className="uppercase text-[9px] text-indigo-650">{ph.fieldName}</span>
                        <span className="text-slate-455 font-normal">{new Date(ph.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 truncate">"{ph.oldValue || 'none'}" &rarr; "{ph.newValue || 'none'}"</p>
                      <p className="text-[9px] text-[#0B4C8C] font-bold truncate">By: {ph.changedBy?.name || ph.changedBy?.email || 'System'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right Column (5 cols) — Section 9: Unified User 360° Timeline */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-[24px] shadow-sm p-6 flex flex-col space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">User 360° Timeline</h3>
            <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">Unified chronological activity logs</p>
          </div>

          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              No historical timeline entries found.
            </p>
          ) : (
            <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6 flex-1 max-h-[750px] overflow-y-auto custom-scrollbar">
              {timeline.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Icon Circle */}
                  <div className="absolute -left-[35px] top-0 w-7.5 h-7.5 rounded-full border border-slate-200 bg-white flex items-center justify-center shrink-0 shadow-xs group-hover:border-[#0B4C8C] transition-colors">
                    {renderTimelineIcon(item.icon)}
                  </div>

                  {/* Timeline Event Details */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className={`px-2 py-0.5 border text-[8px] font-bold rounded uppercase tracking-wider ${getTimelineBadgeStyle(item.type)}`}>
                        {item.badge}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold">
                        {new Date(item.date).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#0B4C8C] transition-colors">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
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
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-[24px] p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Edit Profile Metadata</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none transition-colors h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none transition-colors h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold block">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none transition-colors h-12 rounded-xl"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all text-[11px] shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2.5 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white font-extrabold rounded-xl uppercase tracking-wider disabled:opacity-40 transition-all text-[11px] shadow-xs"
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
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-[24px] p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900">Suspend Client Account</h3>
                <button
                  onClick={() => setShowSuspendModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-slate-500 leading-relaxed font-semibold">
                  Suspending this account will restrict the user from executing any search bookmarks, saving properties, scheduling showings, or accessing client dashboards.
                </p>
                
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-bold block">Suspension Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide justification or reason for this audit event..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none transition-colors rounded-xl"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all text-[11px] shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl uppercase tracking-wider disabled:opacity-40 transition-all text-[11px] shadow-xs"
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
