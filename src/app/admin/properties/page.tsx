'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Building,
  Plus,
  Search,
  Trash2,
  Edit,
  Sparkles,
  Upload,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  Copy,
  History,
  Video,
  FileCheck,
  Globe,
  Settings,
  X,
  Eye,
  Compass,
  Navigation,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Dynamically import Leaflet components with SSR disabled to prevent window-undefined errors
const PropertyEditMap = dynamic(() => import('@/components/property-edit-map'), { ssr: false });
const PropertyViewMap = dynamic(() => import('@/components/property-view-map'), { ssr: false });
import { formatIndianRealEstatePrice } from '@/lib/currency';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [featuredFilter, setFeaturedFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [selectedPropertyDetails, setSelectedPropertyDetails] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Property fields state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Apartment');
  const [category, setCategory] = useState('Buy');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('2');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState('Sq Ft');
  const [floor, setFloor] = useState('1');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [boundary, setBoundary] = useState<string | null>(null);
  const [boundaryZones, setBoundaryZones] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);
  
  // New fields for Wave 1
  const [status, setStatus] = useState('DRAFT');
  const [videoUrl, setVideoUrl] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [virtualTourUrl, setVirtualTourUrl] = useState('');

  // Wave 8B Template states
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<any>({});

  // Amenities checklist
  const availableAmenities = ['Parking', 'Swimming Pool', 'Security', 'Power Backup', 'Garden', 'Gym', 'Wine Cellar', 'Spa', 'Private Dock'];
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Images state
  const [imagesList, setImagesList] = useState<any[]>([]); // { publicId, url, order, isCover }

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/cms/templates');
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchTemplates();
  }, []);

  // Auto-select template based on property type on creation/opening
  useEffect(() => {
    if (showForm && !editingId && !templateId && templates.length > 0) {
      if (type === 'Apartment') {
        const t = templates.find(temp => temp.type === 'APARTMENT');
        if (t) setTemplateId(t.id);
      } else if (type === 'Villa' || type === 'Duplex' || type === 'Penthouse') {
        const t = templates.find(temp => temp.type === 'RESIDENCY');
        if (t) setTemplateId(t.id);
      } else if (type === 'Plot' || type === 'Lot') {
        const t = templates.find(temp => temp.type === 'PLOT');
        if (t) setTemplateId(t.id);
      } else if (type === 'Commercial') {
        const t = templates.find(temp => temp.type === 'COMMERCIAL');
        if (t) setTemplateId(t.id);
      }
    }
  }, [showForm, editingId, templateId, type, templates]);

  // Open Form for Adding
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setType('Apartment');
    setCategory('Buy');
    setPrice('');
    setBedrooms('3');
    setBathrooms('2');
    setArea('');
    setAreaUnit('Sq Ft');
    setFloor('1');
    setAddress('');
    setCity('');
    setState('');
    setCountry('');
    setPostalCode('');
    setLatitude(null);
    setLongitude(null);
    setBoundary(null);
    setBoundaryZones(null);
    setFeatured(false);
    setStatus('DRAFT');
    setVideoUrl('');
    setBrochureUrl('');
    setVirtualTourUrl('');
    setSelectedAmenities([]);
    setImagesList([]);
    const t = templates.find(temp => temp.type === 'APARTMENT');
    setTemplateId(t ? t.id : null);
    setTemplateFields({});
    setShowForm(true);
  };

  // Open Form for Editing
  const handleOpenEdit = (prop: any) => {
    setEditingId(prop.id);
    setName(prop.name);
    setDescription(prop.description || '');
    setType(prop.type || 'Apartment');
    setCategory(prop.category || 'Buy');
    setPrice(prop.price.toString());
    setBedrooms(prop.bedrooms.toString());
    setBathrooms((prop.bathrooms || 1).toString());
    setArea(prop.area.toString());
    setAreaUnit(prop.areaUnit || 'Sq Ft');
    setFloor(prop.floor.toString());
    setAddress(prop.address || '');
    setCity(prop.city || '');
    setState(prop.state || '');
    
    // Try to extract country and postal code from location text
    let initialCountry = '';
    let initialPostalCode = '';
    if (prop.location) {
      const parts = prop.location.split(',').map((p: any) => p.trim());
      if (parts.length >= 5) {
        initialCountry = parts[parts.length - 1];
        initialPostalCode = parts[parts.length - 2];
      } else if (parts.length === 4) {
        const last = parts[3];
        if (/\d+/.test(last)) {
          initialPostalCode = last;
        } else {
          initialCountry = last;
        }
      }
    }
    setCountry(initialCountry);
    setPostalCode(initialPostalCode);
    setLatitude(prop.latitude);
    setLongitude(prop.longitude);
    setBoundary(prop.boundary);
    setBoundaryZones(prop.boundaryZones ? JSON.stringify(prop.boundaryZones) : null);
    setFeatured(prop.featured || false);
    setStatus(prop.status || 'DRAFT');
    setVideoUrl(prop.videoUrl || '');
    setBrochureUrl(prop.brochureUrl || '');
    setVirtualTourUrl(prop.virtualTourUrl || '');
    setSelectedAmenities(prop.amenities || []);
    setTemplateId(prop.templateId || null);
    setTemplateFields(prop.templateFields || {});

    // Load related images
    if (prop.imagesRelation) {
      setImagesList(prop.imagesRelation.map((img: any) => ({
        publicId: img.publicId,
        url: img.url,
        order: img.order,
        isCover: img.isCover
      })).sort((a: any, b: any) => a.order - b.order));
    } else {
      setImagesList([]);
    }

    setShowForm(true);
  };

  // Cloudinary image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadLoading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/admin/cloudinary', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setImagesList((prev) => {
            const nextOrder = prev.length;
            const isFirst = nextOrder === 0;
            return [
              ...prev,
              {
                publicId: data.publicId,
                url: data.url,
                order: nextOrder,
                isCover: isFirst,
              },
            ];
          });
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    }

    setUploadLoading(false);
  };

  // Media (Video / Brochure) upload handler
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'video' | 'brochure') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/cloudinary', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (target === 'video') setVideoUrl(data.url);
        if (target === 'brochure') setBrochureUrl(data.url);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to upload media.');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete image
  const handleDeleteImage = async (index: number, publicId: string) => {
    try {
      await fetch(`/api/admin/cloudinary?publicId=${encodeURIComponent(publicId)}`, {
        method: 'DELETE',
      });

      setImagesList((prev) => {
        const next = prev.filter((_, i) => i !== index);
        return next.map((img, idx) => ({
          ...img,
          order: idx,
          isCover: img.isCover && next.some(x => x.isCover) ? img.isCover : idx === 0 ? true : false,
        }));
      });
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  // Reordering images
  const moveImage = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= imagesList.length) return;

    setImagesList((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[nextIndex];
      updated[nextIndex] = temp;
      return updated.map((img, idx) => ({ ...img, order: idx }));
    });
  };

  // Set cover image
  const handleSetCover = (index: number) => {
    setImagesList((prev) =>
      prev.map((img, idx) => ({
        ...img,
        isCover: idx === index,
      }))
    );
  };

  // Submit create or edit form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    const locationText = `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${postalCode ? `, ${postalCode}` : ''}${country ? `, ${country}` : ''}`;

    const payload = {
      id: editingId,
      name,
      description,
      type,
      category,
      price: parseFloat(price),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      area: parseFloat(area),
      areaUnit,
      floor: parseInt(floor),
      location: locationText,
      address,
      city,
      state,
      latitude,
      longitude,
      boundary,
      boundaryZones: boundaryZones ? JSON.parse(boundaryZones) : null,
      amenities: selectedAmenities,
      featured,
      imagesList,
      status,
      videoUrl,
      brochureUrl,
      virtualTourUrl,
      templateId,
      templateFields
    };

    try {
      const endpoint = '/api/admin/properties';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        fetchProperties();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit property form.');
      }
    } catch (err) {
      console.error(err);
      alert('A network error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete property
  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property and all its uploaded images?')) return;
    try {
      const res = await fetch(`/api/admin/properties?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchProperties();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete property.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle quick parameters
  const handleQuickUpdate = async (id: string, updates: any) => {
    const property = properties.find(p => p.id === id);
    if (!property) return;

    const payload = {
      ...property,
      ...updates,
      imagesList: property.imagesRelation || [],
    };

    try {
      const res = await fetch('/api/admin/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchProperties();
      }
    } catch (err) {
      console.error('Failed to quick update:', err);
    }
  };

  // Duplicate Action
  const handleDuplicate = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/properties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', ids: [id] })
      });
      if (res.ok) {
        fetchProperties();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to duplicate property.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Operations
  const handleBulkAction = async (action: 'publish' | 'archive' | 'feature' | 'unfeature' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Are you sure you want to delete the ${selectedIds.length} selected properties?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/properties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Bulk operation completed.\nSuccessfully modified: ${data.successCount}\nFailures: ${data.failedCount}`);
        setSelectedIds([]);
        fetchProperties();
      } else {
        const err = await res.json();
        alert(err.error || 'Bulk operation failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Network failure processing bulk operation.');
    } finally {
      setLoading(false);
    }
  };

  // Checkbox Selection Helpers
  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = (filteredList: any[]) => {
    const allFilteredIds = filteredList.map(p => p.id);
    const areAllSelected = allFilteredIds.every(id => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };

  // Filter listings
  const filteredProperties = properties.filter((prop) => {
    const matchesSearch = prop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = prop.city.toLowerCase().includes(searchCity.toLowerCase());
    const matchesType = propertyTypeFilter === 'ALL' || prop.type === propertyTypeFilter;
    const matchesAvailability = availabilityFilter === 'ALL' || prop.availability === availabilityFilter;
    const matchesFeatured = featuredFilter === 'ALL' || (featuredFilter === 'FEATURED' ? prop.featured : !prop.featured);
    const matchesStatus = statusFilter === 'ALL' || prop.status === statusFilter;

    return matchesSearch && matchesCity && matchesType && matchesAvailability && matchesFeatured && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#0B4C8C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-mono">Loading Residences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#0B4C8C] font-extrabold">Properties Management</span>
          <h1 className="text-3xl font-light tracking-tight mt-1 text-slate-900">Manage Residences</h1>
          <p className="text-xs text-slate-500 mt-1">Create, edit, feature, and delete property portfolios.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#0B4C8C] text-white text-xs uppercase tracking-widest font-extrabold rounded-lg hover:bg-[#0B4C8C]/90 flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Plus size={16} />
            <span>Add Property</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm ? (
          /* Create / Edit Form View */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-[24px] shadow-sm space-y-8"
          >
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-[#0B4C8C]" />
                <span>{editingId ? 'Modify Residence' : 'Publish New Residence'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-650 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-8">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2 md:col-span-4">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Title / Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 transition-colors h-12"
                      placeholder="The Amberwood Estate"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Type</label>
                    <select
                      value={type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setType(newType);
                        // Auto-select template matching standard types
                        if (newType === 'Apartment') {
                          const t = templates.find(temp => temp.type === 'APARTMENT');
                          if (t) {
                            setTemplateId(t.id);
                            setTemplateFields({});
                          }
                        } else if (newType === 'Villa' || newType === 'Duplex' || newType === 'Penthouse') {
                          const t = templates.find(temp => temp.type === 'RESIDENCY');
                          if (t) {
                            setTemplateId(t.id);
                            setTemplateFields({});
                          }
                        } else if (newType === 'Plot' || newType === 'Lot') {
                          const t = templates.find(temp => temp.type === 'PLOT');
                          if (t) {
                            setTemplateId(t.id);
                            setTemplateFields({});
                          }
                        } else if (newType === 'Commercial') {
                          const t = templates.find(temp => temp.type === 'COMMERCIAL');
                          if (t) {
                            setTemplateId(t.id);
                            setTemplateFields({});
                          }
                        } else {
                          setTemplateId(null);
                          setTemplateFields({});
                        }
                      }}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-800 text-sm outline-none focus:border-[#0B4C8C] h-12"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Duplex">Duplex</option>
                      <option value="Plot">Plot</option>
                      <option value="Lot">Estate Lot</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-800 text-sm outline-none focus:border-[#0B4C8C] h-12"
                    >
                      <option value="Buy">For Sale</option>
                      <option value="Rent">For Lease</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Listing Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-800 text-sm outline-none focus:border-[#0B4C8C] h-12"
                    >
                      <option value="DRAFT">Draft Mode</option>
                      <option value="PUBLISHED">Published / Active</option>
                      <option value="ARCHIVED">Archived / Hidden</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Template Schema</label>
                    <select
                      value={templateId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplateId(val || null);
                        setTemplateFields({});
                      }}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-800 text-sm outline-none focus:border-[#0B4C8C] h-12"
                    >
                      <option value="">No Schema / Custom Fields</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} (Code: {t.type})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 transition-colors resize-none leading-relaxed"
                    placeholder="Provide property details, locality intelligence and specifications..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 transition-colors h-12"
                      placeholder="5000000"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="w-5 h-5 accent-[#0B4C8C] bg-white border-slate-200 rounded cursor-pointer"
                    />
                    <label htmlFor="featured" className="text-xs text-slate-600 cursor-pointer select-none font-semibold">Mark this property as Featured Portfolio Item</label>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Specifications</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Area</label>
                    <input
                      type="number"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] h-12"
                      placeholder="5400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Area Unit</label>
                    <select
                      value={areaUnit}
                      onChange={(e) => setAreaUnit(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-800 text-sm outline-none focus:border-[#0B4C8C] h-12"
                    >
                      <option value="Sq Ft">Sq Ft</option>
                      <option value="Sq Yard">Sq Yard</option>
                      <option value="Acre">Acre</option>
                      <option value="Hectare">Hectare</option>
                      <option value="Bigha">Bigha</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Bedrooms</label>
                    <input
                      type="number"
                      required
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] h-12"
                      placeholder="4"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Bathrooms</label>
                    <input
                      type="number"
                      required
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] h-12"
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Floor level</label>
                    <input
                      type="number"
                      required
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C] h-12"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Template Fields */}
              {templateId && (
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Dynamic Template Attributes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    {(() => {
                      const selectedT = templates.find(t => t.id === templateId);
                      if (!selectedT || !selectedT.fields || selectedT.fields.length === 0) {
                        return <p className="text-xs text-slate-400 col-span-2 italic">This template has no attributes configured.</p>;
                      }
                      return selectedT.fields.map((field: any) => {
                        const val = templateFields[field.name] !== undefined ? templateFields[field.name] : '';
                        
                        const handleFieldChange = (newValue: any) => {
                          setTemplateFields((prev: any) => ({
                            ...prev,
                            [field.name]: newValue
                          }));
                        };

                        return (
                          <div key={field.name} className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            {field.type === 'checkbox' ? (
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val)}
                                  onChange={(e) => handleFieldChange(e.target.checked)}
                                  className="w-4 h-4 accent-[#0B4C8C] bg-white border-slate-200 rounded cursor-pointer"
                                />
                                <span className="text-xs text-slate-600 font-semibold">Yes / Enabled</span>
                              </div>
                            ) : field.type === 'dropdown' ? (
                              <select
                                value={val}
                                required={field.required}
                                onChange={(e) => handleFieldChange(e.target.value)}
                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs outline-none focus:border-[#0B4C8C]"
                              >
                                <option value="">-- Choose Option --</option>
                                {(field.options || []).map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'multiselect' ? (
                              <div className="flex flex-wrap gap-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                                {(field.options || []).map((opt: string) => {
                                  const list = Array.isArray(val) ? val : [];
                                  const checked = list.includes(opt);
                                  const handleToggle = () => {
                                    const next = checked ? list.filter((x: any) => x !== opt) : [...list, opt];
                                    handleFieldChange(next);
                                  };
                                  return (
                                    <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 font-semibold select-none">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={handleToggle}
                                        className="w-3.5 h-3.5 accent-[#0B4C8C]"
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                value={val}
                                required={field.required}
                                onChange={(e) => handleFieldChange(e.target.value)}
                                rows={3}
                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none focus:border-[#0B4C8C] resize-none"
                              />
                            ) : field.type === 'date' ? (
                              <input
                                type="date"
                                value={val}
                                required={field.required}
                                onChange={(e) => handleFieldChange(e.target.value)}
                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none focus:border-[#0B4C8C]"
                              />
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={val}
                                required={field.required}
                                onChange={(e) => handleFieldChange(field.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
                                className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none focus:border-[#0B4C8C]"
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Media Enhancements */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Media Enhancements</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  
                  {/* Video URL & Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Showcase Video</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none"
                        placeholder="Video stream URL (or upload below)"
                      />
                      <div className="relative shrink-0">
                        <input
                           type="file"
                           accept="video/*"
                           onChange={(e) => handleMediaUpload(e, 'video')}
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           disabled={uploadLoading}
                        />
                        <button type="button" className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-250 text-[#0B4C8C] rounded-lg text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider shadow-xs">
                          <Video size={14} className="text-[#0B4C8C]" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Brochure URL & Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Brochure PDF</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={brochureUrl}
                        onChange={(e) => setBrochureUrl(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none"
                        placeholder="Brochure PDF URL (or upload below)"
                      />
                      <div className="relative shrink-0">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => handleMediaUpload(e, 'brochure')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploadLoading}
                        />
                        <button type="button" className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-250 text-[#0B4C8C] rounded-lg text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider shadow-xs">
                          <FileCheck size={14} className="text-[#0B4C8C]" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Virtual Tour URL */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">3D Virtual Tour Embed URL</label>
                    <input
                      type="text"
                      value={virtualTourUrl}
                      onChange={(e) => setVirtualTourUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs outline-none focus:border-[#0B4C8C]"
                      placeholder="e.g. Matterport or 3D viewer frame address"
                    />
                  </div>

                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Amenities</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {availableAmenities.map((amenity) => {
                    const isChecked = selectedAmenities.includes(amenity);
                    return (
                      <div key={amenity} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`amenity-${amenity}`}
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAmenities(prev => prev.filter(x => x !== amenity));
                            } else {
                              setSelectedAmenities(prev => [...prev, amenity]);
                            }
                          }}
                          className="w-4 h-4 accent-[#0B4C8C] bg-white border-slate-200 rounded cursor-pointer"
                        />
                        <label htmlFor={`amenity-${amenity}`} className="text-xs text-slate-700 cursor-pointer select-none font-semibold">{amenity}</label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Location & Map */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Location & OpenStreetMap</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Address</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C]"
                      placeholder="1428 Elm St"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C]"
                      placeholder="Beverly Hills"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C]"
                      placeholder="CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Country</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C]"
                      placeholder="United States"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Postal Code</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 text-sm outline-none focus:border-[#0B4C8C]"
                      placeholder="90210"
                    />
                  </div>
                </div>

                {/* Leaflet Editor Component */}
                <div className="pt-2">
                  <PropertyEditMap
                    latitude={latitude}
                    longitude={longitude}
                    boundary={boundary}
                    boundaryZones={boundaryZones}
                    onChangeLocation={(lat, lng) => {
                      setLatitude(parseFloat(lat.toFixed(6)));
                      setLongitude(parseFloat(lng.toFixed(6)));
                    }}
                    onChangeBoundary={setBoundary}
                    onChangeBoundaryZones={setBoundaryZones}
                    onChangeAddress={setAddress}
                    onChangeCity={setCity}
                    onChangeState={setState}
                    onChangeCountry={setCountry}
                    onChangePostalCode={setPostalCode}
                  />
                </div>
              </div>

              {/* Image Management */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#0B4C8C] border-l-2 border-[#0B4C8C] pl-2">Portfolio Images (Cloudinary)</h4>
                
                <div className="border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center rounded-xl hover:border-[#0B4C8C] transition-colors relative cursor-pointer shadow-2xs">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadLoading}
                  />
                  <div className="space-y-2">
                    <Upload className="mx-auto text-slate-400" size={32} />
                    <span className="text-sm font-semibold text-slate-700 block">
                      {uploadLoading ? 'Uploading to secure servers...' : 'Click or Drag images to upload'}
                    </span>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Supports JPG, PNG, WEBP (Max 5MB)</span>
                  </div>
                </div>

                {imagesList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {imagesList.map((img, idx) => (
                      <div key={img.publicId} className={`bg-slate-50 border rounded-xl overflow-hidden p-3 relative flex items-center gap-3 transition-colors ${
                        img.isCover ? 'border-emerald-350 bg-emerald-50 text-emerald-700 shadow-xs' : 'border-slate-200 hover:border-slate-350'
                      }`}>
                        <div className="w-14 h-14 bg-slate-200/50 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                          <img src={img.url} alt="Uploaded preview" className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Order: {img.order + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleSetCover(idx)}
                            className={`text-[10px] uppercase font-extrabold tracking-widest block transition-colors ${
                              img.isCover ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-650'
                            }`}
                          >
                            {img.isCover ? '★ Cover Residence' : '☆ Set as Cover'}
                          </button>
                        </div>

                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveImage(idx, 'up')}
                            className="p-1 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-slate-700 bg-white rounded-md disabled:opacity-30 shadow-3xs"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === imagesList.length - 1}
                            onClick={() => moveImage(idx, 'down')}
                            className="p-1 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-slate-700 bg-white rounded-md disabled:opacity-30 shadow-3xs"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteImage(idx, img.publicId)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-red-650 p-1 rounded-full bg-white/80 hover:bg-white border border-slate-200 shadow-3xs"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-6 border-t border-slate-100 flex gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3.5 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  {formLoading ? 'Submitting Portfolio...' : editingId ? 'Update Listing Details' : 'Publish Listing'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* Table Portfolio Management List */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Search Filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-[24px] border border-slate-200/80 items-center shadow-sm">
              <div className="relative md:col-span-3">
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 p-2.5 pl-9 rounded-lg text-slate-800 text-xs outline-none transition-all h-10"
                />
                <Search className="absolute left-3 top-3 text-slate-400" size={14} />
              </div>

              <div className="relative md:col-span-2">
                <input
                  type="text"
                  placeholder="Search by city..."
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-[#0B4C8C] focus:ring-[#0B4C8C]/20 p-2.5 pl-9 rounded-lg text-slate-800 text-xs outline-none transition-all h-10"
                />
                <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:col-span-7">
                <select
                  value={propertyTypeFilter}
                  onChange={(e) => setPropertyTypeFilter(e.target.value)}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-all text-center h-10 appearance-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="Apartment">Apartments</option>
                  <option value="Villa">Villas</option>
                  <option value="Penthouse">Penthouses</option>
                  <option value="Duplex">Duplexes</option>
                  <option value="Plot">Plots</option>
                  <option value="Lot">Estate Lots</option>
                  <option value="Commercial">Commercial</option>
                </select>

                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-all text-center h-10 appearance-none"
                >
                  <option value="ALL">All Avail.</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="SOLD">Sold</option>
                </select>

                <select
                  value={featuredFilter}
                  onChange={(e) => setFeaturedFilter(e.target.value)}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-all text-center h-10 appearance-none"
                >
                  <option value="ALL">All List</option>
                  <option value="FEATURED">Featured</option>
                  <option value="REGULAR">Regular</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-slate-700 text-[11px] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-all text-center h-10 appearance-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="DRAFT">Drafts</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Settings className="text-[#0B4C8C]" size={16} />
                  <span className="text-xs text-[#0B4C8C] font-semibold">
                    <strong>{selectedIds.length}</strong> listings selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => handleBulkAction('publish')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-[#0B4C8C] text-[10px] font-extrabold uppercase tracking-wider rounded-md shadow-3xs transition-all"
                  >
                    Bulk Publish
                  </button>
                  <button
                    onClick={() => handleBulkAction('archive')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-amber-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md shadow-3xs transition-all"
                  >
                    Bulk Archive
                  </button>
                  <button
                    onClick={() => handleBulkAction('feature')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-cyan-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md shadow-3xs transition-all"
                  >
                    Bulk Feature
                  </button>
                  <button
                    onClick={() => handleBulkAction('unfeature')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-650 text-[10px] font-extrabold uppercase tracking-wider rounded-md shadow-3xs transition-all"
                  >
                    Bulk Unfeature
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md shadow-3xs transition-all"
                  >
                    Bulk Delete
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-[10px] uppercase font-extrabold"
                  >
                    Clear Selection
                  </button>
                </div>
              </motion.div>
            )}

            {/* List Table */}
            {filteredProperties.length === 0 ? (
              <div className="bg-white border border-slate-200/80 p-12 text-center rounded-[24px] shadow-sm">
                <p className="text-sm text-slate-500 font-semibold">No properties found in list matching criteria.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200/85 font-extrabold">
                      <tr>
                        <th className="p-4 sm:p-6 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedIds.includes(p.id))}
                            onChange={() => handleSelectAllToggle(filteredProperties)}
                            className="w-4 h-4 accent-[#0B4C8C] cursor-pointer rounded"
                          />
                        </th>
                        <th className="p-4 sm:p-6">Residence</th>
                        <th className="p-4 sm:p-6">Type / Price</th>
                        <th className="p-4 sm:p-6">Specs</th>
                        <th className="p-4 sm:p-6">Featured</th>
                        <th className="p-4 sm:p-6">Avail.</th>
                        <th className="p-4 sm:p-6">Workflow</th>
                        <th className="p-4 sm:p-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProperties.map((prop) => (
                        <tr key={prop.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4 sm:p-6 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(prop.id)}
                              onChange={() => handleSelectToggle(prop.id)}
                              className="w-4 h-4 accent-[#0B4C8C] cursor-pointer rounded"
                            />
                          </td>
                          <td className="p-4 sm:p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shrink-0 relative">
                                {prop.imagesRelation?.[0] ? (
                                  <img src={prop.imagesRelation.find((img: any) => img.isCover)?.url || prop.imagesRelation[0].url} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={16} /></div>
                                )}
                              </div>
                              <div>
                                <span className="font-bold block text-slate-900">{prop.name}</span>
                                <span className="text-xs text-slate-500 block mt-0.5 font-semibold">{prop.location}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:p-6">
                            <span className="text-xs text-slate-550 block font-semibold">{prop.type}</span>
                            <span className="text-sm text-[#0B4C8C] font-bold block mt-0.5">{formatIndianRealEstatePrice(prop.price)}</span>
                          </td>
                          <td className="p-4 sm:p-6 text-xs text-slate-600 font-semibold space-y-0.5">
                            <div>{prop.bedrooms} Bed / {prop.bathrooms || 1} Bath</div>
                            <div>{prop.area.toLocaleString()} {prop.areaUnit || 'Sq Ft'} • Floor {prop.floor}</div>
                          </td>
                          <td className="p-4 sm:p-6">
                            <button
                              onClick={() => handleQuickUpdate(prop.id, { featured: !prop.featured })}
                              className={`px-2 py-1 border text-[10px] uppercase font-extrabold rounded transition-colors shadow-3xs ${
                                prop.featured
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 text-slate-400 hover:text-slate-650 bg-slate-50/50'
                              }`}
                            >
                              {prop.featured ? 'Featured' : 'Standard'}
                            </button>
                          </td>
                          <td className="p-4 sm:p-6">
                            <button
                              onClick={() => handleQuickUpdate(prop.id, { availability: prop.availability === 'AVAILABLE' ? 'SOLD' : 'AVAILABLE' })}
                              className={`px-2 py-1 border text-[10px] uppercase font-bold rounded transition-colors shadow-3xs ${
                                prop.availability === 'AVAILABLE'
                                  ? 'border-emerald-250 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-250 bg-rose-50 text-rose-700'
                              }`}
                            >
                              {prop.availability}
                            </button>
                          </td>
                          <td className="p-4 sm:p-6">
                            <span className={`px-2 py-1 border text-[9px] uppercase font-extrabold rounded ${
                              prop.status === 'PUBLISHED'
                                ? 'border-emerald-250 bg-emerald-50 text-emerald-700'
                                : prop.status === 'ARCHIVED'
                                ? 'border-rose-250 bg-rose-50 text-rose-700'
                                : 'border-amber-250 bg-amber-50 text-amber-700'
                            }`}>
                              {prop.status || 'DRAFT'}
                            </span>
                          </td>
                          <td className="p-4 sm:p-6 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleDuplicate(prop.id)}
                                className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                                title="Duplicate Residence"
                              >
                                <Copy size={13} />
                              </button>
                              <Link
                                href={`/admin/properties/${prop.id}/history`}
                                className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                                title="View Timeline History"
                              >
                                <History size={13} />
                              </Link>
                              <button
                                onClick={() => setSelectedPropertyDetails(prop)}
                                className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                                title="View GIS Details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(prop)}
                                className="p-1.5 border border-slate-200 hover:border-slate-350 text-slate-450 hover:text-[#0B4C8C] rounded-md bg-white shadow-3xs"
                                title="Edit Details"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteProperty(prop.id)}
                                className="p-1.5 border border-slate-200 hover:border-red-300 text-slate-450 hover:text-red-650 rounded-md bg-white shadow-3xs"
                                title="Delete Listing"
                              >
                                <Trash2 size={13} />
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
      </AnimatePresence>

      {/* Property Details Drawer */}
      <AnimatePresence>
        {selectedPropertyDetails && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPropertyDetails(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-45 cursor-pointer"
            />
            {/* Drawer body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto p-6 space-y-6"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 block font-bold">Property Details Drawer</span>
                  <h2 className="text-xl font-semibold text-slate-900 mt-1">{selectedPropertyDetails.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedPropertyDetails(null)}
                  className="p-1 border border-slate-200 hover:border-slate-350 text-slate-400 hover:text-slate-650 rounded-lg shadow-3xs"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Specification Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Type</span>
                  <span className="text-slate-900 font-bold mt-1 block">{selectedPropertyDetails.type}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Price</span>
                  <span className="text-[#0B4C8C] font-extrabold mt-1 block">{formatIndianRealEstatePrice(selectedPropertyDetails.price)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Area</span>
                  <span className="text-slate-900 font-bold mt-1 block">{selectedPropertyDetails.area.toLocaleString()} {selectedPropertyDetails.areaUnit || 'Sq Ft'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Floor level</span>
                  <span className="text-slate-900 font-bold mt-1 block">Floor {selectedPropertyDetails.floor}</span>
                </div>
              </div>

              {/* Location details */}
              <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">GIS Coordinates</span>
                <p className="text-xs text-slate-900 font-bold font-mono">
                  Latitude: {selectedPropertyDetails.latitude || 'N/A'}, Longitude: {selectedPropertyDetails.longitude || 'N/A'}
                </p>
                <p className="text-xs text-slate-650 font-semibold mt-1">
                  Location: {selectedPropertyDetails.location || `${selectedPropertyDetails.address}, ${selectedPropertyDetails.city}, ${selectedPropertyDetails.state}`}
                </p>
              </div>

              {/* Interactive map display */}
              {selectedPropertyDetails.latitude && selectedPropertyDetails.longitude && (
                <div className="space-y-3">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold flex items-center gap-1.5">
                    <Compass size={12} className="text-[#0B4C8C]" />
                    Interactive Map View
                  </span>
                  <div className="h-[220px] rounded-xl overflow-hidden border border-slate-200 relative z-10 bg-slate-50">
                    <PropertyViewMap
                      latitude={selectedPropertyDetails.latitude}
                      longitude={selectedPropertyDetails.longitude}
                      boundary={selectedPropertyDetails.boundary}
                    />
                  </div>
                  
                  {/* Google maps navigation */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <a
                      href={`https://www.google.com/maps?q=${selectedPropertyDetails.latitude},${selectedPropertyDetails.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-250 text-slate-750 font-bold rounded-xl text-xs uppercase tracking-wider text-center shadow-3xs"
                    >
                      <ExternalLink size={12} />
                      Open Maps
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPropertyDetails.latitude},${selectedPropertyDetails.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider text-center shadow-xs"
                    >
                      <Navigation size={12} />
                      Get Directions
                    </a>
                  </div>
                </div>
              )}

              {/* Amenities */}
              {selectedPropertyDetails.amenities && selectedPropertyDetails.amenities.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Amenities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPropertyDetails.amenities.map((amenity: string) => (
                      <span
                        key={amenity}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-md shadow-3xs"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
