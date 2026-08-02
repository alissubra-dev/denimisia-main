# Database snapshot — 2026-08-02

Point-in-time snapshot of the **catalog tables only** from the live
Supabase (production) database, captured after the catalog-recovery
seed run on `2026-08-02`.

## What's inside

| Table | Rows | Notes |
|---|---|---|
| `Category` | 10 | Top-level + sub categories |
| `Collection` | 2 | `Spring '26`, `Eid al-Adha '26` |
| `CollectionProduct` | 20 | Membership rows (composite PK) |
| `Product` | 27 | The recovered catalog |
| `ProductVariant` | 570 | All SKUs |

Tables explicitly **not** included: `User`, `Order`, `OrderItem`,
`Review`, `Cart`, `CartItem`, `Wishlist`, `WishlistItem`, `MediaAsset`,
`Address`, `Return`, `RefundTransaction`, `ProductSizeChart`, `ProductTag`,
and any other non-catalog table. The live DB had zero rows in most of
these at capture time and the rest (e.g. `User`) contains credentials
that should not be committed to the repo.

## Files

- `snapshot.sql` — `pg_dump` output, re-runnable against any PostgreSQL
  database that already has the schema (`prisma migrate deploy` has been
  applied). One `INSERT` per row, fully qualified with `public."Table"`.
  Validated against a scratch schema at capture time; restores to
  exactly 10 / 2 / 20 / 27 / 570 rows.
- `json/` — same data as `snapshot.sql`, one JSON file per table. Easier
  to diff in pull-request review, easier to load into a Node script for
  fixtures.

## How to restore

### Restore via SQL

```bash
# 1. Ensure the schema is current:
psql "$DATABASE_URL" -f packages/database/prisma/migrations
#    (or run the project's standard migration flow)

# 2. Inside a transaction, restore the snapshot:
psql "$DATABASE_URL" <<'EOF'
BEGIN;
SET LOCAL session_replication_role = replica;
\i scripts/db-snapshots/2026-08-02/snapshot.sql
COMMIT;
EOF
```

The `SET session_replication_role = replica` is required because the
`Category` table has a self-referencing FK (`Category.parentId →
Category.id`), and inserting parents + children in separate statements
within a single transaction otherwise requires `DEFERRABLE INITIALLY
DEFERRED`, which the live schema doesn't have. `session_replication_role
= replica` bypasses user triggers and is supported on any role (including
the `authenticated`/`postgres` roles Supabase uses).

### Restore via JSON

Each file under `json/` is a top-level JSON array of row objects with
keys matching the column names exactly. Load with any JSON tooling:

```js
const products = require('./scripts/db-snapshots/2026-08-02/json/products.json');
```

## When to refresh

This snapshot is **stale by design** the moment the catalog changes.
Refresh it with:

```bash
pg_dump "$DATABASE_URL" \
  --data-only --inserts --column-inserts \
  --no-owner --no-privileges --disable-triggers \
  --table=public.\"Category\" \
  --table=public.\"Collection\" \
  --table=public.\"CollectionProduct\" \
  --table=public.\"Product\" \
  --table=public.\"ProductVariant\" \
  --file=snapshot.sql

# Then strip per-table DISABLE TRIGGER blocks and replace with the
# session-level SET session_replication_role = replica; pattern (see
# the file header) so the dump restores cleanly on non-superuser roles.
```

## Caveats

- **No `_prisma_migrations` rows.** This snapshot is data only. To
  reproduce the schema in a fresh DB, run the standard Prisma migration
  flow first.
- **No `ProductSizeChart`, `ProductTag`, or `ProductBundle` rows.**
  The catalog-recovery seed did not generate those; the live DB has
  zero rows in each. Capture them in a future snapshot once product
  attributes are populated.
- **`updatedAt` timestamps reflect capture-time state**, not the
  original create time. The `createdAt` column preserves the original
  timestamp.
