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
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        return { icon: LogIn, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'LOGOUT':
        return { icon: LogOut, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
      case 'PROPERTY_VIEW':
        return { icon: Eye, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 'PROPERTY_SAVE':
        return { icon: Star, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'PROPERTY_UNSAVE':
        return { icon: X, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'INQUIRY_CREATE':
        return { icon: Mail, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'APPOINTMENT_CREATE':
        return { icon: Calendar, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' };
      case 'APPOINTMENT_UPDATE':
        return { icon: Activity, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
      case 'USER_SUSPEND':
        return { icon: UserX, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
      case 'USER_RESTORE':
        return { icon: UserCheck, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'ROLE_PROMOTE':
        return { icon: ShieldCheck, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
      case 'ROLE_REVOKE':
        return { icon: ShieldAlert, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
      case 'PASSWORD_RESET_REQUEST':
      case 'PASSWORD_RESET_COMPLETE':
        return { icon: Key, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
      case 'EMAIL_VERIFIED':
        return { icon: BadgeCheck, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      default:
        return { icon: Clock, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const getCategoryBadgeColor = (category: UserCRM['engagementCategory']) => {
    switch (category) {
      case 'VIP':
        return 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#F5D67B] shadow-[0_0_10px_rgba(212,175,55,0.2)]';
      case 'High':
        return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
      case 'Medium':
        return 'border-blue-500/30 bg-blue-500/5 text-blue-400';
      case 'Low':
        return 'border-slate-500/30 bg-slate-500/5 text-slate-400';
      case 'Inactive':
      default:
        return 'border-white/10 bg-white/5 text-white/45';
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Client CRM Suite</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Client Management</h1>
          <p className="text-xs text-white/50 mt-1">Track profiles, engagement scores, and audit activities.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#161616] p-4 rounded-xl border border-white/5">
        <div className="md:col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
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
            className="w-full px-3 py-2.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          >
            <option value="">All Roles</option>
            <option value="USER">User (Clients)</option>
            <option value="ADMIN">Admin (Staff)</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#161616] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs uppercase tracking-widest text-white/40">Fetching profiles...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-white/40 italic">No users found matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] uppercase tracking-widest text-white/45 font-semibold">
                  <th className="py-4 px-6">Client Profile</th>
                  <th className="py-4 px-6">System Role</th>
                  <th className="py-4 px-6">Engagement Score</th>
                  <th className="py-4 px-6">Last Active</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {users.map(u => (
                  <motion.tr 
                    key={u.id} 
                    layoutId={`user-row-${u.id}`}
                    onClick={() => handleSelectUser(u)}
                    className={`hover:bg-white/[0.01] transition-colors cursor-pointer group ${
                      selectedUser?.id === u.id ? 'bg-[#D4AF37]/[0.02]' : ''
                    }`}
                  >
                    <td className="py-4 px-6 flex items-center space-x-3.5">
                      <div className="w-9 h-9 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#F5D67B] font-semibold text-sm">
                        {u.name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                          {u.name || 'Anonymous Client'}
                        </h4>
                        <p className="text-xs text-white/40">{u.email}</p>
                        {u.phone && <p className="text-[10px] text-white/30">{u.phone}</p>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                        u.role === 'ADMIN'
                          ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 border text-[10px] rounded-md font-semibold tracking-wide ${getCategoryBadgeColor(u.engagementCategory)}`}>
                          {u.engagementCategory}
                        </span>
                        <span className="font-light text-white/80">{u.engagementScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-white/50">
                      {u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-0.5 border text-[9px] rounded-full uppercase font-bold tracking-widest ${
                        u.status === 'ACTIVE'
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                          : 'border-rose-500/20 bg-rose-500/5 text-rose-400 animate-pulse'
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
                                className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                title="Suspend Client"
                              >
                                <UserX size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateUser(u.id, { status: 'ACTIVE' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
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
                                className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-all"
                                title="Demote Role"
                              >
                                <ShieldAlert size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateUser(u.id, { role: 'ADMIN' })}
                                disabled={updatingUserId === u.id}
                                className="p-1.5 rounded bg-yellow-500/10 border border-[#D4AF37]/30 text-[#F5D67B] hover:bg-[#D4AF37] hover:text-black transition-all"
                                title="Promote to Admin"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-white/30 italic">Self (Admin)</span>
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
          <div className="p-4 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <span className="text-xs text-white/45">Page {page} of {totalPages}</span>
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

      {/* Right Drawer/Panel for Selected User */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 bg-[#161616] border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-white/[0.01] flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Activity className="text-[#D4AF37]" size={16} />
                <h3 className="text-sm font-semibold tracking-wide uppercase text-white">Client Portfolio</h3>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-white/5">
                <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5D67B] font-semibold text-2xl shadow-xl">
                  {selectedUser.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <h2 className="text-xl font-medium text-white">{selectedUser.name || 'Anonymous Client'}</h2>
                  <p className="text-xs text-white/50">{selectedUser.email}</p>
                  {selectedUser.phone && <p className="text-xs text-white/40 mt-1">{selectedUser.phone}</p>}
                </div>

                <div className="flex items-center space-x-3.5">
                  <span className={`px-2.5 py-0.5 border text-[10px] rounded-full uppercase font-bold tracking-widest ${
                    selectedUser.status === 'ACTIVE'
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
                  }`}>
                    {selectedUser.status}
                  </span>
                  <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                    selectedUser.role === 'ADMIN'
                      ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]'
                      : 'border-white/10 bg-white/5 text-white/50'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Engagement Analytics</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Category Card */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 col-span-2 ${getCategoryBadgeColor(selectedUser.engagementCategory)}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase tracking-widest font-semibold opacity-70">Engagement Status</span>
                      <TrendingUp size={16} />
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-light">{selectedUser.engagementCategory}</span>
                      <span className="text-xs opacity-60">({selectedUser.engagementScore} points)</span>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Property Views</span>
                    <span className="text-2xl font-light text-white">{selectedUser.metrics.views}</span>
                  </div>
                  <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Saved Favorites</span>
                    <span className="text-2xl font-light text-white">{selectedUser.metrics.saves}</span>
                  </div>
                  <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Leads Inquiries</span>
                    <span className="text-2xl font-light text-white">{selectedUser.metrics.inquiries}</span>
                  </div>
                  <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Viewings Booked</span>
                    <span className="text-2xl font-light text-white">{selectedUser.metrics.appointments}</span>
                  </div>
                </div>
              </div>

              {/* User Metadata */}
              <div className="space-y-3 bg-[#1C1C1C] border border-white/5 p-4 rounded-xl text-xs text-white/60">
                <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">Registration Details</h4>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span>Joined Date:</span>
                  <span className="text-white">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span>Email Verification:</span>
                  <span className={`font-semibold ${selectedUser.emailVerified ? 'text-emerald-400' : 'text-yellow-500'}`}>
                    {selectedUser.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Last Sign In:</span>
                  <span className="text-white">
                    {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Activity Timeline</h4>
                  <span className="text-[10px] text-white/40">Audit records</span>
                </div>
                {loadingTimeline ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[10px] uppercase tracking-widest text-white/30">Syncing timeline...</p>
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-white/40 italic py-8 text-center bg-white/[0.01] border border-white/5 rounded-xl">
                    No activity logs recorded.
                  </p>
                ) : (
                  <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6">
                    {timeline.map((item) => {
                      const iconConfig = getTimelineIconConfig(item.action);
                      const Icon = iconConfig.icon;
                      return (
                        <div key={item.id} className="relative group">
                          {/* Timeline node icon */}
                          <div className={`absolute -left-[35px] top-0 w-7.5 h-7.5 rounded-full border flex items-center justify-center shrink-0 shadow-lg ${iconConfig.color}`}>
                            <Icon size={12} />
                          </div>

                          {/* Event info */}
                          <div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                                {item.action.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] text-white/30">
                                {new Date(item.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-white/80 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                            
                            {/* Render details context if present */}
                            {item.details && (
                              <div className="mt-1.5 p-2 bg-white/[0.02] rounded border border-white/5 text-[10px] font-mono text-white/40 max-h-24 overflow-y-auto divide-y divide-white/5">
                                {Object.entries(item.details).map(([k, v]) => (
                                  <div key={k} className="flex justify-between py-0.5">
                                    <span className="text-white/35 font-semibold pr-2">{k}:</span>
                                    <span className="text-white/60 truncate max-w-[200px]">{JSON.stringify(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actor identifier if admin event */}
                            {item.actor && item.actor.email !== selectedUser.email && (
                              <p className="text-[9px] text-[#D4AF37]/80 mt-1.5 flex items-center gap-1 font-semibold">
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
              <div className="p-5 border-t border-white/5 bg-white/[0.01] shrink-0 grid grid-cols-2 gap-3">
                {selectedUser.status === 'ACTIVE' ? (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { status: 'SUSPENDED' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-rose-500/10 border border-rose-500/35 hover:bg-rose-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider text-rose-400 text-center flex items-center justify-center space-x-1.5"
                  >
                    <UserX size={14} />
                    <span>Suspend Client</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { status: 'ACTIVE' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-emerald-500/10 border border-emerald-500/35 hover:bg-emerald-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider text-emerald-400 text-center flex items-center justify-center space-x-1.5"
                  >
                    <UserCheck size={14} />
                    <span>Restore Client</span>
                  </button>
                )}

                {selectedUser.role === 'ADMIN' ? (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { role: 'USER' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-orange-500/10 border border-orange-500/35 hover:bg-orange-500 hover:text-white transition-all rounded-lg text-xs font-semibold uppercase tracking-wider text-orange-400 text-center flex items-center justify-center space-x-1.5"
                  >
                    <ShieldAlert size={14} />
                    <span>Revoke Admin</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateUser(selectedUser.id, { role: 'ADMIN' })}
                    disabled={updatingUserId === selectedUser.id}
                    className="w-full py-2.5 bg-yellow-500/10 border border-[#D4AF37]/35 hover:bg-[#D4AF37] hover:text-black transition-all rounded-lg text-xs font-semibold uppercase tracking-wider text-[#F5D67B] text-center flex items-center justify-center space-x-1.5"
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
