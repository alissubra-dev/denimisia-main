/**
 * Meta Pixel tracking helper for Denimisia e-commerce events
 *
 * Usage:
 * import { trackMetaEvent } from '@/lib/meta-pixel';
 *
 * trackMetaEvent('ViewContent', { content_ids: ['product-123'], value: 2500, currency: 'BDT' });
 * trackMetaEvent('AddToCart', { content_ids: ['product-123'], value: 2500, currency: 'BDT' });
 * trackMetaEvent('InitiateCheckout', { content_ids: ['product-123'], value: 2500, currency: 'BDT', num_items: 1 });
 * trackMetaEvent('Purchase', { value: 2500, currency: 'BDT', content_ids: ['product-123'] }, 'purchase_order_123');
 */

const META_PIXEL_ID = '3968375216817052';

interface MetaEventData {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
}

declare global {
  interface Window {
    fbq: (
      command: string,
      eventName: string,
      data?: MetaEventData,
      options?: { eventID?: string }
    ) => void;
    _fbq: unknown;
  }
}

/**
 * Track a Meta Pixel event
 * @param eventName - The event name (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase)
 * @param data - Event data
 * @param eventId - Optional event ID for deduplication with CAPI
 */
export function trackMetaEvent(
  eventName: string,
  data?: MetaEventData,
  eventId?: string
): void {
  if (typeof window === 'undefined') return;

  const fbq = window.fbq;
  if (!fbq) {
    console.warn('[Meta Pixel] fbq not loaded yet');
    return;
  }

  try {
    if (eventId) {
      fbq('track', eventName, data, { eventID: eventId });
    } else {
      fbq('track', eventName, data);
    }
  } catch (error) {
    console.error('[Meta Pixel] Error tracking event:', error);
  }
}

/**
 * Track ViewContent event when user views a product
 */
export function trackViewContent(productId: string, productName: string, value: number, currency = 'BDT'): void {
  trackMetaEvent('ViewContent', {
    content_ids: [productId],
    content_type: 'product',
    content_name: productName,
    value,
    currency,
  });
}

/**
 * Track AddToCart event when user adds product to cart
 */
export function trackAddToCart(
  productId: string,
  value: number,
  currency = 'BDT',
  quantity = 1
): void {
  trackMetaEvent('AddToCart', {
    content_ids: [productId],
    content_type: 'product',
    value,
    currency,
    contents: [{ id: productId, quantity }],
  });
}

/**
 * Track InitiateCheckout when user starts checkout
 */
export function trackInitiateCheckout(
  items: Array<{ productId: string; quantity: number }>,
  value: number,
  currency = 'BDT'
): void {
  trackMetaEvent('InitiateCheckout', {
    content_ids: items.map((item) => item.productId),
    content_type: 'product',
    value,
    currency,
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
  });
}

/**
 * Track Purchase event after successful order
 * IMPORTANT: Use the same eventId in both Pixel (browser) and CAPI (server) for deduplication
 */
export function trackPurchase(
  orderId: string,
  value: number,
  currency = 'BDT',
  items: Array<{ productId: string; quantity: number }>
): void {
  // Use purchase_{orderId} as eventId to match CAPI event
  const eventId = `purchase_${orderId}`;

  trackMetaEvent(
    'Purchase',
    {
      value,
      currency,
      content_ids: items.map((item) => item.productId),
      content_type: 'product',
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    },
    eventId
  );
}

export { META_PIXEL_ID };
