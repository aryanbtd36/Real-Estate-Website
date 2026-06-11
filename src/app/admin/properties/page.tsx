'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Building,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Check,
  X,
  Sparkles,
  DollarSign,
  Upload,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  MapPin,
  Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Dynamically import Leaflet components with SSR disabled to prevent window-undefined errors
const PropertyEditMap = dynamic(() => import('@/components/property-edit-map'), { ssr: false });

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [featuredFilter, setFeaturedFilter] = useState('ALL');

  // Form State
  const [showForm, setShowForm] = useState(false);
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
  const [floor, setFloor] = useState('1');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [boundary, setBoundary] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);

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

  useEffect(() => {
    fetchProperties();
  }, []);

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
    setFloor('1');
    setAddress('');
    setCity('');
    setState('');
    setLatitude(null);
    setLongitude(null);
    setBoundary(null);
    setFeatured(false);
    setSelectedAmenities([]);
    setImagesList([]);
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
    setFloor(prop.floor.toString());
    setAddress(prop.address || '');
    setCity(prop.city || '');
    setState(prop.state || '');
    setLatitude(prop.latitude);
    setLongitude(prop.longitude);
    setBoundary(prop.boundary);
    setFeatured(prop.featured || false);
    setSelectedAmenities(prop.amenities || []);

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
                isCover: isFirst, // First image uploaded is set as cover by default
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

  // Delete image
  const handleDeleteImage = async (index: number, publicId: string) => {
    try {
      // Clean from Cloudinary
      await fetch(`/api/admin/cloudinary?publicId=${encodeURIComponent(publicId)}`, {
        method: 'DELETE',
      });

      setImagesList((prev) => {
        const next = prev.filter((_, i) => i !== index);
        // Recalculate order and covers
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

      // Reset orders
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

    const locationText = `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}`;

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
      floor: parseInt(floor),
      location: locationText,
      address,
      city,
      state,
      latitude,
      longitude,
      boundary,
      amenities: selectedAmenities,
      featured,
      imagesList,
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

  // Toggle quick parameters (sold/featured)
  const handleQuickUpdate = async (id: string, updates: any) => {
    const property = properties.find(p => p.id === id);
    if (!property) return;

    // Build complete body mimicking PUT API requirements
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

  // Filter listings
  const filteredProperties = properties.filter((prop) => {
    const matchesSearch = prop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = prop.city.toLowerCase().includes(searchCity.toLowerCase());
    const matchesType = propertyTypeFilter === 'ALL' || prop.type === propertyTypeFilter;
    const matchesAvailability = availabilityFilter === 'ALL' || prop.availability === availabilityFilter;
    const matchesFeatured = featuredFilter === 'ALL' || (featuredFilter === 'FEATURED' ? prop.featured : !prop.featured);

    return matchesSearch && matchesCity && matchesType && matchesAvailability && matchesFeatured;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-white/40">Loading Residences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Properties Management</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Manage Residences</h1>
          <p className="text-xs text-white/50 mt-1">Create, edit, feature, and delete luxury portfolios.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#D4AF37] text-black text-xs uppercase tracking-widest font-semibold rounded hover:opacity-90 flex items-center gap-1.5 transition-opacity"
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
            className="bg-[#161616] border border-white/5 p-6 sm:p-8 rounded-xl shadow-2xl space-y-8"
          >
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Sparkles size={16} className="text-[#D4AF37]" />
                <span>{editingId ? 'Modify Luxury Residence' : 'Publish New Luxury Residence'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-8">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] border-l-2 border-[#D4AF37] pl-2">Basic Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Property Title / Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37] transition-colors"
                      placeholder="The Amberwood Estate"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block">Property Type</label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      >
                        <option value="Apartment">Apartment</option>
                        <option value="Villa">Villa</option>
                        <option value="Penthouse">Penthouse</option>
                        <option value="Duplex">Duplex</option>
                        <option value="Lot">Estate Lot</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      >
                        <option value="Buy">For Sale</option>
                        <option value="Rent">For Lease</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block">Property Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 p-3.5 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37] transition-colors resize-none leading-relaxed"
                    placeholder="Provide a luxurious and detailed description outlining the residential spaces, layouts, architectural heritage, or panoramic vistas..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Price ($)</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37] transition-colors"
                      placeholder="12500000"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="w-5 h-5 accent-[#D4AF37] bg-[#0A0A0A] border-white/10 rounded cursor-pointer"
                    />
                    <label htmlFor="featured" className="text-xs text-white/60 cursor-pointer select-none">Mark this property as Featured Portfolio Item</label>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] border-l-2 border-[#D4AF37] pl-2">Specifications</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Area (Sq Ft)</label>
                    <input
                      type="number"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="5400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Bedrooms</label>
                    <input
                      type="number"
                      required
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="4"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Bathrooms</label>
                    <input
                      type="number"
                      required
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Floor level</label>
                    <input
                      type="number"
                      required
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] border-l-2 border-[#D4AF37] pl-2">Amenities</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
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
                          className="w-4 h-4 accent-[#D4AF37] bg-[#161616] border-white/10 rounded cursor-pointer"
                        />
                        <label htmlFor={`amenity-${amenity}`} className="text-xs text-white/70 cursor-pointer select-none">{amenity}</label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Location & Map */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] border-l-2 border-[#D4AF37] pl-2">Location & OpenStreetMap</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Address</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="1428 Elm St"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="Beverly Hills"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude || ''}
                      onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="34.0736"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude || ''}
                      onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full bg-[#0A0A0A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-[#D4AF37]"
                      placeholder="-118.4004"
                    />
                  </div>
                </div>

                {/* Leaflet Editor Component */}
                <div className="pt-2">
                  <PropertyEditMap
                    latitude={latitude}
                    longitude={longitude}
                    boundary={boundary}
                    onChangeLocation={(lat, lng) => {
                      setLatitude(parseFloat(lat.toFixed(6)));
                      setLongitude(parseFloat(lng.toFixed(6)));
                    }}
                    onChangeBoundary={setBoundary}
                  />
                </div>
              </div>

              {/* Image Management */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] border-l-2 border-[#D4AF37] pl-2">Portfolio Images (Cloudinary)</h4>
                
                <div className="border-2 border-dashed border-white/10 p-8 text-center rounded-xl hover:border-[#D4AF37]/30 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadLoading}
                  />
                  <div className="space-y-2">
                    <Upload className="mx-auto text-white/40" size={32} />
                    <span className="text-sm font-medium text-white block">
                      {uploadLoading ? 'Uploading to secure servers...' : 'Click or Drag images to upload'}
                    </span>
                    <span className="text-[10px] text-white/30 block uppercase tracking-wider">Supports JPG, PNG, WEBP (Max 5MB)</span>
                  </div>
                </div>

                {imagesList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {imagesList.map((img, idx) => (
                      <div key={img.publicId} className={`bg-[#0A0A0A] border rounded-xl overflow-hidden p-3 relative flex items-center gap-3 transition-colors ${
                        img.isCover ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/5 hover:border-white/10'
                      }`}>
                        <div className="w-14 h-14 bg-white/5 rounded-lg overflow-hidden shrink-0 relative">
                          <img src={img.url} alt="Uploaded preview" className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-white/40 block">Order: {img.order + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleSetCover(idx)}
                            className={`text-[10px] uppercase font-bold tracking-widest block transition-colors ${
                              img.isCover ? 'text-[#D4AF37]' : 'text-white/40 hover:text-white/80'
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
                            className="p-1 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === imagesList.length - 1}
                            onClick={() => moveImage(idx, 'down')}
                            className="p-1 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteImage(idx, img.publicId)}
                          className="absolute top-2 right-2 text-white/30 hover:text-red-400 p-1 rounded-full bg-black/40 hover:bg-black/80"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-6 border-t border-white/5 flex gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-4 bg-gradient-to-r from-[#D4AF37] to-[#F5D67B] text-black font-semibold uppercase tracking-widest text-xs rounded hover:opacity-95 shadow-lg flex items-center justify-center gap-2"
                >
                  {formLoading ? 'Submitting Portfolio...' : editingId ? 'Update Listing Details' : 'Publish Listing'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-4 bg-[#1E1E1E] hover:bg-white/5 border border-white/10 text-white font-semibold uppercase tracking-widest text-xs rounded transition-colors"
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#161616] p-4 rounded-xl border border-white/5 items-center">
              <div className="relative md:col-span-4">
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2.5 pl-9 rounded-lg text-white text-xs outline-none transition-colors"
                />
                <Search className="absolute left-3 top-3 text-white/40" size={14} />
              </div>

              <div className="relative md:col-span-3">
                <input
                  type="text"
                  placeholder="Search by city..."
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 focus:border-[#D4AF37] p-2.5 pl-9 rounded-lg text-white text-xs outline-none transition-colors"
                />
                <MapPin className="absolute left-3 top-3 text-white/40" size={14} />
              </div>

              <div className="grid grid-cols-3 gap-2 md:col-span-5">
                <select
                  value={propertyTypeFilter}
                  onChange={(e) => setPropertyTypeFilter(e.target.value)}
                  className="bg-[#0A0A0A] border border-white/10 p-2.5 rounded-lg text-white text-[11px] outline-none cursor-pointer appearance-none text-center"
                >
                  <option value="ALL">All Types</option>
                  <option value="Apartment">Apartments</option>
                  <option value="Villa">Villas</option>
                  <option value="Penthouse">Penthouses</option>
                  <option value="Duplex">Duplexes</option>
                  <option value="Lot">Estate Lots</option>
                </select>

                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="bg-[#0A0A0A] border border-white/10 p-2.5 rounded-lg text-white text-[11px] outline-none cursor-pointer appearance-none text-center"
                >
                  <option value="ALL">All Status</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="SOLD">Sold</option>
                </select>

                <select
                  value={featuredFilter}
                  onChange={(e) => setFeaturedFilter(e.target.value)}
                  className="bg-[#0A0A0A] border border-white/10 p-2.5 rounded-lg text-white text-[11px] outline-none cursor-pointer appearance-none text-center"
                >
                  <option value="ALL">All List</option>
                  <option value="FEATURED">Featured</option>
                  <option value="REGULAR">Regular</option>
                </select>
              </div>
            </div>

            {/* List Table */}
            {filteredProperties.length === 0 ? (
              <div className="bg-[#161616]/40 border border-white/5 p-12 text-center rounded-xl">
                <p className="text-sm text-white/45">No properties found in list matching criteria.</p>
              </div>
            ) : (
              <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1E1E1E] text-white/60 text-xs uppercase tracking-wider border-b border-white/5">
                      <tr>
                        <th className="p-4 sm:p-6">Residence</th>
                        <th className="p-4 sm:p-6">Type / Price</th>
                        <th className="p-4 sm:p-6">Specifications</th>
                        <th className="p-4 sm:p-6">Featured</th>
                        <th className="p-4 sm:p-6">Status</th>
                        <th className="p-4 sm:p-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredProperties.map((prop) => (
                        <tr key={prop.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 sm:p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-lg overflow-hidden shrink-0 relative">
                                {prop.imagesRelation?.[0] ? (
                                  <img src={prop.imagesRelation.find((img: any) => img.isCover)?.url || prop.imagesRelation[0].url} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/20"><ImageIcon size={16} /></div>
                                )}
                              </div>
                              <div>
                                <span className="font-semibold block text-white">{prop.name}</span>
                                <span className="text-xs text-white/50 block mt-0.5">{prop.location}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:p-6">
                            <span className="text-xs text-white/60 block">{prop.type}</span>
                            <span className="text-sm text-[#D4AF37] font-semibold block mt-0.5">${(prop.price / 1000000).toFixed(2)}M</span>
                          </td>
                          <td className="p-4 sm:p-6 text-xs text-white/70 space-y-0.5">
                            <div>{prop.bedrooms} Bed / {prop.bathrooms || 1} Bath</div>
                            <div>{prop.area.toLocaleString()} Sq Ft • Floor {prop.floor}</div>
                          </td>
                          <td className="p-4 sm:p-6">
                            <button
                              onClick={() => handleQuickUpdate(prop.id, { featured: !prop.featured })}
                              className={`px-2 py-1 border text-[10px] uppercase font-bold rounded transition-colors ${
                                prop.featured
                                  ? 'border-[#D4AF37] bg-[#D4AF37]/5 text-[#F5D67B]'
                                  : 'border-white/10 text-white/40 hover:text-white/60'
                              }`}
                            >
                              {prop.featured ? 'Featured' : 'Standard'}
                            </button>
                          </td>
                          <td className="p-4 sm:p-6">
                            <button
                              onClick={() => handleQuickUpdate(prop.id, { availability: prop.availability === 'AVAILABLE' ? 'SOLD' : 'AVAILABLE' })}
                              className={`px-2 py-1 border text-[10px] uppercase font-semibold rounded transition-colors ${
                                prop.availability === 'AVAILABLE'
                                  ? 'border-green-500/30 bg-green-500/5 text-green-400'
                                  : 'border-red-500/30 bg-red-500/5 text-red-400'
                              }`}
                            >
                              {prop.availability}
                            </button>
                          </td>
                          <td className="p-4 sm:p-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(prop)}
                                className="p-1.5 border border-white/5 hover:border-[#D4AF37]/30 text-white/40 hover:text-[#D4AF37] rounded"
                                title="Edit Residence"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProperty(prop.id)}
                                className="p-1.5 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 rounded"
                                title="Delete Residence"
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
      </AnimatePresence>
    </div>
  );
}
