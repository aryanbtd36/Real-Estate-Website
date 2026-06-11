'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Phone, Calendar, Trash2, Search, Filter, CheckCircle2, AlertCircle, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONTACTED' | 'CLOSED'>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInquiries = async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setInquiries(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchInquiries();
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry((prev: any) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inquiry permanently?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leads?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchInquiries();
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete inquiry:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredInquiries = inquiries.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.phone && item.phone.includes(searchQuery)) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Concierge Leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Leads Management</span>
        <h1 className="text-3xl font-light tracking-tight mt-1">Concierge Inquiries</h1>
        <p className="text-xs text-white/50 mt-1">Review and action client requests submitted via site forms.</p>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#161616] p-4 rounded-xl border border-white/5">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search by name, email, phone or message content..."
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
            <option value="CONTACTED">Contacted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Main List Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className={`${selectedInquiry ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4`}>
          {filteredInquiries.length === 0 ? (
            <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
              <p className="text-sm text-white/40">No inquiries found matching criteria.</p>
            </div>
          ) : (
            <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="p-4 sm:p-6">Client</th>
                      <th className="p-4 sm:p-6">Brief Message</th>
                      <th className="p-4 sm:p-6">Received</th>
                      <th className="p-4 sm:p-6">Status</th>
                      <th className="p-4 sm:p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredInquiries.map((lead) => (
                      <tr key={lead.id} className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedInquiry?.id === lead.id ? 'bg-white/5' : ''}`} onClick={() => setSelectedInquiry(lead)}>
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="font-semibold block text-white">{lead.name}</span>
                            <span className="text-[11px] text-white/40 block mt-0.5">{lead.email}</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6 text-white/70 max-w-[200px] truncate">
                          {lead.message}
                        </td>
                        <td className="p-4 sm:p-6 text-white/40 text-xs">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 sm:p-6">
                          <span className={`inline-block px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded border ${
                            lead.status === 'PENDING'
                              ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
                              : lead.status === 'CONTACTED'
                              ? 'border-blue-500/30 bg-blue-500/5 text-blue-400'
                              : 'border-green-500/30 bg-green-500/5 text-green-400'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="p-4 sm:p-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedInquiry(lead)}
                              className="p-1.5 border border-white/5 hover:border-[#D4AF37]/30 text-white/40 hover:text-[#D4AF37] rounded transition-colors"
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteInquiry(lead.id)}
                              className="p-1.5 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded transition-colors"
                              title="Delete inquiry"
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
        </div>

        {/* Selected Inquiry Detail Side Drawer */}
        <AnimatePresence>
          {selectedInquiry && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="xl:col-span-5 bg-[#161616] border border-white/5 rounded-xl p-6 shadow-2xl space-y-6 self-start"
            >
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <h3 className="text-base font-semibold text-[#D4AF37] uppercase tracking-wider">Inquiry Details</h3>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Client name</label>
                  <span className="text-base font-light text-white block mt-0.5">{selectedInquiry.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Email</label>
                    <a href={`mailto:${selectedInquiry.email}`} className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 mt-1">
                      <Mail size={12} />
                      <span className="truncate block max-w-[150px]">{selectedInquiry.email}</span>
                    </a>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Phone</label>
                    {selectedInquiry.phone ? (
                      <a href={`tel:${selectedInquiry.phone}`} className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 mt-1">
                        <Phone size={12} />
                        <span>{selectedInquiry.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-white/30 italic block mt-1">None provided</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Date Submitted</label>
                  <span className="text-xs text-white/60 block mt-1">
                    {new Date(selectedInquiry.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Client Message</label>
                  <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-lg text-sm text-white/85 leading-relaxed italic mt-1.5">
                    "{selectedInquiry.message}"
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Workflow Status Actions</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'PENDING'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'PENDING')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold rounded transition-colors ${
                        selectedInquiry.status === 'PENDING'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/60'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'CONTACTED'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'CONTACTED')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold rounded transition-colors ${
                        selectedInquiry.status === 'CONTACTED'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/60'
                      }`}
                    >
                      Contacted
                    </button>
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'CLOSED'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'CLOSED')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold rounded transition-colors ${
                        selectedInquiry.status === 'CLOSED'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/60'
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
