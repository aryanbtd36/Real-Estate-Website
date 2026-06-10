'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building,
  Calendar,
  Users as UsersIcon,
  LogOut,
  Home as HomeIcon,
  Trash2,
  Check,
  X as CloseIcon,
  Plus,
  MapPin,
  BedDouble,
  Maximize2,
  Mail,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stats' | 'properties' | 'appointments' | 'users' | 'leads' | 'slots'>('stats');

  // Stats / Dashboard Info
  const [stats, setStats] = useState<any>({
    totalProperties: 0,
    totalUsers: 0,
    totalAppointments: 0,
    totalVisits: 0,
    pendingAppointments: 0,
    mostViewedProperty: null,
    mostScheduledProperty: null
  });

  // Admin lists
  const [properties, setProperties] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);



  // Add Property Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: '',
    location: '',
    price: '',
    bedrooms: '3',
    area: '',
    floor: '1'
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Add Slot Form State
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('10:00 AM');

  // Reschedule Form State
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00 AM');

  // Redirect if not authenticated or not ADMIN
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session.user as any).role !== 'ADMIN') {
      alert('Forbidden access. Admin only.');
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch admin data
  const fetchAdminData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const propRes = await fetch('/api/properties');
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(Array.isArray(propData) ? propData : []);
      }

      const appRes = await fetch('/api/admin/appointments');
      if (appRes.ok) {
        const appData = await appRes.json();
        setAppointments(appData);
      }

      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      const leadsRes = await fetch('/api/leads');
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData);
      }

      const slotsRes = await fetch('/api/admin/slots');
      if (slotsRes.ok) {
        const slotsData = await slotsRes.json();
        setSlots(slotsData);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && (session.user as any).role === 'ADMIN') {
      fetchAdminData();
    }
  }, [status, session]);

  // Handle Approve/Cancel appointment
  const handleUpdateAppointment = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Property
  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const { name, location, price, bedrooms, area, floor } = newProperty;
    if (!name || !location || !price || !area) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/admin/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProperty),
      });

      if (res.ok) {
        setFormSuccess('Property added successfully!');
        setNewProperty({
          name: '',
          location: '',
          price: '',
          bedrooms: '3',
          area: '',
          floor: '1'
        });
        fetchAdminData();
        setTimeout(() => setShowAddForm(false), 1500);
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to add property.');
      }
    } catch (err) {
      setFormError('Network error. Please try again.');
    }
  };

  // Delete Property
  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      const res = await fetch(`/api/admin/properties?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle contacted status for lead
  const handleUpdateLeadStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };



  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-[#161616] border-r border-white/5 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
            <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">ESTATE</span>
          </Link>

          <div className="p-4 bg-[#1E1E1E] rounded-lg border border-white/5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5D67B] font-semibold">
              A
            </div>
            <div>
              <span className="text-xs text-[#D4AF37] block font-semibold">Administrator</span>
              <span className="text-sm font-medium text-white truncate max-w-[150px] block">{session?.user?.name}</span>
            </div>
          </div>

          <nav className="flex flex-col space-y-1">
            {[
              { id: 'stats', name: 'Dashboard stats', icon: LayoutDashboard },
              { id: 'properties', name: 'Manage residences', icon: Building },
              { id: 'appointments', name: 'Visits manager', icon: Calendar },
              { id: 'users', name: 'Registered clients', icon: UsersIcon },
              { id: 'leads', name: 'Concierge leads', icon: Mail },
              { id: 'slots', name: 'Visits scheduler', icon: Clock },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setShowAddForm(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded text-sm text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#F5D67B]/5 text-[#F5D67B] border-l-2 border-[#D4AF37]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-6 border-t border-white/5">
          <Link
            href="/"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <HomeIcon size={18} />
            <span>Go to Site</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded text-sm text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 sm:p-12 overflow-y-auto max-h-screen">
        <AnimatePresence mode="wait">
          
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Admin Stats</h1>
                <p className="text-xs text-white/50 mt-1">Platform-wide statistics and metrics.</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Total Residences</span>
                  <span className="text-4xl font-light text-[#D4AF37]">{stats.totalProperties}</span>
                </div>
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Registered Clients</span>
                  <span className="text-4xl font-light text-[#D4AF37]">{stats.totalUsers}</span>
                </div>
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Total Visits / Appointments</span>
                  <span className="text-4xl font-light text-[#D4AF37]">{stats.totalAppointments}</span>
                </div>
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Confirmed / Active Visits</span>
                  <span className="text-4xl font-light text-green-400">{stats.totalVisits}</span>
                </div>
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Pending visit requests</span>
                  <span className="text-4xl font-light text-red-400">{stats.pendingAppointments}</span>
                </div>
              </div>

              {/* Analytics Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-4">
                  <span className="text-[#D4AF37] text-[10px] uppercase tracking-widest block font-semibold">Most Viewed Property</span>
                  {stats.mostViewedProperty ? (
                    <div className="space-y-2">
                      <p className="text-xl font-light text-white">{stats.mostViewedProperty.name}</p>
                      <p className="text-xs text-white/50">{stats.mostViewedProperty.location}</p>
                      <div className="pt-2 border-t border-white/5 flex items-baseline gap-2">
                        <span className="text-3xl font-light text-[#D4AF37]">{stats.mostViewedProperty.views}</span>
                        <span className="text-xs text-white/40">page views</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40 italic">No view metrics recorded yet.</p>
                  )}
                </div>

                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-4">
                  <span className="text-[#D4AF37] text-[10px] uppercase tracking-widest block font-semibold">Most Scheduled Property</span>
                  {stats.mostScheduledProperty ? (
                    <div className="space-y-2">
                      <p className="text-xl font-light text-white">{stats.mostScheduledProperty.name}</p>
                      <p className="text-xs text-white/50">Price: ${(stats.mostScheduledProperty.price / 1000000).toFixed(1)}M</p>
                      <div className="pt-2 border-t border-white/5 flex items-baseline gap-2">
                        <span className="text-3xl font-light text-[#D4AF37]">{stats.mostScheduledProperty.count}</span>
                        <span className="text-xs text-white/40">scheduled viewings</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40 italic">No scheduled appointments yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'properties' && (
            <motion.div
              key="properties"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-light tracking-tight">Manage Residences</h1>
                  <p className="text-xs text-white/50 mt-1">Add or remove real estate listings.</p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 bg-[#D4AF37] text-black text-xs uppercase tracking-widest font-semibold rounded hover:opacity-90 flex items-center gap-1.5 transition-opacity"
                >
                  <Plus size={16} />
                  <span>Add Property</span>
                </button>
              </div>

              {/* Add Property Form Panel */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#161616] border border-[#D4AF37]/30 p-6 rounded-xl max-w-2xl overflow-hidden shadow-2xl space-y-6"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <h3 className="text-lg font-medium text-white">New Luxury Residence</h3>
                      <button onClick={() => setShowAddForm(false)} className="text-white/40 hover:text-white">
                        <CloseIcon size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleAddProperty} className="space-y-6">
                      {formError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">{formError}</div>}
                      {formSuccess && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded">{formSuccess}</div>}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Property Name</label>
                          <input
                            type="text"
                            required
                            value={newProperty.name}
                            onChange={(e) => setNewProperty(p => ({ ...p, name: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                            placeholder="The Sky Mansion"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Location</label>
                          <input
                            type="text"
                            required
                            value={newProperty.location}
                            onChange={(e) => setNewProperty(p => ({ ...p, location: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                            placeholder="Beverly Hills, CA"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Market Price ($)</label>
                          <input
                            type="number"
                            required
                            value={newProperty.price}
                            onChange={(e) => setNewProperty(p => ({ ...p, price: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                            placeholder="7500000"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Total Area (Sq Ft)</label>
                          <input
                            type="number"
                            required
                            value={newProperty.area}
                            onChange={(e) => setNewProperty(p => ({ ...p, area: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                            placeholder="4800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Bedrooms</label>
                          <select
                            value={newProperty.bedrooms}
                            onChange={(e) => setNewProperty(p => ({ ...p, bedrooms: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                          >
                            <option value="2">2 Rooms</option>
                            <option value="3">3 Rooms</option>
                            <option value="4">4 Rooms</option>
                            <option value="5">5 Rooms</option>
                            <option value="6">6+ Rooms</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-white/40 block">Floor Number</label>
                          <select
                            value={newProperty.floor}
                            onChange={(e) => setNewProperty(p => ({ ...p, floor: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                          >
                            {Array.from({ length: 8 }).map((_, i) => (
                              <option key={i} value={i + 1}>Floor {i + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider text-xs rounded hover:opacity-95 shadow-lg"
                      >
                        Publish Listing
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Property list table */}
              <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                      <tr>
                        <th className="p-4 sm:p-6">Residence</th>
                        <th className="p-4 sm:p-6">Rooms & Area</th>
                        <th className="p-4 sm:p-6">Floor</th>
                        <th className="p-4 sm:p-6">Price</th>
                        <th className="p-4 sm:p-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {properties.map(property => (
                        <tr key={property.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 sm:p-6">
                            <div>
                              <span className="font-semibold block text-white">{property.name}</span>
                              <span className="text-xs text-white/50 block mt-0.5">{property.location}</span>
                            </div>
                          </td>
                          <td className="p-4 sm:p-6 text-white/80">
                            {property.bedrooms} Beds / {property.area.toLocaleString()} Sq Ft
                          </td>
                          <td className="p-4 sm:p-6 text-white/80">Floor {property.floor}</td>
                          <td className="p-4 sm:p-6 text-[#D4AF37] font-semibold">
                            ${(property.price / 1000000).toFixed(1)}M
                          </td>
                          <td className="p-4 sm:p-6">
                            <button
                              onClick={() => handleDeleteProperty(property.id)}
                              className="p-2 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded-full transition-colors"
                              title="Delete Residence"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'appointments' && (
            <motion.div
              key="appointments"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Visits Manager</h1>
                <p className="text-xs text-white/50 mt-1">Review, approve, or cancel client site consultation bookings.</p>
              </div>

              {appointments.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No appointments requested on the platform yet.</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                        <tr>
                          <th className="p-4 sm:p-6">Client Info</th>
                          <th className="p-4 sm:p-6">Residence</th>
                          <th className="p-4 sm:p-6">Scheduled Slot</th>
                          <th className="p-4 sm:p-6">Status</th>
                          <th className="p-4 sm:p-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {appointments.map(app => (
                          <tr key={app.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 sm:p-6">
                              <div>
                                <span className="font-semibold block text-white">{app.name}</span>
                                <span className="text-xs text-white/50 block mt-0.5">{app.email}</span>
                                <span className="text-[10px] text-white/40 block mt-0.5">{app.phone}</span>
                              </div>
                            </td>
                            <td className="p-4 sm:p-6">
                              <div>
                                <span className="font-medium text-white">{app.property.name}</span>
                                <span className="text-xs text-white/50 block mt-0.5">{app.property.location}</span>
                              </div>
                            </td>
                            <td className="p-4 sm:p-6">
                              <div>
                                <span className="font-semibold block text-white">{app.date}</span>
                                <span className="text-xs text-white/45">{app.time} slot</span>
                              </div>
                            </td>
                            <td className="p-4 sm:p-6">
                              <span className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded border ${
                                app.status === 'CONFIRMED'
                                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                  : app.status === 'PENDING'
                                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                  : 'bg-white/5 border-white/10 text-white/40'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="p-4 sm:p-6">
                              {app.status === 'PENDING' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateAppointment(app.id, 'CONFIRMED')}
                                    className="p-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500 hover:text-black rounded transition-colors"
                                    title="Approve visit"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRescheduleAppointmentId(app.id);
                                      setRescheduleDate(app.date);
                                      setRescheduleTime(app.time);
                                    }}
                                    className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-black rounded transition-colors"
                                    title="Reschedule visit"
                                  >
                                    <Clock size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateAppointment(app.id, 'CANCELLED')}
                                    className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black rounded transition-colors"
                                    title="Reject visit"
                                  >
                                    <CloseIcon size={14} />
                                  </button>
                                </div>
                              )}
                              {app.status === 'CONFIRMED' && (
                                <button
                                  onClick={() => handleUpdateAppointment(app.id, 'CANCELLED')}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white/50 hover:text-red-400 text-xs rounded transition-colors"
                                >
                                  Cancel Visit
                                </button>
                              )}
                              {app.status === 'CANCELLED' && (
                                <span className="text-xs text-white/30 italic">No action</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Registered Clients</h1>
                <p className="text-xs text-white/50 mt-1">Audit log of client user directory.</p>
              </div>

              {users.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No registered clients found on the platform.</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                        <tr>
                          <th className="p-4 sm:p-6">Client Name</th>
                          <th className="p-4 sm:p-6">Email Address</th>
                          <th className="p-4 sm:p-6">Phone Number</th>
                          <th className="p-4 sm:p-6">Registration Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 sm:p-6 font-medium text-white">{u.name || 'Anonymous User'}</td>
                            <td className="p-4 sm:p-6 text-white/80">{u.email}</td>
                            <td className="p-4 sm:p-6 text-white/80">{u.phone || 'Not provided'}</td>
                            <td className="p-4 sm:p-6 text-white/40 text-xs">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'leads' && (
            <motion.div
              key="leads"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Inquiries / Leads</h1>
                <p className="text-xs text-white/50 mt-1">Review contact requests submitted by public visitors.</p>
              </div>

              {leads.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No inquiries received yet.</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                        <tr>
                          <th className="p-4 sm:p-6">Contact Info</th>
                          <th className="p-4 sm:p-6">Message</th>
                          <th className="p-4 sm:p-6">Date</th>
                          <th className="p-4 sm:p-6">Status</th>
                          <th className="p-4 sm:p-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leads.map(lead => (
                          <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 sm:p-6">
                              <div>
                                <span className="font-semibold block text-white">{lead.name}</span>
                                <span className="text-xs text-white/50 block mt-0.5">{lead.email}</span>
                                {lead.phone && <span className="text-[10px] text-white/40 block mt-0.5">{lead.phone}</span>}
                              </div>
                            </td>
                            <td className="p-4 sm:p-6 text-white/80 max-w-xs sm:max-w-sm truncate whitespace-normal">
                              {lead.message}
                            </td>
                            <td className="p-4 sm:p-6 text-white/40 text-xs">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-4 sm:p-6">
                              <span className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded border ${
                                lead.status === 'CONTACTED'
                                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="p-4 sm:p-6">
                              <div className="flex gap-2">
                                {lead.status !== 'CONTACTED' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch('/api/leads', {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ id: lead.id, status: 'CONTACTED' })
                                        });
                                        if (res.ok) fetchAdminData();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-green-500/10 hover:bg-green-500 hover:text-black border border-green-500/20 text-green-400 text-xs rounded transition-colors"
                                    title="Mark as Contacted"
                                  >
                                    Mark Contacted
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!confirm('Are you sure you want to delete this inquiry?')) return;
                                    try {
                                      const res = await fetch(`/api/leads?id=${lead.id}`, {
                                        method: 'DELETE'
                                      });
                                      if (res.ok) fetchAdminData();
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className="p-2 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded transition-colors"
                                  title="Delete Inquiry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'slots' && (
            <motion.div
              key="slots"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-light tracking-tight">Available Slots</h1>
                  <p className="text-xs text-white/50 mt-1">Manage private tour viewing slot schedule parameters.</p>
                </div>
              </div>

              {/* Add Slot Form */}
              <div className="bg-[#161616] border border-white/5 p-6 rounded-xl max-w-xl space-y-4 shadow-xl">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-[#D4AF37]">Create Available Slot</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newSlotDate || !newSlotTime) return;
                  try {
                    const res = await fetch('/api/admin/slots', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ date: newSlotDate, time: newSlotTime }),
                    });
                    if (res.ok) {
                      setNewSlotTime('10:00 AM');
                      fetchAdminData();
                    } else {
                      const err = await res.json();
                      alert(err.error || 'Failed to create slot.');
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Date</label>
                    <input
                      type="date"
                      required
                      value={newSlotDate}
                      onChange={(e) => setNewSlotDate(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Time Slot</label>
                    <input
                      type="text"
                      required
                      value={newSlotTime}
                      onChange={(e) => setNewSlotTime(e.target.value)}
                      placeholder="e.g. 10:00 AM"
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold text-xs uppercase tracking-widest rounded shadow-lg hover:opacity-95 transition-opacity"
                  >
                    Add Slot
                  </button>
                </form>
              </div>

              {/* Slots List */}
              {slots.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No slots configured yet. Dynamic scheduling will fallback to default slots.</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                        <tr>
                          <th className="p-4 sm:p-6">Scheduled Date</th>
                          <th className="p-4 sm:p-6">Time Slot</th>
                          <th className="p-4 sm:p-6">Availability</th>
                          <th className="p-4 sm:p-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {slots.map(slot => (
                          <tr key={slot.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 sm:p-6 text-white font-semibold">{slot.date}</td>
                            <td className="p-4 sm:p-6 text-white/80">{slot.time}</td>
                            <td className="p-4 sm:p-6">
                              <span className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded border ${
                                slot.isBooked
                                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                  : 'bg-green-500/10 border-green-500/30 text-green-400'
                              }`}>
                                {slot.isBooked ? 'Booked' : 'Available'}
                              </span>
                            </td>
                            <td className="p-4 sm:p-6">
                              <button
                                onClick={async () => {
                                  if (!confirm('Are you sure you want to delete this slot?')) return;
                                  try {
                                    const res = await fetch(`/api/admin/slots?id=${slot.id}`, {
                                      method: 'DELETE'
                                    });
                                    if (res.ok) fetchAdminData();
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="p-2 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded transition-colors"
                                title="Delete Slot"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reschedule Modal */}
        <AnimatePresence>
          {rescheduleAppointmentId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#161616] border border-[#D4AF37]/30 p-6 rounded-xl w-full max-w-md shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <h3 className="text-lg font-medium text-[#D4AF37]">Reschedule Property Visit</h3>
                  <button
                    onClick={() => setRescheduleAppointmentId(null)}
                    className="text-white/40 hover:text-white"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">New Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">New Time Slot</label>
                    <input
                      type="text"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      placeholder="e.g., 10:00 AM"
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded text-white text-sm outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setRescheduleAppointmentId(null)}
                    className="flex-1 py-2.5 border border-white/10 text-white/80 hover:text-white text-xs uppercase tracking-widest rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/appointments', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            id: rescheduleAppointmentId,
                            status: 'RESCHEDULED',
                            date: rescheduleDate,
                            time: rescheduleTime
                          })
                        });
                        if (res.ok) {
                          setRescheduleAppointmentId(null);
                          fetchAdminData();
                        } else {
                          const err = await res.json();
                          alert(err.error || 'Failed to reschedule');
                        }
                      } catch (err) {
                        console.error(err);
                        alert('Network error');
                      }
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold text-xs uppercase tracking-widest rounded shadow-lg hover:opacity-95"
                  >
                    Confirm Change
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
