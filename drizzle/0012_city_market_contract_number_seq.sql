CREATE SEQUENCE IF NOT EXISTS "city_market_contract_number_seq";--> statement-breakpoint
SELECT setval(
  '"city_market_contract_number_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("number" from '^ДГ-([0-9]+)$'))::bigint) FROM "contracts"),
      0
    ),
    1
  ),
  exists(select 1 from "contracts" where "number" ~ '^ДГ-[0-9]+$')
);--> statement-breakpoint
