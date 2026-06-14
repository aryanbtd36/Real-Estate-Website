'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Tag,
  Clock,
  Calendar,
  AlertTriangle,
  MessageSquare,
  FileText,
  Activity,
  Plus,
  Trash,
  Edit2,
  CheckCircle,
  PlusCircle,
  CheckSquare,
  ArrowLeft,
  Briefcase,
  Share2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [engagementScore, setEngagementScore] = useState(0);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms states
  const [noteContent, setNoteContent] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDesc, setFollowUpDesc] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpAssignee, setFollowUpAssignee] = useState('');
  const [commType, setCommType] = useState('CALL');
  const [commContent, setCommContent] = useState('');
  const [newTag, setNewTag] = useState('');

  // Editing states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  // Timeline filters
  const [timelineFilter, setTimelineFilter] = useState('ALL');

  const fetchLeadDetails = async () => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setLead(data.lead);
        setTimeline(data.timeline);
        setEngagementScore(data.engagementScore);
      } else {
        console.error('Failed to fetch lead details');
      }
    } catch (err) {
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const users = await res.json();
        const activeAdmins = users.filter((u: any) => u.role === 'ADMIN' && !u.deletedAt && u.status === 'ACTIVE');
        setAdmins(activeAdmins);
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
      fetchAdmins();
    }
  }, [leadId]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeadDetails();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminAssign = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: adminId || null }),
      });
      if (res.ok) {
        fetchLeadDetails();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to assign admin');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const updatedTags = [...(lead.tags || []), newTag.trim()];
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (res.ok) {
        setNewTag('');
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = (lead.tags || []).filter((t: string) => t !== tagToRemove);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Notes actions
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      if (res.ok) {
        setNoteContent('');
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, content: editingNoteContent }),
      });
      if (res.ok) {
        setEditingNoteId(null);
        setEditingNoteContent('');
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Comments actions
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent }),
      });
      if (res.ok) {
        setCommentContent('');
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/comments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content: editingCommentContent }),
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentContent('');
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Follow-ups actions
  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpTitle.trim() || !followUpDate) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: followUpTitle,
          description: followUpDesc,
          dueDate: followUpDate,
          assignedToId: followUpAssignee || null,
        }),
      });
      if (res.ok) {
        setFollowUpTitle('');
        setFollowUpDesc('');
        setFollowUpDate('');
        setFollowUpAssignee('');
        fetchLeadDetails();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to create task');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string, currentlyCompleted: boolean) => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/follow-ups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpId,
          completed: !currentlyCompleted,
        }),
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/follow-ups?followUpId=${followUpId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Communications actions
  const handleLogComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commContent.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: commType,
          content: commContent,
        }),
      });
      if (res.ok) {
        setCommContent('');
        fetchLeadDetails();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to log interaction');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTimeline = timeline.filter((item) => {
    if (timelineFilter === 'ALL') return true;
    return item.type === timelineFilter;
  });

  const getEngagementBadge = (score: number) => {
    if (score >= 150) return 'border-pink-500/25 bg-pink-500/5 text-pink-400';
    if (score >= 50) return 'border-orange-500/25 bg-orange-500/5 text-orange-400';
    if (score >= 15) return 'border-yellow-500/25 bg-yellow-500/5 text-yellow-400';
    if (score >= 1) return 'border-blue-500/25 bg-blue-500/5 text-blue-400';
    return 'border-white/5 bg-white/5 text-white/40';
  };

  const getEngagementCategory = (score: number) => {
    if (score >= 150) return 'VIP';
    if (score >= 50) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    if (score >= 1) return 'LOW';
    return 'INACTIVE';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Fetching CRM Profile...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center bg-[#161616] border border-white/5 rounded-xl space-y-4">
        <AlertTriangle className="text-red-500 mx-auto" size={40} />
        <h2 className="text-xl font-light">Lead Profile Not Found</h2>
        <p className="text-xs text-white/40">The requested lead ID does not exist or you lack admin privileges.</p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-[#D4AF37] text-black text-xs uppercase font-semibold rounded">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top action header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#161616] border border-white/5 p-6 rounded-xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 bg-[#0A0A0A] hover:bg-[#111] border border-white/5 rounded text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40">Concierge Relationship CRM</span>
              <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${getEngagementBadge(engagementScore)}`}>
                Engagement: {getEngagementCategory(engagementScore)} ({engagementScore} pts)
              </span>
            </div>
            <h1 className="text-2xl font-light text-white mt-1">{lead.name}</h1>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Status Select Box */}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-white/40 mb-1 font-semibold">Funnel State</span>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white text-xs rounded px-3 py-1.5 focus:outline-none"
            >
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="VISIT_SCHEDULED">VISIT SCHEDULED</option>
              <option value="NEGOTIATION">NEGOTIATION</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
          </div>

          {/* Priority Select Box */}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-white/40 mb-1 font-semibold">Priority</span>
            <select
              value={lead.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white text-xs rounded px-3 py-1.5 focus:outline-none"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Assignment Select Box */}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-white/40 mb-1 font-semibold">Assigned Admin</span>
            <select
              value={lead.assignedToId || ''}
              onChange={(e) => handleAdminAssign(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white text-xs rounded px-3 py-1.5 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name || admin.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Basic overview and widgets */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Lead Details Card */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-white/70 border-b border-white/5 pb-2 font-bold">Contact Profile</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-white/75">
                <Mail size={14} className="text-[#D4AF37]" />
                <span className="truncate">{lead.email}</span>
              </div>
              <div className="flex items-center gap-2 text-white/75">
                <Phone size={14} className="text-[#D4AF37]" />
                <span>{lead.phone || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2 text-white/75">
                <Briefcase size={14} className="text-[#D4AF37]" />
                <span>Source: <strong className="text-white">{lead.source}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-white/75">
                <Clock size={14} className="text-[#D4AF37]" />
                <span>Inquired: {new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg text-white/60 italic mt-2">
                "{lead.message}"
              </div>
            </div>

            {/* Tags Panel */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block font-semibold">Relationship Tags</span>
              <div className="flex flex-wrap gap-2">
                {(lead.tags || []).map((tag: string) => (
                  <span key={tag} className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#D4AF37] px-2 py-0.5 bg-[#D4AF37]/5 border border-[#D4AF37]/25 rounded-full">
                    <span>{tag}</span>
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 font-bold transition-colors">×</button>
                  </span>
                ))}
                {(lead.tags || []).length === 0 && <span className="text-[10px] text-white/30 italic">No tags attached.</span>}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-white/5 text-xs rounded px-2.5 py-1 text-white focus:outline-none"
                />
                <button type="submit" className="p-1 bg-[#D4AF37] hover:bg-[#c29f2f] text-black rounded transition-colors">
                  <Plus size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* Follow-up tasks scheduler and list */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-white/70 border-b border-white/5 pb-2 font-bold">Follow-Up Action Items</h3>
            
            {/* Action Items List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {lead.followUps.length === 0 ? (
                <div className="text-center text-white/30 italic text-xs py-4">No scheduled follow-up tasks.</div>
              ) : (
                lead.followUps.map((task: any) => (
                  <div key={task.id} className={`p-3 bg-[#0A0A0A] border rounded-lg space-y-2 transition-all ${
                    task.completed 
                      ? 'border-green-500/20 bg-green-950/5 opacity-60' 
                      : new Date(task.dueDate) < new Date() 
                        ? 'border-red-500/20 bg-red-950/5' 
                        : 'border-white/5'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex gap-2 items-start">
                        <button 
                          onClick={() => handleCompleteFollowUp(task.id, task.completed)}
                          className="mt-0.5 text-white/40 hover:text-[#D4AF37] transition-colors"
                        >
                          <CheckSquare className={task.completed ? 'text-green-500' : ''} size={14} />
                        </button>
                        <div>
                          <p className={`text-xs font-semibold ${task.completed ? 'line-through text-white/40' : 'text-white'}`}>
                            {task.title}
                          </p>
                          {task.description && <p className="text-[10px] text-white/50">{task.description}</p>}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteFollowUp(task.id)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash size={12} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-white/40 pt-1.5 border-t border-white/5">
                      <span>Owner: {task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : 'Unassigned'}</span>
                      <span className={new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-400 font-semibold' : ''}>
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Scheduler Form */}
            <form onSubmit={handleAddFollowUp} className="border-t border-white/5 pt-4 space-y-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block font-semibold">Schedule New Action</span>
              <input
                type="text"
                placeholder="Task title (e.g., Send luxury prospectus)"
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                required
                className="w-full bg-[#0A0A0A] border border-white/5 text-xs rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
              <textarea
                placeholder="Optional notes/details..."
                value={followUpDesc}
                onChange={(e) => setFollowUpDesc(e.target.value)}
                className="w-full h-12 bg-[#0A0A0A] border border-white/5 text-xs rounded px-2.5 py-1.5 text-white focus:outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  required
                  className="bg-[#0A0A0A] border border-white/5 text-xs rounded px-2 py-1 text-white focus:outline-none"
                />
                <select
                  value={followUpAssignee}
                  onChange={(e) => setFollowUpAssignee(e.target.value)}
                  className="bg-[#0A0A0A] border border-white/5 text-xs rounded px-2 py-1 text-white focus:outline-none"
                >
                  <option value="">Assignee...</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name || admin.email}
                    </option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full py-1.5 bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-semibold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusCircle size={14} />
                <span>Schedule Task</span>
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Unified Communication timeline feed & interaction logs */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Quick Interaction Panel (Notes, Comments, Comm log tabs) */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-white/70 border-b border-white/5 pb-2 font-bold">CRM Logging Controls</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Log Communication Form */}
              <form onSubmit={handleLogComm} className="space-y-3">
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block font-bold">Log Interaction Call/Email</span>
                <div className="flex gap-2">
                  <select
                    value={commType}
                    onChange={(e) => setCommType(e.target.value)}
                    className="bg-[#0A0A0A] border border-white/10 text-white text-xs rounded px-2.5 py-1 focus:outline-none"
                  >
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                    <option value="MEETING">Meeting</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <span className="text-[10px] text-white/30 self-center">Logged directly in timeline</span>
                </div>
                <textarea
                  placeholder="Summary of interaction (e.g. Discussed penthouse pricing. Customer requested floorplan.)"
                  value={commContent}
                  onChange={(e) => setCommContent(e.target.value)}
                  required
                  className="w-full h-20 bg-[#0A0A0A] border border-white/5 text-xs rounded p-2.5 text-white focus:outline-none resize-none"
                />
                <button type="submit" className="px-3 py-1 bg-[#D4AF37] hover:bg-[#c29f2f] text-black text-[10px] font-bold uppercase tracking-wider rounded transition-colors">
                  Submit Log
                </button>
              </form>

              {/* Note / Comment side by side box */}
              <div className="space-y-4">
                {/* Note adding Form */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block font-bold">Add CRM Note</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Relationship notes (e.g., prefers high-floor units)..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      required
                      className="flex-1 bg-[#0A0A0A] border border-white/5 text-xs rounded px-2.5 py-1 text-white focus:outline-none"
                    />
                    <button type="submit" className="px-3 py-1 bg-white hover:bg-white/80 text-black text-[10px] font-bold uppercase tracking-wider rounded transition-colors">
                      Post Note
                    </button>
                  </div>
                </form>

                {/* Comment adding Form */}
                <form onSubmit={handleAddComment} className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block font-bold">Add Internal Comment</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Comment for other admins (e.g. I will call tomorrow)..."
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      required
                      className="flex-1 bg-[#0A0A0A] border border-white/5 text-xs rounded px-2.5 py-1 text-white focus:outline-none"
                    />
                    <button type="submit" className="px-3 py-1 bg-white hover:bg-white/80 text-black text-[10px] font-bold uppercase tracking-wider rounded transition-colors">
                      Post Comment
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>

          {/* Unified Timeline Widget */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-6 space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 flex items-center gap-2">
                <Activity size={16} className="text-[#D4AF37]" />
                <span>Relationship Timeline & Feed</span>
              </h3>
              
              {/* Timeline filter chips */}
              <div className="flex flex-wrap gap-1">
                {['ALL', 'NOTE', 'COMMENT', 'COMMUNICATION', 'FOLLOW_UP', 'STATUS_CHANGE', 'ASSIGNMENT'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimelineFilter(filter)}
                    className={`text-[8px] uppercase tracking-widest px-2 py-1 border rounded transition-all font-semibold ${
                      timelineFilter === filter
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
                        : 'bg-transparent text-white/40 border-white/5 hover:border-white/10 hover:text-white'
                    }`}
                  >
                    {filter === 'STATUS_CHANGE' ? 'STATUS' : filter === 'COMMUNICATION' ? 'CALL/MAIL' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline scroll stream */}
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {filteredTimeline.length === 0 ? (
                <div className="p-12 text-center text-white/30 italic text-xs">No entries match the filter.</div>
              ) : (
                filteredTimeline.map((item) => (
                  <div key={item.id} className="relative flex gap-4 text-xs group">
                    
                    {/* Visual left timeline rail */}
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded border ${
                        item.type === 'NOTE' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
                        item.type === 'COMMENT' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
                        item.type === 'COMMUNICATION' ? 'bg-purple-500/10 border-purple-500/25 text-purple-400' :
                        item.type === 'FOLLOW_UP' ? 'bg-green-500/10 border-green-500/25 text-green-400' :
                        item.type === 'STATUS_CHANGE' ? 'bg-pink-500/10 border-pink-500/25 text-pink-400' :
                        'bg-white/5 border-white/10 text-white/55'
                      }`}>
                        {item.type === 'NOTE' ? <FileText size={12} /> :
                         item.type === 'COMMENT' ? <MessageSquare size={12} /> :
                         item.type === 'COMMUNICATION' ? <Activity size={12} /> :
                         item.type === 'FOLLOW_UP' ? <CheckCircle size={12} /> :
                         <User size={12} />}
                      </div>
                      <div className="w-[1px] flex-1 bg-white/5 mt-2" />
                    </div>

                    <div className="flex-1 bg-[#0A0A0A] border border-white/5 p-4 rounded-xl space-y-1 relative">
                      <div className="flex justify-between items-start flex-wrap gap-2 text-[10px] text-white/40">
                        <span className="font-semibold uppercase tracking-wider">
                          {item.type}
                        </span>
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>

                      {/* Display content or edit input */}
                      {editingNoteId === item.id ? (
                        <div className="space-y-2 pt-2">
                          <input
                            type="text"
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 text-xs text-white rounded p-2 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateNote(item.id)} className="px-2.5 py-1 bg-[#D4AF37] text-black text-[9px] font-bold uppercase rounded">Save</button>
                            <button onClick={() => setEditingNoteId(null)} className="px-2.5 py-1 bg-white/10 text-white text-[9px] font-bold uppercase rounded">Cancel</button>
                          </div>
                        </div>
                      ) : editingCommentId === item.id ? (
                        <div className="space-y-2 pt-2">
                          <input
                            type="text"
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 text-xs text-white rounded p-2 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateComment(item.id)} className="px-2.5 py-1 bg-[#D4AF37] text-black text-[9px] font-bold uppercase rounded">Save</button>
                            <button onClick={() => setEditingCommentId(null)} className="px-2.5 py-1 bg-white/10 text-white text-[9px] font-bold uppercase rounded">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-white/80 leading-relaxed py-1">{item.content}</p>
                      )}

                      {/* Timeline attribution details */}
                      <div className="flex justify-between items-center text-[9px] text-white/30 border-t border-white/5 pt-2 mt-2">
                        <span>Attributed: {item.createdBy ? (item.createdBy.name || item.createdBy.email) : 'System Admin'}</span>
                        
                        {/* Hover controls for editing/deleting notes/comments */}
                        <div className="hidden group-hover:flex gap-2 transition-opacity">
                          {item.type === 'NOTE' && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingNoteId(item.id);
                                  setEditingNoteContent(item.content);
                                }}
                                className="text-white/40 hover:text-[#D4AF37] transition-colors"
                              >
                                <Edit2 size={10} />
                              </button>
                              <button onClick={() => handleDeleteNote(item.id)} className="text-white/40 hover:text-red-400 transition-colors">
                                <Trash size={10} />
                              </button>
                            </>
                          )}
                          {item.type === 'COMMENT' && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingCommentId(item.id);
                                  setEditingCommentContent(item.content);
                                }}
                                className="text-white/40 hover:text-[#D4AF37] transition-colors"
                              >
                                <Edit2 size={10} />
                              </button>
                              <button onClick={() => handleDeleteComment(item.id)} className="text-white/40 hover:text-red-400 transition-colors">
                                <Trash size={10} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
