ALTER TABLE "sellers" ADD COLUMN "contract_number" varchar(32);--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "city_market_seller_contract_seq";--> statement-breakpoint
WITH numbered_sellers AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "created_at", "id") AS row_number
  FROM "sellers"
  WHERE "contract_number" IS NULL
)
UPDATE "sellers"
SET "contract_number" = 'SC-' || lpad(numbered_sellers.row_number::text, 6, '0')
FROM numbered_sellers
WHERE "sellers"."id" = numbered_sellers."id";--> statement-breakpoint
SELECT setval(
  '"city_market_seller_contract_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("contract_number" from '^SC-([0-9]+)$'))::bigint) FROM "sellers"),
      0
    ) + 1,
    1
  ),
  false
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sellers_contract_number_idx" ON "sellers" ("contract_number");
