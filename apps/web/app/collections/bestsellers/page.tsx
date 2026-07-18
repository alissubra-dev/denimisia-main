import type { Metadata } from 'next';
import { BestsellersCollection } from '@/components/bestsellers/bestsellers-collection';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { buildMetadata } from '@/lib/seo/metadata';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  isFeatured: boolean;
  variants: { id: string; size: string; color: string; price: string; stock: number }[];
}

interface ProductsResponse {
  products: ApiProduct[];
  total: number;
}

export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: 'Bestsellers',
  description:
    "The pieces our community keeps coming back for. Ranked by reorders, restocks, and time on waitlist — Denimisia's most-loved styles.",
  pathname: '/collections/bestsellers',
});

async function getProducts(): Promise<ApiProduct[]> {
  try {
    // First try to get featured products (these are the bestsellers)
    const res = await fetch(`${API}/products/featured?limit=20`, { next: { revalidate: 60 } });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        return json.data;
      }
    }

    // Fallback: get products with isTrending=true
    const trendingRes = await fetch(`${API}/products/trending?limit=20`, { next: { revalidate: 60 } });
    if (trendingRes.ok) {
      const json = await trendingRes.json();
      if (json.success && json.data?.length > 0) {
        return json.data;
      }
    }

    // Final fallback: get recent products
    const recentRes = await fetch(`${API}/products?limit=20`, { next: { revalidate: 60 } });
    if (recentRes.ok) {
      const json = await recentRes.json();
      if (json.success) {
        return json.data.products || [];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export default async function BestsellersCollectionPage() {
  const productsData = await getProducts();

  const products = productsData.map((p) => {
    const colors = new Set(p.variants.map((v) => v.color));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: resolveProductImage(p.images[0], p.slug),
      hoverImage: resolveHoverImage(p.images[1], p.slug),
      colourCount: colors.size,
    };
  });

  return (
    <BestsellersCollection
      products={products}
      isPlaceholder={products.length === 0}
    />
  );
}
