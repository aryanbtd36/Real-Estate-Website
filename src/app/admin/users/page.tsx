'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Search, 
  Filter, 
  ShieldAlert, 
  UserX, 
  UserCheck, 
  ShieldCheck, 
  TrendingUp, 
  Activity, 
  Eye, 
  Star, 
  Mail, 
  Calendar, 
  LogIn, 
  LogOut, 
  Key, 
  BadgeCheck, 
  X,
  Clock,
  ExternalLink,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface UserCRM {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLogin: string | null;
  lastActivity: string | null;
  createdAt: string;
  emailVerified: string | null;
  metrics: {
    views: number;
    saves: number;
    inquiries: number;
    appointments: number;
  };
  engagementScore: number;
  engagementCategory: 'VIP' | 'High' | 'Medium' | 'Low' | 'Inactive';
}

interface TimelineItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  details: any;
  actor?: { name: string; email: string; role: string } | null;
}

export default function UsersCRMPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserCRM | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const currentUserId = (session?.user as any)?.id;

  // Fetch users with search and filters
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        search,
        status,
        role,
        page: page.toString(),
        limit: '10',
      });
      const res = await fetch(`/api/admin/users?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch CRM users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, status, role, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch timeline for the selected user
  const fetchUserTimeline = async (userId: string) => {
    try {
      setLoadingTimeline(true);
      const res = await fetch(`/api/admin/users/${userId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleSelectUser = (user: UserCRM) => {
    setSelectedUser(user);
    fetchUserTimeline(user.id);
  };

  // Handle promoting or demoting roles / suspending or restoring user status
  const handleUpdateUser = async (userId: string, updates: { role?: string; status?: string }) => {
    try {
      setUpdatingUserId(userId);
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      });

      const data = await res.json();
      if (res.ok) {
        // Update local users array
        setUsers(prev =>
          prev.map(u => {
            if (u.id === userId) {
              const updatedStatus = updates.status !== undefined ? (updates.status as 'ACTIVE' | 'SUSPENDED') : u.status;
              const updatedRole = updates.role !== undefined ? updates.role : u.role;
              // Recalculate engagement score if suspended status changed
              const isSuspended = updatedStatus === 'SUSPENDED';
              const recalculatedScore = isSuspended ? 0 : u.engagementScore;
              return {
                ...u,
                status: updatedStatus,
                role: updatedRole,
                engagementScore: recalculatedScore,
                engagementCategory: isSuspended ? 'Inactive' as const : u.engagementCategory,
              };
            }
            return u;
          })
        );

        // Update selected user panel if open
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => {
            if (!prev) return null;
            const updatedStatus = updates.status !== undefined ? (updates.status as 'ACTIVE' | 'SUSPENDED') : prev.status;
            const updatedRole = updates.role !== undefined ? updates.role : prev.role;
            return {
              ...prev,
              status: updatedStatus,
              role: updatedRole,
            };
          });
          // Refresh timeline
          fetchUserTimeline(userId);
        }
      } else {
        alert(data.error || 'Failed to update user profile');
      }
    } catch (err) {
      console.error('Update user error:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Map Timeline action types to Lucide Icons & Colors
  const getTimelineIconConfig = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return { icon: LogIn, color: 'text-emerald-600 bg-emerald-50 border-emerald-205' };
      case 'LOGOUT':
        return { icon: LogOut, color: 'text-slate-500 bg-slate-50 border-slate-205' };
      case 'PROPERTY_VIEW':
        return { icon: Eye, color: 'text-sky-600 bg-sky-50 border-sky-205' };
      case 'PROPERTY_SAVE':
        return { icon: Star, color: 'text-amber-600 bg-amber-50 border-amber-205' };
      case 'PROPERTY_UNSAVE':
        return { icon: X, color: 'text-rose-600 bg-rose-50 border-rose-205' };
      case 'INQUIRY_CREATE':
        return { icon: Mail, color: 'text-purple-650 bg-purple-50 border-purple-205' };
      case 'APPOINTMENT_CREATE':
        return { icon: Calendar, color: 'text-teal-650 bg-teal-50 border-teal-205' };
      case 'APPOINTMENT_UPDATE':
        return { icon: Activity, color: 'text-cyan-650 bg-cyan-50 border-cyan-205' };
      case 'USER_SUSPEND':
        return { icon: UserX, color: 'text-rose-600 bg-rose-50 border-rose-205' };
      case 'USER_RESTORE':
        return { icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-205' };
      case 'ROLE_PROMOTE':
        return { icon: ShieldCheck, color: 'text-blue-600 bg-blue-50 border-blue-205' };
      case 'ROLE_REVOKE':
        return { icon: ShieldAlert, color: 'text-orange-600 bg-orange-50 border-orange-205' };
      case 'PASSWORD_RESET_REQUEST':
      case 'PASSWORD_RESET_COMPLETE':
        return { icon: Key, color: 'text-pink-650 bg-pink-50 border-pink-205' };
      case 'EMAIL_VERIFIED':
        return { icon: BadgeCheck, color: 'text-indigo-650 bg-indigo-50 border-indigo-205' };
      default:
        return { icon: Clock, color: 'text-slate-500 bg-slate-50 border-slate-205' };
    }
  };

  const getCategoryBadgeColor = (category: UserCRM['engagementCategory']) => {
    switch (category) {
      case 'VIP':
        return 'border-amber-350 bg-amber-50 text-amber-700 shadow-xs';
      case 'High':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'Medium':
        return 'border-blue-200 bg-blue-50 text-[#0B4C8C]';
      case 'Low':
        return 'border-slate-200 bg-slate-50 text-slate-650';
      case 'Inactive':
      default:
        return 'border-slate-150 bg-slate-100/60 text-slate-400';
    }
  };

  return (
    <div className="space-y-8 relative text-[#0F172A]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Client CRM Suite</span>
          <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Client Management</h1>
          <p className="text-xs text-slate-500 mt-1">Track profiles, engagement scores, and audit activities.</p>
        </div>
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

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-[24px] border border-slate-200 shadow-xs">
        <div className="md:col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-50 focus:border-[#0B4C8C]/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-[#0B4C8C]/50 focus:outline-none transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-[#0B4C8C]/50 focus:outline-none transition-colors"
          >
            <option value="">All Roles</option>
            <option value="USER">User (Clients)</option>
            <option value="ADMIN">Admin (Staff)</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Fetching profiles...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-slate-400 italic">No users found matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">
                  <th className="py-4 px-6">Client Profile</th>
                  <th className="py-4 px-6">System Role</th>
                  <th className="py-4 px-6">Engagement Score</th>
                  <th className="py-4 px-6">Last Active</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map(u => (
                  <motion.tr 
                    key={u.id} 
                    layoutId={`user-row-${u.id}`}
                    onClick={() => handleSelectUser(u)}
                    className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${
                      selectedUser?.id === u.id ? 'bg-slate-100/70' : ''
                    }`}
                  >
                    <td className="py-4 px-6 flex items-center space-x-3.5">
                      <div className="w-9 h-9 rounded-full bg-[#0B4C8C]/10 border border-[#0B4C8C]/20 flex items-center justify-center text-[#0B4C8C] font-semibold text-sm">
                        {u.name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 group-hover:text-[#0B4C8C] transition-colors">
                          {u.name || 'Anonymous Client'}
                        </h4>
                        <p className="text-xs text-slate-400">{u.email}</p>
                        {u.phone && <p className="text-[10px] text-slate-500">{u.phone}</p>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                        u.role === 'ADMIN'
                          ? 'border-blue-200 bg-blue-50 text-[#0B4C8C]'
                          : 'border-slate-205 bg-slate-50 text-slate-500'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 border text-[10px] rounded-md font-semibold tracking-wide ${getCategoryBadgeColor(u.engagementCategory)}`}>
                          {u.engagementCategory}
                        </span>
                        <span className="font-semibold text-slate-700">{u.engagementScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      {u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-0.5 border text-[9px] rounded-full uppercase font-bold tracking-widest ${
                        u.status === 'ACTIVE'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-rose-205 bg-rose-50 text-rose-600 animate-pulse'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {u.id !== currentUserId ? (
                          <>
                            {/* Suspend/Restore */}
                            {u.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleUpdateUser(u.id, { status: 'SUSPENDED' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-605 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                title="Suspend Client"
                              >
                                <UserX size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateUser(u.id, { status: 'ACTIVE' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-605 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                title="Restore Client"
                              >
                                <UserCheck size={14} />
                              </button>
                            )}
                            
                            {/* Role promote/revoke */}
                            {u.role === 'ADMIN' ? (
                              <button
                                onClick={() => handleUpdateUser(u.id, { role: 'USER' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-orange-50 border border-orange-200 text-orange-605 hover:bg-orange-500 hover:text-white transition-all cursor-pointer"
                                title="Demote Role"
                              >
                                <ShieldAlert size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateUser(u.id, { role: 'ADMIN' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-[#0B4C8C]/10 border border-[#0B4C8C]/30 text-[#0B4C8C] hover:bg-[#0B4C8C] hover:text-white hover:border-[#0B4C8C] transition-all cursor-pointer"
                                title="Promote to Admin"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Self (Admin)</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-550">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-35 transition-all text-slate-705 font-bold"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-35 transition-all text-slate-705 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer/Panel for Selected User */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Activity className="text-[#0B4C8C]" size={16} />
                <h3 className="text-xs font-extrabold tracking-widest uppercase text-slate-805">Client Portfolio</h3>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-full bg-slate-200 hover:bg-slate-250 text-slate-650 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full bg-[#0B4C8C]/10 border border-[#0B4C8C]/30 flex items-center justify-center text-[#0B4C8C] font-semibold text-2xl shadow-sm">
                  {selectedUser.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <h2 className="text-xl font-medium text-slate-900">{selectedUser.name || 'Anonymous Client'}</h2>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                  {selectedUser.phone && <p className="text-xs text-slate-500 mt-1">{selectedUser.phone}</p>}
                </div>
                <button
                  onClick={() => router.push(`/admin/users/${selectedUser.id}`)}
                  className="mt-1 flex items-center gap-1.5 px-4 py-1.5 bg-[#0B4C8C]/10 hover:bg-[#0B4C8C] border border-[#0B4C8C]/35 text-[#0B4C8C] hover:text-white font-semibold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  <span>View 360° Profile</span>
                  <ExternalLink size={10} />
                </button>

                <div className="flex items-center space-x-3.5">
                  <span className={`px-2.5 py-0.5 border text-[10px] rounded-full uppercase font-bold tracking-widest ${
                    selectedUser.status === 'ACTIVE'
                      ? 'border-emerald-205 bg-emerald-50 text-emerald-600'
                      : 'border-rose-205 bg-rose-50 text-rose-600'
                  }`}>
                    {selectedUser.status}
                  </span>
                  <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                    selectedUser.role === 'ADMIN'
                      ? 'border-blue-200 bg-blue-50 text-[#0B4C8C]'
                      : 'border-slate-200 bg-slate-50 text-slate-550'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Engagement Analytics</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Category Card */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 col-span-2 ${getCategoryBadgeColor(selectedUser.engagementCategory)}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase tracking-widest font-semibold opacity-70">Engagement Status</span>
                      <TrendingUp size={16} />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-light">{selectedUser.engagementCategory}</span>
                      <span className="text-xs opacity-65 font-semibold">({selectedUser.engagementScore} points)</span>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block">Property Views</span>
                    <span className="text-2xl font-light text-slate-805">{selectedUser.metrics.views}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block">Saved Favorites</span>
                    <span className="text-2xl font-light text-slate-855">{selectedUser.metrics.saves}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block">Leads Inquiries</span>
                    <span className="text-2xl font-light text-slate-855">{selectedUser.metrics.inquiries}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block">Viewings Booked</span>
                    <span className="text-2xl font-light text-slate-855">{selectedUser.metrics.appointments}</span>
                  </div>
                </div>
              </div>

              {/* User Metadata */}
              <div className="space-y-3 bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-xs text-slate-600">
                <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold mb-2">Registration Details</h4>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Joined Date:</span>
                  <span className="text-slate-850 font-semibold">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Email Verification:</span>
                  <span className={`font-bold ${selectedUser.emailVerified ? 'text-emerald-600' : 'text-amber-605'}`}>
                    {selectedUser.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Last Sign In:</span>
                  <span className="text-slate-850 font-semibold">
                    {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Activity Timeline</h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Audit records</span>
                </div>
                {loadingTimeline ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Syncing timeline...</p>
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 border border-slate-205 rounded-xl">
                    No activity logs recorded.
                  </p>
                ) : (
                  <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
                    {timeline.map((item) => {
                      const iconConfig = getTimelineIconConfig(item.action);
                      const Icon = iconConfig.icon;
                      return (
                        <div key={item.id} className="relative group">
                          {/* Timeline node icon */}
                          <div className={`absolute -left-[35px] top-0 w-7.5 h-7.5 rounded-full border flex items-center justify-center shrink-0 shadow-sm ${iconConfig.color}`}>
                            <Icon size={12} />
                          </div>

                          {/* Event info */}
                          <div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] uppercase tracking-wider text-[#0B4C8C] font-extrabold">
                                {item.action.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold">
                                {new Date(item.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-750 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                            
                            {/* Render details context if present */}
                            {item.details && (
                              <div className="mt-1.5 p-2 bg-white rounded border border-slate-200 text-[10px] font-mono text-slate-500 max-h-24 overflow-y-auto divide-y divide-slate-100">
                                {Object.entries(item.details).map(([k, v]) => (
                                  <div key={k} className="flex justify-between py-0.5">
                                    <span className="text-slate-400 font-semibold pr-2">{k}:</span>
                                    <span className="text-slate-600 truncate max-w-[200px]">{JSON.stringify(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actor identifier if admin event */}
                            {item.actor && item.actor.email !== selectedUser.email && (
                              <p className="text-[9px] text-[#0B4C8C]/80 mt-1.5 flex items-center gap-1 font-semibold">
                                <span>Executed by Admin: {item.actor.name || item.actor.email}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions inside Panel */}
            {selectedUser.id !== currentUserId && (
              <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 grid grid-cols-2 gap-3">
                {selectedUser.status === 'ACTIVE' ? (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { status: 'SUSPENDED' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-rose-50 border border-rose-250 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all rounded-lg text-xs font-bold uppercase tracking-widest text-rose-600 text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <UserX size={14} />
                    <span>Suspend Client</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { status: 'ACTIVE' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-emerald-50 border border-emerald-250 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all rounded-lg text-xs font-bold uppercase tracking-widest text-emerald-600 text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <UserCheck size={14} />
                    <span>Restore Client</span>
                  </button>
                )}

                {selectedUser.role === 'ADMIN' ? (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { role: 'USER' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-orange-50 border border-orange-200 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all rounded-lg text-xs font-bold uppercase tracking-widest text-orange-600 text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <ShieldAlert size={14} />
                    <span>Revoke Admin</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { role: 'ADMIN' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-[#0B4C8C]/10 border border-[#0B4C8C]/35 hover:bg-[#0B4C8C] hover:text-white hover:border-[#0B4C8C] transition-all rounded-lg text-xs font-bold uppercase tracking-widest text-[#0B4C8C] text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <ShieldCheck size={14} />
                    <span>Promote Admin</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
