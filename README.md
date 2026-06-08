# City Market

B2B marketplace for legal entities and individual entrepreneurs.

## Local Development

```bash
bun install
bun run db:up
bun run db:migrate
bun run dev
```

App URL: http://localhost:3000

## Database Commands

```bash
bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:studio
```

## Copy Local Data To Production

Use `db:copy-data` only as an explicit one-off operation. Do not put it into the normal Railway pre-deploy/migrate command: migrations should update schema, while data copy truncates and replaces production data.

The script copies all public application tables from `SOURCE_DATABASE_URL` to `TARGET_DATABASE_URL`, truncates the target first, then resets number sequences for orders, invoices, product SKU, seller contracts, and buyer contracts.

It copies database rows only. If files are stored outside the database, transfer the underlying storage bucket/files separately.

1. Make sure production schema is migrated:

```bash
TARGET_DATABASE_URL="postgresql://..." bun run db:migrate
```

2. Run a dry-run from local database to production:

```bash
SOURCE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/city_market" \
TARGET_DATABASE_URL="postgresql://..." \
bun run db:copy-data:dry
```

3. Replace production data:

```bash
SOURCE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/city_market" \
TARGET_DATABASE_URL="postgresql://..." \
CONFIRM_PROD_DATA_IMPORT=YES \
CONFIRM_TRUNCATE_NON_EMPTY_TARGET=YES \
bun run db:copy-data
```

Safety flags:

- `DRY_RUN=YES` prints source row counts and does not write to target.
- `CONFIRM_PROD_DATA_IMPORT=YES` is required for real copy.
- `CONFIRM_TRUNCATE_NON_EMPTY_TARGET=YES` is required when target already has rows.
- `ALLOW_SAME_DATABASE_COPY=YES` bypasses source/target identity protection; normally leave it empty.

## HTTP Data Import Fallback

Use this when Railway public Postgres proxy credentials do not work locally, but the app service has a valid internal `DATABASE_URL`.

1. Set a strong one-off secret in Railway app variables:

```env
DATA_IMPORT_SECRET=long-random-secret
```

2. Deploy the app with `/api/admin/data-import`.

3. Dry-run locally:

```bash
SOURCE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/city_market" \
DRY_RUN=YES \
bun run db:push-data-http
```

4. Push local database rows through the production app:

```bash
SOURCE_DATABASE_URL="postgres://postgres:postgres@localhost:5432/city_market" \
TARGET_DATA_IMPORT_URL="https://your-app.up.railway.app/api/admin/data-import" \
DATA_IMPORT_SECRET="long-random-secret" \
CONFIRM_PROD_DATA_IMPORT=YES \
bun run db:push-data-http
```

Remove `DATA_IMPORT_SECRET` from Railway after the import. Without this variable the endpoint returns 404.
