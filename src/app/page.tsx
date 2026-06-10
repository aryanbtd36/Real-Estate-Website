'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import { ShowcaseCanvas } from '@/components/building3d';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  BedDouble,
  Maximize2,
  MapPin,
  Heart,
  Calendar,
  Phone,
  Mail,
  Clock,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  Eye,
  ArrowUpRight,
  Shield,
  Award,
  Users,
  Compass,
  Search
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  bedrooms: number;
  area: number;
  floor: number;
  availability: string;
  images: string;
  floorPlan: string | null;
  type: string;
  views: number;
}

export default function Home() {
  const { data: session } = useSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Floor Selection
  const [activeFloor, setActiveFloor] = useState(4);
  const [selectedApartment, setSelectedApartment] = useState<any>(null);

  // Quick View Modal
  const [quickViewProperty, setQuickViewProperty] = useState<Property | null>(null);

  // Testimonials Carousel
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Search state
  const [searchLocation, setSearchLocation] = useState('');
  const [searchType, setSearchType] = useState('');
  const [searchBudget, setSearchBudget] = useState('');

  // Advanced Filters state
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [filterBedrooms, setFilterBedrooms] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');

  // Comparison State
  const [compareList, setCompareList] = useState<Property[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Dynamic available slots state
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Contact Inquiry Form State
  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);

  // Appointment Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyId: '',
    date: '',
    time: '',
    message: '',
    specialRequests: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // Search submission scrolls to property grid and applies filters
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilterLocation(searchLocation);
    setFilterType(searchType);
    setFilterBudget(searchBudget);

    const el = document.getElementById('properties');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Toggle Property Comparison list
  const toggleCompare = (property: Property) => {
    if (compareList.some(p => p.id === property.id)) {
      setCompareList(prev => prev.filter(p => p.id !== property.id));
    } else {
      if (compareList.length >= 3) {
        alert('You can compare a maximum of 3 properties.');
        return;
      }
      setCompareList(prev => [...prev, property]);
    }
  };

  // Increment views dynamically when quick-view is opened
  const handleQuickView = async (property: Property) => {
    setQuickViewProperty(property);
    try {
      fetch(`/api/properties?id=${property.id}&increment=true`);
    } catch (err) {
      console.error('Failed to increment views:', err);
    }
    // Save to client-side localStorage recently viewed properties
    try {
      const viewedStr = localStorage.getItem('recently_viewed');
      let viewedIds = viewedStr ? JSON.parse(viewedStr) : [];
      if (!Array.isArray(viewedIds)) viewedIds = [];
      viewedIds = viewedIds.filter((id: string) => id !== property.id);
      viewedIds.unshift(property.id);
      localStorage.setItem('recently_viewed', JSON.stringify(viewedIds.slice(0, 5)));
      
      // Dispatch storage event to update dashboard if open in another tab
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to save recently viewed:', err);
    }
  };

  // Load available slots dynamically on date change
  useEffect(() => {
    if (!formData.date) {
      setAvailableSlots([]);
      return;
    }
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/admin/slots?date=${formData.date}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out booked slots
          const unbooked = data.filter((s: any) => !s.isBooked);
          setAvailableSlots(unbooked);
        }
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [formData.date]);

  // Handle inquiry form submit
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    setLeadSubmitted(false);
    setLeadLoading(true);

    if (!leadData.name || !leadData.email || !leadData.message) {
      setLeadError('Please fill out all required fields.');
      setLeadLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      if (res.ok) {
        setLeadSubmitted(true);
        setLeadData({ name: '', email: '', phone: '', message: '' });
      } else {
        const errData = await res.json();
        setLeadError(errData.error || 'Failed to submit inquiry.');
      }
    } catch (err) {
      setLeadError('Network error. Please try again.');
    } finally {
      setLeadLoading(false);
    }
  };

  // Mock Testimonials
  const testimonials = [
    {
      name: 'Alexander Vane',
      role: 'Investment Banker',
      text: 'Aura redefined my expectations of luxury living. The design, structural details, and high-fidelity finish are truly world-class.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    {
      name: 'Elena Rostova',
      role: 'Creative Director',
      text: 'The 3D interactive showcase made choosing our penthouse an effortless, visual experience. Highly professional service.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
    },
    {
      name: 'Marcus Sterling',
      role: 'Tech Entrepreneur',
      text: 'From the amenities to the custom design tokens, everything feels premium and custom-tailored for sophisticated tastes.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
    }
  ];

  // Amenities list
  const amenitiesList = [
    { name: 'Infinity Pool', desc: 'Overlooking the cinematic skyline', icon: Sparkles },
    { name: 'Fitness Club', desc: 'State of the art wellness equipment', icon: Award },
    { name: 'Concierge Service', desc: '24/7 personalized assistance', icon: Shield },
    { name: 'Sky Lounge', desc: 'Exclusive rooftop lounge for gatherings', icon: Sparkles },
    { name: 'Spa & Wellness', desc: 'Thermal baths and sauna services', icon: Users },
    { name: 'Smart Security', desc: 'Advanced biometrics & secure entry', icon: Shield },
    { name: 'Private Gardens', desc: 'Lush landscaped walking spaces', icon: Compass },
    { name: 'Helipad Access', desc: 'Priority sky transport links', icon: ArrowUpRight }
  ];
  // Fetch properties and wishlist on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/properties');
        const data = await res.json();
        if (Array.isArray(data)) {
          setProperties(data);
          // Pre-fill first property in reservation form
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, propertyId: data[0].id }));
          }
        } else {
          setProperties([]);
        }

        if (session) {
          const savedRes = await fetch('/api/saved');
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            setSavedIds(savedData);
          }
        }
      } catch (err) {
        console.error('Error fetching landing data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session]);

  // Update selected apartment details when floor changes
  useEffect(() => {
    const floorProperties = Array.isArray(properties) ? properties.filter(p => p.floor === activeFloor) : [];
    if (floorProperties.length > 0) {
      setSelectedApartment(floorProperties[0]);
    } else {
      // Create a mock penthouse/apartment details if none found in seeded properties for that floor
      setSelectedApartment({
        name: `Penthouse Suite ${activeFloor}01`,
        location: 'Aura Tower, Manhattan',
        price: 4500000 + activeFloor * 1200000,
        bedrooms: activeFloor > 6 ? 4 : 3,
        area: 2800 + activeFloor * 400,
        floor: activeFloor,
        availability: activeFloor === 5 ? 'SOLD' : 'AVAILABLE'
      });
    }
  }, [activeFloor, properties]);

  // Wishlist toggle
  const toggleSave = async (propertyId: string) => {
    if (!session) {
      alert('Please log in to save properties to your wishlist.');
      window.location.href = '/login';
      return;
    }

    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId })
      });
      const data = await res.json();
      if (data.saved) {
        setSavedIds(prev => [...prev, propertyId]);
      } else {
        setSavedIds(prev => prev.filter(id => id !== propertyId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Form Submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitted(false);

    const { name, email, phone, propertyId, date, time } = formData;
    if (!name || !email || !phone || !propertyId || !date || !time) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormSubmitted(true);
        setFormData(prev => ({
          ...prev,
          name: '',
          email: '',
          phone: '',
          message: ''
        }));
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to submit appointment request.');
      }
    } catch (err) {
      setFormError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section id="home" className="relative w-full min-h-screen flex items-center pt-24 md:pt-0 overflow-hidden">
        {/* Background Image Container with Ken Burns effect */}
        <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
          <motion.div
            initial={{ scale: 1.12 }}
            animate={{ scale: 1.02 }}
            transition={{ duration: 20, ease: 'easeOut', repeat: Infinity, repeatType: 'reverse' }}
            className="w-full h-full bg-[url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&auto=format&fit=crop&q=80')] bg-cover bg-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-[#0A0A0A]/40" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 py-12">
          
          {/* Left Column Text */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#D4AF37]/30 bg-black/60 backdrop-blur-md rounded text-xs tracking-[0.2em] uppercase text-[#F5D67B] font-semibold">
                <Sparkles size={12} className="text-[#D4AF37]" />
                <span>The Pinnacle of Architecture</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-light tracking-tight leading-tight text-white">
                Find Your <br />
                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] drop-shadow-md">
                  Dream Property
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/70 font-light max-w-xl">
                Luxury Living. Exceptional Investment. Discover bespoke apartments and luxury estates designed by architectural pioneers.
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <a
                href="#properties"
                className="px-8 py-4 bg-gradient-to-r from-[#D4AF37] via-[#aa7c11] to-[#D4AF37] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] text-black text-xs uppercase tracking-widest font-bold rounded shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Explore Properties
              </a>
              <a
                href="#book"
                className="px-8 py-4 bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 text-xs uppercase tracking-widest font-bold rounded transition-all duration-300 backdrop-blur-sm"
              >
                Book Appointment
              </a>
            </motion.div>

            {/* Floating Glassmorphic Property Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="w-full bg-black/45 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
            >
              <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold">Location</label>
                  <select
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-[#D4AF37] p-3 rounded text-white text-xs outline-none transition-colors"
                  >
                    <option value="" className="bg-[#161616]">All Locations</option>
                    <option value="Manhattan, NY" className="bg-[#161616]">Manhattan, NY</option>
                    <option value="Malibu, CA" className="bg-[#161616]">Malibu, CA</option>
                    <option value="Miami, FL" className="bg-[#161616]">Miami, FL</option>
                    <option value="London, UK" className="bg-[#161616]">London, UK</option>
                    <option value="Saint-Tropez, France" className="bg-[#161616]">Saint-Tropez, France</option>
                    <option value="Kyoto, Japan" className="bg-[#161616]">Kyoto, Japan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold">Property Type</label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-[#D4AF37] p-3 rounded text-white text-xs outline-none transition-colors"
                  >
                    <option value="" className="bg-[#161616]">All Types</option>
                    <option value="Apartment" className="bg-[#161616]">Apartment</option>
                    <option value="Villa" className="bg-[#161616]">Villa</option>
                    <option value="Penthouse" className="bg-[#161616]">Penthouse</option>
                    <option value="Duplex" className="bg-[#161616]">Duplex</option>
                    <option value="Lot" className="bg-[#161616]">Lot</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold">Budget Limit</label>
                  <select
                    value={searchBudget}
                    onChange={(e) => setSearchBudget(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-[#D4AF37] p-3 rounded text-white text-xs outline-none transition-colors"
                  >
                    <option value="" className="bg-[#161616]">No Limit</option>
                    <option value="10000000" className="bg-[#161616]">Under $10M</option>
                    <option value="15000000" className="bg-[#161616]">Under $15M</option>
                    <option value="20000000" className="bg-[#161616]">Under $20M</option>
                    <option value="30000000" className="bg-[#161616]">Under $30M</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#D4AF37] via-[#aa7c11] to-[#F5D67B] text-black hover:opacity-95 p-3 rounded text-xs uppercase tracking-widest font-bold transition-all shadow-md flex items-center justify-center gap-2 h-[42px]"
                >
                  <Search size={14} />
                  <span>Search</span>
                </button>
              </form>
            </motion.div>
          </div>

          {/* Right Column - Premium floating estate card */}
          <div className="lg:col-span-5 w-full flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative p-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm group"
            >
              <div className="absolute inset-0 bg-[#D4AF37]/5 filter blur-3xl pointer-events-none rounded-full" />
              <div className="relative h-56 overflow-hidden rounded-lg mb-5">
                <img
                  src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80"
                  alt="Penthouse AURA"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 rounded text-[9px] uppercase tracking-wider text-[#F5D67B] font-bold font-sans">
                  Curated Peak
                </div>
              </div>
              <h3 className="text-xl font-light text-white mb-1">The Aurelia Penthouse</h3>
              <p className="text-xs text-white/50 mb-4 flex items-center gap-1">
                <MapPin size={12} className="text-[#D4AF37]" /> Manhattan, NY
              </p>
              
              {/* Statistics Glass Cards inside right column */}
              <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 mt-2">
                <div className="p-2 bg-white/[0.02] border border-white/5 rounded text-center">
                  <p className="text-sm font-semibold text-[#D4AF37]">24</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/45 mt-0.5">Projects</p>
                </div>
                <div className="p-2 bg-white/[0.02] border border-white/5 rounded text-center">
                  <p className="text-sm font-semibold text-[#D4AF37]">1.8K+</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/45 mt-0.5">Clients</p>
                </div>
                <div className="p-2 bg-white/[0.02] border border-white/5 rounded text-center">
                  <p className="text-sm font-semibold text-[#D4AF37]">12+</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/45 mt-0.5">Years</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2 – Featured Properties */}
      <section id="properties" className="py-32 border-t border-white/5 bg-[#161616]/30 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 space-y-4 md:space-y-0">
            <div>
              <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Curated Portfolio</p>
              <h2 className="text-3xl sm:text-5xl font-light tracking-tight">Featured Residences</h2>
            </div>
            <p className="text-white/55 font-light max-w-md text-sm">
              Discover unique architect-designed spaces carefully cataloged for their refined taste, cinematic vantage points, and investment credentials.
            </p>
          </div>

          {/* Advanced Dynamic Filters Panel */}
          <div className="mb-12 p-6 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/45 block">Location</label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none"
                >
                  <option value="">All Locations</option>
                  <option value="Manhattan, NY">Manhattan, NY</option>
                  <option value="Malibu, CA">Malibu, CA</option>
                  <option value="Miami, FL">Miami, FL</option>
                  <option value="London, UK">London, UK</option>
                  <option value="Saint-Tropez, France">Saint-Tropez, France</option>
                  <option value="Kyoto, Japan">Kyoto, Japan</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/45 block">Property Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none"
                >
                  <option value="">All Types</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Villa">Villa</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Duplex">Duplex</option>
                  <option value="Lot">Lot</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/45 block">Max Budget</label>
                <select
                  value={filterBudget}
                  onChange={(e) => setFilterBudget(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none"
                >
                  <option value="">No Limit</option>
                  <option value="10000000">Under $10M</option>
                  <option value="15000000">Under $15M</option>
                  <option value="20000000">Under $20M</option>
                  <option value="30000000">Under $30M</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/45 block">Bedrooms</label>
                <select
                  value={filterBedrooms}
                  onChange={(e) => setFilterBedrooms(e.target.value)}
                  className="w-full bg-[#161616] border border-white/10 p-2.5 rounded text-white text-xs outline-none"
                >
                  <option value="">Any Beds</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4 Bedrooms</option>
                  <option value="5">5+ Bedrooms</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <button
                  onClick={() => {
                    setFilterLocation('');
                    setFilterType('');
                    setFilterBudget('');
                    setFilterBedrooms('');
                    setFilterAvailability('');
                    setSearchLocation('');
                    setSearchType('');
                    setSearchBudget('');
                  }}
                  className="w-full py-2.5 border border-white/10 hover:border-[#D4AF37] hover:text-[#D4AF37] rounded text-white text-xs tracking-wider uppercase font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[450px] bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(Array.isArray(properties) ? properties : []).filter(property => {
                if (filterLocation && property.location !== filterLocation) return false;
                if (filterType && property.type !== filterType) return false;
                if (filterBudget && property.price > parseInt(filterBudget)) return false;
                if (filterBedrooms && property.bedrooms < parseInt(filterBedrooms)) return false;
                if (filterAvailability && property.availability !== filterAvailability) return false;
                return true;
              }).map((property, idx) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                  className="group bg-[#1E1E1E] border border-white/5 hover:border-[#D4AF37]/30 rounded-lg overflow-hidden transition-all duration-500 shadow-xl hover:-translate-y-2"
                >
                  {/* Property Image Placeholder */}
                  <div className="relative h-64 bg-gradient-to-br from-[#1E1E1E] to-[#0A0A0A] overflow-hidden flex items-center justify-center">
                    {/* Simulated luxury image background */}
                    <div className="absolute inset-0 bg-[#0A0A0A] bg-opacity-40 group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                    
                    {/* Visual indicators */}
                    <div className="absolute top-4 left-4 z-20 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] uppercase tracking-wider text-white">
                      Floor {property.floor}
                    </div>

                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      <button
                        onClick={() => toggleCompare(property)}
                        className={`p-2 rounded-full border transition-all duration-300 ${
                          compareList.some(p => p.id === property.id)
                            ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-md'
                            : 'bg-black/60 border-white/10 text-white/70 hover:text-[#D4AF37]'
                        }`}
                        title="Compare Property"
                      >
                        <Sparkles size={16} fill={compareList.some(p => p.id === property.id) ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => toggleSave(property.id)}
                        className={`p-2 rounded-full border transition-colors ${
                          savedIds.includes(property.id)
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                            : 'bg-black/60 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        <Heart size={16} fill={savedIds.includes(property.id) ? '#D4AF37' : 'none'} />
                      </button>
                    </div>

                    {/* SVG architectural building design placeholder if no real image */}
                    <svg className="w-24 h-24 text-white/10 group-hover:text-[#D4AF37]/20 transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <line x1="9" y1="6" x2="15" y2="6" />
                      <line x1="9" y1="10" x2="15" y2="10" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                      <line x1="9" y1="18" x2="15" y2="18" />
                    </svg>

                    {/* Quick view button */}
                    <button
                      onClick={() => handleQuickView(property)}
                      className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-[#D4AF37] hover:text-black text-xs font-semibold rounded shadow transition-colors duration-300 opacity-0 group-hover:opacity-100 translation-all duration-300"
                    >
                      <Eye size={12} />
                      <span>Quick View</span>
                    </button>
                  </div>

                  {/* Property Details */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-light tracking-wide group-hover:text-[#F5D67B] transition-colors">
                        {property.name}
                      </h3>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded font-semibold ${
                        property.availability === 'AVAILABLE'
                          ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F5D67B]'
                          : property.availability === 'RESERVED'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-400'
                      }`}>
                        {property.availability}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-white/50 gap-1">
                      <MapPin size={12} />
                      <span>{property.location}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5 text-xs text-white/70">
                      <div className="flex items-center gap-1.5">
                        <BedDouble size={14} className="text-[#D4AF37]" />
                        <span>{property.bedrooms} Bedrooms</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Maximize2 size={14} className="text-[#D4AF37]" />
                        <span>{property.area.toLocaleString()} Sq Ft</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-white/40 block">Market Price</span>
                        <span className="text-xl font-semibold text-[#D4AF37]">
                          ${(property.price / 1000000).toFixed(1)}M
                        </span>
                      </div>

                      <a
                        href="#book"
                        onClick={() => setFormData(prev => ({ ...prev, propertyId: property.id }))}
                        className="p-2 border border-white/10 rounded group-hover:bg-[#D4AF37] group-hover:text-black transition-all duration-300"
                        title="Book visit appointment"
                      >
                        <Calendar size={16} />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 3 – Interactive Property Showcase */}
      <section id="showcase" className="py-32 bg-[#0A0A0A] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 text-center">
            <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Interactive Experience</p>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight">3D Tower Floor Selection</h2>
            <p className="text-white/50 max-w-xl mx-auto mt-4 font-light text-sm">
              Use our interactive 3D model. Rotate the skyscraper and click on any floor to view individual luxury apartment layouts, sizes, and pricing configurations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left 3D Canvas */}
            <div className="lg:col-span-6 h-[500px] w-full bg-[#161616]/40 rounded-xl border border-white/5 flex items-center justify-center shadow-xl relative overflow-hidden">
              <ShowcaseCanvas activeFloor={activeFloor} onSelectFloor={setActiveFloor} />
            </div>

            {/* Right Floor details panel */}
            <div className="lg:col-span-6 space-y-6">
              <AnimatePresence mode="wait">
                {selectedApartment && (
                  <motion.div
                    key={activeFloor}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4 }}
                    className="bg-[#161616] border border-white/5 p-8 rounded-xl space-y-6 shadow-2xl relative"
                  >
                    <div className="absolute top-6 right-6 border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-3 py-1 rounded text-xs text-[#D4AF37]">
                      Floor {activeFloor} of 8
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-widest text-[#D4AF37] block mb-2 font-semibold">Selected Floor Suite</span>
                      <h3 className="text-3xl font-light tracking-wide">{selectedApartment.name}</h3>
                      <p className="text-xs text-white/40 mt-1">{selectedApartment.location}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 py-6 border-y border-white/5">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-white/40 block">Price</span>
                        <span className="text-lg font-semibold text-[#D4AF37] mt-1 block">
                          ${(selectedApartment.price / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-white/40 block">Beds</span>
                        <span className="text-lg text-white font-semibold mt-1 block">
                          {selectedApartment.bedrooms} Rooms
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-white/40 block">Total Area</span>
                        <span className="text-lg text-white font-semibold mt-1 block">
                          {selectedApartment.area.toLocaleString()} Sq Ft
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs uppercase tracking-widest text-white/40 block font-semibold">Apartment Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${selectedApartment.availability === 'AVAILABLE' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                        <span className="text-sm font-medium">{selectedApartment.availability}</span>
                      </div>
                    </div>

                    {/* Floor Plan Render Placeholder */}
                    <div className="h-44 bg-[#0A0A0A] border border-white/5 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group">
                      <span className="text-xs text-white/40 tracking-wider">Interactive Floorplan Blueprint</span>
                      {/* Architectural blueprint lines grid */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none" />
                      
                      <svg className="w-24 h-24 text-[#D4AF37]/10 mt-2" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
                        <rect x="10" y="10" width="80" height="80" />
                        <line x1="50" y1="10" x2="50" y2="90" />
                        <line x1="10" y1="50" x2="90" y2="50" />
                        <rect x="20" y="20" width="20" height="20" />
                        <rect x="60" y="60" width="20" height="20" />
                      </svg>
                    </div>

                    <a
                      href="#book"
                      onClick={() => {
                        if (selectedApartment.id) {
                          setFormData(prev => ({ ...prev, propertyId: selectedApartment.id }));
                        }
                      }}
                      className="w-full text-center py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-wider rounded block hover:opacity-95 shadow-lg"
                    >
                      Inquire About This Floor
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 – Amenities */}
      <section id="amenities" className="py-32 bg-[#161616]/30 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Exclusive Privilege</p>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight">Luxury Amenities</h2>
            <p className="text-white/50 mt-4 font-light text-sm">
              Indulge in amenities designed to elevate your standard of wellness, privacy, and aesthetic comfort.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {amenitiesList.map((amenity, index) => {
              const Icon = amenity.icon;
              return (
                <motion.div
                  key={amenity.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="bg-[#1E1E1E]/50 border border-white/5 hover:border-[#D4AF37]/25 p-6 rounded-lg space-y-4 hover:bg-[#1E1E1E] transition-all duration-300"
                >
                  <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/10 w-fit rounded-lg text-[#F5D67B]">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{amenity.name}</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-light">{amenity.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 5 – About Company */}
      <section id="about" className="py-32 bg-[#0A0A0A] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Left storytelling col */}
          <div className="lg:col-span-6 space-y-8">
            <div>
              <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Corporate Story</p>
              <h2 className="text-3xl sm:text-5xl font-light tracking-tight">Crafting Iconic Skylines</h2>
            </div>
            <p className="text-white/60 font-light leading-relaxed text-sm">
              Founded on the pillars of bespoke craftsmanship, uncompromising structural integrity, and modern luxury design principles, AURA has delivered architectural landmarks across metropolitan centers. We design spaces that transcend the ordinary, curating residential and commercial portfolios for high-net-worth individuals globally.
            </p>

            {/* Timeline */}
            <div className="space-y-6 relative border-l border-white/10 pl-6 ml-3">
              {[
                { year: '2015', title: 'Platform Launch', desc: 'Introduced next-generation high-end boutique property consultancy.' },
                { year: '2019', title: 'Expansion to London & Tokyo', desc: 'Integrated bespoke international assets into our portfolio.' },
                { year: '2023', title: '3D Virtual Interactive Launch', desc: 'Introduced full real-time structural interactive floor layout designs.' }
              ].map((milestone) => (
                <div key={milestone.year} className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-[#D4AF37] border-4 border-[#0A0A0A]" />
                  <span className="text-xs font-semibold text-[#D4AF37] block">{milestone.year}</span>
                  <h4 className="text-sm font-medium text-white mt-1">{milestone.title}</h4>
                  <p className="text-xs text-white/40 mt-1">{milestone.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right graphics/stat blocks col */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-6 relative">
            <div className="absolute inset-0 bg-[#D4AF37]/5 filter blur-3xl pointer-events-none rounded-full" />
            
            <div className="p-8 bg-[#161616] border border-white/5 rounded-xl space-y-3">
              <span className="text-[#D4AF37] text-3xl font-light">42+</span>
              <h4 className="text-sm font-medium text-white">Awards Won</h4>
              <p className="text-xs text-white/40 leading-relaxed font-light">Accolades for design novelty and green architecture.</p>
            </div>
            <div className="p-8 bg-[#161616] border border-white/5 rounded-xl space-y-3 mt-8">
              <span className="text-[#D4AF37] text-3xl font-light">250K+</span>
              <h4 className="text-sm font-medium text-white">Sq Ft Delivered</h4>
              <p className="text-xs text-white/40 leading-relaxed font-light">Completed residences built to premier criteria.</p>
            </div>
            <div className="p-8 bg-[#161616] border border-white/5 rounded-xl space-y-3">
              <span className="text-[#D4AF37] text-3xl font-light">100%</span>
              <h4 className="text-sm font-medium text-white">Bespoke Design</h4>
              <p className="text-xs text-white/40 leading-relaxed font-light">Each property represents a unique architectural vision.</p>
            </div>
            <div className="p-8 bg-[#161616] border border-white/5 rounded-xl space-y-3 mt-8">
              <span className="text-[#D4AF37] text-3xl font-light">99.8%</span>
              <h4 className="text-sm font-medium text-white">Client Trust</h4>
              <p className="text-xs text-white/40 leading-relaxed font-light">Unwavering customer rating in property handling.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 – Testimonials */}
      <section id="testimonials" className="py-32 bg-[#161616]/30 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Vouched by Leaders</p>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight">Client Testimonials</h2>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Main Testimonial Card */}
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="bg-[#1E1E1E]/80 backdrop-blur-md border border-white/5 p-8 sm:p-12 rounded-xl text-center space-y-6 shadow-2xl"
            >
              {/* Star Rating */}
              <div className="flex items-center justify-center gap-1 text-[#F5D67B]">
                {Array.from({ length: testimonials[currentTestimonial].rating }).map((_, idx) => (
                  <Star key={idx} size={16} fill="#F5D67B" />
                ))}
              </div>

              {/* Review Text */}
              <p className="text-lg sm:text-2xl font-light text-white/95 italic leading-relaxed">
                "{testimonials[currentTestimonial].text}"
              </p>

              {/* Reviewer Details */}
              <div className="flex flex-col items-center space-y-2">
                <img
                  src={testimonials[currentTestimonial].image}
                  alt={testimonials[currentTestimonial].name}
                  className="w-14 h-14 rounded-full object-cover border border-[#D4AF37]/50 p-0.5"
                />
                <h4 className="font-semibold text-white tracking-wide">{testimonials[currentTestimonial].name}</h4>
                <span className="text-xs text-[#D4AF37] uppercase tracking-wider">{testimonials[currentTestimonial].role}</span>
              </div>
            </motion.div>

            {/* Testimonials Navigation buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() =>
                  setCurrentTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1))
                }
                className="p-3 border border-white/10 hover:border-[#D4AF37] text-white rounded-full bg-black/40 hover:bg-black transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() =>
                  setCurrentTestimonial((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1))
                }
                className="p-3 border border-white/10 hover:border-[#D4AF37] text-white rounded-full bg-black/40 hover:bg-black transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 – Book Appointment */}
      <section id="book" className="py-32 bg-[#0A0A0A] border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(212,175,55,0.06),transparent_50%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Direct Scheduling</p>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight">Book a Site Visit</h2>
            <p className="text-white/50 mt-4 font-light text-sm">
              Schedule an exclusive consultation and virtual property viewing with an Aura Client Director.
            </p>
          </div>

          <div className="bg-[#161616] border border-white/5 p-8 rounded-xl shadow-2xl relative">
            <AnimatePresence mode="wait">
              {formSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="py-12 flex flex-col items-center text-center space-y-4"
                >
                  <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full">
                    <CheckCircle size={48} />
                  </div>
                  <h3 className="text-2xl font-light">Appointment Requested</h3>
                  <p className="text-sm text-white/50 max-w-sm">
                    Thank you. An Aura consultant will verify your slot availability and email a formal confirmation within 24 hours.
                  </p>
                  <button
                    onClick={() => setFormSubmitted(false)}
                    className="mt-6 px-6 py-2 border border-white/15 hover:border-[#D4AF37] text-xs uppercase tracking-widest text-white rounded transition-all"
                  >
                    Book Another
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  {formError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Full Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                        placeholder="Alexander Vane"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Email Address</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                        placeholder="alex@domain.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                        placeholder="+1 (555) 012-3456"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Select Residence</label>
                      <select
                        required
                        value={formData.propertyId}
                        onChange={(e) => setFormData(p => ({ ...p, propertyId: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                      >
                        {properties.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#161616] text-white">
                            {p.name} - {p.location}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Preferred Date</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Preferred Time Slot</label>
                      <select
                        required
                        value={formData.time}
                        onChange={(e) => setFormData(p => ({ ...p, time: e.target.value }))}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                      >
                        <option value="" className="bg-[#161616]">
                          {loadingSlots ? 'Loading slots...' : 'Select a time slot'}
                        </option>
                        {availableSlots.length > 0 ? (
                          availableSlots.map((s: any) => (
                            <option key={s.id} value={s.time} className="bg-[#161616]">
                              {s.time} (Available)
                            </option>
                          ))
                        ) : formData.date && !loadingSlots ? (
                          <>
                            <option value="10:00 AM" className="bg-[#161616]">10:00 AM (Default)</option>
                            <option value="11:30 AM" className="bg-[#161616]">11:30 AM (Default)</option>
                            <option value="02:00 PM" className="bg-[#161616]">02:00 PM (Default)</option>
                            <option value="03:30 PM" className="bg-[#161616]">03:30 PM (Default)</option>
                            <option value="05:00 PM" className="bg-[#161616]">05:00 PM (Default)</option>
                          </>
                        ) : (
                          <>
                            <option value="10:00 AM" className="bg-[#161616]">10:00 AM</option>
                            <option value="11:30 AM" className="bg-[#161616]">11:30 AM</option>
                            <option value="02:00 PM" className="bg-[#161616]">02:00 PM</option>
                            <option value="03:30 PM" className="bg-[#161616]">03:30 PM</option>
                            <option value="05:00 PM" className="bg-[#161616]">05:00 PM</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Message / Inquiry Details</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                      rows={3}
                      className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors resize-none"
                      placeholder="Specify structural customization or schedule details..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-white/50 font-medium block">Special Requests</label>
                    <input
                      type="text"
                      value={formData.specialRequests}
                      onChange={(e) => setFormData(p => ({ ...p, specialRequests: e.target.value }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-3.5 rounded text-white text-sm outline-none transition-colors"
                      placeholder="e.g. wheelchair access, private transport, NDA required..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-widest rounded hover:opacity-95 shadow-lg transition-all"
                  >
                    Submit Booking Request
                  </button>
                </form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Section 8 – Contact */}
      <section id="contact" className="py-32 bg-[#161616]/20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left contact card info */}
          <div className="lg:col-span-4 space-y-6">
            <div>
              <p className="text-[#D4AF37] text-xs uppercase tracking-[0.25em] font-semibold mb-3">Worldwide Offices</p>
              <h2 className="text-3xl font-light tracking-tight">Contact Aura</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[#F5D67B] rounded-lg">
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Metropolitan HQ</h4>
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                    745 Fifth Avenue, Penthouse Level<br />
                    New York, NY 10151
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[#F5D67B] rounded-lg">
                  <Phone size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Client Support</h4>
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                    Tel: +1 (212) 555-9830<br />
                    Mon - Sun: 09:00 AM - 08:00 PM EST
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[#F5D67B] rounded-lg">
                  <Mail size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Inquiries</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    inquire@aurarealestate.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Center simulated map card */}
          <div className="lg:col-span-4 h-full min-h-[400px] bg-[#161616] border border-white/5 rounded-xl shadow-2xl relative overflow-hidden flex flex-col justify-between p-6">
            {/* Map lines details */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.015)_1px,transparent_1px)] bg-[size:25px_25px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-25">
              <svg className="w-64 h-64 text-[#D4AF37]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.1">
                <circle cx="50" cy="50" r="40" />
                <circle cx="50" cy="50" r="30" />
                <circle cx="50" cy="50" r="20" />
                <line x1="10" y1="50" x2="90" y2="50" />
                <line x1="50" y1="10" x2="50" y2="90" />
              </svg>
            </div>

            <div className="z-10 flex justify-between items-start">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#D4AF37] block font-semibold">Interactive Locator</span>
                <h4 className="text-lg font-light text-white mt-0.5">New York HQ</h4>
              </div>
              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] uppercase tracking-wider text-white">
                GPS Live
              </span>
            </div>

            <div className="z-10 bg-[#0A0A0A]/95 border border-white/5 p-3 rounded-lg flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                <div>
                  <span className="text-[11px] font-semibold block text-white">Fifth Avenue Office</span>
                  <span className="text-[9px] text-white/45">745 5th Ave, Manhattan</span>
                </div>
              </div>
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 border border-white/10 hover:border-[#D4AF37] rounded transition-colors text-white/80 hover:text-white"
              >
                <ArrowUpRight size={12} />
              </a>
            </div>
          </div>

          {/* Right Contact Inquiry Form */}
          <div className="lg:col-span-4 p-6 bg-[#161616] border border-white/5 rounded-xl shadow-2xl relative">
            <h3 className="text-lg font-light text-white mb-1">Send an Inquiry</h3>
            <p className="text-[11px] text-white/50 mb-4">Our concierge desk responds within 24 hours.</p>

            {leadSubmitted ? (
              <div className="py-8 flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full">
                  <CheckCircle size={32} />
                </div>
                <h4 className="text-base font-light">Message Received</h4>
                <p className="text-xs text-white/55 max-w-[200px]">Thank you. A private office concierge will email you shortly.</p>
                <button
                  type="button"
                  onClick={() => setLeadSubmitted(false)}
                  className="px-4 py-1.5 border border-white/10 hover:border-[#D4AF37] text-[10px] uppercase tracking-widest text-white rounded transition-colors"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3">
                {leadError && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
                    {leadError}
                  </div>
                )}
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={leadData.name}
                    onChange={(e) => setLeadData(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#D4AF37] p-2 rounded text-white text-xs outline-none transition-colors"
                    placeholder="Marcus Sterling"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={leadData.email}
                    onChange={(e) => setLeadData(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#D4AF37] p-2 rounded text-white text-xs outline-none transition-colors"
                    placeholder="marcus@domain.com"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={leadData.phone}
                    onChange={(e) => setLeadData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#D4AF37] p-2 rounded text-white text-xs outline-none transition-colors"
                    placeholder="+1 (555) 012-3456"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/50 block font-semibold mb-1">Message</label>
                  <textarea
                    required
                    value={leadData.message}
                    onChange={(e) => setLeadData(p => ({ ...p, message: e.target.value }))}
                    rows={3}
                    className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#D4AF37] p-2 rounded text-white text-xs outline-none transition-colors resize-none"
                    placeholder="I am interested in private estates..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={leadLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-xs font-bold uppercase tracking-widest rounded hover:opacity-95 shadow-md transition-opacity"
                >
                  {leadLoading ? 'Sending...' : 'Submit Inquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#0A0A0A] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-[0.2em] text-[#D4AF37]">AURA</span>
            <span className="text-[9px] tracking-[0.4em] uppercase text-white/40">ESTATE</span>
          </div>
          <p className="text-[10px] tracking-widest text-white/30 uppercase">
            © 2026 AURA REAL ESTATE PLATFORM. ALL PRIVILEGES RESERVED.
          </p>
        </div>
      </footer>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#161616] border border-white/10 max-w-2xl w-full rounded-xl p-8 relative space-y-6 shadow-2xl"
            >
              <button
                onClick={() => setQuickViewProperty(null)}
                className="absolute top-6 right-6 text-white/60 hover:text-white"
              >
                Close
              </button>

              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#D4AF37] block font-semibold mb-2">Residence Overview</span>
                  <h3 className="text-3xl font-light">{quickViewProperty.name}</h3>
                  <p className="text-xs text-white/45 mt-1">{quickViewProperty.location}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 border rounded font-semibold ${
                  quickViewProperty.availability === 'AVAILABLE'
                    ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F5D67B]'
                    : quickViewProperty.availability === 'RESERVED'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}>
                  {quickViewProperty.availability}
                </span>
              </div>

              <div className="h-60 bg-gradient-to-br from-[#1E1E1E] to-[#0A0A0A] rounded-lg border border-white/5 flex items-center justify-center relative overflow-hidden">
                <svg className="w-16 h-16 text-[#D4AF37]/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="9" y1="6" x2="15" y2="6" />
                  <line x1="9" y1="10" x2="15" y2="10" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-6 py-6 border-y border-white/5 text-center">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 block">Price</span>
                  <span className="text-lg font-semibold text-[#D4AF37] mt-1 block">
                    ${(quickViewProperty.price / 1000000).toFixed(1)}M
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 block">Bedrooms</span>
                  <span className="text-lg text-white font-semibold mt-1 block">
                    {quickViewProperty.bedrooms} Rooms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 block">Area</span>
                  <span className="text-lg text-white font-semibold mt-1 block">
                    {quickViewProperty.area.toLocaleString()} Sq Ft
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    toggleSave(quickViewProperty.id);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-[#D4AF37] text-sm tracking-wider font-semibold rounded text-white w-1/3 transition-colors"
                >
                  <Heart size={16} fill={savedIds.includes(quickViewProperty.id) ? '#D4AF37' : 'none'} className={savedIds.includes(quickViewProperty.id) ? 'text-[#D4AF37]' : ''} />
                  <span>{savedIds.includes(quickViewProperty.id) ? 'Saved' : 'Save'}</span>
                </button>
                <a
                  href="#book"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, propertyId: quickViewProperty.id }));
                    setQuickViewProperty(null);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-sm tracking-wider font-semibold rounded w-2/3 hover:opacity-95 text-center shadow-md"
                >
                  <Calendar size={16} />
                  <span>Inquire residence</span>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Comparison Bottom Bar */}
      <AnimatePresence>
        {compareList.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-[#161616]/95 border border-white/10 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Compare ({compareList.length}/3)</span>
              <div className="flex gap-2">
                {compareList.map(p => (
                  <div key={p.id} className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white flex items-center gap-1.5">
                    <span>{p.name.split(' ').slice(-2).join(' ')}</span>
                    <button onClick={() => toggleCompare(p)} className="text-red-400 hover:text-red-300 ml-1">×</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-[11px] uppercase tracking-wider font-bold rounded hover:opacity-90 transition-opacity"
              >
                Compare Now
              </button>
              <button
                onClick={() => setCompareList([])}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[11px] uppercase tracking-wider rounded transition-colors"
              >
                Clear
              </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
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
                {compareList.map(p => (
                  <div key={p.id} className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-4 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white truncate">{p.name}</h4>
                      <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider">Floor {p.floor}</span>
                    </div>

                    <div className="border-t border-white/5 pt-3 space-y-3 text-xs">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Price:</span>
                        <span className="text-sm font-bold text-[#D4AF37]">${(p.price / 1000000).toFixed(1)}M</span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Location:</span>
                        <span className="text-white/70">{p.location}</span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Type:</span>
                        <span className="text-white/70">{p.type}</span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Beds:</span>
                        <span className="text-white/70">{p.bedrooms} Beds</span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Area:</span>
                        <span className="text-white/70">{p.area.toLocaleString()} Sq Ft</span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-white/40 font-semibold uppercase tracking-widest text-[9px] mr-2">Status:</span>
                        <span className={`px-2 py-0.5 border text-[10px] rounded uppercase font-semibold ${
                          p.availability === 'AVAILABLE' ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#F5D67B]' : 'border-red-500/30 bg-red-500/5 text-red-400'
                        }`}>{p.availability}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <a
                        href="#book"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, propertyId: p.id }));
                          setIsCompareModalOpen(false);
                        }}
                        className="w-full text-center py-2 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black text-[10px] font-bold uppercase tracking-widest rounded block hover:opacity-90 transition-opacity"
                      >
                        Inquire Visit
                      </a>
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
    </div>
  );
}
