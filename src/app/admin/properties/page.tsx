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
import { handleImageError } from '@/lib/images';

// Dynamically import Leaflet components with SSR disabled to prevent window-undefined errors
const PropertyEditMap = dynamic(() => import('@/components/property-edit-map'), { ssr: false });
const PropertyViewMap = dynamic(() => import('@/components/property-view-map'), { ssr: false });
import { formatIndianRealEstatePrice } from '@/lib/currency';

const ProgressBar = ({ value, max, label, color = 'bg-[#0B4C8C]' }: { value: number, max: number, label: string, color?: string }) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-3xs text-left">
      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${color}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

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
  const [floorPlan, setFloorPlan] = useState('');

  // Wave 8B Template states
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<any>({});

  // Amenities checklist
  const availableAmenities = ['Parking', 'Swimming Pool', 'Security', 'Power Backup', 'Garden', 'Gym', 'Wine Cellar', 'Spa', 'Private Dock'];
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Images state
  const [imagesList, setImagesList] = useState<any[]>([]); // { publicId, url, order, isCover, size }
  
  // Wave 8D Multi-upload states
  const [floorPlansList, setFloorPlansList] = useState<any[]>([]); // { url, size }
  const [brochuresList, setBrochuresList] = useState<any[]>([]); // { url, size }
  const [uploadQueue, setUploadQueue] = useState<any[]>([]); // { id, file, name, size, uploadType, status, progress, url, error }
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Helper to fetch size of existing uploaded media
  const fetchUrlSize = async (url: string): Promise<number> => {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const len = res.headers.get('content-length');
      if (len) return parseInt(len, 10);
    } catch (e) {
      console.warn('Failed to fetch size for URL', url, e);
    }
    // Fallbacks
    if (url.toLowerCase().endsWith('.pdf')) return 1500000;
    return 350000;
  };

  // Client-side image WebP compression pipeline
  const optimizeImageFile = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'webp', 'png'].includes(ext || '')) {
        return resolve(file);
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDimension = 1600;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file);
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file);
              }
              const newName = file.name.substring(0, file.name.lastIndexOf('.')) + '.webp';
              const optimizedFile = new File([blob], newName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            },
            'image/webp',
            0.8
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  // Helper to parse Cloudinary Public ID from URL
  const getCloudinaryPublicId = (url: string) => {
    if (!url || !url.includes('cloudinary.com')) return null;
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    const subParts = pathPart.split('/');
    if (subParts[0].startsWith('v') && /^\d+$/.test(subParts[0].substring(1))) {
      subParts.shift();
    }
    const fullPath = subParts.join('/');
    const dotIdx = fullPath.lastIndexOf('.');
    if (dotIdx !== -1) {
      return fullPath.substring(0, dotIdx);
    }
    return fullPath;
  };

  // Add files to local validation queue
  const addFilesToQueue = async (filesList: FileList | File[], type: 'image' | 'floorPlan' | 'brochure') => {
    const files = Array.from(filesList);
    const newQueueItems: any[] = [];
    
    const currentImages = imagesList.length;
    const currentFloorPlans = floorPlansList.length;
    const currentBrochures = brochuresList.length;
    
    const queueImages = uploadQueue.filter(q => q.uploadType === 'image').length;
    const queueFloorPlans = uploadQueue.filter(q => q.uploadType === 'floorPlan').length;
    const queueBrochures = uploadQueue.filter(q => q.uploadType === 'brochure').length;
    
    let typeMax = 15;
    if (type === 'floorPlan') typeMax = 5;
    if (type === 'brochure') typeMax = 2;
    
    const currentCount = type === 'image' ? currentImages : type === 'floorPlan' ? currentFloorPlans : currentBrochures;
    const queueCount = type === 'image' ? queueImages : type === 'floorPlan' ? queueFloorPlans : queueBrochures;
    
    if (currentCount + queueCount + files.length > typeMax) {
      alert(`Cannot add files. Maximum limit of ${typeMax} ${type}s would be exceeded.`);
      return;
    }
    
    const uploadedSize = 
      imagesList.reduce((acc, img) => acc + (img.size || 350000), 0) +
      floorPlansList.reduce((acc, f) => acc + (f.size || 500000), 0) +
      brochuresList.reduce((acc, b) => acc + (b.size || 1500000), 0);
    
    const queueSize = uploadQueue.reduce((acc, item) => acc + item.size, 0);
    let cumulativeSize = uploadedSize + queueSize;
    
    for (const file of files) {
      // Validation: Format
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let allowedExts: string[] = [];
      if (type === 'image') allowedExts = ['jpg', 'jpeg', 'webp'];
      else if (type === 'floorPlan') allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
      else if (type === 'brochure') allowedExts = ['pdf'];
      
      if (!allowedExts.includes(ext)) {
        alert(`Format not allowed: "${file.name}" is not supported for ${type}.`);
        continue;
      }
      
      // Validation: Size
      let maxLimit = 2 * 1024 * 1024;
      if (type === 'floorPlan') maxLimit = 3 * 1024 * 1024;
      if (type === 'brochure') maxLimit = 5 * 1024 * 1024;
      
      if (file.size > maxLimit) {
        const limitStr = type === 'image' ? '2MB' : type === 'floorPlan' ? '3MB' : '5MB';
        alert(`File too large: "${file.name}" exceeds the ${limitStr} limit.`);
        continue;
      }
      
      // Validation: Duplicate Detection
      const inQueueDup = uploadQueue.some(q => q.name === file.name && q.size === file.size);
      let isUploadedDup = false;
      if (type === 'image') {
        isUploadedDup = imagesList.some(img => img.url.endsWith(file.name) || (img.size === file.size && img.url.includes(file.name.split('.')[0])));
      } else if (type === 'floorPlan') {
        isUploadedDup = floorPlansList.some(f => f.url.endsWith(file.name) || f.size === file.size);
      } else if (type === 'brochure') {
        isUploadedDup = brochuresList.some(b => b.url.endsWith(file.name) || b.size === file.size);
      }
      
      if (inQueueDup || isUploadedDup) {
        alert(`Duplicate skipped: "${file.name}" has already been queued or uploaded.`);
        continue;
      }
      
      // Validation: Total Budget
      if (cumulativeSize + file.size > 40 * 1024 * 1024) {
        alert(`Budget exceeded: Adding "${file.name}" would exceed the 40MB total property payload limit.`);
        break;
      }
      
      cumulativeSize += file.size;
      
      newQueueItems.push({
        id: Date.now() + Math.random(),
        file,
        name: file.name,
        size: file.size,
        uploadType: type,
        status: 'pending',
        progress: 0
      });
    }
    
    if (newQueueItems.length > 0) {
      setUploadQueue(prev => [...prev, ...newQueueItems]);
    }
  };

  // Sequentially process queue uploads with metadata matching server schema
  const processQueue = async () => {
    const pendingItems = uploadQueue.filter(item => item.status === 'pending' || item.status === 'failed');
    if (pendingItems.length === 0) return;
    
    setFormLoading(true);
    
    for (const item of pendingItems) {
      let fileToUpload = item.file;
      if (item.uploadType === 'image') {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'compressing' } : q));
        try {
          fileToUpload = await optimizeImageFile(item.file);
          setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, size: fileToUpload.size } : q));
        } catch (err) {
          console.error('Optimization error:', err);
        }
      }
      
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q));
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('uploadType', item.uploadType);
      formData.append('currentImagesCount', imagesList.length.toString());
      formData.append('currentFloorPlansCount', floorPlansList.length.toString());
      formData.append('currentBrochuresCount', brochuresList.length.toString());
      
      const uploadedSize = 
        imagesList.reduce((acc, img) => acc + (img.size || 350000), 0) +
        floorPlansList.reduce((acc, f) => acc + (f.size || 500000), 0) +
        brochuresList.reduce((acc, b) => acc + (b.size || 1500000), 0);
      formData.append('currentTotalSize', uploadedSize.toString());
      
      try {
        const result = await new Promise<{ publicId?: string; url: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/admin/cloudinary');
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: percent } : q));
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                resolve(resJson);
              } catch (err) {
                reject(new Error('Invalid server response'));
              }
            } else {
              try {
                const resJson = JSON.parse(xhr.responseText);
                reject(new Error(resJson.error || 'Upload failed'));
              } catch (err) {
                reject(new Error(`Server error: ${xhr.statusText || xhr.status}`));
              }
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('Network connection error'));
          });
          
          xhr.send(formData);
        });
        
        if (item.uploadType === 'image') {
          setImagesList(prev => {
            const nextOrder = prev.length;
            const isFirst = nextOrder === 0;
            return [
              ...prev,
              {
                publicId: result.publicId!,
                url: result.url,
                order: nextOrder,
                isCover: isFirst,
                size: fileToUpload.size
              }
            ];
          });
        } else if (item.uploadType === 'floorPlan') {
          setFloorPlansList(prev => [
            ...prev,
            { url: result.url, size: fileToUpload.size }
          ]);
        } else if (item.uploadType === 'brochure') {
          setBrochuresList(prev => [
            ...prev,
            { url: result.url, size: fileToUpload.size }
          ]);
        }
        
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', progress: 100, url: result.url } : q));
        
      } catch (err: any) {
        console.error('File upload failed in queue:', err);
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'failed', error: err.message || 'Upload failed' } : q));
      }
    }
    
    setFormLoading(false);
  };

  // Delete already uploaded media from Cloudinary and state
  const handleDeleteUploadedMedia = async (type: 'floorPlan' | 'brochure', index: number, url: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    const publicId = getCloudinaryPublicId(url);
    if (publicId) {
      try {
        await fetch(`/api/admin/cloudinary?publicId=${encodeURIComponent(publicId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete media from Cloudinary:', err);
      }
    }
    
    if (type === 'floorPlan') {
      setFloorPlansList(prev => prev.filter((_, i) => i !== index));
    } else {
      setBrochuresList(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Standalone upload handler for showcase video
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', 'video');
    try {
      const res = await fetch('/api/admin/cloudinary', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setVideoUrl(data.url);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to upload video.');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploadLoading(false);
    }
  };

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
    setFloorPlan('');
    setSelectedAmenities([]);
    setImagesList([]);
    setFloorPlansList([]);
    setBrochuresList([]);
    setUploadQueue([]);
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
    setFloorPlan(prop.floorPlan || '');
    setSelectedAmenities(prop.amenities || []);
    setTemplateId(prop.templateId || null);
    setTemplateFields(prop.templateFields || {});

    // Load related images
    const initialImages = prop.imagesRelation ? prop.imagesRelation.map((img: any) => ({
      publicId: img.publicId,
      url: img.url,
      order: img.order,
      isCover: img.isCover,
      size: 350000
    })).sort((a: any, b: any) => a.order - b.order) : [];
    setImagesList(initialImages);

    const initialFloorPlans = prop.floorPlan ? prop.floorPlan.split(',').filter(Boolean).map((url: string) => ({ url, size: 500000 })) : [];
    const initialBrochures = prop.brochureUrl ? prop.brochureUrl.split(',').filter(Boolean).map((url: string) => ({ url, size: 1500000 })) : [];
    setFloorPlansList(initialFloorPlans);
    setBrochuresList(initialBrochures);
    setUploadQueue([]);

    // Asynchronously fetch exact sizes to update budget accurately
    initialImages.forEach((item: any, idx: number) => {
      fetchUrlSize(item.url).then(size => {
        setImagesList(prev => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], size };
          return next;
        });
      });
    });

    initialFloorPlans.forEach((item: any, idx: number) => {
      fetchUrlSize(item.url).then(size => {
        setFloorPlansList(prev => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], size };
          return next;
        });
      });
    });

    initialBrochures.forEach((item: any, idx: number) => {
      fetchUrlSize(item.url).then(size => {
        setBrochuresList(prev => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], size };
          return next;
        });
      });
    });

    setShowForm(true);
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
      brochureUrl: brochuresList.map(b => b.url).join(','),
      virtualTourUrl,
      floorPlan: floorPlansList.map(f => f.url).join(','),
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
                           onChange={handleVideoUpload}
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

                  {/* Brochure PDF Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Brochures (PDF only)</label>
                    <div className="border border-dashed border-slate-200 bg-white p-4 text-center rounded-lg relative hover:border-[#0B4C8C] transition-colors cursor-pointer shadow-3xs">
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) addFilesToQueue(e.target.files, 'brochure');
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-1">
                        <FileCheck size={20} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700">Add Brochure PDFs</span>
                        <span className="text-[9px] text-slate-400 block font-semibold">Max 2 brochures, ≤ 5MB each</span>
                      </div>
                    </div>
                    
                    {/* Render List of Already Uploaded Brochures */}
                    {brochuresList.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Uploaded Brochures</span>
                        {brochuresList.map((b, idx) => (
                          <div key={b.url} className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-3xs">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <FileText size={14} className="text-[#0B4C8C] shrink-0" />
                              <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[180px]">
                                {b.url.split('/').pop()} ({b.size ? (b.size / 1024 / 1024).toFixed(2) + ' MB' : 'Size N/A'})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={b.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] uppercase font-bold text-[#0B4C8C] hover:underline flex items-center gap-0.5 shrink-0"
                              >
                                View PDF
                                <ExternalLink size={8} />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteUploadedMedia('brochure', idx, b.url)}
                                className="text-slate-400 hover:text-rose-650"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Floor Plan Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Property Floor Plans (PDF, PNG, JPG)</label>
                    <div className="border border-dashed border-slate-200 bg-white p-4 text-center rounded-lg relative hover:border-[#0B4C8C] transition-colors cursor-pointer shadow-3xs">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) addFilesToQueue(e.target.files, 'floorPlan');
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={20} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700">Add Floor Plans</span>
                        <span className="text-[9px] text-slate-400 block font-semibold">Max 5 floor plans, ≤ 3MB each</span>
                      </div>
                    </div>
                    
                    {/* Render List of Already Uploaded Floor Plans */}
                    {floorPlansList.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Uploaded Floor Plans</span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {floorPlansList.map((f, idx) => {
                            const isPdf = f.url.toLowerCase().endsWith('.pdf');
                            return (
                              <div key={f.url} className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-3xs">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  {isPdf ? (
                                    <FileText size={14} className="text-[#0B4C8C] shrink-0" />
                                  ) : (
                                    <div className="w-6 h-6 bg-slate-100 rounded overflow-hidden shrink-0 border border-slate-100">
                                      <img src={f.url} className="w-full h-full object-cover" alt="floor plan" onError={(e) => handleImageError(e, 'plot')} />
                                    </div>
                                  )}
                                  <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[180px]">
                                    {f.url.split('/').pop()} ({f.size ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'Size N/A'})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] uppercase font-bold text-[#0B4C8C] hover:underline flex items-center gap-0.5 shrink-0"
                                  >
                                    View
                                    <ExternalLink size={8} />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUploadedMedia('floorPlan', idx, f.url)}
                                    className="text-slate-400 hover:text-rose-650"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingImage(false); if (e.dataTransfer.files) addFilesToQueue(e.dataTransfer.files, 'image'); }}
                  className={`border-2 border-dashed p-8 text-center rounded-xl transition-all relative cursor-pointer shadow-2xs ${
                    isDraggingImage ? 'border-[#0B4C8C] bg-blue-50/50' : 'border-slate-200 bg-slate-50 hover:border-[#0B4C8C]'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) addFilesToQueue(e.target.files, 'image');
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2 select-none pointer-events-none">
                    <Upload className={`mx-auto transition-colors ${isDraggingImage ? 'text-[#0B4C8C]' : 'text-slate-400'}`} size={32} />
                    <span className="text-sm font-semibold text-slate-700 block">
                      {isDraggingImage ? 'Drop images here!' : 'Click or Drag images to queue for upload'}
                    </span>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Supports JPG, JPEG, WEBP (Max 2MB per image)</span>
                  </div>
                </div>

                {imagesList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {imagesList.map((img, idx) => (
                      <div key={img.publicId} className={`bg-slate-50 border rounded-xl overflow-hidden p-3 relative flex items-center gap-3 transition-colors ${
                        img.isCover ? 'border-emerald-350 bg-emerald-50 text-emerald-700 shadow-xs' : 'border-slate-200 hover:border-slate-350'
                      }`}>
                        <div className="w-14 h-14 bg-slate-200/50 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                          <img
                            src={img.url}
                            alt="Uploaded preview"
                            className="w-full h-full object-cover"
                            onError={(e) => handleImageError(e, type)}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
                            Order: {img.order + 1} {img.size ? `(${ (img.size / 1024 / 1024).toFixed(2) } MB)` : ''}
                          </span>
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

                {/* Media Queue Dashboard */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-4 border border-slate-200 rounded-[20px] p-6 bg-slate-50/50 shadow-2xs pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Upload size={16} className="text-[#0B4C8C]" />
                          <span>Upload Queue Dashboard</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold">Review, optimize, and publish queued media assets.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={processQueue}
                          disabled={formLoading || !uploadQueue.some(q => q.status === 'pending' || q.status === 'failed')}
                          className="px-3.5 py-2 bg-[#0B4C8C] hover:bg-[#0B4C8C]/90 text-white rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          {formLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          <span>Confirm & Upload Files</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadQueue([])}
                          disabled={formLoading}
                          className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-3xs"
                        >
                          Clear Queue
                        </button>
                      </div>
                    </div>

                    {/* Capacity Gauges */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <ProgressBar 
                        value={imagesList.length + uploadQueue.filter(q => q.uploadType === 'image').length} 
                        max={15} 
                        label="Images Count" 
                        color={imagesList.length + uploadQueue.filter(q => q.uploadType === 'image').length > 12 ? 'bg-amber-500' : 'bg-[#0B4C8C]'} 
                      />
                      <ProgressBar 
                        value={floorPlansList.length + uploadQueue.filter(q => q.uploadType === 'floorPlan').length} 
                        max={5} 
                        label="Floor Plans" 
                        color={floorPlansList.length + uploadQueue.filter(q => q.uploadType === 'floorPlan').length > 4 ? 'bg-amber-500' : 'bg-[#0B4C8C]'} 
                      />
                      <ProgressBar 
                        value={brochuresList.length + uploadQueue.filter(q => q.uploadType === 'brochure').length} 
                        max={2} 
                        label="Brochures" 
                        color={brochuresList.length + uploadQueue.filter(q => q.uploadType === 'brochure').length > 1 ? 'bg-amber-500' : 'bg-[#0B4C8C]'} 
                      />
                      <ProgressBar 
                        value={parseFloat(((uploadQueue.reduce((acc, q) => acc + q.size, 0) + 
                              imagesList.reduce((acc, img) => acc + (img.size || 350000), 0) +
                              floorPlansList.reduce((acc, f) => acc + (f.size || 500000), 0) +
                              brochuresList.reduce((acc, b) => acc + (b.size || 1500000), 0)
                            ) / 1024 / 1024).toFixed(2))} 
                        max={40} 
                        label="Payload (MB)" 
                        color={
                          (uploadQueue.reduce((acc, q) => acc + q.size, 0) + 
                            imagesList.reduce((acc, img) => acc + (img.size || 350000), 0) +
                            floorPlansList.reduce((acc, f) => acc + (f.size || 500000), 0) +
                            brochuresList.reduce((acc, b) => acc + (b.size || 1500000), 0)
                          ) > 35 * 1024 * 1024 ? 'bg-rose-500' : 'bg-emerald-500'
                        } 
                      />
                    </div>

                    {/* Queue Items List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {uploadQueue.map((item) => {
                        const isImage = item.uploadType === 'image';
                        return (
                          <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 shadow-3xs hover:border-slate-300 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              {isImage && item.status !== 'completed' ? (
                                <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200 relative flex items-center justify-center">
                                  <span className="text-[10px] text-slate-400 font-bold">Image</span>
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-slate-50 rounded-lg shrink-0 border border-slate-200 flex items-center justify-center text-slate-450">
                                  <FileText size={16} />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 block truncate max-w-[240px]" title={item.name}>{item.name}</span>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  <span>{item.uploadType}</span>
                                  <span>•</span>
                                  <span>{ (item.size / 1024 / 1024).toFixed(2) } MB</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Status Indicator */}
                              <div className="text-right">
                                {item.status === 'pending' && (
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-extrabold uppercase tracking-wider rounded-md">Pending</span>
                                )}
                                {item.status === 'compressing' && (
                                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold uppercase tracking-wider rounded-md animate-pulse">Compressing</span>
                                )}
                                {item.status === 'uploading' && (
                                  <div className="space-y-1">
                                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-[#0B4C8C] text-[9px] font-extrabold uppercase tracking-wider rounded-md">Uploading {item.progress}%</span>
                                    <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#0B4C8C] transition-all duration-150" style={{ width: `${item.progress}%` }} />
                                    </div>
                                  </div>
                                )}
                                {item.status === 'completed' && (
                                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-250 text-emerald-700 text-[9px] font-extrabold uppercase tracking-wider rounded-md">Completed</span>
                                )}
                                {item.status === 'failed' && (
                                  <div className="space-y-0.5">
                                    <span className="px-2 py-0.5 bg-rose-50 border border-rose-250 text-rose-700 text-[9px] font-extrabold uppercase tracking-wider rounded-md">Failed</span>
                                    <span className="text-[8px] text-rose-500 block max-w-[120px] truncate leading-none mt-0.5" title={item.error}>{item.error}</span>
                                  </div>
                                )}
                              </div>

                              {/* Remove button */}
                              {(item.status === 'pending' || item.status === 'failed') && (
                                <button
                                  type="button"
                                  onClick={() => setUploadQueue(prev => prev.filter(q => q.id !== item.id))}
                                  className="p-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-400 hover:text-rose-650 rounded-lg shadow-3xs"
                                  title="Remove from Queue"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                                  <img
                                    src={prop.imagesRelation.find((img: any) => img.isCover)?.url || prop.imagesRelation[0].url}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                    onError={(e) => handleImageError(e, prop.type)}
                                  />
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
