/**
 * Section type → component switch.
 *
 * SectionRenderer is intentionally dumb: page.tsx pre-fetches all the data
 * any section might need (products, bundles, etc.) into a single bag, then
 * SectionRenderer picks the slice each section type needs.
 *
 * Multi-instance behaviour:
 * - Slot-based sections (HERO, CATEGORY_CARDS, BRAND_STORY) read slotKey or
 *   slotGroupKey from `section.config` so each instance can target its own
 *   slot. Defaults (hero_main, brand_story_backdrop, home.category_cards)
 *   preserve the legacy visuals.
 * - EDITORIAL_BANNER accepts a `slotGroupKey` so two instances can point
 *   at different slot groups (e.g., home.editorial + home.editorial_secondary).
 * - Product-row sections (NEW_ARRIVALS, TRENDING, BESTSELLERS) currently
 *   show the same data across instances. Per-instance product filtering
 *   is a v2 extension.
 */

import { HeroSection } from '@/components/home/hero-section';
import { CategoryCards } from '@/components/home/category-cards';
import { NewArrivals } from '@/components/home/new-arrivals';
import { EditorialBanner } from '@/components/home/editorial-banner';
import { BundleDeals } from '@/components/home/bundle-deals';
import { TrendingSection } from '@/components/home/trending-section';
import { BestSellers } from '@/components/home/best-sellers';
import { BrandStory } from '@/components/home/brand-story';
import {
  type HomepageSection,
  readEditorialBannerConfig,
  readNewArrivalsConfig,
  readBundleDealsConfig,
  readTrendingConfig,
  readBestsellersConfig,
  readHeroConfig,
  readBrandStoryConfig,
  readCategoryCardsConfig,
} from '@/lib/homepage-sections';

interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage: string | undefined;
  colourCount: number;
  showStarBadge: boolean;
}

export interface SectionData {
  newArrivals: ProductCard[];
  trending: ProductCard[];
  bestsellers: ProductCard[];
}

interface SectionRendererProps {
  readonly section: HomepageSection;
  readonly data: SectionData;
}

export async function SectionRenderer({ section, data }: SectionRendererProps) {
  switch (section.type) {
    case 'HERO': {
      const cfg = readHeroConfig(section.config);
      return <HeroSection slotKey={cfg.slotKey} />;
    }

    case 'CATEGORY_CARDS': {
      const cfg = readCategoryCardsConfig(section.config);
      return <CategoryCards slotGroupKey={cfg.slotGroupKey} />;
    }

    case 'NEW_ARRIVALS': {
      const cfg = readNewArrivalsConfig(section.config);
      return (
        <NewArrivals
          products={data.newArrivals}
          title={cfg.title}
          limit={cfg.limit}
        />
      );
    }

    case 'EDITORIAL_BANNER': {
      const { slotGroupKey, slotKeyPrefix } = readEditorialBannerConfig(
        section.config,
      );
      return (
        <EditorialBanner
          slotGroupKey={slotGroupKey}
          slotKeyPrefix={slotKeyPrefix}
        />
      );
    }

    case 'BUNDLE_DEALS': {
      const cfg = readBundleDealsConfig(section.config);
      return <BundleDeals title={cfg.title} limit={cfg.limit} />;
    }

    case 'TRENDING': {
      const cfg = readTrendingConfig(section.config);
      return (
        <TrendingSection
          products={data.trending}
          title={cfg.title}
          limit={cfg.limit}
        />
      );
    }

    case 'BESTSELLERS': {
      const cfg = readBestsellersConfig(section.config);
      return <BestSellers products={data.bestsellers} title={cfg.title} />;
    }

    case 'BRAND_STORY': {
      const cfg = readBrandStoryConfig(section.config);
      return <BrandStory slotKey={cfg.slotKey} />;
    }
  }
}
