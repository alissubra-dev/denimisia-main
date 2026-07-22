'use client';

import { ImageUploader } from './image-uploader';

// Variant matrix builder. Full (color × size) matrix:
//  - Each color has its own list of sizes
//  - Each (color, size) pair has its own stock count
// On product create, every entry becomes one CreateVariantDto row with an
// auto-generated SKU. The template `sizes` field just seeds new colors so
// the admin doesn't have to retype S/M/L for every color.

export interface SizeEntry {
  /** Stable id for React keys. */
  id: string;
  /** Size label as shown to the customer: "S", "M", "30", etc. */
  label: string;
  stock: number;
}

export interface ColorEntry {
  /** Stable id so React keys + image uploaders don't lose state on reorder. */
  id: string;
  name: string;
  /** Original name from the database - used to track variants when name changes */
  originalName?: string;
  images: string[];
  /**
   * Optional hex (e.g. "#1B1B1B"). Used as the swatch fallback when the
   * color has no uploaded images yet. The storefront's selector prefers
   * variant images; this is a nicety so the admin can preview "Olive" as
   * an actual olive dot before photos are added.
   */
  hex?: string;
  /** Per-color size list. Each size has its own stock. */
  sizes: SizeEntry[];
}

export interface VariantsBuilderValue {
  colors: ColorEntry[];
}

interface VariantsBuilderProps {
  value: VariantsBuilderValue;
  onChange: (next: VariantsBuilderValue) => void;
  token: string | undefined;
  /**
   * Existing variants loaded from the database.
   * Used to track which variants can be deleted.
   */
  existingVariants?: Array<{ id: string; color: string; size: string }>;
  /**
   * Callback when a color/variant should be deleted via API
   */
  onDeleteVariant?: (variantId: string) => Promise<void>;
  /**
   * Callback when variant images should be updated via API
   */
  onUpdateVariantImages?: (color: string, images: string[]) => Promise<void>;
  /**
   * Size labels used to pre-fill a new color when "+ Add color" is clicked.
   * Typically the Main Variant's size labels so additional colors inherit
   * the same size set with stocks defaulted to 0. Falls back to one blank
   * size row when empty.
   */
  seedSizes?: string[];
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function ColorSwatchPreview({
  imageUrl,
  hex,
}: {
  imageUrl?: string;
  hex?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Color preview"
        className="h-8 w-8 rounded-full object-cover border border-outline-variant/20"
      />
    );
  }
  if (hex) {
    return (
      <span
        className="h-8 w-8 rounded-full border border-outline-variant/20"
        style={{ backgroundColor: hex }}
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full border border-outline-variant/20 bg-gradient-to-br from-white via-gray-100 to-gray-300" />
  );
}

function ColorSwatch({
  hex,
  images,
}: {
  hex?: string;
  images: string[];
}) {
  const preview = images[0] || hex;
  if (!preview) {
    return (
      <span className="block h-6 w-6 rounded-full border border-outline-variant/20 bg-gradient-to-br from-white via-gray-100 to-gray-300" />
    );
  }
  if (preview.startsWith('#')) {
    return (
      <span
        className="block h-6 w-6 rounded-full border border-outline-variant/20"
        style={{ backgroundColor: preview }}
      />
    );
  }
  return (
    <img
      src={preview}
      alt="Swatch"
      className="h-6 w-6 rounded-full object-cover border border-outline-variant/20"
    />
  );
}

export function VariantsBuilder({
  value,
  onChange,
  token,
  existingVariants = [],
  onDeleteVariant,
  onUpdateVariantImages,
  seedSizes = [],
}: VariantsBuilderProps) {
  const { colors } = value;

  const update = (patch: Partial<VariantsBuilderValue>) => {
    onChange({ ...value, ...patch });
  };

  const seedSizeEntries = (): SizeEntry[] => {
    if (seedSizes.length === 0) {
      return [{ id: crypto.randomUUID(), label: '', stock: 0 }];
    }
    return seedSizes.map((label) => ({
      id: crypto.randomUUID(),
      label,
      stock: 0,
    }));
  };

  // Find existing variant IDs for a given color
  // Uses originalName if available to handle color name changes
  const getExistingVariantIdsForColor = (color: ColorEntry): string[] => {
    // Use originalName if it exists (meaning the color name was changed)
    const lookupName = color.originalName || color.name;
    return existingVariants
      .filter(v => v.color?.toLowerCase() === lookupName?.toLowerCase())
      .map(v => v.id);
  };

  const addColor = () => {
    update({
      colors: [
        ...colors,
        {
          id: crypto.randomUUID(),
          name: '',
          images: [],
          hex: '',
          sizes: seedSizeEntries(),
        },
      ],
    });
  };

  const updateColor = (id: string, patch: Partial<ColorEntry>) => {
    const color = colors.find(c => c.id === id);
    if (!color) return;

    // For NEW colors (not loaded from database), we should NEVER track originalName
    // Only existing colors loaded from DB should have originalName set
    // Check if this color has existing variants to determine if it's from DB
    const hasExistingVariants = getExistingVariantIdsForColor(color).length > 0;

    // Only track originalName for EXISTING colors when they are renamed
    // For new colors, we don't set originalName at all
    if (patch.name && hasExistingVariants && color.originalName === undefined && color.name) {
      // This is an existing color being renamed - track the original name
      patch.originalName = color.name;
    }

    // If images are being updated and there's an existing variant for this color, save them
    if (patch.images && onUpdateVariantImages && color.name) {
      const existingIds = getExistingVariantIdsForColor(color);
      if (existingIds.length > 0) {
        // Update images for all existing variants of this color
        onUpdateVariantImages(color.originalName || color.name, patch.images).catch(console.error);
      }
    }

    update({
      colors: colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const removeColor = async (id: string) => {
    const color = colors.find((c) => c.id === id);
    if (!color) return;

    // If there are existing variants for this color, delete them via API
    if (onDeleteVariant && color.name) {
      const existingIds = getExistingVariantIdsForColor(color);
      for (const variantId of existingIds) {
        try {
          await onDeleteVariant(variantId);
        } catch (err) {
          console.error('Failed to delete variant:', err);
        }
      }
    }

    update({ colors: colors.filter((c) => c.id !== id) });
  };

  const addSize = (colorId: string) => {
    updateColor(colorId, {
      sizes: [
        ...(colors.find((c) => c.id === colorId)?.sizes ?? []),
        { id: crypto.randomUUID(), label: '', stock: 0 },
      ],
    });
  };

  const updateSize = (
    colorId: string,
    sizeId: string,
    patch: Partial<SizeEntry>,
  ) => {
    const color = colors.find((c) => c.id === colorId);
    if (!color) return;
    updateColor(colorId, {
      sizes: color.sizes.map((s) => (s.id === sizeId ? { ...s, ...patch } : s)),
    });
  };

  const removeSize = (colorId: string, sizeId: string) => {
    const color = colors.find((c) => c.id === colorId);
    if (!color) return;
    // If there's an existing variant for this color+size, delete it
    if (onDeleteVariant && color.name) {
      const sizeLabel = color.sizes.find(s => s.id === sizeId)?.label;
      if (sizeLabel) {
        const existingVariant = existingVariants.find(
          v => v.color?.toLowerCase() === color.name?.toLowerCase() &&
               v.size?.toLowerCase() === sizeLabel?.toLowerCase()
        );
        if (existingVariant) {
          onDeleteVariant(existingVariant.id).catch(console.error);
        }
      }
    }
    updateColor(colorId, {
      sizes: color.sizes.filter((s) => s.id !== sizeId),
    });
  };

  return (
    <div className="space-y-6">
      {colors.map((color, idx) => {
        const firstImage = color.images[0];
        const swatchHex = color.hex && isValidHex(color.hex) ? color.hex : undefined;
        return (
          <div
            key={color.id}
            className="border border-outline-variant/15 bg-surface-container/40 p-4"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary w-6">
                {String(idx + 1).padStart(2, '0')}
              </span>

              {/* Circular swatch preview — image wins, hex fallback,
                  neutral checker if neither set yet. Same visual the
                  customer sees on the product detail page. */}
              <ColorSwatchPreview imageUrl={firstImage} hex={swatchHex} />

              <div className="flex-1">
                <input
                  type="text"
                  value={color.name}
                  onChange={(e) => updateColor(color.id, { name: e.target.value })}
                  placeholder="e.g. Black, Olive, Off White"
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm font-medium text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
              </div>

              <input
                type="color"
                value={color.hex || '#cccccc'}
                onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label="Pick swatch color"
                title="Hex shown as the solid PDP swatch when set"
              />

              <button
                type="button"
                onClick={() => removeColor(color.id)}
                className="text-secondary hover:text-error"
                title="Delete this color and all its sizes"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="ml-9 space-y-4">
              {/* Per-color image upload — optional, but if provided, the PDP
                  prioritises these over the general product images. */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Photos for this color
                </p>
                <ImageUploader
                  value={color.images}
                  onChange={(images) => updateColor(color.id, { images })}
                  token={token}
                  folder="products"
                  maxFiles={6}
                />
              </div>

              {/* Per-size stock grid for this color. Each row is one
                  size label + its own stock count. Add/remove freely;
                  an empty label row is silently skipped at submit. */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    Sizes &amp; stock
                  </p>
                  <button
                    type="button"
                    onClick={() => addSize(color.id)}
                    className="text-[10px] font-bold uppercase tracking-widest text-primary"
                  >
                    + Add size
                  </button>
                </div>

                <div className="space-y-2">
                  {color.sizes.map((sz) => (
                    <div key={sz.id} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={sz.label}
                        onChange={(e) =>
                          updateSize(color.id, sz.id, { label: e.target.value })
                        }
                        placeholder="Size (e.g. M, 32)"
                        className="flex-1 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                      />
                      <input
                        type="number"
                        value={sz.stock}
                        onChange={(e) =>
                          updateSize(color.id, sz.id, {
                            stock: Number(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min="0"
                        className="w-20 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => removeSize(color.id, sz.id)}
                        className="text-secondary hover:text-error"
                      >
                        <span className="material-symbols-outlined text-sm">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addColor}
        className="w-full rounded-sm border border-dashed border-outline-variant/30 py-4 text-[10px] font-bold uppercase tracking-widest text-secondary hover:border-primary hover:text-primary transition-colors"
      >
        + Add color
      </button>
    </div>
  );
}

export function buildVariantsFromBuilder(
  product: { slug: string },
  builder: VariantsBuilderValue,
): {
  sku: string;
  size: string;
  color: string;
  colorHex?: string;
  stock: number;
  images?: string[];
}[] {
  const colorList = builder.colors.filter(
    (c) => c.name.trim().length > 0 && c.sizes.some((s) => s.label.trim()),
  );
  if (colorList.length === 0) return [];

  const slugCode = product.slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(2, 'X');

  return colorList.flatMap((color) => {
    const colorCode = color.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3)
      .padEnd(2, 'X');
    return color.sizes
      .filter((s) => s.label.trim().length > 0)
      .map((sz) => {
        const sizeCode = sz.label.replace(/[^A-Za-z0-9]/g, '');
        return {
          sku: `${slugCode}-${colorCode}-${sizeCode}`,
          size: sz.label.trim(),
          color: color.name.trim(),
          ...(color.hex ? { colorHex: color.hex } : {}),
          stock: sz.stock,
          ...(color.images.length > 0 ? { images: color.images } : {}),
        };
      });
  });
}