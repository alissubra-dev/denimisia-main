-- Bring "ProductSizeChart" into sync with schema.prisma by adding the
-- "valueIn" column the API selects in apps/api/src/modules/products/products.service.ts
-- (PRODUCT_LIST_INCLUDE and findBySlug). Pre-fix, the deployed API returned
-- 500 "Database error." on /api/v1/products with the underlying Prisma
-- error:
--
--   Invalid `prisma.product.findMany()` invocation:
--   The column `ProductSizeChart.valueIn` does not exist in the current database.
--
-- schema.prisma (last touched by commit ffc7200, Jul 15) declares:
--
--   model ProductSizeChart {
--     ...
--     valueIn Float
--     ...
--   }
--
-- The May 21, 2026 migration (20260521023916_add_product_size_chart) created
-- the table with two separate columns:
--
--   bodyValueIn    DOUBLE PRECISION NOT NULL
--   garmentValueIn DOUBLE PRECISION NOT NULL
--
-- The Jul 15 update renamed both into a single "valueIn" in schema.prisma and
-- pushed the corresponding code change to the API, but the DB-side rename
-- was never applied to prod — the legacy columns are still present and the
-- rename's "applied" marker (supabase/migrations/20260715061302_remote_commit.sql)
-- is empty.
--
-- This migration completes the rename at the DB level. It is intentionally
-- narrow:
--
--   1. ADD COLUMN valueIn DOUBLE PRECISION (nullable)                — idempotent.
--   2. UPDATE valueIn from COALESCE(bodyValueIn, garmentValueIn)      — idempotent
--                                                                       (re-runs are no-ops
--                                                                       once valueIn is filled).
--   3. ALTER COLUMN valueIn SET NOT NULL                             — idempotent
--                                                                       (no-op if already NOT NULL).
--
-- The legacy bodyValueIn and garmentValueIn columns are LEFT IN PLACE.
-- Removing them is out of scope for this fix — no code path reads them
-- after this migration, but a future cleanup can DROP COLUMN them safely
-- once you're confident nothing else depends on them.
--
-- DO NOT run `prisma migrate deploy` against this entry on a DB that
-- already has these columns — the IF NOT EXISTS guards make it a safe
-- no-op, but the deployment tooling will record a row in
-- `_prisma_migrations` for this entry, which we explicitly want to avoid
-- until we have a coordinated plan for the migration bookkeeping table.
-- Apply via:
--   psql "$DIRECT_URL" -f packages/database/prisma/migrations/20260802000003_align_product_size_chart_value_in/migration.sql
--
-- Idempotent. Pure additive. Reversible (DROP COLUMN "ProductSizeChart"."valueIn").

ALTER TABLE "ProductSizeChart"
  ADD COLUMN IF NOT EXISTS "valueIn" DOUBLE PRECISION;

UPDATE "ProductSizeChart"
  SET "valueIn" = COALESCE("bodyValueIn", "garmentValueIn")
  WHERE "valueIn" IS NULL;

ALTER TABLE "ProductSizeChart"
  ALTER COLUMN "valueIn" SET NOT NULL;
