/**
 * Shared types for the CMS Section Composer admin page.
 *
 * String values MUST match the Prisma `HomepageSectionType` enum in
 * packages/database/prisma/schema.prisma. If you change a name here,
 * change it there too and run a migration.
 */

export type HomepageSectionType =
  | 'HERO'
  | 'CATEGORY_CARDS'
  | 'NEW_ARRIVALS'
  | 'EDITORIAL_BANNER'
  | 'BUNDLE_DEALS'
  | 'TRENDING'
  | 'BESTSELLERS'
  | 'BRAND_STORY';

export interface HomepageSection {
  readonly id: string;
  readonly type: HomepageSectionType;
  readonly position: number;
  readonly isActive: boolean;
  readonly config: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GlobalStorefrontStyles {
  readonly id: string;
  readonly negativeSpace: number;  // 0=tight, 1=default, 2=airy
  readonly typographyFlow: number; // 0=tight, 1=default, 2=loose
}

export interface AuditLogEntry {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly details: unknown;
  readonly createdAt: string;
  readonly user?: { firstName?: string; lastName?: string; email?: string } | null;
}

interface SectionTypeMeta {
  readonly label: string;
  readonly description: string;
  readonly icon: string;             // material-symbols-outlined name
  readonly contentEditor?: string;   // /admin route where slot content for this type is edited
  readonly defaultConfig: Record<string, unknown>;
}

export const SECTION_TYPE_META: Record<HomepageSectionType, SectionTypeMeta> = {
  HERO: {
    label: 'Hero banner',
    description: 'Fullscreen image or video at the top of the page.',
    icon: 'photo_library',
    defaultConfig: { slotKey: 'hero_main' },
  },
  CATEGORY_CARDS: {
    label: 'Category cards',
    description: 'Three tiles below the hero linking to category pages.',
    icon: 'grid_view',
    defaultConfig: { slotGroupKey: 'home.category_cards' },
  },
  NEW_ARRIVALS: {
    label: 'New arrivals row',
    description: 'Horizontal product row showing newly-added products.',
    icon: 'fiber_new',
    defaultConfig: { title: 'New Arrivals', limit: 17 },
  },
  EDITORIAL_BANNER: {
    label: 'Editorial carousel',
    description: 'Auto-sliding fullwidth carousel of editorial slides.',
    icon: 'view_carousel',
    defaultConfig: { slotGroupKey: 'home.editorial' },
  },
  BUNDLE_DEALS: {
    label: 'Bundle deals',
    description: 'Product bundles shown as cards.',
    icon: 'inventory_2',
    defaultConfig: { title: 'Bundle Deals', limit: 4 },
  },
  TRENDING: {
    label: 'Trending row',
    description: 'Horizontal product row of admin-flagged trending products.',
    icon: 'trending_up',
    defaultConfig: { title: 'Trending', limit: 8 },
  },
  BESTSELLERS: {
    label: 'Bestsellers',
    description: 'Curated row of bestseller products.',
    icon: 'star',
    defaultConfig: { title: 'Bestsellers' },
  },
  BRAND_STORY: {
    label: 'Brand story',
    description: 'Backdrop image with brand narrative text.',
    icon: 'auto_stories',
    defaultConfig: { slotKey: 'brand_story_backdrop' },
  },
};

/** Section types whose `config` field has user-editable values. */
export const HAS_CONFIG_FIELDS: ReadonlySet<HomepageSectionType> = new Set<HomepageSectionType>([
  'HERO',
  'CATEGORY_CARDS',
  'EDITORIAL_BANNER',
  'NEW_ARRIVALS',
  'BUNDLE_DEALS',
  'TRENDING',
  'BESTSELLERS',
  'BRAND_STORY',
]);

/**
 * How each section type resolves its content. Used to drive the section
 * config form: 'single' types render a slotKey picker, 'group' types
 * render a slotGroupKey picker, 'product' types skip slot binding.
 */
export const SLOT_TYPE_INFO: Record<
  HomepageSectionType,
  'single' | 'group' | 'product'
> = {
  HERO: 'single',
  CATEGORY_CARDS: 'group',
  EDITORIAL_BANNER: 'group',
  BRAND_STORY: 'single',
  NEW_ARRIVALS: 'product',
  BESTSELLERS: 'product',
  TRENDING: 'product',
  BUNDLE_DEALS: 'product',
};

/**
 * The default slotKey/slotGroupKey used when a new section is inserted.
 * Drives both the section config default and the auto-suggestion logic
 * in the admin insert flow.
 */
export const DEFAULT_SLOT_KEYS: Record<
  Extract<HomepageSectionType, 'HERO' | 'BRAND_STORY'>,
  string
> = {
  HERO: 'hero_main',
  BRAND_STORY: 'brand_story_backdrop',
};

export const DEFAULT_SLOT_GROUP_KEYS: Record<
  Extract<HomepageSectionType, 'CATEGORY_CARDS' | 'EDITORIAL_BANNER'>,
  string
> = {
  CATEGORY_CARDS: 'home.category_cards',
  EDITORIAL_BANNER: 'home.editorial',
};

/**
 * Suggested unique keys for ad-hoc section instances. The admin insert
 * flow calls this when there is already a section using the default key,
 * and the returned suffix (e.g. _secondary, _2) is appended.
 */
export function slotKeySuggestionsForType(
  type: HomepageSectionType,
  existingKeys: readonly string[],
): { readonly key: string; readonly isGroup: boolean } {
  const isGroup =
    SLOT_TYPE_INFO[type] === 'group' ||
    type === 'CATEGORY_CARDS' ||
    type === 'EDITORIAL_BANNER';

  if (isGroup) {
    const base =
      type === 'EDITORIAL_BANNER'
        ? 'home.editorial'
        : 'home.category_cards';
    if (!existingKeys.includes(base)) return { key: base, isGroup: true };
    for (let i = 2; i < 50; i++) {
      const candidate =
        type === 'EDITORIAL_BANNER'
          ? `home.editorial_${ordinalSuffix(i)}`
          : `home.category_cards_${i}`;
      if (!existingKeys.includes(candidate)) {
        return { key: candidate, isGroup: true };
      }
    }
    return { key: `${base}_${Date.now()}`, isGroup: true };
  }

  // Single-slot
  const base =
    type === 'HERO'
      ? 'hero_main'
      : type === 'BRAND_STORY'
        ? 'brand_story_backdrop'
        : `${type.toLowerCase()}_main`;
  if (!existingKeys.includes(base)) return { key: base, isGroup: false };

  // Try hero_aux_1, hero_aux_2, ...
  for (let i = 1; i < 100; i++) {
    const candidate = `${base.replace(/_main$|_backdrop$/, '')}_aux_${i}`;
    if (!existingKeys.includes(candidate)) {
      return { key: candidate, isGroup: false };
    }
  }
  return { key: `${base}_${Date.now()}`, isGroup: false };
}

function ordinalSuffix(n: number): string {
  // 2 -> secondary, 3 -> tertiary, 4 -> quaternary, 5+ -> n
  const named: Record<number, string> = {
    2: 'secondary',
    3: 'tertiary',
    4: 'quaternary',
  };
  return named[n] ?? String(n);
}
