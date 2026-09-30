import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { CategoryAttributeSchema, CategoryAttributeDefinition } from '../types';
import { authFetch } from '../utils/apiClient';
import { DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS } from '../data/defaultCategoryAttributes';

interface AttributeEditorProps {
  categories?: any[];
  onSchemaUpdated?: () => void;
}

export const AttributeEditor: React.FC<AttributeEditorProps> = ({ categories = [], onSchemaUpdated }) => {
  const [schemas, setSchemas] = useState<CategoryAttributeSchema[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSchemas();
  }, []);

  const categoryNames = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach((c) => {
        const name = typeof c === 'string' ? c : c?.name || c?.id;
        if (name && !list.includes(name)) list.push(name);
      });
    }

    // Include categories from default schemas if not present
    DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.forEach((s) => {
      if (s?.category && !list.includes(s.category)) {
        list.push(s.category);
      }
    });

    return list;
  }, [categories]);

  const fetchSchemas = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/category-attributes');
      if (res.ok) {
        const data = await res.json();
        const schemasList: CategoryAttributeSchema[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.schemas)
          ? data.schemas
          : [];

        if (schemasList.length > 0) {
          setSchemas(schemasList);
          if (!selectedCategory) {
            setSelectedCategory(schemasList[0].category);
          }
        } else {
          setSchemas(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS);
          if (!selectedCategory && DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.length > 0) {
            setSelectedCategory(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS[0].category);
          }
        }
      } else {
        setSchemas(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS);
        if (!selectedCategory && DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.length > 0) {
          setSelectedCategory(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS[0].category);
        }
      }
    } catch (e) {
      console.warn('Error fetching category schemas, falling back to defaults:', e);
      setSchemas(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS);
      if (!selectedCategory && DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS.length > 0) {
        setSelectedCategory(DEFAULT_CATEGORY_ATTRIBUTE_SCHEMAS[0].category);
      }
    } finally {
      setLoading(false);
    }
  };

  // Ensure selectedCategory is initialized
  useEffect(() => {
    if (!selectedCategory && categoryNames.length > 0) {
      setSelectedCategory(categoryNames[0]);
    }
  }, [selectedCategory, categoryNames]);

  const currentSchema: CategoryAttributeSchema | undefined = useMemo(() => {
    if (!Array.isArray(schemas)) return undefined;
    return schemas.find((s) => s && s.category === selectedCategory);
  }, [schemas, selectedCategory]);

  const handleAddAttribute = () => {
    if (!selectedCategory) return;
    const existing = currentSchema;
    const baseSchema: CategoryAttributeSchema = existing || {
      id: `schema-${selectedCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category: selectedCategory,
      description: `Hardware specifications for ${selectedCategory}`,
      attributes: [],
      updatedAt: new Date().toISOString(),
    };

    const newAttr: CategoryAttributeDefinition = {
      id: `attr_${Date.now()}`,
      name: '',
      type: 'text',
      placeholder: 'e.g. Value',
      displayInOverview: true,
    };

    const updated: CategoryAttributeSchema = {
      ...baseSchema,
      attributes: [...(baseSchema.attributes || []), newAttr],
    };

    if (existing) {
      setSchemas((prev) => (Array.isArray(prev) ? prev.map((s) => (s.category === selectedCategory ? updated : s)) : [updated]));
    } else {
      setSchemas((prev) => [...(Array.isArray(prev) ? prev : []), updated]);
    }
  };

  const handleRemoveAttribute = (id: string) => {
    if (!currentSchema) return;
    const updated: CategoryAttributeSchema = {
      ...currentSchema,
      attributes: (currentSchema.attributes || []).filter((a) => a.id !== id),
    };
    setSchemas((prev) => (Array.isArray(prev) ? prev.map((s) => (s.category === selectedCategory ? updated : s)) : [updated]));
  };

  const handleUpdateAttribute = (idx: number, patch: Partial<CategoryAttributeDefinition>) => {
    if (!currentSchema || !Array.isArray(currentSchema.attributes)) return;
    const updatedAttrs = [...currentSchema.attributes];
    updatedAttrs[idx] = { ...updatedAttrs[idx], ...patch };
    const updated: CategoryAttributeSchema = {
      ...currentSchema,
      attributes: updatedAttrs,
    };
    setSchemas((prev) => (Array.isArray(prev) ? prev.map((s) => (s.category === selectedCategory ? updated : s)) : [updated]));
  };

  const handleSave = async () => {
    if (!selectedCategory) return;
    const schemaToSave = currentSchema || {
      id: `schema-${selectedCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category: selectedCategory,
      description: `Hardware specifications schema for ${selectedCategory}`,
      attributes: [],
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await authFetch('/api/category-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemaToSave),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Hardware schema for "${selectedCategory}" saved successfully.` });
        onSchemaUpdated?.();
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save schema.' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ type: 'error', text: e?.message || 'Error connecting to server.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Category Specification Attributes
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure dynamic hardware specification fields and spec-sheet keys per category.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setStatusMessage(null);
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
          >
            {categoryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchSchemas}
            disabled={loading}
            title="Refresh schemas"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Schema'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {currentSchema && Array.isArray(currentSchema.attributes) && currentSchema.attributes.length > 0 ? (
        <div className="space-y-3">
          {currentSchema.attributes.map((attr, idx) => (
            <div
              key={attr.id || idx}
              className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                  Field Label
                </label>
                <input
                  type="text"
                  value={attr.name}
                  onChange={(e) => handleUpdateAttribute(idx, { name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Socket, VRAM, TDP"
                />
              </div>

              <div className="w-full sm:w-32">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                  Data Type
                </label>
                <select
                  value={attr.type}
                  onChange={(e) => handleUpdateAttribute(idx, { type: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Dropdown</option>
                  <option value="boolean">Yes / No</option>
                </select>
              </div>

              <div className="w-full sm:w-24">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                  Unit (opt)
                </label>
                <input
                  type="text"
                  value={attr.unit || ''}
                  onChange={(e) => handleUpdateAttribute(idx, { unit: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="GHz, W, GB"
                />
              </div>

              {attr.type === 'select' && (
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(attr.options) ? attr.options.join(', ') : ''}
                    onChange={(e) =>
                      handleUpdateAttribute(idx, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="AM4, AM5, LGA1700"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 self-end sm:self-center mt-2 sm:mt-5">
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(attr.id)}
                  title="Remove attribute"
                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddAttribute}
            className="w-full py-3 border border-dashed border-slate-700 hover:border-indigo-500/60 hover:bg-indigo-500/5 rounded-xl text-xs font-semibold text-slate-300 hover:text-indigo-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Specification Field
          </button>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm">
            No specification attributes defined for <strong className="text-slate-200">{selectedCategory}</strong> yet.
          </p>
          <button
            type="button"
            onClick={handleAddAttribute}
            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Initialize Attributes for {selectedCategory}
          </button>
        </div>
      )}
    </div>
  );
};
