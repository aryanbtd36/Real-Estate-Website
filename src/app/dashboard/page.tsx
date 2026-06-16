'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  LayoutDashboard,
  Heart,
  Calendar,
  User,
  LogOut,
  Home as HomeIcon,
  Trash2,
  Phone,
  Mail,
  Lock,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@/components/turnstile';
import { formatIndianRealEstatePrice } from '@/lib/currency';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'wishlist' | 'appointments' | 'profile'>('overview');
  
  // Dashboard states
  const [stats, setStats] = useState<any>({
    savedCount: 0,
    appointmentsCount: 0,
    upcomingAppointments: [],
    savedProperties: [],
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [compareList, setCompareList] = useState<any[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Turnstile state for verification resend
  const [resendTurnstileToken, setResendTurnstileToken] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);

  // Helper to construct Add to Google Calendar URLs client-side
  const getGoogleCalendarLink = (propertyName: string, location: string, dateStr: string, timeStr: string) => {
    try {
      const cleanTime = timeStr.trim().toUpperCase();
      let hours = 0;
      let minutes = 0;

      if (cleanTime.includes('AM') || cleanTime.includes('PM')) {
        const match = cleanTime.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (match) {
          hours = parseInt(match[1]);
          minutes = parseInt(match[2]);
          const ampm = match[3];
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      } else {
        const parts = cleanTime.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      }

      const startDateTime = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      const formatToGoogleDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const startISO = formatToGoogleDate(startDateTime);
      const endISO = formatToGoogleDate(endDateTime);

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`AURA Property Visit: ${propertyName}`)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(`Luxury property visit scheduled with AURA Real Estate.\nLocation: ${location}\nDate: ${dateStr}\nTime: ${timeStr}`)}&location=${encodeURIComponent(location)}`;
    } catch (err) {
      return 'https://calendar.google.com';
    }
  };

  // Redirect if unauthenticated or if user is ADMIN or SUPER_ADMIN
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user && ((session.user as any).role === 'ADMIN' || (session.user as any).role === 'SUPER_ADMIN')) {
      router.push('/admin');
    }
  }, [status, session, router]);

  // Fetch data
  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/dashboard/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const appRes = await fetch('/api/dashboard/appointments');
      if (appRes.ok) {
        const appData = await appRes.json();
        setAppointments(appData);
      }

      const propRes = await fetch('/api/properties');
      if (propRes.ok) {
        const propData = await propRes.json();
        if (Array.isArray(propData)) {
          setAllProperties(propData);

          // Load recently viewed from client-side localStorage
          const viewedIds = JSON.parse(localStorage.getItem('recently_viewed') || '[]');
          const matching = viewedIds
            .map((id: string) => propData.find((p: any) => p.id === id))
            .filter(Boolean);
          setRecentlyViewed(matching);
        } else {
          setAllProperties([]);
          setRecentlyViewed([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      setProfileForm({
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        phone: (session?.user as any)?.phone || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [status, session]);

  // Remove from wishlist
  const handleRemoveSaved = async (propertyId: string) => {
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Profile Info
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setProfileError('Passwords do not match.');
      return;
    }

    setProfileLoading(true);

    try {
      const res = await fetch('/api/dashboard/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileSuccess('Profile updated successfully! Refreshing session...');
        setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
        // Refresh session
        router.refresh();
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError('Network error. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!resendTurnstileToken) {
      setResendError('Please complete Turnstile bot protection check.');
      return;
    }

    setResendLoading(true);
    setResendSuccess('');
    setResendError('');

    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: resendTurnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendSuccess('A verification email has been dispatched. Please check your inbox.');
        setResendTurnstileToken('');
      } else {
        setResendError(data.error || 'Failed to resend verification email.');
        setTurnstileKey(prev => prev + 1);
        setResendTurnstileToken('');
      }
    } catch (err) {
      setResendError('Network error. Please try again.');
      setTurnstileKey(prev => prev + 1);
      setResendTurnstileToken('');
    } finally {
      setResendLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-[#161616] border-r border-white/5 flex flex-col justify-between p-6">
        <div className="space-y-8">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
            <span className="text-[10px] tracking-[0.4em] uppercase text-white/50 border-l border-white/20 pl-2">ESTATE</span>
          </Link>

          {/* User Welcome */}
          <div className="p-4 bg-[#1E1E1E] rounded-lg border border-white/5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F5D67B] font-semibold">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <span className="text-xs text-white/40 block">Client Account</span>
              <span className="text-sm font-medium text-white truncate max-w-[150px] block">{session?.user?.name}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1">
            {[
              { id: 'overview', name: 'Overview', icon: LayoutDashboard },
              { id: 'wishlist', name: 'Saved Wishlist', icon: Heart },
              { id: 'appointments', name: 'Scheduled Visits', icon: Calendar },
              { id: 'profile', name: 'Profile Settings', icon: User },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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

        {/* Foot links */}
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
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Overview</h1>
                <p className="text-xs text-white/50 mt-1">Summary of your saved properties and scheduler leads.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Wishlisted Properties</span>
                  <span className="text-4xl font-light text-[#D4AF37]">{stats.savedCount}</span>
                </div>
                <div className="bg-[#161616] border border-white/5 p-6 rounded-xl space-y-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block font-semibold">Scheduled Site Visits</span>
                  <span className="text-4xl font-light text-[#D4AF37]">{stats.appointmentsCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Upcoming appointments list */}
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="text-lg font-medium tracking-wide">Upcoming Consultations</h2>
                  {stats.upcomingAppointments.length === 0 ? (
                    <div className="bg-[#161616]/40 border border-white/5 p-8 text-center rounded-xl">
                      <p className="text-sm text-white/40">No upcoming consultations booked.</p>
                      <Link href="/#book" className="text-xs text-[#D4AF37] hover:underline mt-2 inline-block">
                        Book a site visit slot &rarr;
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.upcomingAppointments.map((app: any) => (
                        <div key={app.id} className="bg-[#161616] border border-white/5 p-6 rounded-xl flex items-center justify-between">
                          <div className="space-y-1">
                            <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded font-semibold ${
                              app.status === 'APPROVED' || app.status === 'CONFIRMED'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : app.status === 'PENDING'
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                : 'bg-white/5 border-white/10 text-white/45'
                            }`}>
                              {app.status}
                            </span>
                            <h4 className="text-base font-semibold text-white mt-2">{app.property.name}</h4>
                            <p className="text-xs text-white/50">{app.property.location}</p>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="space-y-0.5">
                              <span className="text-sm font-semibold text-white block">{app.date}</span>
                              <span className="text-xs text-white/40 block">{app.time} slot</span>
                            </div>
                            {(app.status === 'APPROVED' || app.status === 'CONFIRMED' || app.status === 'RESCHEDULED') && (
                              <a
                                href={getGoogleCalendarLink(app.property.name, app.property.location, app.date, app.time)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold hover:underline border border-[#D4AF37]/30 px-2 py-1 bg-[#D4AF37]/5 rounded"
                              >
                                Add to Calendar
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick saved properties snapshot with compare shortcut */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium tracking-wide">Wishlist Highlights</h2>
                    {stats.savedProperties.length > 1 && (
                      <button
                        onClick={() => {
                          setCompareList(stats.savedProperties.slice(0, 3));
                          setIsCompareModalOpen(true);
                        }}
                        className="text-[10px] uppercase tracking-widest text-[#D4AF37] hover:underline"
                      >
                        Compare (Top 3)
                      </button>
                    )}
                  </div>
                  {stats.savedProperties.length === 0 ? (
                    <div className="bg-[#161616]/40 border border-white/5 p-8 text-center rounded-xl">
                      <p className="text-sm text-white/40">Your saved portfolio is empty.</p>
                      <Link href="/#properties" className="text-xs text-[#D4AF37] hover:underline mt-2 inline-block">
                        Explore properties &rarr;
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.savedProperties.map((prop: any) => (
                        <div key={prop.id} className="bg-[#161616] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                          <div className="max-w-[150px] sm:max-w-none">
                            <h4 className="text-sm font-medium text-white truncate">{prop.name}</h4>
                            <span className="text-xs text-[#D4AF37]">{formatIndianRealEstatePrice(prop.price)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (compareList.some(item => item.id === prop.id)) {
                                  setCompareList(prev => prev.filter(item => item.id !== prop.id));
                                } else {
                                  if (compareList.length >= 3) {
                                    alert('Compare limit: 3 properties.');
                                    return;
                                  }
                                  setCompareList(prev => [...prev, prop]);
                                }
                              }}
                              className={`p-1.5 border rounded text-[10px] uppercase tracking-wider ${
                                compareList.some(item => item.id === prop.id)
                                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                                  : 'border-white/10 text-white/60 hover:text-white'
                              }`}
                              title="Compare"
                            >
                              Compare
                            </button>
                            <button
                              onClick={() => handleRemoveSaved(prop.id)}
                              className="p-1.5 border border-white/10 text-white/40 hover:text-red-400 rounded"
                              title="Remove"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Compare properties shortcut action bar */}
              {compareList.length > 0 && (
                <div className="bg-[#1E1E1E] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Ready to compare ({compareList.length})</span>
                    <div className="flex gap-2">
                      {compareList.map((p: any) => (
                        <span key={p.id} className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-white/80" style={{ display: 'inline-block', maxWidth: '80px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.name}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCompareModalOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-[11px] uppercase tracking-wider font-bold rounded hover:opacity-90"
                  >
                    Launch Comparison
                  </button>
                </div>
              )}

              {/* Recently Viewed Properties Section */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <h2 className="text-lg font-medium tracking-wide">Recently Viewed Residences</h2>
                {recentlyViewed.length === 0 ? (
                  <div className="bg-[#161616]/40 border border-white/5 p-8 text-center rounded-xl">
                    <p className="text-sm text-white/40">You haven't viewed any properties recently.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {recentlyViewed.map((prop: any) => (
                      <div key={prop.id} className="bg-[#161616] border border-white/5 p-4 rounded-xl flex flex-col justify-between hover:border-[#D4AF37]/30 transition-all">
                        <div>
                          <h4 className="text-sm font-semibold text-white truncate">{prop.name}</h4>
                          <span className="text-[10px] text-white/50 block mt-0.5">{prop.location}</span>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-2 border-t border-white/5">
                          <span className="text-xs font-bold text-[#D4AF37]">{formatIndianRealEstatePrice(prop.price)}</span>
                          <Link href="/#properties" className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-semibold hover:underline">Details &rarr;</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'wishlist' && (
            <motion.div
              key="wishlist"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Saved Wishlist</h1>
                <p className="text-xs text-white/50 mt-1">Bespoke portfolio items pinned to your account.</p>
              </div>

              {stats.savedProperties.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No properties bookmarked in your wishlist.</p>
                  <Link href="/#properties" className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold text-xs uppercase tracking-widest rounded hover:opacity-95 inline-block">
                    Explore Residences
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {stats.savedProperties.map((property: any) => (
                    <div
                      key={property.id}
                      className="bg-[#161616] border border-white/5 hover:border-[#D4AF37]/30 p-6 rounded-xl flex flex-col justify-between space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-white">{property.name}</h3>
                          <span className="text-xs text-white/50 block mt-1">{property.location}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSaved(property.id)}
                          className="p-2 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded-full"
                          title="Remove bookmark"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5 text-xs text-white/60">
                        <span>{property.bedrooms} Rooms</span>
                        <span>{property.area.toLocaleString()} {property.areaUnit || 'Sq Ft'}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className="text-base font-semibold text-[#D4AF37]">
                          {formatIndianRealEstatePrice(property.price)}
                        </span>
                        <Link
                          href="/#properties"
                          className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
                        >
                          <span>Quick View</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <h1 className="text-3xl font-light tracking-tight">Scheduled Visits</h1>
                <p className="text-xs text-white/50 mt-1">Lead status of your site visits and consultations.</p>
              </div>

              {appointments.length === 0 ? (
                <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                  <p className="text-sm text-white/45">No appointments requested or scheduled yet.</p>
                  <Link href="/#book" className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold text-xs uppercase tracking-widest rounded hover:opacity-95 inline-block">
                    Schedule site visit
                  </Link>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                        <tr>
                          <th className="p-4 sm:p-6">Residence</th>
                          <th className="p-4 sm:p-6">Date</th>
                          <th className="p-4 sm:p-6">Time Slot</th>
                          <th className="p-4 sm:p-6">Status</th>
                          <th className="p-4 sm:p-6">Booking Date</th>
                          <th className="p-4 sm:p-6">Calendar Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {appointments.map((app) => (
                          <tr key={app.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 sm:p-6 font-medium">
                              <div>
                                <span className="block text-white font-medium">{app.property.name}</span>
                                <span className="text-xs text-white/45 block mt-0.5">{app.property.location}</span>
                              </div>
                            </td>
                            <td className="p-4 sm:p-6 text-white/80">{app.date}</td>
                            <td className="p-4 sm:p-6 text-white/80">{app.time}</td>
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
                            <td className="p-4 sm:p-6 text-white/40 text-xs">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-4 sm:p-6">
                              {app.status === 'CONFIRMED' ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <a
                                    href={getGoogleCalendarLink(app.property.name, app.property.location, app.date, app.time)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 bg-[#D4AF37] text-black text-[10px] uppercase tracking-wider font-semibold rounded hover:opacity-90 inline-block text-center whitespace-nowrap"
                                  >
                                    Google Calendar
                                  </a>
                                  <a
                                    href={`/api/appointments/ics?id=${app.id}`}
                                    className="px-2.5 py-1 border border-white/10 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] text-[10px] uppercase tracking-wider font-semibold rounded inline-block text-center transition-colors whitespace-nowrap"
                                  >
                                    Download (.ics)
                                  </a>
                                </div>
                              ) : (
                                <span className="text-xs text-white/30 italic">Available once confirmed</span>
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

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-light tracking-tight">Profile Settings</h1>
                <p className="text-xs text-white/50 mt-1">Manage credentials and contact information.</p>
              </div>

              {!(session?.user as any)?.emailVerified && (
                <div className="bg-[#161616] border border-[#D4AF37]/20 p-6 rounded-xl max-w-xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 bg-gradient-to-b from-[#D4AF37] to-[#F5D67B] h-full" />
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/20 text-[#F5D67B]">
                      <Mail size={20} />
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <h3 className="text-sm font-semibold tracking-wider text-[#F5D67B] uppercase">Email Verification Required</h3>
                        <p className="text-xs text-white/60 mt-1 leading-relaxed">
                          Your email address <span className="text-white font-medium">{session?.user?.email}</span> has not been verified. Please verify your email to ensure account security and access all features.
                        </p>
                      </div>

                      {resendSuccess && (
                        <div className="p-3.5 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded flex items-center gap-2">
                          <CheckCircle size={14} className="shrink-0" />
                          <span>{resendSuccess}</span>
                        </div>
                      )}

                      {resendError && (
                        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                          {resendError}
                        </div>
                      )}

                      {!resendSuccess && (
                        <div className="space-y-3 pt-2">
                          <div className="bg-black/20 p-2 rounded border border-white/5 inline-block">
                            <Turnstile
                              key={turnstileKey}
                              onVerify={setResendTurnstileToken}
                              onError={() => setResendTurnstileToken('')}
                              onExpire={() => setResendTurnstileToken('')}
                            />
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={resendLoading || !resendTurnstileToken}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#D4AF37]/10 to-[#F5D67B]/10 hover:from-[#D4AF37]/20 hover:to-[#F5D67B]/20 border border-[#D4AF37]/30 text-[#F5D67B] text-[10px] uppercase tracking-widest font-semibold rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {resendLoading ? 'Sending link...' : 'Resend Verification Email'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#161616] border border-white/5 p-8 rounded-xl max-w-xl shadow-2xl">
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {profileSuccess && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded flex items-center gap-2">
                      <CheckCircle size={16} />
                      <span>{profileSuccess}</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded">
                      {profileError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block font-semibold">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      />
                      <User className="absolute left-3.5 top-4 text-white/40" size={16} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block font-semibold">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      />
                      <Mail className="absolute left-3.5 top-4 text-white/40" size={16} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block font-semibold">Phone Number</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                      />
                      <Phone className="absolute left-3.5 top-4 text-white/40" size={16} />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-6 space-y-4">
                    <span className="text-xs uppercase tracking-widest text-white/40 block font-semibold">Security Update (Optional)</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40 block">New Password</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={profileForm.password}
                            onChange={(e) => setProfileForm(p => ({ ...p, password: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                            placeholder="Leave blank to keep same"
                          />
                          <Lock className="absolute left-3.5 top-4 text-white/40" size={16} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40 block">Confirm Password</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={profileForm.confirmPassword}
                            onChange={(e) => setProfileForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 pl-10 rounded text-white text-sm outline-none transition-colors"
                            placeholder="Leave blank to keep same"
                          />
                          <Lock className="absolute left-3.5 top-4 text-white/40" size={16} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-widest text-xs rounded hover:opacity-95 shadow-lg"
                  >
                    {profileLoading ? 'Saving changes...' : 'Save Profile Changes'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison Modal */}
        <AnimatePresence>
          {isCompareModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm text-white"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-[#161616] border border-white/10 max-w-4xl w-full rounded-2xl p-6 sm:p-8 relative space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <button
                  onClick={() => setIsCompareModalOpen(false)}
                  className="absolute top-6 right-6 text-white/50 hover:text-white text-xs uppercase tracking-wider"
                >
                  Close Comparison
                </button>

                <div>
                  <span className="text-xs uppercase tracking-widest text-[#D4AF37] block font-semibold mb-1">Residence Comparison</span>
                  <h3 className="text-2xl font-light text-white">Side-by-Side Analysis</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                  {/* Headers column for desktop */}
                  <div className="hidden md:flex flex-col justify-between py-2 text-xs text-white/45 space-y-4 font-semibold uppercase tracking-widest border-r border-white/5 pr-4">
                    <div className="h-10 flex items-center">Feature</div>
                    <div className="border-b border-white/5 pb-2">Price</div>
                    <div className="border-b border-white/5 pb-2">Location</div>
                    <div className="border-b border-white/5 pb-2">Property Type</div>
                    <div className="border-b border-white/5 pb-2">Bedrooms</div>
                    <div className="border-b border-white/5 pb-2">Area (Sq Ft)</div>
                    <div>Availability</div>
                  </div>

                  {/* Compare items */}
                  {compareList.map((p: any) => (
                    <div key={p.id} className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white truncate">{p.name}</h4>
                        <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider">Floor {p.floor}</span>
                      </div>

                      <div className="border-t border-white/5 pt-3 space-y-3 text-xs text-white/70">
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Price:</span>
                          <span className="text-sm font-bold text-[#D4AF37]">${(p.price / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Location:</span>
                          <span>{p.location}</span>
                        </div>
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Type:</span>
                          <span>{p.type}</span>
                        </div>
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Beds:</span>
                          <span>{p.bedrooms} Beds</span>
                        </div>
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Area:</span>
                          <span>{p.area.toLocaleString()} Sq Ft</span>
                        </div>
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Status:</span>
                          <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                            p.availability === 'AVAILABLE' ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]' : 'border-red-500/30 bg-red-500/5 text-red-400'
                          }`}>{p.availability}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Link
                          href="/#book"
                          className="w-full text-center py-2 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-[10px] font-bold uppercase tracking-widest rounded block hover:opacity-90 transition-opacity"
                        >
                          Inquire Visit
                        </Link>
                      </div>
                    </div>
                  ))}

                  {/* Empty cards if fewer than 3 */}
                  {Array.from({ length: 3 - compareList.length }).map((_, idx) => (
                    <div key={idx} className="hidden md:flex border border-dashed border-white/10 rounded-xl flex-col items-center justify-center text-center p-6 text-white/30 text-xs">
                      <Sparkles className="mb-2 text-white/10" size={20} />
                      <span>Select another property to compare</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
