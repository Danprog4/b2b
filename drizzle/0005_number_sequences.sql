CREATE SEQUENCE IF NOT EXISTS "city_market_order_number_seq";--> statement-breakpoint
SELECT setval(
  '"city_market_order_number_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("number" from '^ORD-([0-9]+)$'))::bigint) FROM "orders"),
      0
    ) + 1,
    1
  ),
  false
);--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "city_market_invoice_number_seq";--> statement-breakpoint
SELECT setval(
  '"city_market_invoice_number_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("number" from '^INV-([0-9]+)$'))::bigint) FROM "invoices"),
      0
    ) + 1,
    1
  ),
  false
);--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "city_market_product_sku_seq";--> statement-breakpoint
SELECT setval(
  '"city_market_product_sku_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("sku" from '^CM-([0-9]+)$'))::bigint) FROM "products"),
      0
    ) + 1,
    1
  ),
  false
);
