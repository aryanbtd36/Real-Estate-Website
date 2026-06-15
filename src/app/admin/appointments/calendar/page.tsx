'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Building, X, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminAppointmentsCalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filter states
  const [adminFilter, setAdminFilter] = useState('ALL');
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  
  // Lists for filters
  const [admins, setAdmins] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch appointments and metadata
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Build start/end boundaries based on currentDate and view
      let startDateStr = '';
      let endDateStr = '';
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      if (view === 'month') {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        startDateStr = firstDay.toISOString().split('T')[0];
        endDateStr = lastDay.toISOString().split('T')[0];
      } else if (view === 'week') {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        startDateStr = startOfWeek.toISOString().split('T')[0];
        endDateStr = endOfWeek.toISOString().split('T')[0];
      } else {
        startDateStr = currentDate.toISOString().split('T')[0];
        endDateStr = startDateStr;
      }

      const params = new URLSearchParams({
        view,
        startDate: startDateStr,
        endDate: endDateStr,
      });

      if (adminFilter !== 'ALL') params.append('adminId', adminFilter);
      if (propertyFilter !== 'ALL') params.append('propertyId', propertyFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (outcomeFilter !== 'ALL') params.append('outcome', outcomeFilter);

      const res = await fetch(`/api/admin/appointments/calendar?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);

        // Populate metadata options from the fetched showing list
        const extractedAdminsMap = new Map<string, any>();
        const extractedPropertiesMap = new Map<string, any>();

        (data.appointments || []).forEach((app: any) => {
          if (app.admin) {
            extractedAdminsMap.set(app.admin.id, app.admin);
          }
          if (app.property) {
            extractedPropertiesMap.set(app.property.id, app.property);
          }
        });

        setAdmins(Array.from(extractedAdminsMap.values()));
        setProperties(Array.from(extractedPropertiesMap.values()));
      }
    } catch (err) {
      console.error('Error fetching calendar appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate, view, adminFilter, propertyFilter, statusFilter, outcomeFilter]);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(currentDate.getMonth() - 1);
    } else if (view === 'week') {
      next.setDate(currentDate.getDate() - 7);
    } else {
      next.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(currentDate.getMonth() + 1);
    } else if (view === 'week') {
      next.setDate(currentDate.getDate() + 7);
    } else {
      next.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(next);
  };

  // Overlap conflict checker
  const hasConflict = (appt: any) => {
    const activeStatuses = ['PENDING', 'APPROVED', 'CONFIRMED', 'RESCHEDULED'];
    if (!activeStatuses.includes(appt.status)) return false;

    const apptStart = new Date(appt.startTime).getTime();
    const apptEnd = new Date(appt.endTime).getTime();

    return appointments.some((other) => {
      if (other.id === appt.id) return false;
      if (!activeStatuses.includes(other.status)) return false;

      const otherStart = new Date(other.startTime).getTime();
      const otherEnd = new Date(other.endTime).getTime();

      const overlap = Math.max(apptStart, otherStart) < Math.min(apptEnd, otherEnd);
      if (overlap) {
        // Admin conflict or Listing conflict
        return (appt.adminId && other.adminId === appt.adminId) || (appt.propertyId === other.propertyId);
      }
      return false;
    });
  };

  // Date helper creators
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  const { firstDay, totalDays } = getDaysInMonth(currentDate);
  const monthDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const blankDays = Array.from({ length: firstDay }, (_, i) => i);

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/admin/appointments" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1.5 mb-2">
            <ArrowLeft size={12} /> Back to showing dashboard
          </Link>
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-[#D4AF37]" size={24} />
            <h1 className="text-2xl font-light tracking-tight">Interactive Showings Calendar</h1>
          </div>
          <p className="text-xs text-white/50 mt-1">Visually coordinate and detect overlaps across active showings.</p>
        </div>

        {/* View Toggles */}
        <div className="flex bg-[#161616] p-1 rounded-lg border border-white/5 shrink-0">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wider transition-colors ${
                view === v ? 'bg-[#D4AF37] text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Form */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#161616] p-4 rounded-xl border border-white/5">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">Agent Admin</label>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-xs text-white outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="ALL">All Agents</option>
            <option value="unassigned">Unassigned/System</option>
            {admins.map((adm) => (
              <option key={adm.id} value={adm.id}>{adm.name || adm.email}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">Residence Listing</label>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-xs text-white outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="ALL">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-xs text-white outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="RESCHEDULED">Rescheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">Outcome</label>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 p-2.5 rounded text-xs text-white outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="ALL">All Outcomes</option>
            <option value="INTERESTED">Interested</option>
            <option value="VERY_INTERESTED">Very Interested</option>
            <option value="FOLLOW_UP_REQUIRED">Follow Up Required</option>
            <option value="NEGOTIATION_STARTED">Negotiation Started</option>
            <option value="NOT_INTERESTED">Not Interested</option>
            <option value="NO_SHOW">No Show</option>
            <option value="SALE_COMPLETED">Sale Completed</option>
          </select>
        </div>
      </div>

      {/* Navigation & Current Range */}
      <div className="flex justify-between items-center bg-[#161616] p-4 rounded-xl border border-white/5">
        <button onClick={handlePrev} className="p-2 border border-white/10 hover:border-[#D4AF37]/40 rounded hover:text-[#D4AF37] transition-all">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold tracking-wider uppercase text-white/90">
          {view === 'month' && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          {view === 'week' && `Week of ${new Date(currentDate.getTime() - currentDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString()}`}
          {view === 'day' && currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <button onClick={handleNext} className="p-2 border border-white/10 hover:border-[#D4AF37]/40 rounded hover:text-[#D4AF37] transition-all">
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-widest text-white/40">Loading grid events...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Calendar Views */}
          <div className={`${selectedAppt ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all`}>
            {view === 'month' && (
              <div className="bg-[#161616] border border-white/5 rounded-xl p-4 shadow-xl">
                <div className="grid grid-cols-7 text-center text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] pb-4 border-b border-white/5">
                  <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div className="grid grid-cols-7 gap-2 pt-2">
                  {blankDays.map((b) => (
                    <div key={`blank-${b}`} className="min-h-[100px] bg-[#0A0A0A]/20 border border-transparent rounded-lg" />
                  ))}
                  {monthDays.map((day) => {
                    // Match appointments for this day
                    const dayString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayAppts = appointments.filter((app) => app.date === dayString);

                    return (
                      <div key={`day-${day}`} className="min-h-[100px] bg-[#0A0A0A] border border-white/5 hover:border-[#D4AF37]/20 p-2 rounded-lg flex flex-col justify-between transition-colors">
                        <span className="text-xs text-white/30 font-semibold self-end">{day}</span>
                        <div className="space-y-1.5 mt-2 flex-grow overflow-y-auto max-h-[80px]">
                          {dayAppts.map((appt) => {
                            const conflict = hasConflict(appt);
                            return (
                              <div
                                key={appt.id}
                                onClick={() => setSelectedAppt(appt)}
                                className={`text-[9px] truncate p-1.5 rounded cursor-pointer border font-semibold ${
                                  conflict
                                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                    : appt.status === 'COMPLETED'
                                    ? 'border-blue-500/20 bg-blue-500/5 text-blue-400'
                                    : 'border-[#D4AF37]/20 bg-[#D4AF37]/5 text-white'
                                }`}
                              >
                                {appt.time} - {appt.name}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'week' && (
              <div className="bg-[#161616] border border-white/5 rounded-xl p-6 shadow-xl overflow-x-auto">
                <div className="min-w-[700px] grid grid-cols-7 gap-4">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const wDate = new Date(currentDate);
                    wDate.setDate(currentDate.getDate() - currentDate.getDay() + i);
                    const dayStr = wDate.toISOString().split('T')[0];
                    const dayAppts = appointments.filter((app) => app.date === dayStr);

                    return (
                      <div key={`week-day-${i}`} className="space-y-4">
                        <div className="text-center pb-3 border-b border-white/5">
                          <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold block">
                            {wDate.toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                          <span className="text-xs font-semibold text-white/40 block mt-1">{wDate.getDate()}</span>
                        </div>
                        <div className="space-y-2 min-h-[300px] bg-[#0A0A0A] p-2 rounded-lg border border-white/5">
                          {dayAppts.length === 0 ? (
                            <span className="text-[9px] text-white/20 block text-center mt-12">No slots</span>
                          ) : (
                            dayAppts.map((appt) => {
                              const conflict = hasConflict(appt);
                              return (
                                <div
                                  key={appt.id}
                                  onClick={() => setSelectedAppt(appt)}
                                  className={`p-2 rounded cursor-pointer border space-y-1.5 transition-colors ${
                                    conflict
                                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                      : appt.status === 'COMPLETED'
                                      ? 'border-blue-500/20 bg-blue-500/5 text-blue-400 hover:border-blue-500/40'
                                      : 'border-white/10 bg-[#161616] hover:border-[#D4AF37]/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-white font-semibold">{appt.time}</span>
                                    {conflict && <AlertTriangle size={10} className="text-red-400 shrink-0" />}
                                  </div>
                                  <span className="text-[9px] text-white/70 block truncate font-medium">{appt.name}</span>
                                  <span className="text-[8px] text-white/40 block truncate">{appt.property.name}</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'day' && (
              <div className="bg-[#161616] border border-white/5 rounded-xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-semibold tracking-wider text-[#D4AF37] uppercase">Daily Schedule</h3>
                <div className="space-y-3">
                  {appointments.length === 0 ? (
                    <div className="text-center p-12 text-white/40 text-xs bg-[#0A0A0A] border border-white/5 rounded-lg">
                      No showings scheduled for this date.
                    </div>
                  ) : (
                    appointments.map((appt) => {
                      const conflict = hasConflict(appt);
                      return (
                        <div
                          key={appt.id}
                          onClick={() => setSelectedAppt(appt)}
                          className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 ${
                            conflict
                              ? 'border-red-500/50 bg-red-500/10 hover:border-red-500'
                              : appt.status === 'COMPLETED'
                              ? 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 text-blue-400'
                              : 'border-white/5 bg-[#0A0A0A] hover:border-[#D4AF37]/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <Clock size={16} className="text-[#D4AF37]" />
                            <div>
                              <span className="text-xs font-semibold text-white block">{appt.time} - {appt.name}</span>
                              <span className="text-[10px] text-white/40 block mt-0.5">{appt.property.name} • Assigned: {appt.admin?.name || 'System/Unassigned'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {conflict && (
                              <span className="flex items-center gap-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                <AlertTriangle size={10} /> Overlap Conflict
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                              appt.status === 'COMPLETED' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-[#D4AF37]/30 text-[#D4AF37] bg-[#D4AF37]/5'
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Detail */}
          {selectedAppt && (
            <div className="lg:col-span-4 bg-[#161616] border border-white/5 rounded-xl p-6 shadow-2xl space-y-6 self-start">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <h3 className="text-base font-semibold text-[#D4AF37] uppercase tracking-wider">Inspection details</h3>
                <button onClick={() => setSelectedAppt(null)} className="text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/10 text-[#F5D67B] rounded-lg shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Client</span>
                    <span className="text-sm font-semibold block">{selectedAppt.name}</span>
                    <span className="text-xs text-white/50">{selectedAppt.email} • {selectedAppt.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/10 text-[#F5D67B] rounded-lg shrink-0">
                    <Building size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block">Listing residence</span>
                    <span className="text-sm font-semibold block">{selectedAppt.property.name}</span>
                    <span className="text-xs text-white/50">{selectedAppt.property.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 block">Date</span>
                    <span className="text-xs text-white font-medium">{selectedAppt.date}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 block">Time Slot</span>
                    <span className="text-xs text-white font-medium">{selectedAppt.time}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 block">Status / Outcome</span>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-0.5 border border-[#D4AF37]/30 text-[#D4AF37] bg-[#D4AF37]/5 text-[9px] font-bold rounded uppercase tracking-wider">
                      {selectedAppt.status}
                    </span>
                    {selectedAppt.outcome && (
                      <span className="px-2 py-0.5 border border-blue-500/30 text-blue-400 bg-blue-500/5 text-[9px] font-bold rounded uppercase tracking-wider">
                        {selectedAppt.outcome}
                      </span>
                    )}
                  </div>
                </div>

                {hasConflict(selectedAppt) && (
                  <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-red-400 uppercase tracking-wide text-[10px]">
                      <AlertTriangle size={12} /> Overlap Schedule Conflict
                    </div>
                    <p className="text-[10px] leading-relaxed">
                      Another active showing overlaps with this slot for either the assigned agent or this listing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
