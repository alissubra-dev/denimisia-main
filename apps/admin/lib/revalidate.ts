/**
 * Revalidate the storefront cache after product mutations.
 * This ensures changes made in admin appear immediately on the storefront.
 */

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN || 'https://denimisia.com';
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

/**
 * Revalidate a specific product page
 */
export async function revalidateProduct(slug: string): Promise<void> {
  try {
    const url = new URL('/api/revalidate', WEB_ORIGIN);
    url.searchParams.set('path', `/products/${slug}`);
    if (REVALIDATION_SECRET) {
      url.searchParams.set('secret', REVALIDATION_SECRET);
    }
    await fetch(url.toString(), { cache: 'no-store' });
  } catch (err) {
    console.error('Failed to revalidate product:', err);
  }
}

/**
 * Revalidate product listing pages
 */
export async function revalidateProducts(): Promise<void> {
  try {
    const url = new URL('/api/revalidate', WEB_ORIGIN);
    url.searchParams.set('path', '/shop');
    url.searchParams.set('path', '/collections');
    if (REVALIDATION_SECRET) {
      url.searchParams.set('secret', REVALIDATION_SECRET);
    }
    await fetch(url.toString(), { cache: 'no-store' });
  } catch (err) {
    console.error('Failed to revalidate products:', err);
  }
}

/**
 * Revalidate collection pages
 */
export async function revalidateCollections(): Promise<void> {
  try {
    const url = new URL('/api/revalidate', WEB_ORIGIN);
    url.searchParams.set('path', '/collections');
    if (REVALIDATION_SECRET) {
      url.searchParams.set('secret', REVALIDATION_SECRET);
    }
    await fetch(url.toString(), { cache: 'no-store' });
  } catch (err) {
    console.error('Failed to revalidate collections:', err);
  }
}

/**
 * Revalidate homepage sections
 */
export async function revalidateHomepage(): Promise<void> {
  try {
    const url = new URL('/api/revalidate', WEB_ORIGIN);
    url.searchParams.set('path', '/');
    if (REVALIDATION_SECRET) {
      url.searchParams.set('secret', REVALIDATION_SECRET);
    }
    await fetch(url.toString(), { cache: 'no-store' });
  } catch (err) {
    console.error('Failed to revalidate homepage:', err);
  }
}

/**
 * Revalidate all product-related pages after any mutation
 */
export async function revalidateAllProductPages(slug?: string): Promise<void> {
  // Revalidate multiple key pages in parallel
  await Promise.all([
    revalidateHomepage(),
    revalidateProducts(),
    revalidateCollections(),
    slug ? revalidateProduct(slug) : Promise.resolve(),
    // Also revalidate special collections that show products
    fetch(new URL('/api/revalidate?path=/new-arrivals', WEB_ORIGIN), { cache: 'no-store' }).catch(() => {}),
    fetch(new URL('/api/revalidate?path=/trending', WEB_ORIGIN), { cache: 'no-store' }).catch(() => {}),
    fetch(new URL('/api/revalidate?path=/collections/bestsellers', WEB_ORIGIN), { cache: 'no-store' }).catch(() => {}),
  ]);
}