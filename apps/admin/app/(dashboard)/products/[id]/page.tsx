'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { revalidateAllProductPages } from '@/lib/revalidate';
import { Banner } from '@/components/admin-ui';
import { ConfirmModal } from '@/components/modal';
import { ImageUploader } from '@/components/image-uploader';
import { PlacementToggle } from '@/components/placement-toggle';
import {
  VariantsBuilder,
  buildVariantsFromBuilder,
  type VariantsBuilderValue,
} from '@/components/variants-builder';
import { RichTextEditor } from '@/components/rich-text-editor';
import {
  TypeAttributeFields,
  type TagPair,
} from '@/components/products/type-attribute-fields';
import {
  SizeAndFitEditor,
  type ChartRow,
} from '@/components/products/size-and-fit-editor';
import type { FitLandmarks } from '@repo/fit-engine';
import {
  PRODUCT_TYPES,
  TYPE_ATTRIBUTES,
  UNIVERSAL_ATTRIBUTES,
  type ProductType,
} from '@/lib/product-taxonomy';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Variant {
  id: string;
  size?: string;
  color?: string;
  colorHex?: string | null;
  stock: number;
  price?: number;
  sku?: string;
  images?: string[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  categoryId?: string;
  category?: Category;
  tags?: string[];
  isFeatured: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  showStarBadge: boolean;
  images?: string[];
  variants?: Variant[];
  type?: ProductType | null;
  productTags?: TagPair[];
  fitLandmarks?: unknown;
  sizeCharts?: Array<{
    sizeKey: string;
    dimension: string;
    valueIn: number;
  }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function formatBdt(value: number): string {
  return value.toLocaleString('en-BD');
}

/** Convert API variants to VariantsBuilder format */
function convertVariantsToBuilder(variants: Variant[]): VariantsBuilderValue {
  const colorMap = new Map<string, { id: string; name: string; originalName: string; hex?: string; images: string[]; sizes: { id: string; label: string; stock: number }[] }>();

  for (const v of variants) {
    const colorName = (v.color || '').trim();
    if (!colorName) continue;

    if (!colorMap.has(colorName)) {
      colorMap.set(colorName, {
        id: `color-${crypto.randomUUID()}`,
        name: colorName,
        originalName: colorName, // Track original name for proper variant matching
        hex: v.colorHex || undefined,
        images: v.images || [],
        sizes: [],
      });
    }

    const color = colorMap.get(colorName)!;
    if (v.size?.trim()) {
      color.sizes.push({
        id: `size-${crypto.randomUUID()}`,
        label: v.size.trim(),
        stock: v.stock,
      });
    }
  }

  return { colors: Array.from(colorMap.values()) };
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Product form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [showStarBadge, setShowStarBadge] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  // Product type + attribute tags drive the chatbot's product finder.
  // Hydrated from the API response in fetchProduct().
  const [type, setType] = useState<ProductType | null>(null);
  const [productTags, setProductTags] = useState<TagPair[]>([]);
  const [sizeCharts, setSizeCharts] = useState<ChartRow[]>([]);
  const [fitLandmarks, setFitLandmarks] = useState<FitLandmarks | null>(null);

  // Variant state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsBuilder, setVariantsBuilder] = useState<VariantsBuilderValue>({ colors: [] });
  // Per-colour image editing for existing variants. Saving applies the image
  // set to every variant of the same colour (the API enforces they match).
  const [imageEditVariant, setImageEditVariant] = useState<Variant | null>(null);
  const [imageEditUrls, setImageEditUrls] = useState<string[]>([]);
  const [savingImages, setSavingImages] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const product = await adminFetch<Product>(
        `/products/admin/${productId}`,
        token,
      );
      setName(product.name);
      setSlug(product.slug);
      setDescription(product.description ?? '');
      setPrice(String(product.price));
      setCompareAtPrice(
        product.compareAtPrice ? String(product.compareAtPrice) : '',
      );
      setCategoryId(product.categoryId ?? product.category?.id ?? '');
      setTags((product.tags ?? []).join(', '));
      setIsFeatured(product.isFeatured);
      setIsTrending(product.isTrending ?? false);
      setIsNewArrival(product.isNewArrival ?? false);
      setShowStarBadge(product.showStarBadge ?? false);
      setImages(product.images ?? []);
      // Convert API variants to builder format
      const loadedVariants = product.variants ?? [];
      setVariants(loadedVariants);
      const builderColors = convertVariantsToBuilder(loadedVariants);
      setVariantsBuilder(builderColors);
      setType((product.type ?? null) as ProductType | null);
      setProductTags(
        (product.productTags ?? []).map((t) => ({
          dimension: t.dimension,
          value: t.value,
        })),
      );
      setSizeCharts(
        (product.sizeCharts ?? []).map((s) => ({
          sizeKey: s.sizeKey,
          dimension: s.dimension,
          valueIn: s.valueIn,
        })),
      );
      setFitLandmarks(
        (product.fitLandmarks ?? null) as FitLandmarks | null,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load product';
      if (message.includes('404')) {
        notFound();
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (!token) return;
    setCategoriesError('');
    adminFetch<Category[] | { categories: Category[] }>('/categories', token)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.categories ?? []);
        setCategories(list);
      })
      .catch((err: unknown) => {
        setCategoriesError(
          err instanceof Error ? err.message : 'Failed to load categories',
        );
      });
  }, [token]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Client-side enforcement of the required-attribute rule the API also
    // checks. Keeps round-trips down for the common case.
    if (!type) {
      setError('Type is required.');
      return;
    }
    const missingDims: string[] = [];
    const universalSpec = UNIVERSAL_ATTRIBUTES as unknown as Record<
      string,
      { required: boolean }
    >;
    for (const [dim, spec] of Object.entries(universalSpec)) {
      if (spec.required && !productTags.some((t) => t.dimension === dim)) {
        missingDims.push(dim);
      }
    }
    const typeAttrs = type && type in TYPE_ATTRIBUTES ? TYPE_ATTRIBUTES[type as keyof typeof TYPE_ATTRIBUTES] : {};
    for (const [dim, spec] of Object.entries(typeAttrs) as [string, { required?: boolean }][]) {
      if (spec.required && !productTags.some((t) => t.dimension === dim)) {
        missingDims.push(dim);
      }
    }
    if (missingDims.length > 0) {
      setError(`Missing required attributes: ${missingDims.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const body = {
        name,
        slug: slug || slugify(name),
        description,
        price: Number(price),
        ...(compareAtPrice
          ? { compareAtPrice: Number(compareAtPrice) }
          : { compareAtPrice: null }),
        ...(categoryId ? { categoryId } : {}),
        tags: tagList,
        isFeatured,
        isTrending,
        isNewArrival,
        showStarBadge,
        images,
        type,
        productTags,
        sizeCharts,
        fitLandmarks,
      };

      // Save any new variants from the VariantsBuilder
      const newVariants = buildVariantsFromBuilder(
        { slug: slug || slugify(name) },
        variantsBuilder,
      );

      // First, update the product
      await adminFetch(`/products/${productId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      // Now save/update variants - we need to handle this properly:
      // 1. For colors that existed before, update their properties via PATCH
      // 2. For completely new colors, create new variants via POST

      const currentSlug = slug || slugify(name);
      let hasVariantError = false;

      console.log('=== DEBUG VARIANT SAVE ===');
      console.log('Original variants:', variants.map(v => ({ id: v.id, color: v.color, size: v.size })));
      console.log('Builder colors:', JSON.stringify(variantsBuilder.colors.map(c => ({ name: c.name, originalName: c.originalName, sizes: c.sizes.map(s => ({ label: s.label })) })), null, 2));

      // Build a map of original variants for lookup
      // Key: lowercase "color|size" -> Variant
      const originalVariantMap = new Map<string, Variant>();
      for (const v of variants) {
        const colorName = (v.color || '').trim().toLowerCase();
        const sizeName = (v.size || '').trim().toLowerCase();
        if (colorName && sizeName) {
          originalVariantMap.set(`${colorName}|${sizeName}`, v);
        }
      }
      console.log('Original variant map keys:', Array.from(originalVariantMap.keys()));

      // Update existing variants with their new values
      for (const builderColor of variantsBuilder.colors) {
        if (!builderColor.name) continue;

        // Use originalName to look up existing variants (in case color name was changed)
        // If originalName exists, use it; otherwise use the current name
        const lookupName = builderColor.originalName || builderColor.name;
        console.log(`Processing color: ${builderColor.name}, lookupName: ${lookupName}`);

        // For each size in this color, update or create the variant
        for (const sizeEntry of builderColor.sizes) {
          if (!sizeEntry.label) continue;

          // Look up existing variant using the ORIGINAL color name
          const key = `${lookupName.toLowerCase()}|${sizeEntry.label.toLowerCase()}`;
          console.log(`  Looking up key: "${key}"`);
          const existingVariant = originalVariantMap.get(key);
          console.log(`  Found existing:`, existingVariant ? existingVariant.id : 'NO');

          if (existingVariant) {
            // Update existing variant - send all relevant fields including color and colorHex
            try {
              const updateData: Record<string, unknown> = {
                stock: sizeEntry.stock,
                color: builderColor.name, // Send color name in case it changed
              };
              // Only add colorHex if it has a valid hex value
              if (builderColor.hex && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(builderColor.hex)) {
                updateData.colorHex = builderColor.hex;
              }
              if (builderColor.images.length > 0) {
                updateData.images = builderColor.images;
              }

              await adminFetch(`/products/${productId}/variants/${existingVariant.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify(updateData),
              });
            } catch (err) {
              console.error(`Failed to update variant: ${err}`);
              hasVariantError = true;
            }
          } else {
            // Create new variant (color/size combination that didn't exist before)
            const slugCode = currentSlug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(2, 'X');
            const colorCode = builderColor.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(2, 'X');
            const sizeCode = sizeEntry.label.replace(/[^A-Za-z0-9]/g, '');

            console.log(`  Creating NEW variant: color=${builderColor.name}, size=${sizeEntry.label}, colorCode=${colorCode}, sizeCode=${sizeCode}`);

            try {
              const variantData: Record<string, unknown> = {
                sku: `${slugCode}-${colorCode}-${sizeCode}`,
                size: sizeEntry.label,
                color: builderColor.name,
                stock: sizeEntry.stock,
              };
              if (builderColor.hex && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(builderColor.hex)) {
                variantData.colorHex = builderColor.hex;
              }
              if (builderColor.images.length > 0) {
                variantData.images = builderColor.images;
              }

              console.log(`  POST variant data:`, JSON.stringify(variantData));

              await adminFetch(`/products/${productId}/variants`, token, {
                method: 'POST',
                body: JSON.stringify(variantData),
              });
            } catch (err) {
              // If we get a 409 Conflict, it means the variant already exists
              // Try to find and update it instead
              if (err instanceof Error && err.message.includes('409')) {
                console.log(`Variant exists, trying to update: ${builderColor.name} / ${sizeEntry.label}`);
                const key = `${builderColor.name.toLowerCase()}|${sizeEntry.label.toLowerCase()}`;
                const existingByNewName = originalVariantMap.get(key);

                if (existingByNewName) {
                  try {
                    const updateData: Record<string, unknown> = {
                      stock: sizeEntry.stock,
                    };
                    if (builderColor.hex && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(builderColor.hex)) {
                      updateData.colorHex = builderColor.hex;
                    }
                    await adminFetch(`/products/${productId}/variants/${existingByNewName.id}`, token, {
                      method: 'PATCH',
                      body: JSON.stringify(updateData),
                    });
                    console.log(`Successfully updated existing variant ${existingByNewName.id}`);
                  } catch (updateErr) {
                    console.error(`Failed to update existing variant: ${updateErr}`);
                    hasVariantError = true;
                  }
                } else {
                  console.error(`Could not find existing variant for key: ${key}`);
                  hasVariantError = true;
                }
              } else {
                console.error(`Failed to create variant: ${err}`);
                hasVariantError = true;
              }
            }
          }
        }
      }

      // Only redirect if no errors occurred
      if (!hasVariantError) {
        // Revalidate storefront cache so changes appear immediately
        await revalidateAllProductPages(currentSlug);

        // Force full page reload to ensure fresh data is loaded
        window.location.href = '/products';
      } else {
        setError('Some variants could not be saved. Please check the console for details.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await adminFetch(`/products/${productId}`, token, { method: 'DELETE' });

      // Revalidate storefront cache so deleted product disappears immediately
      await revalidateAllProductPages(slug);

      setConfirmDeleteOpen(false);
      // Force full page reload to ensure fresh data is loaded
      window.location.href = '/products';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  // Variants are now managed via VariantsBuilder component below
  const [confirmVariantDeleteId, setConfirmVariantDeleteId] = useState<string | null>(null);
  const [deletingVariant, setDeletingVariant] = useState(false);

  const handleDeleteVariant = async () => {
    // Variant deletion is now handled via the VariantsBuilder component
  };

  const handleSaveVariantImages = async () => {
    if (!token || !imageEditVariant) return;
    setSavingImages(true);
    try {
      const color = imageEditVariant.color ?? '';
      // Use bulk endpoint to update all variants of this color at once
      await adminFetch<Variant[]>(
        `/products/${productId}/variants-by-color/${encodeURIComponent(color)}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ images: imageEditUrls }) },
      );
      // Update local state with new images for all variants of this color
      setVariants((prev) =>
        prev.map((v) =>
          (v.color ?? '') === color ? { ...v, images: imageEditUrls } : v,
        ),
      );

      // Revalidate storefront cache so new images appear immediately
      await revalidateAllProductPages(slug);

      setImageEditVariant(null);
      setImageEditUrls([]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update images');
    } finally {
      setSavingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
          Loading garment archive...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            Atelier · Edit Entry
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            {name || 'Untitled Garment'}
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Revise piece details, variants, and storefront placement.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/products')}
            className="inline-flex items-center gap-2 bg-surface-container-highest px-6 py-2 text-xs font-semibold uppercase tracking-widest text-on-surface border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              arrow_back
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-2 bg-[#c62828] px-6 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-opacity duration-300 ease-editorial hover:opacity-90"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              delete
            </span>
            Delete
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <Banner tone="error" message={error} />}
      {categoriesError && (
        <Banner tone="error" message={categoriesError} />
      )}

      <form
        onSubmit={handleUpdate}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Main Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Basic Info */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                I · Identity
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                draft
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Product Name <span className="text-primary">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Slug
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
                />
              </label>

              <div className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Description
                </span>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the product. Use the toolbar for bold, headings, bullet lists, and links."
                />
                <p className="mt-1.5 text-[11px] text-secondary">
                  Use headings (H2/H3) for sections, bullet lists for spec
                  details, and bold/italic for emphasis. Formatting renders
                  exactly the same on the storefront.
                </p>
              </div>
            </div>
          </section>

          {/* Type + Attributes — drives the product-finder bot */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                I·b · Attributes
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                tune
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Type <span className="text-primary">*</span>
                </span>
                <select
                  value={type ?? ''}
                  onChange={(e) =>
                    setType((e.target.value || null) as ProductType | null)
                  }
                  required
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <TypeAttributeFields
                type={type}
                selected={productTags}
                onChange={setProductTags}
              />

              <div className="border-t border-outline-variant/20 pt-6">
                <SizeAndFitEditor
                  type={type}
                  variantSizes={Array.from(
                    new Set(
                      variants
                        .map((v) => (v.size ?? '').trim())
                        .filter((s) => s.length > 0),
                    ),
                  )}
                  chartValue={sizeCharts}
                  onChartChange={setSizeCharts}
                  fitLandmarks={fitLandmarks}
                  onFitChange={setFitLandmarks}
                />
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                II · Pricing
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                payments
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Price (BDT) <span className="text-primary">*</span>
                </span>
                <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                  <span className="text-sm text-secondary">BDT </span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min="0"
                    step="1"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Compare At Price
                </span>
                <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                  <span className="text-sm text-secondary">BDT </span>
                  <input
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface focus:outline-none focus:ring-0"
                  />
                </div>
              </label>
            </div>
          </section>

          {/* Images */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                III · Imagery
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                image
              </span>
            </header>

            <ImageUploader
              value={images}
              onChange={setImages}
              token={token}
              folder="products"
              maxFiles={12}
            />
            <p className="mt-4 text-[10px] tracking-wide text-secondary">
              First image is used as the product cover. Hover a thumbnail to
              reorder or remove.
            </p>
          </section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Organization */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                IV · Taxonomy
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                category
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Category
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Tags
                </span>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="casual, summer, slim-fit"
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
              </label>
            </div>
          </section>

          {/* Featured toggle — prominent */}
          <section
            className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]"
          >
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                V · Placement
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                {isFeatured ? 'star' : 'star_outline'}
              </span>
            </header>

            <div className="space-y-6">
              <PlacementToggle
                label="Best Seller"
                description="Surfaces this piece on the homepage Best Sellers tab."
                checked={isFeatured}
                onChange={setIsFeatured}
              />
              <PlacementToggle
                label="Trending"
                description="Adds this piece to the Trending row on the homepage."
                checked={isTrending}
                onChange={setIsTrending}
              />
              <PlacementToggle
                label="New Arrival"
                description="Pins this piece into the New Arrivals section."
                checked={isNewArrival}
                onChange={setIsNewArrival}
              />
              <PlacementToggle
                label="Star Badge on Card"
                description="Renders a ★ badge over this product's card in any list."
                checked={showStarBadge}
                onChange={setShowStarBadge}
              />
            </div>
          </section>

          {/* Submit */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity duration-300 ease-editorial hover:opacity-90 disabled:opacity-50"
            >
              <span
                className="material-symbols-outlined text-sm"
                aria-hidden
              >
                save
              </span>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="w-full inline-flex items-center justify-center bg-surface-container-highest px-6 py-3 text-xs font-semibold uppercase tracking-widest text-on-surface border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Variants Section */}
      <section className="mt-12 bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
              VI · Variants
            </p>
            <h3 className="mt-2 font-headline text-2xl font-semibold uppercase tracking-[0.15em] text-on-surface">
              Sizing & Colorways
            </h3>
            <p className="mt-2 text-[11px] tracking-wide text-secondary">
              {variants.length}{' '}
              {variants.length === 1 ? 'variant' : 'variants'} archived.
            </p>
          </div>
          <span
            className="material-symbols-outlined text-secondary"
            aria-hidden
          >
            inventory_2
          </span>
        </header>

        {/* Existing variants table */}
        {variants.length > 0 && (
          <div className="mb-8 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Size
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Color
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Stock
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Price
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    SKU
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {variants.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-on-surface">
                      {v.size ?? (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      <span className="inline-flex items-center gap-2">
                        {v.colorHex && (
                          <span
                            aria-hidden
                            className="inline-block h-3.5 w-3.5 rounded-full border border-outline-variant/30"
                            style={{ backgroundColor: v.colorHex }}
                            title={v.colorHex}
                          />
                        )}
                        {v.color ?? (
                          <span className="text-secondary">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-on-surface">
                        {v.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {v.price != null ? (
                        <>
                          <span className="text-secondary">BDT </span>
                          {formatBdt(v.price)}
                        </>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-mono tracking-tight text-secondary">
                      {v.sku ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setImageEditVariant(v);
                          setImageEditUrls(v.images ?? []);
                        }}
                        className="mr-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          image
                        </span>
                        Images
                        {v.images && v.images.length ? ` (${v.images.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmVariantDeleteId(v.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          delete
                        </span>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Additional Variants - using VariantsBuilder */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary mb-4">
            Add color
          </p>
          <VariantsBuilder
            value={variantsBuilder}
            onChange={setVariantsBuilder}
            token={token}
            existingVariants={variants.map(v => ({ id: v.id, color: v.color || '', size: v.size || '' }))}
            onDeleteVariant={async (variantId: string) => {
              if (!token) return;
              await adminFetch(`/products/${productId}/variants/${variantId}`, token, {
                method: 'DELETE',
              });
              setVariants(prev => prev.filter(v => v.id !== variantId));
            }}
            onUpdateVariantImages={async (color: string, images: string[]) => {
              if (!token) return;
              await adminFetch<Variant[]>(
                `/products/${productId}/variants-by-color/${encodeURIComponent(color)}`,
                token,
                { method: 'PATCH', body: JSON.stringify({ images }) },
              );
              setVariants(prev =>
                prev.map(v =>
                  (v.color ?? '') === color ? { ...v, images } : v,
                ),
              );
            }}
          />
        </div>
      </section>

      <ConfirmModal
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteProduct}
        title="Delete product"
        message="Delete this product? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />

      <ConfirmModal
        open={confirmVariantDeleteId !== null}
        onCancel={() => setConfirmVariantDeleteId(null)}
        onConfirm={handleDeleteVariant}
        title="Delete variant"
        message="Delete this variant? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deletingVariant}
      />

      {imageEditVariant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (!savingImages) setImageEditVariant(null);
          }}
        >
          <div
            className="w-full max-w-lg border border-outline-variant/20 bg-surface-container p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-on-surface">
              Variant Images
            </h3>
            <p className="mb-4 mt-1 text-[10px] tracking-wide text-secondary">
              Applies to all{' '}
              {imageEditVariant.color
                ? `"${imageEditVariant.color}"`
                : 'same-colour'}{' '}
              variants of this product.
            </p>
            <ImageUploader
              value={imageEditUrls}
              onChange={setImageEditUrls}
              token={token}
              folder="products"
              maxFiles={8}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImageEditVariant(null)}
                disabled={savingImages}
                className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariantImages}
                disabled={savingImages}
                className="bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingImages ? 'Saving...' : 'Save Images'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
