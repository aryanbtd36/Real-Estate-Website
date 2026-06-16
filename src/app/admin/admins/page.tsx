'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  ShieldAlert,
  Settings,
  MoreVertical,
  UserCheck,
  Ban,
  Activity,
  Trash2,
  Lock,
  ChevronRight,
  Sparkles,
  X,
  Compass,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Permissions list constant matching backend enum values
const PERMISSIONS_LIST = [
  { value: 'MANAGE_PROPERTIES', label: 'Manage properties', desc: 'Allows create, edit, delete properties' },
  { value: 'MANAGE_LEADS', label: 'Manage leads', desc: 'CRM access, leads pipeline management' },
  { value: 'MANAGE_APPOINTMENTS', label: 'Manage appointments', desc: 'Visits coordinator, outcomes recordings' },
  { value: 'MANAGE_USERS', label: 'Manage clients', desc: 'View, suspend, restore standard clients' },
  { value: 'VIEW_ANALYTICS', label: 'View BI analytics', desc: 'Access executive growth forecasts & heatmaps' },
  { value: 'EXPORT_DATA', label: 'Export tables', desc: 'Enables downloading CSV sheets' },
  { value: 'MANAGE_CONTENT', label: 'Manage content', desc: 'Edit FAQs, banners, static blocks' },
  { value: 'MANAGE_SETTINGS', label: 'System settings', desc: 'Modify configurations and operational limits' },
  { value: 'MANAGE_ADMINS', label: 'Governance portal', desc: 'Control other admins, grant permissions' },
  { value: 'VIEW_SECURITY', label: 'Security monitor', desc: 'Access SOC logs, session controls' },
  { value: 'VIEW_AUDITS', label: 'View audits', desc: 'Read general system activity logs' },
  { value: 'VIEW_FINANCIALS', label: 'View financials', desc: 'Track executive revenue impacts and margins' }
];

export default function AdminDirectoryPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteRole, setPromoteRole] = useState('ADMIN');
  const [actionError, setActionError] = useState('');

  const [permEditOpen, setPermEditOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } catch (err) {
      console.error('Failed to load admins list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoteEmail, role: promoteRole })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to promote user');
      } else {
        setPromoteEmail('');
        setPromoteOpen(false);
        fetchAdmins();
      }
    } catch (err) {
      setActionError('Internal Server Error');
    }
  };

  const handleStatusChange = async (adminId: string, action: 'SUSPEND' | 'RESTORE' | 'REVOKE') => {
    if (action === 'REVOKE' && !confirm('Are you sure you want to completely strip administrative status from this user?')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Operation failed');
      } else {
        fetchAdmins();
        if (permEditOpen && selectedAdmin?.id === adminId) {
          setPermEditOpen(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openPermModal = (admin: any) => {
    setSelectedAdmin(admin);
    setSelectedPerms(admin.permissions || []);
    setPermEditOpen(true);
  };

  const handlePermissionSave = async () => {
    try {
      const res = await fetch(`/api/admin/admins/${selectedAdmin.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedPerms })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save permissions');
      } else {
        setPermEditOpen(false);
        fetchAdmins();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (val: string) => {
    if (selectedPerms.includes(val)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== val));
    } else {
      setSelectedPerms([...selectedPerms, val]);
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    const text = (admin.name || '') + ' ' + admin.email;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-8 relative">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <Compass className="text-[#D4AF37] animate-pulse" size={28} />
            Governance Portal
          </h1>
          <p className="text-sm text-white/45 mt-1.5">
            Configure hierarchical staff clearances, inspect logs, and manage administration bounds.
          </p>
        </div>
        <div>
          <button
            onClick={() => setPromoteOpen(true)}
            className="flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold rounded text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Promote new admin
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total staff', val: admins.length, desc: 'Registered personnel' },
          { label: 'Super Administrators', val: admins.filter(a => a.role === 'SUPER_ADMIN').length, desc: 'Full authority level' },
          { label: 'Active Admins', val: admins.filter(a => a.status === 'ACTIVE' && a.role === 'ADMIN').length, desc: 'Standard staff active' },
          { label: 'Suspended Accounts', val: admins.filter(a => a.status === 'SUSPENDED').length, desc: 'Revoked/locked clearances' }
        ].map((c, i) => (
          <div key={i} className="bg-[#161616] border border-white/5 p-5 rounded-xl space-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">{c.label}</span>
            <div className="text-3xl font-light text-[#D4AF37]">{c.val}</div>
            <span className="text-[10px] text-white/30 block mt-1">{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Directory Table Area */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h3 className="text-sm uppercase tracking-wider font-semibold text-white/80">Staff Clearance Roster</h3>
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2 pl-9 rounded-lg text-xs outline-none transition-colors"
            />
            <Search className="absolute left-3 top-2.5 text-white/40" size={12} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/5 rounded-lg">
            <ShieldAlert size={36} className="text-white/20 mx-auto mb-2 animate-bounce" />
            <p className="text-sm text-white/45">No administrator accounts located in the staff list.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-mono text-[9px] pb-3">
                  <th className="pb-3 font-semibold">User Details</th>
                  <th className="pb-3 font-semibold">Security Role</th>
                  <th className="pb-3 font-semibold">System Status</th>
                  <th className="pb-3 font-semibold text-center">Permissions</th>
                  <th className="pb-3 font-semibold">Activity Records</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="py-4 pr-3">
                      <div className="font-semibold text-white group-hover:text-[#F5D67B] transition-colors">
                        {admin.name || 'Anonymous User'}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5">{admin.email}</div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-[3px] text-[9px] uppercase tracking-wider font-semibold ${
                        admin.role === 'SUPER_ADMIN'
                          ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#F5D67B]'
                          : 'bg-white/5 border border-white/10 text-white/70'
                      }`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] ${
                        admin.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          admin.status === 'ACTIVE' ? 'bg-green-400 animate-ping' : 'bg-red-400'
                        }`} />
                        {admin.status}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {admin.role === 'SUPER_ADMIN' ? (
                        <span className="text-[9px] text-[#D4AF37] uppercase tracking-widest font-mono">Bypass / All</span>
                      ) : (
                        <button
                          onClick={() => openPermModal(admin)}
                          className="px-2 py-1 bg-white/5 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 border border-white/5 rounded text-[10px] text-white/70 hover:text-[#F5D67B] transition-all"
                        >
                          {admin.permissionCount} Permissions
                        </button>
                      )}
                    </td>
                    <td className="py-4 text-white/50 space-y-0.5 text-[10px] font-mono">
                      <div>Login: {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'Never'}</div>
                      <div>Active: {admin.lastActivity ? new Date(admin.lastActivity).toLocaleDateString() : 'Never'}</div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <Link
                          href={`/admin/admins/${admin.id}`}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-white/50 hover:text-[#D4AF37] transition-colors"
                        >
                          Inspect <ArrowRight size={10} />
                        </Link>
                        <div className="relative group/actions inline-block">
                          <button className="p-1 hover:bg-white/5 rounded border border-transparent hover:border-white/5 text-white/40 hover:text-white">
                            <MoreVertical size={14} />
                          </button>
                          <div className="hidden group-hover/actions:block absolute right-0 top-6 z-30 w-44 bg-[#1E1E1E] border border-white/5 rounded-lg shadow-xl py-1 text-left">
                            {admin.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleStatusChange(admin.id, 'SUSPEND')}
                                className="w-full px-3 py-2 text-[10px] uppercase font-bold text-red-400 hover:bg-red-400/5 flex items-center gap-2"
                              >
                                <Ban size={12} /> Suspend Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(admin.id, 'RESTORE')}
                                className="w-full px-3 py-2 text-[10px] uppercase font-bold text-green-400 hover:bg-green-400/5 flex items-center gap-2"
                              >
                                <UserCheck size={12} /> Activate Admin
                              </button>
                            )}
                            <button
                              onClick={() => handleStatusChange(admin.id, 'REVOKE')}
                              className="w-full px-3 py-2 text-[10px] uppercase font-bold text-red-500 hover:bg-red-500/5 flex items-center gap-2 border-t border-white/5"
                            >
                              <Trash2 size={12} /> Revoke Clearance
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Promotes User Modal */}
      <AnimatePresence>
        {promoteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPromoteOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-sm uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <UserCheck size={16} className="text-[#D4AF37]" />
                  Promote User to Staff
                </h3>
                <button onClick={() => setPromoteOpen(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handlePromote} className="space-y-5 mt-5">
                {actionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/25 rounded text-xs text-red-400">
                    {actionError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 block font-semibold">User Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter registered client email"
                    value={promoteEmail}
                    onChange={(e) => setPromoteEmail(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3 rounded-lg text-xs outline-none text-white transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 block font-semibold">Administrative Access Level</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPromoteRole('ADMIN')}
                      className={`p-3 border rounded-lg text-xs uppercase font-semibold transition-all text-center ${
                        promoteRole === 'ADMIN'
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#F5D67B]'
                          : 'border-white/10 hover:border-white/20 text-white/50'
                      }`}
                    >
                      🛡 Administrator
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoteRole('SUPER_ADMIN')}
                      className={`p-3 border rounded-lg text-xs uppercase font-semibold transition-all text-center ${
                        promoteRole === 'SUPER_ADMIN'
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#F5D67B]'
                          : 'border-white/10 hover:border-white/20 text-white/50'
                      }`}
                    >
                      👑 Super Admin
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#D4AF37] hover:bg-[#F5D67B] text-black font-semibold rounded-lg text-xs uppercase tracking-wider transition-colors mt-2"
                >
                  Authorize clearance level
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permissions Assignment Modal */}
      <AnimatePresence>
        {permEditOpen && selectedAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPermEditOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-center border-b border-white/5 pb-4 shrink-0">
                <div>
                  <h3 className="text-sm uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Settings size={16} className="text-[#D4AF37]" />
                    Assign Granular Clearances
                  </h3>
                  <span className="text-[10px] text-white/40 mt-1 block">Staff user: {selectedAdmin.name || selectedAdmin.email}</span>
                </div>
                <button onClick={() => setPermEditOpen(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>

              {/* Permissions list container */}
              <div className="flex-1 overflow-y-auto py-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pr-2">
                {PERMISSIONS_LIST.map((p) => {
                  const active = selectedPerms.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => togglePermission(p.value)}
                      className={`flex flex-col text-left p-3 border rounded-xl transition-all relative ${
                        active
                          ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                          : 'border-white/5 bg-black/20 hover:border-white/10'
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
                      )}
                      <span className={`text-[11px] font-semibold ${active ? 'text-[#F5D67B]' : 'text-white/80'}`}>
                        {p.label}
                      </span>
                      <span className="text-[10px] text-white/40 mt-1 font-light leading-relaxed">
                        {p.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/5 pt-4 flex gap-3 justify-end shrink-0">
                <button
                  onClick={() => setPermEditOpen(false)}
                  className="py-2.5 px-5 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePermissionSave}
                  className="py-2.5 px-6 bg-[#D4AF37] hover:bg-[#F5D67B] text-black font-semibold rounded text-xs uppercase tracking-wider transition-colors"
                >
                  Save alterations
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
