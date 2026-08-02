-- Add the courier-integration columns to "Order" so the deployed API's
-- prisma.order.findMany() select no longer 500s. Pre-fix, the admin
-- orders list at /api/v1/orders/admin/all returned 500 with the
-- underlying Prisma error:
--
--   Invalid `prisma.order.findMany()` invocation:
--   The column `Order.courier` does not exist in the current database.
--
-- schema.prisma declares (line 541-544):
--
--   // Courier integration fields
--   courier         String?      // e.g., "pathao", "ssl-commerz"
--   consignmentId   String?      // Courier's consignment ID
--   deliveryStatus  String?      // Current delivery status from courier
--
-- These three columns were added to schema.prisma but never had a
-- migration to apply them to the live DB. The orders service reads them
-- via getAllOrders (admin orders list) and getOrderById (admin + customer
-- order detail). All three are nullable, no defaults, no FKs, so this
-- migration is a pure additive no-risk schema extension.
--
-- DO NOT run `prisma migrate deploy` against this entry on a DB that
-- already has these columns — the IF NOT EXISTS guards make it a safe
-- no-op, but the deployment tooling will record a row in
-- `_prisma_migrations` for this entry, which we explicitly want to avoid
-- until we have a coordinated plan for the migration bookkeeping table.
-- Apply via:
--   psql "$DIRECT_URL" -f packages/database/prisma/migrations/20260802000004_add_order_courier_columns/migration.sql
--
-- Idempotent. Pure additive. Reversible (DROP COLUMN "Order"."courier"; …).

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courier"        TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "consignmentId"  TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;