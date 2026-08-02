-- Make the legacy ProductSizeChart columns nullable so the deployed API's
-- prisma.productSizeChart.createMany() (apps/api/src/modules/products/
-- products.service.ts:527) can insert rows that only set the new valueIn
-- column. Pre-fix, the admin product-create form returned 500
-- "Database error." with the underlying Prisma error:
--
--   Invalid `prisma.productSizeChart.createMany()` invocation:
--   Null constraint violation on the fields: (`bodyValueIn`)
--
-- schema.prisma (commit ffc7200, Jul 15) declares only the new
-- valueIn column on ProductSizeChart. The May 21, 2026 migration
-- (20260521023916_add_product_size_chart) created the table with TWO
-- nullable-target columns and marked them NOT NULL:
--
--   bodyValueIn    DOUBLE PRECISION NOT NULL
--   garmentValueIn DOUBLE PRECISION NOT NULL
--
-- The Jul 15 update introduced a single valueIn in schema.prisma and
-- switched the API to write only valueIn — but the DB-side migration
-- to complete the rename (drop the legacy columns OR drop NOT NULL on
-- them) was never applied. The previous recovery migration
-- (20260802000003_align_product_size_chart_value_in) added valueIn so
-- the read path compiles; this migration completes the rename for
-- the write path by dropping NOT NULL on the legacy columns.
--
-- Why DROP NOT NULL and not DROP COLUMN:
--   - Reversible (ALTER COLUMN ... SET NOT NULL restores).
--   - No data loss — preserves bodyValueIn / garmentValueIn for any
--     downstream consumer that still reads them (the storefront
--     doesn't, but a future migration can drop them safely once
--     we're confident).
--   - Instant on PostgreSQL: catalog-only change, no table rewrite,
--     no exclusive lock. Safe even at scale.
--
-- The API now writes both columns from the same valueIn payload
-- (single source of truth: schema.prisma), but the legacy columns
-- being NOT NULL would have rejected an insert that omits them.
-- After this migration, an INSERT that sets only valueIn is valid
-- and bodyValueIn / garmentValueIn default to NULL.
--
-- Idempotent. Pure metadata change. Reversible
-- (ALTER COLUMN "ProductSizeChart"."bodyValueIn" SET NOT NULL; etc.).
--
-- DO NOT run `prisma migrate deploy` against this entry on a DB that
-- already has these columns nullable — the ALTER will record a row in
-- _prisma_migrations for an already-applied change, which we
-- explicitly want to avoid until the migration bookkeeping table is
-- reconciled. Apply via:
--   psql "$DIRECT_URL" -f packages/database/prisma/migrations/20260802000005_drop_not_null_on_product_size_chart_legacy_columns/migration.sql

ALTER TABLE "ProductSizeChart"
  ALTER COLUMN "bodyValueIn" DROP NOT NULL;

ALTER TABLE "ProductSizeChart"
  ALTER COLUMN "garmentValueIn" DROP NOT NULL;
