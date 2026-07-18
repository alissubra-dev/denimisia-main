/**
 * Revalidate the storefront cache after product mutations.
 * Note: Currently disabled due to Netlify redirect issues.
 * The API-level caching has been disabled via @NoCache() decorator.
 */

export async function revalidateAllProductPages(slug?: string): Promise<void> {
  // Revalidation is disabled - the API now uses @NoCache() to prevent caching
  // This function is kept for future use if needed
  console.log('[Revalidate] Disabled - using API-level @NoCache() instead');
}