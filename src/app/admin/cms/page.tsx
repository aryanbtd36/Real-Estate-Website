'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Layout,
  Settings,
  Activity,
  Award,
  MapPin,
  MessageSquare,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Save,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  RefreshCw,
  PlusCircle,
  FileText,
  Globe,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'general' | 'layout' | 'metrics' | 'localities' | 'testimonials' | 'research';

export default function AdminCmsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Selected tab
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // Loading & statuses
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Core CMS states
  const [heroConfig, setHeroConfig] = useState<any>({});
  const [bannerConfig, setBannerConfig] = useState<any>({});
  const [seoConfig, setSeoConfig] = useState<any>({});
  const [featuredConfig, setFeaturedConfig] = useState<any>({});
  const [footerConfig, setFooterConfig] = useState<any>({});
  const [sectionsList, setSectionsList] = useState<any[]>([]);

  // List entities
  const [heroMetrics, setHeroMetrics] = useState<any[]>([]);
  const [trustMetrics, setTrustMetrics] = useState<any[]>([]);
  const [localities, setLocalities] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);

  // Editing modals/form state
  const [editingMetric, setEditingMetric] = useState<any | null>(null);
  const [metricType, setMetricType] = useState<'hero' | 'trust'>('hero');
  
  const [editingLocality, setEditingLocality] = useState<any | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<any | null>(null);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);

  // Fetch all CMS configurations
  const fetchCmsData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/cms');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch CMS settings');
      }
      const data = await res.json();
      setHeroConfig(data.hero || {});
      setBannerConfig(data.banner || {});
      setSeoConfig(data.seo || {});
      setFeaturedConfig(data.featured || {});
      
      // Footer JSON parsers
      const footer = data.footer || {};
      setFooterConfig({
        ...footer,
        linksJson: footer.linksJson ? JSON.stringify(footer.linksJson, null, 2) : '{}',
        socialsJson: footer.socialsJson ? JSON.stringify(footer.socialsJson, null, 2) : '{}'
      });
      setSectionsList(data.sections || []);

      // Fetch other collections
      await Promise.all([
        fetchHeroMetrics(),
        fetchTrustMetrics(),
        fetchLocalities(),
        fetchTestimonials(),
        fetchArticles()
      ]);

    } catch (err: any) {
      setMessage({ text: err.message || 'Error loading dashboard', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchHeroMetrics = async () => {
    const res = await fetch('/api/admin/cms/hero-metrics');
    if (res.ok) setHeroMetrics(await res.json());
  };

  const fetchTrustMetrics = async () => {
    const res = await fetch('/api/admin/cms/trust-metrics');
    if (res.ok) setTrustMetrics(await res.json());
  };

  const fetchLocalities = async () => {
    const res = await fetch('/api/admin/cms/localities');
    if (res.ok) setLocalities(await res.json());
  };

  const fetchTestimonials = async () => {
    const res = await fetch('/api/admin/cms/testimonials');
    if (res.ok) setTestimonials(await res.json());
  };

  const fetchArticles = async () => {
    const res = await fetch('/api/admin/cms/articles');
    if (res.ok) setArticles(await res.json());
  };

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session && !(session.user as any).isFounder) {
      router.push('/admin');
      return;
    }

    if (sessionStatus === 'authenticated') {
      fetchCmsData();
    }
  }, [session, sessionStatus]);

  // Alert handler
  const triggerAlert = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setMessage(null), 5000);
  };

  // Generic block saver
  const handleSaveConfig = async (type: 'hero' | 'banner' | 'seo' | 'featured' | 'footer') => {
    setSaveLoading(true);
    try {
      let dataToSend = {};
      if (type === 'hero') dataToSend = heroConfig;
      if (type === 'banner') dataToSend = bannerConfig;
      if (type === 'seo') dataToSend = seoConfig;
      if (type === 'featured') {
        dataToSend = {
          ...featuredConfig,
          manualIds: typeof featuredConfig.manualIds === 'string'
            ? featuredConfig.manualIds.split(',').map((id: string) => id.trim()).filter(Boolean)
            : featuredConfig.manualIds
        };
      }
      if (type === 'footer') {
        let parsedLinks = {};
        let parsedSocials = {};
        try {
          parsedLinks = JSON.parse(footerConfig.linksJson || '{}');
          parsedSocials = JSON.parse(footerConfig.socialsJson || '{}');
        } catch (e) {
          throw new Error('Footer Links or Socials JSON is not valid format');
        }
        dataToSend = {
          ...footerConfig,
          linksJson: parsedLinks,
          socialsJson: parsedSocials
        };
      }

      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: dataToSend })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save configuration');

      triggerAlert(`Successfully updated ${type.toUpperCase()} configuration block.`, 'success');
    } catch (err: any) {
      triggerAlert(err.message || 'Error occurred while saving settings', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Section visibility and layout save
  const handleSaveSectionsLayout = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sections', data: sectionsList })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update section orders');

      triggerAlert('Homepage section layout settings saved successfully.', 'success');
    } catch (err: any) {
      triggerAlert(err.message || 'Error updating layout', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const list = [...sectionsList];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Recalculate displayOrder
    const updated = list.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1
    }));

    setSectionsList(updated);
  };

  const toggleSectionVisible = (index: number) => {
    const list = [...sectionsList];
    list[index].visible = !list[index].visible;
    setSectionsList(list);
  };

  // Metrics (Hero & Trust) operations
  const handleSaveMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = metricType === 'hero' ? '/api/admin/cms/hero-metrics' : '/api/admin/cms/trust-metrics';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMetric)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save metric');

      setEditingMetric(null);
      if (metricType === 'hero') {
        fetchHeroMetrics();
      } else {
        fetchTrustMetrics();
      }
      triggerAlert(`Metric "${editingMetric.title}" saved.`, 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  const handleDeleteMetric = async (id: string, type: 'hero' | 'trust') => {
    if (!confirm('Are you sure you want to delete this indicator metric?')) return;
    try {
      const baseUrl = type === 'hero' ? '/api/admin/cms/hero-metrics' : '/api/admin/cms/trust-metrics';
      const res = await fetch(`${baseUrl}?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete metric');

      if (type === 'hero') {
        fetchHeroMetrics();
      } else {
        fetchTrustMetrics();
      }
      triggerAlert('Indicator metric deleted successfully.', 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  // Localities operations
  const handleSaveLocality = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/cms/localities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLocality)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save locality scorecard');

      setEditingLocality(null);
      fetchLocalities();
      triggerAlert(`Locality scorecard "${editingLocality.areaName}" saved.`, 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  const handleDeleteLocality = async (id: string) => {
    if (!confirm('Are you sure you want to delete this locality intelligence scorecard?')) return;
    try {
      const res = await fetch(`/api/admin/cms/localities?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete locality');

      fetchLocalities();
      triggerAlert('Locality scorecard deleted.', 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  // Testimonials operations
  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/cms/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTestimonial)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save testimonial review');

      setEditingTestimonial(null);
      fetchTestimonials();
      triggerAlert(`Testimonial from "${editingTestimonial.name}" saved.`, 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this buyer testimonial review?')) return;
    try {
      const res = await fetch(`/api/admin/cms/testimonials?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete testimonial');

      fetchTestimonials();
      triggerAlert('Verified testimonial deleted.', 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  // Research Articles operations
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/cms/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingArticle)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save intelligence article');

      setEditingArticle(null);
      fetchArticles();
      triggerAlert(`Research post "${editingArticle.title}" saved.`, 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this research journal article?')) return;
    try {
      const res = await fetch(`/api/admin/cms/articles?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete article');

      fetchArticles();
      triggerAlert('Intelligence post deleted.', 'success');
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50 text-slate-800">
        <div className="w-10 h-10 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest text-slate-500">Loading Platform CMS Panel...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-semibold">Founder Portal</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Website CMS Command</h1>
          <p className="text-xs text-slate-650 mt-1">Control landing homepage sections, copy text, layout orders, testimonials, and locality statistics.</p>
        </div>
        <button
          onClick={fetchCmsData}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-slate-800 text-xs uppercase tracking-widest font-semibold rounded flex items-center gap-2 transition-all"
        >
          <RefreshCw size={14} className="text-[#0B4C8C]" />
          <span>Reload Settings</span>
        </button>
      </div>

      {/* Message Notifications banner */}
      {message && (
        <div className={`p-4 rounded-lg border text-xs uppercase tracking-wider flex items-center gap-2 font-bold ${
          message.type === 'success' ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto">
        {[
          { id: 'general', label: 'Global Copy & SEO', icon: <Settings size={14} /> },
          { id: 'layout', label: 'Homepage sections layout', icon: <Layout size={14} /> },
          { id: 'metrics', label: 'Hero & Trust Indicators', icon: <Activity size={14} /> },
          { id: 'localities', label: 'Locality scorecards', icon: <MapPin size={14} /> },
          { id: 'testimonials', label: 'Buyer Testimonials', icon: <MessageSquare size={14} /> },
          { id: 'research', label: 'Research journal', icon: <BookOpen size={14} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Tab);
              setEditingMetric(null);
              setEditingLocality(null);
              setEditingTestimonial(null);
              setEditingArticle(null);
            }}
            className={`px-6 py-3 border-b-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#0B4C8C] text-[#0B4C8C] bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tabs content containers */}
      <div className="space-y-8">

        {/* Tab 1: General Copy & SEO */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8 space-y-8">
              {/* Hero Copy Panel */}
              <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">Hero Showcase Segment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Main Headline Title</label>
                    <input
                      type="text"
                      value={heroConfig.headline || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, headline: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Highlighted text</label>
                    <input
                      type="text"
                      value={heroConfig.highlightedText || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, highlightedText: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Visibility Toggle</label>
                    <select
                      value={String(heroConfig.visible)}
                      onChange={(e) => setHeroConfig({ ...heroConfig, visible: e.target.value === 'true' })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    >
                      <option value="true">Visible</option>
                      <option value="false">Hidden</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Subheadline Copy Description</label>
                    <textarea
                      value={heroConfig.subheadline || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, subheadline: e.target.value })}
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Primary CTA Label</label>
                    <input
                      type="text"
                      value={heroConfig.primaryCtaText || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, primaryCtaText: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Primary CTA Action URL</label>
                    <input
                      type="text"
                      value={heroConfig.primaryCtaUrl || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, primaryCtaUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Secondary CTA Label</label>
                    <input
                      type="text"
                      value={heroConfig.secondaryCtaText || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, secondaryCtaText: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Secondary CTA Action URL</label>
                    <input
                      type="text"
                      value={heroConfig.secondaryCtaUrl || ''}
                      onChange={(e) => setHeroConfig({ ...heroConfig, secondaryCtaUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Background media url</label>
                    <input
                      type="text"
                      value={heroConfig.backgroundMedia || ''}
                      placeholder="e.g. image URL or video cloud url"
                      onChange={(e) => setHeroConfig({ ...heroConfig, backgroundMedia: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Background Type</label>
                    <select
                      value={heroConfig.bgType || 'image'}
                      onChange={(e) => setHeroConfig({ ...heroConfig, bgType: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    >
                      <option value="image">Still Image</option>
                      <option value="video">Streaming MP4 Video</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => handleSaveConfig('hero')}
                  className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
                >
                  Save Hero Settings
                </button>
              </div>

              {/* Announcement Banner */}
              <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">Announcement Header Strip</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Banner title badge</label>
                    <input
                      type="text"
                      value={bannerConfig.title || ''}
                      placeholder="e.g. UPDATE"
                      onChange={(e) => setBannerConfig({ ...bannerConfig, title: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Strip visibility</label>
                    <select
                      value={String(bannerConfig.visible)}
                      onChange={(e) => setBannerConfig({ ...bannerConfig, visible: e.target.value === 'true' })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    >
                      <option value="false">Deactivated (Hidden)</option>
                      <option value="true">Active (Visible)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Banner narrative description</label>
                    <input
                      type="text"
                      value={bannerConfig.description || ''}
                      placeholder="e.g. Gomti Nagar Expansion phase III plots have been unlocked..."
                      onChange={(e) => setBannerConfig({ ...bannerConfig, description: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">CTA Button text</label>
                    <input
                      type="text"
                      value={bannerConfig.ctaText || ''}
                      placeholder="e.g. Explore Plots"
                      onChange={(e) => setBannerConfig({ ...bannerConfig, ctaText: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">CTA redirect url</label>
                    <input
                      type="text"
                      value={bannerConfig.ctaUrl || ''}
                      placeholder="/plots"
                      onChange={(e) => setBannerConfig({ ...bannerConfig, ctaUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => handleSaveConfig('banner')}
                  className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
                >
                  Save Announcement Settings
                </button>
              </div>

              {/* Featured Properties Spotlight */}
              <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">Featured Listings Spotlight Mode</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Selection Algorithm</label>
                    <select
                      value={featuredConfig.mode || 'AUTOMATIC'}
                      onChange={(e) => setFeaturedConfig({ ...featuredConfig, mode: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    >
                      <option value="AUTOMATIC">Automatic (Highest ROI & Growth metric)</option>
                      <option value="MANUAL">Manual (Specify Property IDs manually)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Manual Property IDs (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. uuid-1, uuid-2"
                      value={Array.isArray(featuredConfig.manualIds) ? featuredConfig.manualIds.join(', ') : featuredConfig.manualIds || ''}
                      onChange={(e) => setFeaturedConfig({ ...featuredConfig, manualIds: e.target.value })}
                      disabled={featuredConfig.mode === 'AUTOMATIC'}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20 disabled:opacity-40"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => handleSaveConfig('featured')}
                  className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
                >
                  Save Featured Settings
                </button>
              </div>

              {/* Footer configurations */}
              <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">Footer Site Map & Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Company overview text</label>
                    <input
                      type="text"
                      value={footerConfig.companyInfo || ''}
                      onChange={(e) => setFooterConfig({ ...footerConfig, companyInfo: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Contact Hotline Phone</label>
                    <input
                      type="text"
                      value={footerConfig.contactPhone || ''}
                      onChange={(e) => setFooterConfig({ ...footerConfig, contactPhone: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Support Email Address</label>
                    <input
                      type="text"
                      value={footerConfig.contactEmail || ''}
                      onChange={(e) => setFooterConfig({ ...footerConfig, contactEmail: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Footer Navigation Links JSON Structure</label>
                    <textarea
                      value={footerConfig.linksJson || ''}
                      onChange={(e) => setFooterConfig({ ...footerConfig, linksJson: e.target.value })}
                      rows={6}
                      className="w-full bg-white font-mono border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Footer Social Links JSON Structure</label>
                    <textarea
                      value={footerConfig.socialsJson || ''}
                      onChange={(e) => setFooterConfig({ ...footerConfig, socialsJson: e.target.value })}
                      rows={4}
                      className="w-full bg-white font-mono border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => handleSaveConfig('footer')}
                  className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
                >
                  Save Footer Settings
                </button>
              </div>
            </div>

            {/* Sidebar metadata SEO column */}
            <div className="xl:col-span-4 space-y-8">
              <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2 flex items-center gap-1.5">
                  <Globe size={16} />
                  <span>SEO & Meta Parameters</span>
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Meta Title Tag</label>
                    <input
                      type="text"
                      value={seoConfig.metaTitle || ''}
                      onChange={(e) => setSeoConfig({ ...seoConfig, metaTitle: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Meta Description</label>
                    <textarea
                      value={seoConfig.metaDescription || ''}
                      onChange={(e) => setSeoConfig({ ...seoConfig, metaDescription: e.target.value })}
                      rows={4}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Keywords (Comma-separated)</label>
                    <input
                      type="text"
                      value={seoConfig.keywords || ''}
                      onChange={(e) => setSeoConfig({ ...seoConfig, keywords: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">OG Social Preview Image Url</label>
                    <input
                      type="text"
                      value={seoConfig.ogImage || ''}
                      placeholder="e.g. https://domain.com/og-img.jpg"
                      onChange={(e) => setSeoConfig({ ...seoConfig, ogImage: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-650 block font-bold">Canonical Tag URL</label>
                    <input
                      type="text"
                      value={seoConfig.canonicalUrl || ''}
                      placeholder="https://auraestates.com"
                      onChange={(e) => setSeoConfig({ ...seoConfig, canonicalUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => handleSaveConfig('seo')}
                  className="w-full py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
                >
                  Save SEO Parameters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Homepage Section Layout Ordering & Visibility */}
        {activeTab === 'layout' && (
          <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6 max-w-3xl">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2 flex items-center gap-1.5">
                <ListOrdered size={16} />
                <span>Section Ordering & Visibility Layout</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Re-order blocks vertically on the homepage and toggle their visibility directly.</p>
            </div>

            <div className="space-y-3">
              {sectionsList.map((section, idx) => (
                <div key={section.id} className={`p-4 rounded-lg border flex justify-between items-center transition-all ${
                  section.visible ? 'bg-white border-slate-200/80' : 'bg-white/40 border-slate-200/80 opacity-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                    <div>
                      <span className="font-semibold text-xs text-slate-800 block">{section.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">ID: {section.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSectionVisible(idx)}
                      className={`p-2 rounded border text-xs flex items-center gap-1.5 transition-all ${
                        section.visible 
                          ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                          : 'bg-red-500/10 border-red-500/25 text-red-400'
                      }`}
                    >
                      {section.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span className="text-[9px] uppercase tracking-widest font-extrabold">{section.visible ? 'VISIBLE' : 'HIDDEN'}</span>
                    </button>
                    
                    <button
                      onClick={() => moveSection(idx, 'up')}
                      disabled={idx === 0}
                      className="p-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 rounded disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <MoveUp size={12} />
                    </button>
                    <button
                      onClick={() => moveSection(idx, 'down')}
                      disabled={idx === sectionsList.length - 1}
                      className="p-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 rounded disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <MoveDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveSectionsLayout}
              disabled={saveLoading}
              className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded transition-colors disabled:opacity-50"
            >
              Save Section Layout
            </button>
          </div>
        )}

        {/* Tab 3: Metrics (Hero & Trust) */}
        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Col: Hero metrics */}
            <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] flex items-center gap-1.5">
                  <Activity size={16} />
                  <span>Hero Analytics Indicators</span>
                </h3>
                <button
                  onClick={() => {
                    setMetricType('hero');
                    setEditingMetric({ title: '', value: '', suffix: '', icon: 'Activity', displayOrder: heroMetrics.length + 1, visible: true });
                  }}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 rounded"
                >
                  <Plus size={12} />
                  <span>Add Metric</span>
                </button>
              </div>

              <div className="space-y-3">
                {heroMetrics.map((m) => (
                  <div key={m.id} className="p-3.5 bg-white border border-slate-200/80 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800">{m.title}</span>
                        {!m.visible && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] uppercase font-bold rounded">HIDDEN</span>}
                      </div>
                      <span className="text-lg font-light text-[#0B4C8C] mt-1 block">{m.value}{m.suffix}</span>
                      <span className="text-[9px] text-slate-400">Display order: #{m.displayOrder} • Icon: {m.icon}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMetricType('hero');
                          setEditingMetric(m);
                        }}
                        className="p-2 bg-blue-500/10 border border-blue-500/25 text-blue-400 rounded hover:bg-blue-500/25"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteMetric(m.id, 'hero')}
                        className="p-2 bg-red-500/10 border border-red-500/25 text-red-400 rounded hover:bg-red-500/25"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Trust Metrics */}
            <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] flex items-center gap-1.5">
                  <Award size={16} />
                  <span>Trust Badge Counters</span>
                </h3>
                <button
                  onClick={() => {
                    setMetricType('trust');
                    setEditingMetric({ title: '', value: '', suffix: '', icon: 'CheckCircle', displayOrder: trustMetrics.length + 1, visible: true });
                  }}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 rounded"
                >
                  <Plus size={12} />
                  <span>Add Counter</span>
                </button>
              </div>

              <div className="space-y-3">
                {trustMetrics.map((m) => (
                  <div key={m.id} className="p-3.5 bg-white border border-slate-200/80 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800">{m.title}</span>
                        {!m.visible && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] uppercase font-bold rounded">HIDDEN</span>}
                      </div>
                      <span className="text-lg font-light text-green-400 mt-1 block">{m.value}{m.suffix}</span>
                      <span className="text-[9px] text-slate-400">Display order: #{m.displayOrder} • Icon: {m.icon}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMetricType('trust');
                          setEditingMetric(m);
                        }}
                        className="p-2 bg-blue-500/10 border border-blue-500/25 text-blue-400 rounded hover:bg-blue-500/25"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteMetric(m.id, 'trust')}
                        className="p-2 bg-red-500/10 border border-red-500/25 text-red-400 rounded hover:bg-red-500/25"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Editable Form Modal (Conditional Overlay) */}
            {editingMetric && (
              <div className="fixed inset-0 bg-slate-50/80 flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 p-6 rounded-xl w-full max-w-md space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">
                    {editingMetric.id ? 'Edit' : 'Create'} {metricType === 'hero' ? 'Hero Metric' : 'Trust Counter'}
                  </h3>
                  <form onSubmit={handleSaveMetric} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Metric Label Title</label>
                      <input
                        type="text"
                        required
                        value={editingMetric.title || ''}
                        onChange={(e) => setEditingMetric({ ...editingMetric, title: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Number value</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 1200 or 98"
                          value={editingMetric.value || ''}
                          onChange={(e) => setEditingMetric({ ...editingMetric, value: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Unit suffix</label>
                        <input
                          type="text"
                          placeholder="e.g. + or %"
                          value={editingMetric.suffix || ''}
                          onChange={(e) => setEditingMetric({ ...editingMetric, suffix: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Lucide Icon name</label>
                        <input
                          type="text"
                          value={editingMetric.icon || ''}
                          onChange={(e) => setEditingMetric({ ...editingMetric, icon: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Display Order</label>
                        <input
                          type="number"
                          value={editingMetric.displayOrder || 0}
                          onChange={(e) => setEditingMetric({ ...editingMetric, displayOrder: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Visibility Mode</label>
                      <select
                        value={String(editingMetric.visible)}
                        onChange={(e) => setEditingMetric({ ...editingMetric, visible: e.target.value === 'true' })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                      >
                        <option value="true">Visible</option>
                        <option value="false">Hidden</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setEditingMetric(null)}
                        className="px-4 py-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Save Metric
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Localities Scorecards */}
        {activeTab === 'localities' && (
          <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] flex items-center gap-1.5">
                <MapPin size={16} />
                <span>Locality Intelligence pricing scorecards</span>
              </h3>
              <button
                onClick={() => {
                  setEditingLocality({ areaName: '', growthScore: 80, demandScore: 80, connectivityScore: 80, investmentRating: 'A', displayOrder: localities.length + 1, visible: true });
                }}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 rounded"
              >
                <Plus size={12} />
                <span>Add Scorecard</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {localities.map((loc) => (
                <div key={loc.id} className="p-4 bg-white border border-slate-200/80 rounded-lg space-y-4 hover:border-[#0B4C8C]/25 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-slate-800 text-sm">{loc.areaName}</span>
                      {!loc.visible && <span className="ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] uppercase font-bold rounded">HIDDEN</span>}
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold uppercase tracking-widest rounded-full">
                      Rating {loc.investmentRating}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-[#121212] border border-slate-200/80 rounded">
                      <span className="text-[8px] text-slate-500 uppercase block">Growth</span>
                      <span className="text-sm font-semibold text-slate-800 mt-1 block">{loc.growthScore}/100</span>
                    </div>
                    <div className="p-2 bg-[#121212] border border-slate-200/80 rounded">
                      <span className="text-[8px] text-slate-500 uppercase block">Demand</span>
                      <span className="text-sm font-semibold text-slate-800 mt-1 block">{loc.demandScore}/100</span>
                    </div>
                    <div className="p-2 bg-[#121212] border border-slate-200/80 rounded">
                      <span className="text-[8px] text-slate-500 uppercase block">Connect</span>
                      <span className="text-sm font-semibold text-slate-800 mt-1 block">{loc.connectivityScore}/100</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200/80 pt-3 mt-1">
                    <span>Order: #{loc.displayOrder}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingLocality(loc)}
                        className="p-1.5 bg-blue-500/10 border border-blue-500/25 text-blue-400 rounded hover:bg-blue-500/25"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocality(loc.id)}
                        className="p-1.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded hover:bg-red-500/25"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Editing Locality Modal */}
            {editingLocality && (
              <div className="fixed inset-0 bg-slate-50/80 flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 p-6 rounded-xl w-full max-w-md space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">
                    {editingLocality.id ? 'Edit' : 'Create'} Locality Scorecard
                  </h3>
                  <form onSubmit={handleSaveLocality} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Locality Area Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Gomti Nagar Extension"
                        value={editingLocality.areaName || ''}
                        onChange={(e) => setEditingLocality({ ...editingLocality, areaName: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Growth (0-100)</label>
                        <input
                          type="number"
                          required
                          value={editingLocality.growthScore || 0}
                          onChange={(e) => setEditingLocality({ ...editingLocality, growthScore: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Demand (0-100)</label>
                        <input
                          type="number"
                          required
                          value={editingLocality.demandScore || 0}
                          onChange={(e) => setEditingLocality({ ...editingLocality, demandScore: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Connectivity (0-100)</label>
                        <input
                          type="number"
                          required
                          value={editingLocality.connectivityScore || 0}
                          onChange={(e) => setEditingLocality({ ...editingLocality, connectivityScore: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Investment Rating</label>
                        <select
                          value={editingLocality.investmentRating || 'A'}
                          onChange={(e) => setEditingLocality({ ...editingLocality, investmentRating: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        >
                          <option value="A+">A+</option>
                          <option value="A">A</option>
                          <option value="B+">B+</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Display Order</label>
                        <input
                          type="number"
                          value={editingLocality.displayOrder || 0}
                          onChange={(e) => setEditingLocality({ ...editingLocality, displayOrder: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Visibility Mode</label>
                      <select
                        value={String(editingLocality.visible)}
                        onChange={(e) => setEditingLocality({ ...editingLocality, visible: e.target.value === 'true' })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                      >
                        <option value="true">Visible</option>
                        <option value="false">Hidden</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setEditingLocality(null)}
                        className="px-4 py-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Save Locality
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Verified Testimonials */}
        {activeTab === 'testimonials' && (
          <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] flex items-center gap-1.5">
                <MessageSquare size={16} />
                <span>Verified Buyer Reviews & Testimonials</span>
              </h3>
              <button
                onClick={() => {
                  setEditingTestimonial({ name: '', location: '', propertyType: 'Plot', review: '', rating: 5, photo: '', displayOrder: testimonials.length + 1, visible: true, featured: false });
                }}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 rounded"
              >
                <Plus size={12} />
                <span>Add Testimonial</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testimonials.map((t) => (
                <div key={t.id} className="p-5 bg-white border border-slate-200/80 rounded-lg space-y-3 relative hover:border-[#0B4C8C]/25 transition-all">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center text-[#0B4C8C] font-semibold text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800 block">{t.name}</span>
                        {t.featured && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[8px] uppercase font-bold rounded">Featured</span>}
                        {!t.visible && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] uppercase font-bold rounded">HIDDEN</span>}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{t.location} • Purchased {t.propertyType}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 italic leading-relaxed">"{t.review}"</p>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-200/80 pt-3 mt-2">
                    <span>Rating: {t.rating}/5 stars • Order: #{t.displayOrder}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingTestimonial(t)}
                        className="p-1.5 bg-blue-500/10 border border-blue-500/25 text-blue-400 rounded hover:bg-blue-500/25"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="p-1.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded hover:bg-red-500/25"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Editing Testimonial Modal */}
            {editingTestimonial && (
              <div className="fixed inset-0 bg-slate-50/80 flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 p-6 rounded-xl w-full max-w-lg space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">
                    {editingTestimonial.id ? 'Edit' : 'Create'} Buyer Testimonial
                  </h3>
                  <form onSubmit={handleSaveTestimonial} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Client Name</label>
                        <input
                          type="text"
                          required
                          value={editingTestimonial.name || ''}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Client Location</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Indira Nagar, Lucknow"
                          value={editingTestimonial.location || ''}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, location: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Property Type Purchased</label>
                        <input
                          type="text"
                          value={editingTestimonial.propertyType || 'Plot'}
                          placeholder="e.g. 1000 Sq Ft Plot"
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, propertyType: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Rating (1-5)</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={editingTestimonial.rating || 5}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, rating: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Display Order</label>
                        <input
                          type="number"
                          value={editingTestimonial.displayOrder || 0}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, displayOrder: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Testimonial Review Text</label>
                      <textarea
                        required
                        rows={4}
                        value={editingTestimonial.review || ''}
                        onChange={(e) => setEditingTestimonial({ ...editingTestimonial, review: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Featured Review</label>
                        <select
                          value={String(editingTestimonial.featured)}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, featured: e.target.value === 'true' })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                        >
                          <option value="false">Standard Review</option>
                          <option value="true">Featured Review</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Visibility Mode</label>
                        <select
                          value={String(editingTestimonial.visible)}
                          onChange={(e) => setEditingTestimonial({ ...editingTestimonial, visible: e.target.value === 'true' })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                        >
                          <option value="true">Visible</option>
                          <option value="false">Hidden</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setEditingTestimonial(null)}
                        className="px-4 py-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Save Testimonial
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Research Journal */}
        {activeTab === 'research' && (
          <div className="bg-white border border-slate-200/80 p-6 bg-white border border-slate-200/80 rounded-[24px] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] flex items-center gap-1.5">
                <BookOpen size={16} />
                <span>Prop-Tech Research Journal & News Articles</span>
              </h3>
              <button
                onClick={() => {
                  setEditingArticle({ title: '', slug: '', content: '', thumbnail: '', author: 'Aura Research Team', status: 'DRAFT' });
                }}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 rounded"
              >
                <Plus size={12} />
                <span>Create Article</span>
              </button>
            </div>

            <div className="space-y-4">
              {articles.map((art) => (
                <div key={art.id} className="p-4 bg-white border border-slate-200/80 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#0B4C8C]/25 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800">{art.title}</span>
                      <span className={`px-1.5 py-0.5 text-[8px] font-extrabold tracking-widest uppercase border rounded ${
                        art.status === 'PUBLISHED' ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                      }`}>
                        {art.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Slug: <code className="text-slate-400 bg-slate-50 px-1 rounded">{art.slug}</code> • Author: {art.author} • Published: {new Date(art.publishedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingArticle(art)}
                      className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[10px] uppercase font-bold tracking-widest rounded hover:bg-blue-500/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(art.id)}
                      className="p-1.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded hover:bg-red-500/20"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Editing/Creating Article Modal */}
            {editingArticle && (
              <div className="fixed inset-0 bg-slate-50/80 flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-slate-200 p-6 rounded-xl w-full max-w-2xl space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#0B4C8C] border-b border-slate-200/80 pb-2">
                    {editingArticle.id ? 'Edit' : 'Write'} Intelligence Article
                  </h3>
                  <form onSubmit={handleSaveArticle} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Article Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Lucknow Plot Buying Guide: gomti nagar pricing analysis"
                        value={editingArticle.title || ''}
                        onChange={(e) => {
                          const title = e.target.value;
                          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                          setEditingArticle({ ...editingArticle, title, slug });
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Url Slug</label>
                        <input
                          type="text"
                          required
                          value={editingArticle.slug || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Author attribution</label>
                        <input
                          type="text"
                          value={editingArticle.author || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Thumbnail image url</label>
                        <input
                          type="text"
                          value={editingArticle.thumbnail || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, thumbnail: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Publication Status</label>
                        <select
                          value={editingArticle.status || 'DRAFT'}
                          onChange={(e) => setEditingArticle({ ...editingArticle, status: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20"
                        >
                          <option value="DRAFT">Draft Mode</option>
                          <option value="PUBLISHED">Published Live</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-slate-650 block font-bold">Article Content (Markdown/HTML supported)</label>
                      <textarea
                        required
                        rows={8}
                        value={editingArticle.content || ''}
                        onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                        className="w-full bg-white font-mono border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 focus:outline-none focus:ring-2 focus:ring-[#0B4C8C]/20"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setEditingArticle(null)}
                        className="px-4 py-2 border border-slate-200/80 bg-[#1C1C1C] hover:bg-slate-100 text-slate-800 text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#0B4C8C] hover:bg-[#093d70] text-white text-[10px] uppercase font-bold tracking-widest rounded"
                      >
                        Save Article
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
