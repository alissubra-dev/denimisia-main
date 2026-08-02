-- Read-only verification of ProductSizeChart column shape on prod.
-- Run with:
--   psql "$DIRECT_URL" -f check-product-size-chart.sql
-- Confirms the assumption before applying the valueIn alignment migration.
--
-- Expectation (per the Render error and the May 21 migration history):
--   - bodyValueIn DOUBLE PRECISION NOT NULL   ← present
--   - garmentValueIn DOUBLE PRECISION NOT NULL ← present
--   - valueIn  (any type)                      ← ABSENT
-- If a valueIn already exists, the alignment migration is a safe no-op;
-- if bodyValueIn/garmentValueIn are absent, the migration's UPDATE step
-- leaves valueIn null and the SET NOT NULL will fail with a clear error.

SELECT column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ProductSizeChart'
ORDER BY ordinal_position;

SELECT count(*) AS row_count FROM "ProductSizeChart";
