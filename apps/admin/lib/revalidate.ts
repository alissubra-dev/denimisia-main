/**
 * Revalidate the storefront cache after product mutations.
 * This ensures changes made in admin appear immediately on the storefront.
 */

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN || 'https://denimisia.com';

/**
 * Revalidate a specific path on the storefront
 */
async function revalidatePath(path: string): Promise<boolean> {
  try {
    const url = new URL(`/api/revalidate?path=${encodeURIComponent(path)}`, WEB_ORIGIN);
    console.log('[Revalidate] Calling:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
    });

    const result = await response.json();
    console.log('[Revalidate] Response:', result);

    return response.ok;
  } catch (err) {
    console.error('[Revalidate] Failed:', err);
    return false;
  }
}

/**
 * Revalidate a specific product page
 */
export async function revalidateProduct(slug: string): Promise<void> {
  await revalidatePath(`/products/${slug}`);
}

/**
 * Revalidate product listing pages
 */
export async function revalidateProducts(): Promise<void> {
  await Promise.all([
    revalidatePath('/shop'),
    revalidatePath('/collections'),
  ]);
}

/**
 * Revalidate collection pages
 */
export async function revalidateCollections(): Promise<void> {
  await revalidatePath('/collections');
}

/**
 * Revalidate homepage sections
 */
export async function revalidateHomepage(): Promise<void> {
  await revalidatePath('/');
}

/**
 * Revalidate all product-related pages after any mutation
 */
export async function revalidateAllProductPages(slug?: string): Promise<void> {
  console.log('[Revalidate] Starting revalidation for:', slug || 'all pages');

  // Revalidate multiple key pages
  const pages = [
    '/',
    '/shop',
    '/collections',
    '/new-arrivals',
    '/trending',
    '/collections/bestsellers',
  ];

  if (slug) {
    pages.push(`/products/${slug}`);
  }

  // Revalidate all pages in parallel but wait for each
  for (const page of pages) {
    await revalidatePath(page);
  }

  console.log('[Revalidate] Completed');
}