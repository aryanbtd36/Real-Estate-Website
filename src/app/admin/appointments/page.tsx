'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Building, Search, Filter, Check, X, ShieldAlert, Eye, MessageSquare, Plus, Trash2, AlertCircle, ThumbsUp, CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'>('ALL');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminsList, setAdminsList] = useState<any[]>([]);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00 AM');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleAdminId, setRescheduleAdminId] = useState('unassigned');

  // Cancel state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Complete state
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionOutcome, setCompletionOutcome] = useState('INTERESTED');
  const [completionNotes, setCompletionNotes] = useState('');

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/admin/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        const users = Array.isArray(data) ? data : (data.users || []);
        setAdminsList(users.filter((u: any) => u.role === 'ADMIN'));
      }
    } catch (err) {
      console.error('Failed to fetch admins list:', err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchAdmins();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string, customData: any = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, ...customData }),
      });
      if (res.ok) {
        await fetchAppointments();
        setShowReschedule(false);
        if (selectedAppointment && selectedAppointment.id === id) {
          setSelectedAppointment((prev: any) => ({
            ...prev,
            status: newStatus,
            ...customData
          }));
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update appointment status.');
      }
    } catch (err) {
      console.error('Failed to update appointment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime || !rescheduleReason) {
      alert('Please fill out all rescheduling fields.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/appointments/reschedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAppointment.id,
          date: rescheduleDate,
          time: rescheduleTime,
          reason: rescheduleReason,
          adminId: rescheduleAdminId,
        }),
      });
      if (res.ok) {
        await fetchAppointments();
        setShowReschedule(false);
        setSelectedAppointment(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reschedule showing.');
      }
    } catch (err) {
      console.error('Failed to reschedule:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason) {
      alert('Cancellation reason is required.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/appointments/${selectedAppointment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (res.ok) {
        await fetchAppointments();
        setShowCancelForm(false);
        setSelectedAppointment(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to cancel showing.');
      }
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/appointments/${selectedAppointment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: completionOutcome, notes: completionNotes }),
      });
      if (res.ok) {
        await fetchAppointments();
        setShowCompletionForm(false);
        setSelectedAppointment(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to complete showing.');
      }
    } catch (err) {
      console.error('Failed to complete appointment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/appointments/${selectedAppointment.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAppointment((prev: any) => ({
          ...prev,
          notes: [data.note, ...(prev.notes || [])],
        }));
        setNewNoteContent('');
        fetchAppointments();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/admin/appointments/${selectedAppointment.id}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedAppointment((prev: any) => ({
          ...prev,
          notes: (prev.notes || []).filter((n: any) => n.id !== noteId),
        }));
        fetchAppointments();
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // KPIs Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const nowMs = new Date().getTime();

  const todayShowings = appointments.filter((a) => a.date === todayStr).length;
  const overdueVisits = appointments.filter((a) => {
    const isActive = ['PENDING', 'APPROVED', 'CONFIRMED', 'RESCHEDULED'].includes(a.status);
    const start = new Date(a.startTime).getTime();
    return isActive && start < nowMs;
  }).length;
  const noShows = appointments.filter((a) => a.outcome === 'NO_SHOW').length;

  const filteredAppointments = appointments.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.property.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Scheduled Visits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Scheduler Logs</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Visits Manager</h1>
          <p className="text-xs text-white/50 mt-1">Review, approve, reschedule or complete site viewing consultations.</p>
        </div>

        {/* View Calendar Button */}
        <Link
          href="/admin/appointments/calendar"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] text-xs font-semibold uppercase tracking-wider rounded-lg transition-all"
        >
          <CalendarIcon size={14} /> Open Interactive Calendar
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Today's Showings</span>
            <span className="text-3xl font-light block mt-2 text-white">{todayShowings}</span>
          </div>
          <Calendar className="text-[#D4AF37] shrink-0" size={24} />
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Overdue visits</span>
            <span className="text-3xl font-light block mt-2 text-red-400">{overdueVisits}</span>
          </div>
          <AlertCircle className="text-red-400 shrink-0" size={24} />
        </div>

        <div className="bg-[#161616] border border-white/5 p-6 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Total No-Shows</span>
            <span className="text-3xl font-light block mt-2 text-yellow-400">{noShows}</span>
          </div>
          <ThumbsUp className="text-yellow-400 shrink-0" size={24} />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#161616] p-4 rounded-xl border border-white/5">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search by client or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3 pl-10 rounded-lg text-white text-sm outline-none transition-colors"
          />
          <Search className="absolute left-3 top-3.5 text-white/40" size={16} />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-[#D4AF37] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full md:w-44 bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-xs outline-none focus:border-[#D4AF37] appearance-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="RESCHEDULED">Rescheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className={`${selectedAppointment ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4`}>
          {filteredAppointments.length === 0 ? (
            <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
              <p className="text-sm text-white/40">No consultations found matching criteria.</p>
            </div>
          ) : (
            <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="p-4 sm:p-6">Client Info</th>
                      <th className="p-4 sm:p-6">Residence</th>
                      <th className="p-4 sm:p-6">Scheduled Slot</th>
                      <th className="p-4 sm:p-6">Status</th>
                      <th className="p-4 sm:p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAppointments.map((app) => (
                      <tr 
                        key={app.id} 
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedAppointment?.id === app.id ? 'bg-white/5' : ''}`}
                        onClick={() => {
                          setSelectedAppointment(app);
                          setShowReschedule(false);
                          setShowCancelForm(false);
                          setShowCompletionForm(false);
                        }}
                      >
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="font-semibold block text-white">{app.name}</span>
                            <span className="text-[11px] text-white/40 block mt-0.5">{app.email}</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6 text-white/80 font-medium">
                          {app.property.name}
                        </td>
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="block text-white font-medium">{app.date}</span>
                            <span className="text-xs text-white/40">{app.time} slot</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6">
                          <span className={`inline-block px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded border ${
                            app.status === 'CONFIRMED' || app.status === 'APPROVED'
                              ? 'border-green-500/30 bg-green-500/5 text-green-400'
                              : app.status === 'PENDING'
                              ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
                              : app.status === 'COMPLETED'
                              ? 'border-blue-500/30 bg-blue-500/5 text-blue-400'
                              : app.status === 'RESCHEDULED'
                              ? 'border-purple-500/30 bg-purple-500/5 text-purple-400'
                              : 'border-red-500/30 bg-red-500/5 text-red-400'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="p-4 sm:p-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedAppointment(app);
                                setShowReschedule(false);
                                setShowCancelForm(false);
                                setShowCompletionForm(false);
                              }}
                              className="p-1.5 border border-white/5 hover:border-[#D4AF37]/30 text-white/40 hover:text-[#D4AF37] rounded"
                              title="Details"
                            >
                              <Eye size={14} />
                            </button>
                            {app.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(app.id, 'CONFIRMED')}
                                  className="p-1.5 border border-white/5 bg-green-500/5 hover:bg-green-500 hover:text-black text-green-400 rounded"
                                  title="Approve visit"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedAppointment(app);
                                    setShowCancelForm(true);
                                  }}
                                  className="p-1.5 border border-white/5 bg-red-500/5 hover:bg-red-500 hover:text-black text-red-400 rounded"
                                  title="Cancel visit"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel Drawer */}
        <AnimatePresence>
          {selectedAppointment && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="xl:col-span-5 bg-[#161616] border border-white/5 rounded-xl p-6 shadow-2xl space-y-6 self-start max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <h3 className="text-base font-semibold text-[#D4AF37] uppercase tracking-wider">Appointment Info</h3>
                <button
                  onClick={() => {
                    setSelectedAppointment(null);
                    setShowReschedule(false);
                    setShowCancelForm(false);
                    setShowCompletionForm(false);
                  }}
                  className="text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/10 text-[#F5D67B] border border-[#D4AF37]/20 rounded-lg shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Client name</span>
                    <span className="text-sm font-medium text-white block">{selectedAppointment.name}</span>
                    <span className="text-xs text-white/50">{selectedAppointment.email} • {selectedAppointment.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="p-2 bg-[#D4AF37]/10 text-[#F5D67B] border border-[#D4AF37]/20 rounded-lg shrink-0">
                    <Building size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Property residence</span>
                    <span className="text-sm font-medium text-white block">{selectedAppointment.property.name}</span>
                    <span className="text-xs text-white/50">{selectedAppointment.property.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#D4AF37]" />
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">Date</span>
                      <span className="text-xs text-white font-medium">{selectedAppointment.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#D4AF37]" />
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">Time slot</span>
                      <span className="text-xs text-white font-medium">{selectedAppointment.time}</span>
                    </div>
                  </div>
                </div>

                {selectedAppointment.outcome && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Showing Outcome</span>
                    <span className="inline-block mt-1 px-2.5 py-0.5 border border-blue-500/30 text-blue-400 bg-blue-500/5 text-[10px] uppercase tracking-wider font-semibold rounded">
                      {selectedAppointment.outcome.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {selectedAppointment.message && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block flex items-center gap-1">
                      <MessageSquare size={10} />
                      <span>Message</span>
                    </span>
                    <p className="text-xs text-white/80 bg-[#0A0A0A] p-3 rounded border border-white/5 mt-1 leading-relaxed italic">
                      "{selectedAppointment.message}"
                    </p>
                  </div>
                )}

                {selectedAppointment.specialRequests && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-red-400 block flex items-center gap-1">
                      <ShieldAlert size={10} />
                      <span>Special Requests / Notes</span>
                    </span>
                    <p className="text-xs text-red-300 bg-red-950/20 p-3 rounded border border-red-500/10 mt-1 leading-relaxed">
                      {selectedAppointment.specialRequests}
                    </p>
                  </div>
                )}

                {/* Internal Observation Notes Log */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block">Observation Notes</span>
                  
                  {/* Note input form */}
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add internal observation note..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="flex-grow bg-[#0A0A0A] border border-white/10 focus:border-[#D4AF37] p-2 rounded text-xs text-white outline-none"
                    />
                    <button type="submit" className="p-2 bg-[#D4AF37] hover:bg-[#F5D67B] text-black rounded">
                      <Plus size={14} />
                    </button>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {!selectedAppointment.notes || selectedAppointment.notes.length === 0 ? (
                      <p className="text-[10px] text-white/30 italic">No notes recorded yet.</p>
                    ) : (
                      selectedAppointment.notes.map((note: any) => (
                        <div key={note.id} className="bg-[#0A0A0A] p-2.5 rounded border border-white/5 flex justify-between items-start gap-2">
                          <div>
                            <p className="text-[11px] text-white/80 leading-normal">{note.content}</p>
                            <span className="text-[8px] text-white/40 block mt-1">
                              By {note.createdBy?.name || 'Admin'} • {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-white/30 hover:text-red-400 p-0.5 transition-colors shrink-0"
                            title="Delete note"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Workflow Transitions */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Status Management</span>
                    <span className="text-xs font-semibold uppercase text-[#D4AF37]">{selectedAppointment.status}</span>
                  </div>

                  {!showReschedule && !showCancelForm && !showCompletionForm ? (
                    <div className="flex flex-wrap gap-2">
                      {(selectedAppointment.status === 'PENDING' || selectedAppointment.status === 'CANCELLED') && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedAppointment.id, 'CONFIRMED')}
                          className="flex-grow min-w-[100px] px-3 py-2 bg-green-500/10 border border-green-500/20 hover:bg-green-500 hover:text-black text-green-400 text-[10px] uppercase tracking-widest font-bold rounded transition-colors"
                        >
                          Approve visit
                        </button>
                      )}
                      
                      {selectedAppointment.status === 'CONFIRMED' && (
                        <button
                          disabled={actionLoading}
                          onClick={() => {
                            setCompletionOutcome('INTERESTED');
                            setCompletionNotes('');
                            setShowCompletionForm(true);
                          }}
                          className="flex-grow min-w-[100px] px-3 py-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500 hover:text-black text-blue-400 text-[10px] uppercase tracking-widest font-bold rounded transition-colors"
                        >
                          Mark Complete
                        </button>
                      )}

                      {selectedAppointment.status !== 'CANCELLED' && selectedAppointment.status !== 'COMPLETED' && (
                        <>
                          <button
                            disabled={actionLoading}
                            onClick={() => {
                              setRescheduleDate(selectedAppointment.date);
                              setRescheduleTime(selectedAppointment.time);
                              setRescheduleReason('');
                              setRescheduleAdminId(selectedAppointment.adminId || 'unassigned');
                              setShowReschedule(true);
                            }}
                            className="flex-grow min-w-[100px] px-3 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/25 hover:bg-[#D4AF37] hover:text-black text-[#F5D67B] text-[10px] uppercase tracking-widest font-bold rounded transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={() => {
                              setCancelReason('');
                              setShowCancelForm(true);
                            }}
                            className="flex-grow min-w-[100px] px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-black text-red-400 text-[10px] uppercase tracking-widest font-bold rounded transition-colors"
                          >
                            Cancel visit
                          </button>
                        </>
                      )}
                    </div>
                  ) : showReschedule ? (
                    <form onSubmit={handleResubmitReschedule} className="bg-[#0A0A0A] p-4 rounded-lg border border-white/5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">Reschedule Options</span>
                        <button type="button" onClick={() => setShowReschedule(false)} className="text-white/40 hover:text-white text-xs">Cancel</button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Select Date</label>
                          <input
                            type="date"
                            required
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Select Time Slot</label>
                          <select
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] appearance-none"
                          >
                            <option value="09:00 AM">09:00 AM</option>
                            <option value="10:00 AM">10:00 AM</option>
                            <option value="11:00 AM">11:00 AM</option>
                            <option value="01:00 PM">01:00 PM</option>
                            <option value="02:00 PM">02:00 PM</option>
                            <option value="03:00 PM">03:00 PM</option>
                            <option value="04:00 PM">04:00 PM</option>
                            <option value="05:00 PM">05:00 PM</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Assign Agent</label>
                          <select
                            value={rescheduleAdminId}
                            onChange={(e) => setRescheduleAdminId(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] appearance-none"
                          >
                            <option value="unassigned">Unassigned</option>
                            {adminsList.map((adm) => (
                              <option key={adm.id} value={adm.id}>{adm.name || adm.email}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Reschedule Reason</label>
                          <textarea
                            required
                            placeholder="Reason for changing schedule..."
                            value={rescheduleReason}
                            onChange={(e) => setRescheduleReason(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] min-h-[60px]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-[10px] font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
                      >
                        Confirm Reschedule
                      </button>
                    </form>
                  ) : showCancelForm ? (
                    <form onSubmit={handleCancelAppointment} className="bg-[#0A0A0A] p-4 rounded-lg border border-white/5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Cancel Showing</span>
                        <button type="button" onClick={() => setShowCancelForm(false)} className="text-white/40 hover:text-white text-xs">Back</button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-white/40 block">Reason for Cancellation</label>
                        <textarea
                          required
                          placeholder="Provide audit cancellation explanation..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] min-h-[60px]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-red-700 transition-colors"
                      >
                        Confirm Cancel visit
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleCompleteAppointment} className="bg-[#0A0A0A] p-4 rounded-lg border border-white/5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold">Complete Showing</span>
                        <button type="button" onClick={() => setShowCompletionForm(false)} className="text-white/40 hover:text-white text-xs">Back</button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Visit Outcome</label>
                          <select
                            value={completionOutcome}
                            onChange={(e) => setCompletionOutcome(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] appearance-none"
                          >
                            <option value="INTERESTED">Interested</option>
                            <option value="VERY_INTERESTED">Very Interested</option>
                            <option value="FOLLOW_UP_REQUIRED">Follow-Up Required</option>
                            <option value="NEGOTIATION_STARTED">Negotiation Started</option>
                            <option value="NOT_INTERESTED">Not Interested</option>
                            <option value="SALE_COMPLETED">Sale Completed</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-white/40 block">Outcome Notes</label>
                          <textarea
                            placeholder="Add notes about client's interest or deal progress..."
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none focus:border-[#D4AF37] min-h-[60px]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-blue-700 transition-colors"
                      >
                        Complete Visit
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
