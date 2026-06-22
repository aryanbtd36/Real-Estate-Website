'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Building,
  Users as UsersIcon,
  Mail,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function AdminSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeType, setActiveType] = useState(searchParams.get('type') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  
  const [results, setResults] = useState<any[]>([]);
  const [groupedPreviews, setGroupedPreviews] = useState<any>({
    property: [],
    user: [],
    inquiry: [],
    appointment: []
  });
  const [pagination, setPagination] = useState<any>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 1
  });
  const [loading, setLoading] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams();
      if (query) urlParams.append('q', query);
      urlParams.append('type', activeType);
      urlParams.append('page', page.toString());
      urlParams.append('limit', '10');

      const res = await fetch(`/api/admin/search?${urlParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setGroupedPreviews(data.grouped || { property: [], user: [], inquiry: [], appointment: [] });
        setPagination(data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
      }
    } catch (err) {
      console.error('Search query error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [activeType, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchResults();
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'property': return <Building className="text-amber-400" size={16} />;
      case 'user': return <UsersIcon className="text-blue-400" size={16} />;
      case 'inquiry': return <Mail className="text-pink-400" size={16} />;
      case 'appointment': return <Calendar className="text-teal-400" size={16} />;
      default: return <Compass size={16} />;
    }
  };

  const getEntityLabel = (type: string) => {
    switch (type) {
      case 'property': return 'Property';
      case 'user': return 'Client';
      case 'inquiry': return 'Inquiry';
      case 'appointment': return 'Appointment';
      default: return 'Entity';
    }
  };

  const getStatusBadgeClass = (entityType: string, status: string) => {
    const s = (status || '').toUpperCase();
    if (entityType === 'property') {
      if (s === 'PUBLISHED') return 'border-green-500/30 bg-green-500/5 text-green-400';
      if (s === 'DRAFT') return 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400';
      return 'border-red-500/30 bg-red-500/5 text-red-400';
    }
    if (entityType === 'user') {
      if (s === 'ACTIVE') return 'border-green-500/30 bg-green-500/5 text-green-400';
      return 'border-red-500/30 bg-red-500/5 text-red-400';
    }
    if (entityType === 'appointment') {
      if (s === 'APPROVED' || s === 'CONFIRMED' || s === 'COMPLETED') return 'border-green-500/30 bg-green-500/5 text-green-400';
      if (s === 'PENDING') return 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400';
      return 'border-red-500/30 bg-red-500/5 text-red-400';
    }
    return 'border-slate-200 bg-white/5 text-slate-800/50';
  };

  const typeTabs = [
    { value: 'all', label: 'All Results' },
    { value: 'properties', label: 'Properties' },
    { value: 'users', label: 'Clients' },
    { value: 'inquiries', label: 'Inquiries' },
    { value: 'appointments', label: 'Appointments' }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/admin" 
          className="p-2 bg-white border border-slate-200/80 hover:border-slate-200 rounded-lg text-slate-800/60 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-semibold">Search System</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Platform Finder</h1>
        </div>
      </div>

      {/* Unified Search Box */}
      <form onSubmit={handleSearchSubmit} className="relative bg-white p-4 rounded-xl border border-slate-200/80 shadow-lg">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search across properties, clients, inquiries, appointments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 hover:border-white/20 focus:border-[#0B4C8C] p-3.5 pl-11 pr-24 rounded-lg text-slate-800 text-sm outline-none transition-colors"
          />
          <Search className="absolute left-4 text-slate-500" size={18} />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-[#0B4C8C] hover:opacity-90 text-white text-xs uppercase tracking-widest font-bold rounded transition-opacity"
          >
            Find
          </button>
        </div>
      </form>

      {/* Entity Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-2">
        {typeTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveType(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all ${
              activeType === tab.value
                ? 'border-[#0B4C8C] text-[#0B4C8C] bg-white/5'
                : 'border-transparent text-slate-800/50 hover:text-slate-800/80 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-4 py-12">
          <div className="w-8 h-8 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-center text-[10px] uppercase tracking-widest text-slate-500">Searching database records...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grouped Results Side-by-Side (only when activeType === 'all' and query has matches) */}
          {activeType === 'all' && query && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(groupedPreviews).map((key) => {
                const groupList = groupedPreviews[key];
                if (groupList.length === 0) return null;

                return (
                  <div key={key} className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3 shadow-lg">
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                      {getEntityIcon(key)}
                      <span>{getEntityLabel(key)} Matches ({groupList.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {groupList.map((item: any) => (
                        <div key={item.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex justify-between items-center gap-2 hover:border-slate-200 transition-colors">
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 truncate">{item.title}</h4>
                            <p className="text-[10px] text-slate-500 truncate">{item.subtitle}</p>
                          </div>
                          <span className={`text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 border rounded shrink-0 ${getStatusBadgeClass(item.entityType, item.status)}`}>
                            {item.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Combined Flat Results / Paginated results */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#0B4C8C]">
              {query ? `Search Results (${pagination.total})` : 'All Records'}
            </h3>
            {results.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 p-12 text-center rounded-xl">
                <Compass className="mx-auto text-slate-800/20 mb-2" size={32} />
                <p className="text-xs text-slate-800/50">No database records matched your finder parameters.</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Try other keywords or adjust type filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((item, idx) => (
                  <motion.div
                    key={item.id + item.entityType}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="bg-white border border-slate-200/80 hover:border-slate-200 p-5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-colors"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg shrink-0">
                        {getEntityIcon(item.entityType)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                          <span className="text-[8px] uppercase font-bold tracking-widest bg-white/5 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                            {getEntityLabel(item.entityType)}
                          </span>
                          {item.relevance > 0 && (
                            <span className="text-[8px] uppercase font-bold tracking-widest bg-amber-400/10 border border-amber-400/25 text-[#0B4C8C] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <TrendingUp size={8} />
                              Match score: {item.relevance}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-800/50">{item.subtitle}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">
                          Registered: {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {item.status && (
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 border rounded ${getStatusBadgeClass(item.entityType, item.status)}`}>
                          {item.status}
                        </span>
                      )}
                      
                      {item.entityType === 'property' && (
                        <Link
                          href={`/admin/properties`}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-white/5 border border-slate-200/80 text-[10px] uppercase font-bold tracking-wider rounded text-slate-800"
                        >
                          Details
                        </Link>
                      )}
                      {item.entityType === 'user' && (
                        <Link
                          href={`/admin/users`}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-white/5 border border-slate-200/80 text-[10px] uppercase font-bold tracking-wider rounded text-slate-800"
                        >
                          CRM Profile
                        </Link>
                      )}
                      {item.entityType === 'inquiry' && (
                        <Link
                          href={`/admin/inquiries`}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-white/5 border border-slate-200/80 text-[10px] uppercase font-bold tracking-wider rounded text-slate-800"
                        >
                          Concierge
                        </Link>
                      )}
                      {item.entityType === 'appointment' && (
                        <Link
                          href={`/admin/appointments`}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-white/5 border border-slate-200/80 text-[10px] uppercase font-bold tracking-wider rounded text-slate-800"
                        >
                          Bookings
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/80">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 border border-slate-200/80 hover:border-slate-200 text-slate-800 hover:text-[#0B4C8C] rounded-lg disabled:opacity-30 disabled:hover:text-slate-800"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 border border-slate-200/80 hover:border-slate-200 text-slate-800 hover:text-[#0B4C8C] rounded-lg disabled:opacity-30 disabled:hover:text-slate-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-800">
        <div className="w-8 h-8 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminSearchContent />
    </Suspense>
  );
}
