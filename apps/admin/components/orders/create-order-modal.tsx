'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch, adminPost } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  variants: Variant[];
}

interface Variant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
}

interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  productName: string;
  variantName: string;
}

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  apiBase: string;
  token: string | undefined;
}

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function CreateOrderModal({
  open,
  onClose,
  onCreated,
  apiBase,
  token,
}: CreateOrderModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch products on mount
  useEffect(() => {
    if (!open || !token) return;
    setLoadingProducts(true);
    adminFetch<{ products: Product[] }>(`/products/admin/all?limit=100`, token)
      .then((data) => {
        setProducts(data.products ?? []);
      })
      .catch(() => {
        setError('Failed to load products');
      })
      .finally(() => {
        setLoadingProducts(false);
      });
  }, [open, token]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setShippingAddress('');
      setNotes('');
      setItems([]);
      setSelectedProductId('');
      setSelectedVariantId('');
      setQuantity(1);
      setError('');
    }
  }, [open]);

  // Update variants when product is selected
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const variants = selectedProduct?.variants ?? [];

  const handleAddItem = useCallback(() => {
    if (!selectedProductId || !selectedVariantId || quantity < 1) return;
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    const variantName = [variant.size, variant.color].filter(Boolean).join(' - ');

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProductId,
        variantId: selectedVariantId,
        quantity,
        price: variant.price,
        productName: selectedProduct.name,
        variantName: variantName || variant.sku,
      },
    ]);
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity(1);
  }, [selectedProductId, selectedVariantId, quantity, selectedProduct, variants]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = 0; // Could be calculated based on address
  const total = subtotal + shippingCost;

  const handleSubmit = async () => {
    if (!token) return;
    if (!customerName || !customerEmail || !customerPhone) {
      setError('Customer name, email, and phone are required');
      return;
    }
    if (items.length === 0) {
      setError('At least one product is required');
      return;
    }
    if (!shippingAddress) {
      setError('Shipping address is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const orderData = {
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingAddress: {
          address: shippingAddress,
        },
        guestName: customerName,
        guestEmail: customerEmail,
        guestPhone: customerPhone,
        notes: notes || undefined,
      };

      await adminPost(`${apiBase}/orders/admin`, orderData, token);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-sm shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface-container-lowest px-8 py-6 border-b border-outline-variant/10">
          <div>
            <h2 className="font-headline text-2xl font-semibold uppercase tracking-[0.15em] text-on-surface">
              Create Order
            </h2>
            <p className="mt-1 font-body text-xs tracking-wide text-secondary">
              Manually create an order (e.g., from phone call)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-error/10 text-error text-xs font-semibold uppercase tracking-widest rounded-sm">
              {error}
            </div>
          )}

          {/* Customer Info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary"
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary"
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Add Products */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
              Add Products
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId('');
                  }}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface focus:outline-none focus:border-primary"
                  disabled={loadingProducts}
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Variant
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface focus:outline-none focus:border-primary"
                  disabled={!selectedProductId}
                >
                  <option value="">Select variant</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.size || ''} {variant.color || ''} - {variant.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProductId || !selectedVariantId}
                  className="w-full px-4 py-3 bg-surface-container-high text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-highest transition-colors duration-300 ease-editorial disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          {items.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                Order Items
              </h3>
              <div className="bg-surface-container-low rounded-sm border border-outline-variant/10 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Product
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Variant
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-center">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right">
                        Price
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right">
                        Total
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-on-surface">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-secondary">
                          {item.variantName}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface text-right">
                          {BDT_FORMATTER.format(item.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface text-right font-semibold">
                          {BDT_FORMATTER.format(item.price * item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-secondary hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-container-low/30">
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right text-on-surface">
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-on-surface">
                        {BDT_FORMATTER.format(subtotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Shipping Address */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
              Shipping Address
            </h3>
            <textarea
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary"
              rows={3}
              placeholder="Enter complete shipping address"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
              Order Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-sm text-sm text-on-surface placeholder:text-secondary/50 focus:outline-none focus:border-primary"
              rows={2}
              placeholder="Optional notes for this order"
            />
          </div>

          {/* Order Total */}
          <div className="flex justify-end">
            <div className="bg-surface-container-high px-6 py-4 rounded-sm">
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-secondary">Subtotal:</span>
                <span className="text-on-surface font-semibold">{BDT_FORMATTER.format(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8 text-sm mt-2">
                <span className="text-secondary">Shipping:</span>
                <span className="text-on-surface font-semibold">{BDT_FORMATTER.format(shippingCost)}</span>
              </div>
              <div className="flex justify-between gap-8 text-sm mt-2 pt-2 border-t border-outline-variant/20">
                <span className="text-on-surface font-bold uppercase tracking-wider">Total:</span>
                <span className="text-primary font-bold">{BDT_FORMATTER.format(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-4 px-8 py-6 bg-surface-container-lowest border-t border-outline-variant/10">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-surface-container-high text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-highest transition-colors duration-300 ease-editorial"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || items.length === 0}
            className="px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}