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
          <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-mono">Loading Scheduled Visits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Scheduler Logs</span>
          <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Visits Manager</h1>
          <p className="text-xs text-slate-500 mt-1">Review, approve, reschedule or complete site viewing consultations.</p>
        </div>

        {/* View Calendar Button */}
        <Link
          href="/admin/appointments/calendar"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 hover:text-[#0B4C8C] text-xs font-semibold uppercase tracking-wider rounded-lg shadow-xs transition-all"
        >
          <CalendarIcon size={14} /> Open Interactive Calendar
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-550 font-bold">Today's Showings</span>
            <span className="text-3xl font-light block mt-2 text-slate-900">{todayShowings}</span>
          </div>
          <Calendar className="text-[#0B4C8C] shrink-0" size={24} />
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-550 font-bold">Overdue visits</span>
            <span className="text-3xl font-light block mt-2 text-rose-600">{overdueVisits}</span>
          </div>
          <AlertCircle className="text-rose-600 shrink-0" size={24} />
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-[24px] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-slate-550 font-bold">Total No-Shows</span>
            <span className="text-3xl font-light block mt-2 text-amber-600">{noShows}</span>
          </div>
          <ThumbsUp className="text-amber-600 shrink-0" size={24} />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-[24px] border border-slate-200/80 shadow-sm">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search by client or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 p-3 pl-10 rounded-lg text-slate-800 text-sm outline-none transition-all h-10"
          />
          <Search className="absolute left-3 top-3 text-slate-400" size={16} />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-[#0B4C8C] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full md:w-44 bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] hover:border-slate-350 cursor-pointer h-10 appearance-none text-center font-semibold"
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
            <div className="bg-white border border-slate-200/80 p-12 text-center rounded-[24px] shadow-sm">
              <p className="text-sm text-slate-500 font-semibold">No consultations found matching criteria.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/85 font-extrabold">
                    <tr>
                      <th className="p-4 sm:p-6">Client Info</th>
                      <th className="p-4 sm:p-6">Residence</th>
                      <th className="p-4 sm:p-6">Scheduled Slot</th>
                      <th className="p-4 sm:p-6">Status</th>
                      <th className="p-4 sm:p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAppointments.map((app) => (
                      <tr 
                        key={app.id} 
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${selectedAppointment?.id === app.id ? 'bg-slate-50/60' : ''}`}
                        onClick={() => {
                          setSelectedAppointment(app);
                          setShowReschedule(false);
                          setShowCancelForm(false);
                          setShowCompletionForm(false);
                        }}
                      >
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="font-bold block text-slate-900">{app.name}</span>
                            <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">{app.email}</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6 text-slate-800 font-bold">
                          {app.property.name}
                        </td>
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="block text-slate-800 font-bold">{app.date}</span>
                            <span className="text-xs text-slate-500 font-semibold">{app.time} slot</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6">
                          <span className={`inline-block px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold rounded border shadow-3xs ${
                            app.status === 'CONFIRMED' || app.status === 'APPROVED'
                              ? 'border-emerald-250 bg-emerald-50 text-emerald-700'
                              : app.status === 'PENDING'
                              ? 'border-amber-250 bg-amber-50 text-amber-700'
                              : app.status === 'COMPLETED'
                              ? 'border-blue-200 bg-blue-50 text-[#0B4C8C]'
                              : app.status === 'RESCHEDULED'
                              ? 'border-purple-200 bg-purple-50 text-purple-750'
                              : 'border-rose-250 bg-rose-50 text-rose-700'
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
                              className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                              title="Details"
                            >
                              <Eye size={14} />
                            </button>
                            {app.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(app.id, 'CONFIRMED')}
                                  className="p-1.5 border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md shadow-3xs"
                                  title="Approve visit"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedAppointment(app);
                                    setShowCancelForm(true);
                                  }}
                                  className="p-1.5 border border-rose-250 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md shadow-3xs"
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
              className="xl:col-span-5 bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-sm space-y-6 self-start max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-[#0B4C8C] uppercase tracking-wider">Appointment Info</h3>
                <button
                  onClick={() => {
                    setSelectedAppointment(null);
                    setShowReschedule(false);
                    setShowCancelForm(false);
                    setShowCompletionForm(false);
                  }}
                  className="text-slate-400 hover:text-slate-650 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0B4C8C]/10 text-[#0B4C8C] border border-[#0B4C8C]/20 rounded-xl shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Client name</span>
                    <span className="text-sm font-bold text-slate-900 block">{selectedAppointment.name}</span>
                    <span className="text-xs text-slate-500 font-semibold">{selectedAppointment.email} • {selectedAppointment.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="p-2 bg-[#0B4C8C]/10 text-[#0B4C8C] border border-[#0B4C8C]/20 rounded-xl shrink-0">
                    <Building size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property residence</span>
                    <span className="text-sm font-bold text-slate-900 block">{selectedAppointment.property.name}</span>
                    <span className="text-xs text-slate-500 font-semibold">{selectedAppointment.property.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#0B4C8C]" />
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Date</span>
                      <span className="text-xs text-slate-800 font-bold">{selectedAppointment.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#0B4C8C]" />
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Time slot</span>
                      <span className="text-xs text-slate-800 font-bold">{selectedAppointment.time}</span>
                    </div>
                  </div>
                </div>

                {selectedAppointment.outcome && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Showing Outcome</span>
                    <span className="inline-block mt-1 px-2.5 py-0.5 border border-blue-200 text-[#0B4C8C] bg-blue-50 text-[10px] uppercase tracking-wider font-extrabold rounded-md shadow-3xs">
                      {selectedAppointment.outcome.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {selectedAppointment.message && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block flex items-center gap-1">
                      <MessageSquare size={10} />
                      <span>Message</span>
                    </span>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-150 mt-1 leading-relaxed italic">
                      "{selectedAppointment.message}"
                    </p>
                  </div>
                )}

                {selectedAppointment.specialRequests && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-rose-600 block flex items-center gap-1 font-bold">
                      <ShieldAlert size={10} />
                      <span>Special Requests / Notes</span>
                    </span>
                    <p className="text-xs text-rose-700 bg-rose-50 p-3.5 rounded-lg border border-rose-250 mt-1 leading-relaxed font-semibold">
                      {selectedAppointment.specialRequests}
                    </p>
                  </div>
                )}

                {/* Internal Observation Notes Log */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <span className="text-[10px] uppercase tracking-widest text-[#0B4C8C] font-extrabold block">Observation Notes</span>
                  
                  {/* Note input form */}
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add internal observation note..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="flex-grow bg-white border border-slate-200 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 p-2 rounded-lg text-xs text-slate-800 outline-none"
                    />
                    <button type="submit" className="p-2 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white rounded-lg shadow-xs transition-all">
                      <Plus size={14} />
                    </button>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {!selectedAppointment.notes || selectedAppointment.notes.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No notes recorded yet.</p>
                    ) : (
                      selectedAppointment.notes.map((note: any) => (
                        <div key={note.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-205 flex justify-between items-start gap-2">
                          <div>
                            <p className="text-[11px] text-slate-700 leading-normal font-medium">{note.content}</p>
                            <span className="text-[8px] text-slate-450 block mt-1 font-semibold">
                              By {note.createdBy?.name || 'Admin'} • {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5 transition-colors shrink-0"
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
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Status Management</span>
                    <span className="text-xs font-extrabold uppercase text-[#0B4C8C]">{selectedAppointment.status}</span>
                  </div>

                  {!showReschedule && !showCancelForm && !showCompletionForm ? (
                    <div className="flex flex-wrap gap-2">
                      {(selectedAppointment.status === 'PENDING' || selectedAppointment.status === 'CANCELLED') && (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedAppointment.id, 'CONFIRMED')}
                          className="flex-grow min-w-[100px] px-3 py-2 bg-emerald-50 border border-emerald-250 hover:bg-emerald-100 hover:text-emerald-800 text-emerald-700 text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-3xs transition-all"
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
                          className="flex-grow min-w-[100px] px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:text-[#0B4C8C] text-[#0B4C8C] text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-3xs transition-all"
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
                            className="flex-grow min-w-[100px] px-3 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-3xs transition-all"
                          >
                            Reschedule
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={() => {
                              setCancelReason('');
                              setShowCancelForm(true);
                            }}
                            className="flex-grow min-w-[100px] px-3 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 text-rose-700 text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-3xs transition-all"
                          >
                            Cancel visit
                          </button>
                        </>
                      )}
                    </div>
                  ) : showReschedule ? (
                    <form onSubmit={handleResubmitReschedule} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-205">
                        <span className="text-[10px] uppercase tracking-widest text-[#0B4C8C] font-extrabold">Reschedule Options</span>
                        <button type="button" onClick={() => setShowReschedule(false)} className="text-slate-450 hover:text-slate-700 text-xs font-bold">Cancel</button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Select Date</label>
                          <input
                            type="date"
                            required
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Select Time Slot</label>
                          <select
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] appearance-none"
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
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Assign Agent</label>
                          <select
                            value={rescheduleAdminId}
                            onChange={(e) => setRescheduleAdminId(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] appearance-none"
                          >
                            <option value="unassigned">Unassigned</option>
                            {adminsList.map((adm) => (
                              <option key={adm.id} value={adm.id}>{adm.name || adm.email}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Reschedule Reason</label>
                          <textarea
                            required
                            placeholder="Reason for changing schedule..."
                            value={rescheduleReason}
                            onChange={(e) => setRescheduleReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] min-h-[60px]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg shadow-xs transition-all"
                      >
                        Confirm Reschedule
                      </button>
                    </form>
                  ) : showCancelForm ? (
                    <form onSubmit={handleCancelAppointment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-205">
                        <span className="text-[10px] uppercase tracking-widest text-rose-700 font-extrabold">Cancel Showing</span>
                        <button type="button" onClick={() => setShowCancelForm(false)} className="text-slate-450 hover:text-slate-700 text-xs font-bold">Back</button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Reason for Cancellation</label>
                        <textarea
                          required
                          placeholder="Provide audit cancellation explanation..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] min-h-[60px]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg shadow-xs transition-all"
                      >
                        Confirm Cancel visit
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleCompleteAppointment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-205">
                        <span className="text-[10px] uppercase tracking-widest text-[#0B4C8C] font-extrabold">Complete Showing</span>
                        <button type="button" onClick={() => setShowCompletionForm(false)} className="text-slate-450 hover:text-slate-700 text-xs font-bold">Back</button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Visit Outcome</label>
                          <select
                            value={completionOutcome}
                            onChange={(e) => setCompletionOutcome(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] appearance-none"
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
                          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Outcome Notes</label>
                          <textarea
                            placeholder="Add notes about client's interest or deal progress..."
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C] min-h-[60px]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg shadow-xs transition-all"
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
