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
          <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-mono">Loading Concierge Leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#0F172A]">
      {/* Page Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Leads Management</span>
        <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Concierge Inquiries</h1>
        <p className="text-xs text-slate-500 mt-1">Review and action client requests submitted via site forms.</p>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-[24px] border border-slate-200/80 shadow-sm">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="Search by name, email, phone or message content..."
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
            <option value="CONTACTED">Contacted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Main List Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className={`${selectedInquiry ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4`}>
          {filteredInquiries.length === 0 ? (
            <div className="bg-white border border-slate-200/80 p-12 text-center rounded-[24px] shadow-sm">
              <p className="text-sm text-slate-500 font-semibold">No inquiries found matching criteria.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/85 font-extrabold">
                    <tr>
                      <th className="p-4 sm:p-6">Client</th>
                      <th className="p-4 sm:p-6">Brief Message</th>
                      <th className="p-4 sm:p-6">Received</th>
                      <th className="p-4 sm:p-6">Status</th>
                      <th className="p-4 sm:p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInquiries.map((lead) => (
                      <tr key={lead.id} className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${selectedInquiry?.id === lead.id ? 'bg-slate-50/60' : ''}`} onClick={() => setSelectedInquiry(lead)}>
                        <td className="p-4 sm:p-6">
                          <div>
                            <span className="font-bold block text-slate-900">{lead.name}</span>
                            <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">{lead.email}</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-6 text-slate-700 max-w-[200px] truncate font-medium">
                          {lead.message}
                        </td>
                        <td className="p-4 sm:p-6 text-slate-450 font-semibold text-xs">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 sm:p-6">
                          <span className={`inline-block px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold rounded border shadow-3xs ${
                            lead.status === 'PENDING'
                              ? 'border-amber-250 bg-amber-50 text-amber-700'
                              : lead.status === 'CONTACTED'
                              ? 'border-blue-200 bg-blue-50 text-[#0B4C8C]'
                              : 'border-emerald-250 bg-emerald-50 text-emerald-700'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="p-4 sm:p-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedInquiry(lead)}
                              className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteInquiry(lead.id)}
                              className="p-1.5 border border-slate-200 hover:border-red-300 text-slate-450 hover:text-red-650 rounded-md bg-white shadow-3xs"
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
              className="xl:col-span-5 bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-sm space-y-6 self-start"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-[#0B4C8C] uppercase tracking-wider">Inquiry Details</h3>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="text-slate-400 hover:text-slate-650 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Client name</label>
                  <span className="text-base font-bold text-slate-900 block mt-0.5">{selectedInquiry.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Email</label>
                    <a href={`mailto:${selectedInquiry.email}`} className="text-xs text-[#0B4C8C] hover:underline flex items-center gap-1 mt-1 font-bold">
                      <Mail size={12} className="text-[#0B4C8C]" />
                      <span className="truncate block max-w-[150px]">{selectedInquiry.email}</span>
                    </a>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Phone</label>
                    {selectedInquiry.phone ? (
                      <a href={`tel:${selectedInquiry.phone}`} className="text-xs text-[#0B4C8C] hover:underline flex items-center gap-1 mt-1 font-bold">
                        <Phone size={12} className="text-[#0B4C8C]" />
                        <span>{selectedInquiry.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic block mt-1 font-medium">None provided</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Date Submitted</label>
                  <span className="text-xs text-slate-700 block mt-1 font-semibold">
                    {new Date(selectedInquiry.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Client Message</label>
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-sm text-slate-750 leading-relaxed italic mt-1.5 font-medium">
                    "{selectedInquiry.message}"
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Workflow Status Actions</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'PENDING'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'PENDING')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-extrabold rounded-lg transition-all shadow-3xs ${
                        selectedInquiry.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-250'
                          : 'bg-white border border-slate-250 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'CONTACTED'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'CONTACTED')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-extrabold rounded-lg transition-all shadow-3xs ${
                        selectedInquiry.status === 'CONTACTED'
                          ? 'bg-blue-50 text-[#0B4C8C] border border-blue-200'
                          : 'bg-white border border-slate-250 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Contacted
                    </button>
                    <button
                      disabled={actionLoading || selectedInquiry.status === 'CLOSED'}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'CLOSED')}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-extrabold rounded-lg transition-all shadow-3xs ${
                        selectedInquiry.status === 'CLOSED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                          : 'bg-white border border-slate-250 text-slate-500 hover:bg-slate-50'
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
