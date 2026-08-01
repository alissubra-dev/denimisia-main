-- Add tileLabel/tileHref to PageSlot so each menu/search/fit tile can carry
-- an admin-editable label overlay and click destination. Nullable so existing
-- slots (HERO, EDITORIAL, etc.) stay unaffected.

ALTER TABLE "page_slot"
  ADD COLUMN "tile_label" TEXT,
  ADD COLUMN "tile_href"  TEXT;

-- Backfill for nav mega-menu featured tiles (5 rows).
UPDATE "page_slot" SET "tile_label" = 'Women collection',  "tile_href" = '/shop/women'   WHERE "page_key" = 'nav' AND "slot_key" = 'featured_shop_women';
UPDATE "page_slot" SET "tile_label" = 'Men collection',    "tile_href" = '/shop/men'     WHERE "page_key" = 'nav' AND "slot_key" = 'featured_shop_men';
UPDATE "page_slot" SET "tile_label" = 'Latest collection', "tile_href" = '/collections'  WHERE "page_key" = 'nav' AND "slot_key" = 'featured_collection_latest';
UPDATE "page_slot" SET "tile_label" = 'Best sellers',      "tile_href" = '/series/tops'  WHERE "page_key" = 'nav' AND "slot_key" = 'featured_series_bestsellers';
UPDATE "page_slot" SET "tile_label" = 'Wide leg pants',    "tile_href" = '/series/pants' WHERE "page_key" = 'nav' AND "slot_key" = 'featured_series_wide_leg';

-- Backfill for search overlay category tiles (3 rows).
UPDATE "page_slot" SET "tile_label" = 'Denims',  "tile_href" = '/shop/women/denims'  WHERE "page_key" = 'search' AND "slot_key" = 'category_denims';
UPDATE "page_slot" SET "tile_label" = 'Tops',    "tile_href" = '/shop/women/tops'    WHERE "page_key" = 'search' AND "slot_key" = 'category_tops';
UPDATE "page_slot" SET "tile_label" = 'Jackets', "tile_href" = '/shop/women/jackets' WHERE "page_key" = 'search' AND "slot_key" = 'category_jackets';

-- Backfill for shop-by-fit tiles (11 rows). Label comes from the existing
-- FITS array in apps/web/components/shop/fit-carousel.tsx — kept in sync via
-- constants; migration only sets initial DB values so a fresh deploy renders
-- the same labels as the prior hardcoded UI.
UPDATE "page_slot" SET "tile_label" = 'Cargo',      "tile_href" = '/shop/women/cargo'      WHERE "page_key" = 'shop' AND "slot_key" = 'fit_cargo';
UPDATE "page_slot" SET "tile_label" = 'Culotte',    "tile_href" = '/shop/women/culotte'    WHERE "page_key" = 'shop' AND "slot_key" = 'fit_culotte';
UPDATE "page_slot" SET "tile_label" = 'Flare',      "tile_href" = '/shop/women/flare'      WHERE "page_key" = 'shop' AND "slot_key" = 'fit_flare';
UPDATE "page_slot" SET "tile_label" = 'Wide Leg',   "tile_href" = '/shop/women/wide_leg'   WHERE "page_key" = 'shop' AND "slot_key" = 'fit_wide_leg';
UPDATE "page_slot" SET "tile_label" = 'Mom',        "tile_href" = '/shop/women/mom'        WHERE "page_key" = 'shop' AND "slot_key" = 'fit_mom';
UPDATE "page_slot" SET "tile_label" = 'Jegging',    "tile_href" = '/shop/women/jegging'    WHERE "page_key" = 'shop' AND "slot_key" = 'fit_jegging';
UPDATE "page_slot" SET "tile_label" = 'Slouchy',    "tile_href" = '/shop/women/slouchy'    WHERE "page_key" = 'shop' AND "slot_key" = 'fit_slouchy';
UPDATE "page_slot" SET "tile_label" = 'Skinny',     "tile_href" = '/shop/women/skinny'     WHERE "page_key" = 'shop' AND "slot_key" = 'fit_skinny';
UPDATE "page_slot" SET "tile_label" = 'Straight',   "tile_href" = '/shop/women/straight'   WHERE "page_key" = 'shop' AND "slot_key" = 'fit_straight';
UPDATE "page_slot" SET "tile_label" = 'Sweatshirt', "tile_href" = '/shop/women/sweatshirt' WHERE "page_key" = 'shop' AND "slot_key" = 'fit_sweatshirt';
UPDATE "page_slot" SET "tile_label" = 'Jacket',     "tile_href" = '/shop/women/jacket'     WHERE "page_key" = 'shop' AND "slot_key" = 'fit_jacket';
