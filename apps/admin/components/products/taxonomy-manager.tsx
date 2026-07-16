'use client';

import { useState, useEffect } from 'react';
import { UNIVERSAL_ATTRIBUTES, getProductTypes, saveCustomTaxonomy, type ProductType } from '@/lib/product-taxonomy';

interface CustomTaxonomy {
  customTypes: string[];
  customAttributes: Record<string, string[]>;
}

const STORAGE_KEY = 'denimisia_custom_taxonomy';

function loadCustomTaxonomy(): CustomTaxonomy {
  if (typeof window === 'undefined') {
    return { customTypes: [], customAttributes: {} };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { customTypes: [], customAttributes: {} };
  } catch {
    return { customTypes: [], customAttributes: {} };
  }
}

interface Props {
  onUpdate?: () => void;
}

export function TaxonomyManager({ onUpdate }: Props) {
  const [customData, setCustomData] = useState<CustomTaxonomy>({ customTypes: [], customAttributes: {} });
  const [productTypes, setProductTypes] = useState<readonly string[]>([]);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState('');
  const [deletingType, setDeletingType] = useState<string | null>(null);

  // For custom attributes
  const [editingAttr, setEditingAttr] = useState<{ dimension: string; value: string } | null>(null);
  const [editingAttrValue, setEditingAttrValue] = useState('');
  const [deletingAttr, setDeletingAttr] = useState<{ dimension: string; value: string } | null>(null);
  const [addingAttr, setAddingAttr] = useState<string | null>(null);
  const [addingAttrValue, setAddingAttrValue] = useState('');

  useEffect(() => {
    setCustomData(loadCustomTaxonomy());
    setProductTypes(getProductTypes());
  }, []);

  const handleSave = (newData: CustomTaxonomy) => {
    saveCustomTaxonomy(newData);
    setCustomData(newData);
    setProductTypes(getProductTypes());
    onUpdate?.();
  };

  const handleEditType = (oldType: string) => {
    if (!editingTypeValue.trim()) return;
    const newData = {
      ...customData,
      customTypes: customData.customTypes.map(t => t === oldType ? editingTypeValue.trim().toUpperCase() : t),
    };
    handleSave(newData);
    setEditingType(null);
    setEditingTypeValue('');
  };

  const handleDeleteType = (type: string) => {
    const newData = {
      ...customData,
      customTypes: customData.customTypes.filter(t => t !== type),
    };
    handleSave(newData);
    setDeletingType(null);
  };

  const handleAddAttr = (dimension: string) => {
    if (!addingAttrValue.trim()) return;
    const newData = {
      ...customData,
      customAttributes: {
        ...customData.customAttributes,
        [dimension]: [...(customData.customAttributes[dimension] || []), addingAttrValue.trim()],
      },
    };
    handleSave(newData);
    setAddingAttr(null);
    setAddingAttrValue('');
  };

  const handleEditAttr = (dimension: string, oldValue: string) => {
    if (!editingAttrValue.trim()) return;
    const newData = {
      ...customData,
      customAttributes: {
        ...customData.customAttributes,
        [dimension]: (customData.customAttributes[dimension] || []).map(v => v === oldValue ? editingAttrValue.trim() : v),
      },
    };
    handleSave(newData);
    setEditingAttr(null);
    setEditingAttrValue('');
  };

  const handleDeleteAttr = (dimension: string, value: string) => {
    const newData = {
      ...customData,
      customAttributes: {
        ...customData.customAttributes,
        [dimension]: (customData.customAttributes[dimension] || []).filter(v => v !== value),
      },
    };
    handleSave(newData);
    setDeletingAttr(null);
  };

  const universalDimensions = Object.keys(UNIVERSAL_ATTRIBUTES);

  return (
    <div className="space-y-8">
      {/* Custom Product Types */}
      <section>
        <div className="mb-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary">category</span>
          <h3 className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
            Custom Product Types
          </h3>
        </div>

        {customData.customTypes.length === 0 ? (
          <p className="text-[11px] text-secondary italic">No custom types added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customData.customTypes.map((type) => (
              <div
                key={type}
                className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5"
              >
                {editingType === type ? (
                  <input
                    type="text"
                    value={editingTypeValue}
                    onChange={(e) => setEditingTypeValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEditType(type)}
                    onBlur={() => handleEditType(type)}
                    autoFocus
                    className="w-24 bg-transparent text-xs font-bold uppercase tracking-wider text-on-surface focus:outline-none"
                  />
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                    {type}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingType(type); setEditingTypeValue(type); }}
                  className="ml-1 text-secondary hover:text-primary"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-xs">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingType(type)}
                  className="text-secondary hover:text-error"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-xs">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Custom Attribute Values */}
      <section>
        <div className="mb-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary">tune</span>
          <h3 className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
            Custom Attribute Values
          </h3>
        </div>

        {universalDimensions.map((dimension) => {
          const customAttrs = customData.customAttributes[dimension] || [];
          const defaultAttrs = UNIVERSAL_ATTRIBUTES[dimension as keyof typeof UNIVERSAL_ATTRIBUTES]?.options || [];

          return (
            <div key={dimension} className="mb-6 rounded-sm border border-outline-variant/15 bg-surface-container-low p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  {dimension}
                </h4>
                <button
                  type="button"
                  onClick={() => setAddingAttr(dimension)}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  + Add Value
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Default values (read-only) */}
                {defaultAttrs.map((opt) => (
                  <span
                    key={opt}
                    className="rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-1 text-[11px] text-secondary"
                    title="Default value"
                  >
                    {opt}
                  </span>
                ))}

                {/* Custom values (editable) */}
                {customAttrs.map((attr) => (
                  <div
                    key={attr}
                    className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1"
                  >
                    {editingAttr?.dimension === dimension && editingAttr?.value === attr ? (
                      <input
                        type="text"
                        value={editingAttrValue}
                        onChange={(e) => setEditingAttrValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditAttr(dimension, attr)}
                        onBlur={() => handleEditAttr(dimension, attr)}
                        autoFocus
                        className="w-24 bg-transparent text-xs font-bold uppercase tracking-wider text-on-surface focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {attr}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditingAttr({ dimension, value: attr }); setEditingAttrValue(attr); }}
                      className="text-secondary hover:text-primary"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingAttr({ dimension, value: attr })}
                      className="text-secondary hover:text-error"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                ))}

                {customAttrs.length === 0 && (
                  <span className="text-[10px] text-secondary italic">No custom values added.</span>
                )}
              </div>

              {/* Add new attribute value inline */}
              {addingAttr === dimension && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={addingAttrValue}
                    onChange={(e) => setAddingAttrValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttr(dimension)}
                    placeholder={`Add ${dimension} value`}
                    autoFocus
                    className="flex-1 border-b border-outline-variant/30 bg-transparent py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddAttr(dimension)}
                    className="text-xs font-bold uppercase tracking-wider text-primary"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingAttr(null); setAddingAttrValue(''); }}
                    className="text-xs font-bold uppercase tracking-wider text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Delete Type Confirmation Modal */}
      {deletingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingType(null)} />
          <div className="relative z-10 bg-surface-container-lowest p-6 rounded-sm shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-2">
              Delete Product Type?
            </h3>
            <p className="text-xs text-secondary mb-4">
              Are you sure you want to delete &quot;{deletingType}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingType(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteType(deletingType)}
                className="px-4 py-2 bg-error text-white text-xs font-semibold uppercase tracking-widest hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Attribute Confirmation Modal */}
      {deletingAttr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingAttr(null)} />
          <div className="relative z-10 bg-surface-container-lowest p-6 rounded-sm shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-2">
              Delete Attribute Value?
            </h3>
            <p className="text-xs text-secondary mb-4">
              Are you sure you want to delete &quot;{deletingAttr.value}&quot; from {deletingAttr.dimension}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingAttr(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAttr(deletingAttr.dimension, deletingAttr.value)}
                className="px-4 py-2 bg-error text-white text-xs font-semibold uppercase tracking-widest hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}