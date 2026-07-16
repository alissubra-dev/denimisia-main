'use client';

import { useState, useEffect } from 'react';
import {
  UNIVERSAL_ATTRIBUTES,
  TYPE_ATTRIBUTES_DEFAULT,
  getProductTypes,
  getUniversalAttributeOptions,
  getTypeAttributeOptions,
  saveCustomTaxonomy,
  type ProductType,
} from '@/lib/product-taxonomy';

export interface TagPair {
  dimension: string;
  value: string;
}

interface AttributeSpec {
  required: boolean;
  multi: boolean;
  options: readonly string[];
}

interface Props {
  type: ProductType | null;
  selected: TagPair[];
  onChange: (next: TagPair[]) => void;
}

/**
 * Renders the dimension chip-pickers for the universal attributes (season,
 * occasion, material, pattern) plus the type-specific dimensions (e.g.
 * silhouette, rise, sleeve). Selection is stored canonically as lowercase
 * (`dimension`, `value`) pairs so the API can match them against synonyms.
 */
export function TypeAttributeFields({ type, selected, onChange }: Props) {
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [productTypes, setProductTypes] = useState<readonly string[]>(getProductTypes());

  useEffect(() => {
    setProductTypes(getProductTypes());
  }, []);

  const handleAddCustomValue = () => {
    if (!showAddModal || !customValue.trim()) return;

    const customKey = showAddModal;
    const currentData = JSON.parse(localStorage.getItem('denimisia_custom_taxonomy') || '{"customTypes":[], "customAttributes":{}}');

    if (!currentData.customAttributes[customKey]) {
      currentData.customAttributes[customKey] = [];
    }

    if (!currentData.customAttributes[customKey].includes(customValue.trim())) {
      currentData.customAttributes[customKey].push(customValue.trim());
      saveCustomTaxonomy(currentData);
    }

    setCustomValue('');
    setShowAddModal(null);

    // Trigger re-render by updating state
    window.location.reload();
  };

  if (!type) {
    return (
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
        Select a type to configure attributes.
      </p>
    );
  }

  const allDims: Record<string, AttributeSpec> = {
    ...(UNIVERSAL_ATTRIBUTES as unknown as Record<string, AttributeSpec>),
    ...TYPE_ATTRIBUTES_DEFAULT[type],
  };

  const isSelected = (dimension: string, value: string) =>
    selected.some((s) => s.dimension === dimension && s.value === value);

  const toggle = (dimension: string, value: string, multi: boolean) => {
    if (multi) {
      const has = isSelected(dimension, value);
      const next = has
        ? selected.filter(
            (s) => !(s.dimension === dimension && s.value === value),
          )
        : [...selected, { dimension, value }];
      onChange(next);
      return;
    }
    const cleared = selected.filter((s) => s.dimension !== dimension);
    onChange([...cleared, { dimension, value }]);
  };

  const getOptions = (dimension: string): string[] => {
    if (UNIVERSAL_ATTRIBUTES[dimension as keyof typeof UNIVERSAL_ATTRIBUTES]) {
      return getUniversalAttributeOptions(dimension);
    }
    return getTypeAttributeOptions(type, dimension);
  };

  return (
    <div className="space-y-6">
      {Object.entries(allDims).map(([dimension, spec]) => {
        const options = getOptions(dimension);
        return (
          <div key={dimension}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              {dimension}
              {spec.required ? <span className="text-primary"> *</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const value = opt.toLowerCase();
                const active = isSelected(dimension, value);
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => toggle(dimension, value, spec.multi)}
                    className={
                      active
                        ? 'rounded-full border border-primary bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-on-primary'
                        : 'rounded-full border border-outline-variant/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-secondary hover:border-on-surface hover:text-on-surface transition-colors duration-200'
                    }
                  >
                    {opt}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowAddModal(dimension)}
                className="rounded-full border border-dashed border-outline-variant/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-secondary hover:border-primary hover:text-primary transition-colors duration-200"
              >
                + Add custom
              </button>
            </div>
          </div>
        );
      })}

      {/* Add Custom Value Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(null)} />
          <div className="relative z-10 bg-surface-container-lowest p-6 rounded-sm shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-4">
              Add Custom {showAddModal}
            </h3>
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={`Enter ${showAddModal} value`}
              className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomValue()}
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(null)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomValue}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
