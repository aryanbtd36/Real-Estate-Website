'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  FileCode,
  Plus,
  Trash2,
  Edit,
  Save,
  RotateCcw,
  History,
  Copy,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  X,
  ArrowRight,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'textarea' | 'multiselect' | 'date';
  required: boolean;
  options?: string[];
}

interface Template {
  id: string;
  name: string;
  type: string;
  version: number;
  fields: FieldConfig[];
  updatedAt: string;
  versions?: { version: number; createdAt: string; changedBy: string }[];
}

export default function TemplateBuilderPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Loading & states
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  // Modals & version history state
  const [showHistory, setShowHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Alerts state
  const [alertInfo, setAlertInfo] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Custom template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('');
  const [cloneFromId, setCloneFromId] = useState('');

  // Field edit inline state
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldConfig>({
    name: '',
    label: '',
    type: 'text',
    required: false,
    options: []
  });
  const [dropdownOptionsString, setDropdownOptionsString] = useState('');
  const [isAddingNewField, setIsAddingNewField] = useState(false);

  // Fetch templates list
  const fetchTemplates = async (selectId?: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/cms/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      setTemplates(data);

      if (data.length > 0) {
        if (selectId) {
          const match = data.find((t: Template) => t.id === selectId);
          setSelectedTemplate(match || data[0]);
        } else if (!selectedTemplate) {
          setSelectedTemplate(data[0]);
        } else {
          const match = data.find((t: Template) => t.id === selectedTemplate.id);
          setSelectedTemplate(match || data[0]);
        }
      }
    } catch (err: any) {
      triggerAlert(err.message || 'Error loading templates', 'error');
    } finally {
      setLoading(false);
    }
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
      fetchTemplates();
    }
  }, [session, sessionStatus]);

  const triggerAlert = (text: string, type: 'success' | 'error') => {
    setAlertInfo({ text, type });
    setTimeout(() => setAlertInfo(null), 5000);
  };

  // Fetch version history with fields for a template
  const fetchVersionHistory = async (templateId: string) => {
    try {
      const res = await fetch(`/api/admin/cms/templates/versions?templateId=${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setVersionHistory(data);
      }
    } catch (err) {
      console.error('Failed to load template versions history', err);
    }
  };

  const handleOpenHistory = async () => {
    if (!selectedTemplate) return;
    await fetchVersionHistory(selectedTemplate.id);
    setShowHistory(true);
  };

  // Rollback template fields to an older version number
  const handleRollbackVersion = async (versionNumber: number) => {
    if (!selectedTemplate) return;
    if (!confirm(`Are you sure you want to revert template fields schema to version ${versionNumber}? This will create a new version with those parameters.`)) {
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch('/api/admin/cms/templates/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          version: versionNumber
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');

      triggerAlert(`Successfully rolled back template schema to v${versionNumber}`, 'success');
      setShowHistory(false);
      await fetchTemplates(selectedTemplate.id);
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Create new custom template (possibly cloned)
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateType) return;

    setSaveLoading(true);
    try {
      const res = await fetch('/api/admin/cms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          type: newTemplateType.toUpperCase(),
          fields: [],
          cloneFromId: cloneFromId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create template');

      triggerAlert(`Template "${newTemplateName}" created.`, 'success');
      setShowCreateModal(false);
      setNewTemplateName('');
      setNewTemplateType('');
      setCloneFromId('');
      
      await fetchTemplates(data.template.id);
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete custom template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this custom template? Property records linked to it will lose their template metadata rendering.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/cms/templates?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete template');

      triggerAlert('Custom template deleted successfully.', 'success');
      setSelectedTemplate(null);
      await fetchTemplates();
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    }
  };

  // Fields editing list operations
  const handleAddField = () => {
    if (!fieldForm.name || !fieldForm.label) {
      triggerAlert('Field Key name and visual Label are required.', 'error');
      return;
    }

    // Clean field name key: alphanumeric lowercase
    const keyName = fieldForm.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!keyName) {
      triggerAlert('Key name must contain valid alphanumeric characters.', 'error');
      return;
    }

    if (!selectedTemplate) return;

    // Check if key already exists
    const exists = selectedTemplate.fields.some((f, idx) => {
      if (editingFieldIndex !== null && idx === editingFieldIndex) return false;
      return f.name === keyName;
    });

    if (exists) {
      triggerAlert('A field with this exact database key name already exists in this template.', 'error');
      return;
    }

    const options = (fieldForm.type === 'dropdown' || fieldForm.type === 'multiselect')
      ? dropdownOptionsString.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    const newField: FieldConfig = {
      ...fieldForm,
      name: keyName,
      options
    };

    const updatedFields = [...selectedTemplate.fields];
    if (editingFieldIndex !== null) {
      updatedFields[editingFieldIndex] = newField;
    } else {
      updatedFields.push(newField);
    }

    setSelectedTemplate({
      ...selectedTemplate,
      fields: updatedFields
    });

    resetFieldForm();
  };

  const handleEditFieldClick = (index: number) => {
    const field = selectedTemplate!.fields[index];
    setEditingFieldIndex(index);
    setFieldForm({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required
    });
    setDropdownOptionsString(field.options ? field.options.join(', ') : '');
    setIsAddingNewField(true);
  };

  const handleDeleteFieldClick = (index: number) => {
    if (!selectedTemplate) return;
    const updated = [...selectedTemplate.fields];
    updated.splice(index, 1);
    setSelectedTemplate({
      ...selectedTemplate,
      fields: updated
    });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (!selectedTemplate) return;
    const fields = [...selectedTemplate.fields];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = fields[index];
    fields[index] = fields[targetIdx];
    fields[targetIdx] = temp;

    setSelectedTemplate({
      ...selectedTemplate,
      fields
    });
  };

  const resetFieldForm = () => {
    setFieldForm({ name: '', label: '', type: 'text', required: false });
    setDropdownOptionsString('');
    setEditingFieldIndex(null);
    setIsAddingNewField(false);
  };

  // Save template fields updates to database (updates version number)
  const handleSaveTemplateSchema = async () => {
    if (!selectedTemplate) return;

    setSaveLoading(true);
    try {
      const res = await fetch('/api/admin/cms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          type: selectedTemplate.type,
          fields: selectedTemplate.fields
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template schema');

      triggerAlert(`Template fields layout version successfully updated to v${data.template.version}.`, 'success');
      await fetchTemplates(selectedTemplate.id);
    } catch (err: any) {
      triggerAlert(err.message, 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const isSystemTemplate = (type: string) => {
    return ['PLOT', 'APARTMENT', 'RESIDENCY', 'COMMERCIAL'].includes(type);
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#0A0A0A] text-white">
        <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest text-white/40">Loading Template Configurator...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">Founder Portal</span>
          <h1 className="text-3xl font-light tracking-tight mt-1">Property Template Builder</h1>
          <p className="text-xs text-white/50 mt-1">Design form schemas dynamically for different types of properties. Fields appear in property listings, edit sheets, and frontend scorecards.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#C5A030] text-black text-xs uppercase tracking-widest font-bold rounded flex items-center gap-1.5 transition-all"
          >
            <Plus size={14} />
            <span>Create Custom Template</span>
          </button>
        </div>
      </div>

      {/* Alert Strip */}
      {alertInfo && (
        <div className={`p-4 rounded-lg border text-xs uppercase tracking-wider flex items-center gap-2 font-bold ${
          alertInfo.type === 'success' ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
          {alertInfo.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{alertInfo.text}</span>
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Template selection list */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-bold block mb-2">Available Categories</h3>
          <div className="space-y-3">
            {templates.map((t) => {
              const active = selectedTemplate?.id === t.id;
              const isSys = isSystemTemplate(t.type);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    resetFieldForm();
                  }}
                  className={`w-full text-left p-4 rounded-xl border flex justify-between items-center transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#D4AF37]/15 to-[#F5D67B]/5 border-[#D4AF37] text-white'
                      : 'bg-[#161616] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-xs text-white block">{t.name}</span>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-white/40 block mt-1">
                      Code: {t.type} • v{t.version}
                    </span>
                    <span className="text-[9px] text-white/30 block mt-0.5">
                      {t.fields?.length || 0} fields configured
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wider border ${
                      isSys 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                    }`}>
                      {isSys ? 'SYSTEM' : 'CUSTOM'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Schema configurator workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedTemplate ? (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
              
              {/* Workspace Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-light tracking-wide text-white flex items-center gap-2">
                    <FolderOpen size={18} className="text-[#D4AF37]" />
                    <span>{selectedTemplate.name} Schema Configuration</span>
                  </h2>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                    Template ID: {selectedTemplate.id} • Version: v{selectedTemplate.version}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenHistory}
                    className="px-3 py-1.5 border border-white/10 bg-[#1E1E1E] hover:bg-[#252525] text-white text-[10px] uppercase font-bold tracking-widest rounded flex items-center gap-1.5 transition-all"
                  >
                    <History size={12} className="text-[#D4AF37]" />
                    <span>History</span>
                  </button>

                  {!isSystemTemplate(selectedTemplate.type) && (
                    <button
                      onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                      className="px-3 py-1.5 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] uppercase font-bold tracking-widest rounded flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Fields List */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold block border-b border-white/5 pb-2">Fields Checklist</h3>
                
                {selectedTemplate.fields.length === 0 ? (
                  <div className="p-8 text-center text-white/30 italic text-xs border border-white/5 border-dashed rounded-xl">
                    No custom fields configured for this template. Use the "Add Field" workspace below to insert schema attributes.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTemplate.fields.map((f, idx) => (
                      <div key={idx} className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg flex justify-between items-center hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-white/30">#{idx + 1}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white">{f.label}</span>
                              {f.required && (
                                <span className="px-1.5 py-0.2 bg-red-500/10 text-red-400 text-[7px] uppercase font-bold border border-red-500/20 rounded">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-white/40 mt-0.5">
                              Database Key: <code className="text-[#D4AF37] font-mono">{f.name}</code> • Input type: <span className="uppercase text-white/60">{f.type}</span>
                              {f.options && f.options.length > 0 && ` • Options: (${f.options.join(', ')})`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleMoveField(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 border border-white/5 bg-[#1E1E1E] text-white rounded disabled:opacity-30 disabled:pointer-events-none"
                            title="Move Up"
                          >
                            <Edit size={10} className="rotate-180" />
                          </button>
                          <button
                            onClick={() => handleMoveField(idx, 'down')}
                            disabled={idx === selectedTemplate.fields.length - 1}
                            className="p-1.5 border border-white/5 bg-[#1E1E1E] text-white rounded disabled:opacity-30 disabled:pointer-events-none"
                            title="Move Down"
                          >
                            <Edit size={10} />
                          </button>
                          <button
                            onClick={() => handleEditFieldClick(idx)}
                            className="p-1.5 bg-blue-500/15 border border-blue-500/20 text-blue-400 rounded hover:bg-blue-500/25"
                            title="Edit Field Schema"
                          >
                            <Edit size={10} />
                          </button>
                          <button
                            onClick={() => handleDeleteFieldClick(idx)}
                            className="p-1.5 bg-red-500/15 border border-red-500/20 text-red-400 rounded hover:bg-red-500/25"
                            title="Remove Field"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Field Schema Form */}
              <div className="border border-white/5 bg-[#0A0A0A] rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
                    {editingFieldIndex !== null ? 'Modify Field Parameters' : 'Add Custom Field Schema Attribute'}
                  </h4>
                  {isAddingNewField && (
                    <button onClick={resetFieldForm} className="text-white/40 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {!isAddingNewField ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewField(true)}
                    className="w-full py-3 bg-[#161616] hover:bg-[#1E1E1E] border border-white/5 hover:border-white/10 rounded-lg text-xs uppercase tracking-wider font-bold text-white/55 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle size={14} className="text-[#D4AF37]" />
                    <span>Create custom input field attribute</span>
                  </button>
                ) : (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-white/40 font-bold block">Field Visual Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Total Floor Count"
                          value={fieldForm.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            // Pre-fill key name automatically
                            const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '');
                            setFieldForm({ ...fieldForm, label, name: key });
                          }}
                          className="w-full bg-[#161616] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-white/40 font-bold block">Database Key name (lowercase, no spaces)</label>
                        <input
                          type="text"
                          placeholder="e.g. total_floor_count"
                          value={fieldForm.name}
                          onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                          className="w-full bg-[#161616] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-white/40 font-bold block">Visual input widget type</label>
                        <select
                          value={fieldForm.type}
                          onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as any })}
                          className="w-full bg-[#161616] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50"
                        >
                          <option value="text">Text input</option>
                          <option value="number">Number input</option>
                          <option value="dropdown">Dropdown select list</option>
                          <option value="checkbox">Boolean checkbox</option>
                          <option value="multiselect">Multiselect tags list</option>
                          <option value="date">Calendar Date selector</option>
                          <option value="textarea">Textarea multi-line box</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-white/40 font-bold block">Field Requirement</label>
                        <select
                          value={String(fieldForm.required)}
                          onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.value === 'true' })}
                          className="w-full bg-[#161616] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50"
                        >
                          <option value="false">Optional field</option>
                          <option value="true">Required validation</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-white/40 block font-bold">List Options (if dropdown/multiselect)</label>
                        <input
                          type="text"
                          placeholder="Option 1, Option 2, Option 3"
                          value={dropdownOptionsString}
                          onChange={(e) => setDropdownOptionsString(e.target.value)}
                          disabled={fieldForm.type !== 'dropdown' && fieldForm.type !== 'multiselect'}
                          className="w-full bg-[#161616] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none disabled:opacity-40"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={resetFieldForm}
                        className="px-4 py-2 border border-white/5 bg-[#1C1C1C] hover:bg-[#252525] rounded text-[10px] uppercase font-bold tracking-widest transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="px-4 py-2 bg-[#D4AF37] hover:bg-[#C5A030] text-black rounded text-[10px] uppercase font-bold tracking-widest transition-colors"
                      >
                        {editingFieldIndex !== null ? 'Update field' : 'Insert field'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Master Save Button */}
              <div className="border-t border-white/5 pt-6 flex justify-end">
                <button
                  onClick={handleSaveTemplateSchema}
                  disabled={saveLoading}
                  className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white text-xs uppercase font-bold tracking-widest rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>Save Template Schema Version</span>
                </button>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-white/30 italic text-sm border border-white/5 bg-[#161616] rounded-2xl">
              Select or create a property template form layout to get started.
            </div>
          )}
        </div>
      </div>

      {/* Version History Modal Overlay */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161616] border border-white/10 p-6 rounded-xl w-full max-w-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  <History size={16} />
                  <span>Version History & Rollback Logs</span>
                </h3>
                <button onClick={() => setShowHistory(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {versionHistory.length === 0 ? (
                  <p className="text-xs text-white/30 italic text-center py-6">No previous versions registered.</p>
                ) : (
                  versionHistory.map((vh) => (
                    <div key={vh.id} className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-xs text-white">Version #{vh.version}</span>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          Change by: {vh.changedBy} • {new Date(vh.createdAt).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-white/30 mt-0.5">
                          Fields: {vh.fields ? (vh.fields as any[]).map(f => f.label).join(', ') : 'None'}
                        </p>
                      </div>
                      
                      {vh.version !== selectedTemplate?.version && (
                        <button
                          onClick={() => handleRollbackVersion(vh.version)}
                          disabled={saveLoading}
                          className="px-2.5 py-1.5 bg-[#D4AF37] hover:bg-[#C5A030] text-black text-[9px] uppercase tracking-widest font-extrabold rounded flex items-center gap-1 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw size={10} />
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Custom Template Modal Overlay */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161616] border border-white/10 p-6 rounded-xl w-full max-w-md space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  <PlusCircle size={16} />
                  <span>Create Custom Property Template</span>
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-white/40 block font-bold">Template Label Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Duplex Villa Template"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-white/40 block font-bold font-mono">Unique code identifier key (all caps)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DUPLEX_VILLA"
                    value={newTemplateType}
                    onChange={(e) => setNewTemplateType(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-white/40 block font-bold">Clone layout schema from</label>
                  <select
                    value={cloneFromId}
                    onChange={(e) => setCloneFromId(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded px-3 py-2 text-white focus:border-[#D4AF37]/50"
                  >
                    <option value="">-- Start from scratch --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        Clone from {t.name} (Code: {t.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-white/5 bg-[#1C1C1C] hover:bg-[#252525] rounded text-[10px] uppercase font-bold tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#C5A030] text-black rounded text-[10px] uppercase font-bold tracking-widest"
                  >
                    Create Template
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
