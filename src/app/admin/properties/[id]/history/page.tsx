'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  IndianRupee,
  FileText,
  Plus,
  Compass,
  CheckCircle,
  Activity,
  User as UserIcon,
  Archive,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PropertyHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [property, setProperty] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/properties/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setProperty(data.property);
        setTimeline(data.timeline || []);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to fetch history details');
      }
    } catch (err) {
      console.error(err);
      setError('A network error occurred while fetching timeline logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchHistory();
    }
  }, [id]);

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'PROPERTY_CREATE': return <Plus className="text-green-400" size={14} />;
      case 'PROPERTY_UPDATE': return <FileText className="text-cyan-400" size={14} />;
      case 'PROPERTY_PUBLISH': return <CheckCircle className="text-green-500" size={14} />;
      case 'PROPERTY_ARCHIVE': return <Archive className="text-red-400" size={14} />;
      case 'PROPERTY_RESTORE': return <RefreshCw className="text-yellow-400" size={14} />;
      case 'PRICE_CHANGE': return <IndianRupee className="text-amber-400" size={14} />;
      default: return <Activity className="text-white/50" size={14} />;
    }
  };

  const getTimelineBadgeClass = (type: string) => {
    switch (type) {
      case 'PROPERTY_CREATE': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'PROPERTY_PUBLISH': return 'bg-green-500/15 border-green-500/30 text-green-300';
      case 'PROPERTY_ARCHIVE': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'PRICE_CHANGE': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'PROPERTY_RESTORE': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      default: return 'bg-white/5 border-white/10 text-white/50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Lifecycle Timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="space-y-6 text-center py-12 max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
          {error || 'Listing not found in database records.'}
        </div>
        <Link
          href="/admin/properties"
          className="inline-block px-4 py-2 bg-[#1E1E1E] hover:bg-white/5 border border-white/5 text-xs uppercase tracking-widest font-bold rounded text-white"
        >
          Back to Residences
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/properties" 
          className="p-2 bg-[#161616] border border-white/5 hover:border-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Audit Logs</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">{property.name}</h1>
          <p className="text-xs text-white/50 mt-1">Timeline of pricing edits, workflow updates, and modifications.</p>
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-6 md:p-8 space-y-8 relative overflow-hidden">
        <div className="absolute left-11 md:left-13 top-12 bottom-12 w-0.5 bg-white/5" />

        {timeline.length === 0 ? (
          <div className="text-center py-12 text-white/40 italic text-xs">
            No modifications or actions logged for this property.
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            {timeline.map((item: any, idx: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex gap-4 md:gap-6 items-start"
              >
                {/* Visual Node */}
                <div className="p-2 bg-[#0A0A0A] border border-white/10 rounded-full shrink-0 relative z-20 shadow-md">
                  {getTimelineIcon(item.type)}
                </div>

                {/* Content Box */}
                <div className="flex-1 bg-[#0A0A0A] border border-white/5 rounded-xl p-4 md:p-5 space-y-3 hover:border-white/10 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="space-y-1">
                      <span className={`inline-block text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded ${getTimelineBadgeClass(item.type)}`}>
                        {item.type.replace('PROPERTY_', '')}
                      </span>
                      <h4 className="text-xs md:text-sm font-semibold text-white/90 leading-tight">
                        {item.description}
                      </h4>
                    </div>
                    <span className="text-[10px] text-white/40 flex items-center gap-1 shrink-0 self-start sm:self-center">
                      <Clock size={10} />
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Actor detail */}
                  {item.actor ? (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/50">
                      <UserIcon size={10} className="text-[#D4AF37]" />
                      <span>Actioned by: <strong>{item.actor.name || 'Admin'}</strong> ({item.actor.email})</span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/40">
                      <Compass size={10} />
                      <span>Actioned by: <strong>System Service</strong></span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
