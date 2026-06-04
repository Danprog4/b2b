CREATE TYPE "public"."contract_status" AS ENUM('pending', 'generated', 'requires_update', 'failed');--> statement-breakpoint
CREATE TYPE "public"."seller_offer_status" AS ENUM('draft', 'on_moderation', 'published', 'rejected', 'hidden');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'accepted' BEFORE 'new';--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(32) NOT NULL,
	"buyer_company_id" uuid NOT NULL,
	"file_id" uuid,
	"status" "contract_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_to_seller" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"period_from" timestamp with time zone NOT NULL,
	"period_to" timestamp with time zone NOT NULL,
	"sales_amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"payout_amount" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone,
	"comment" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"price_with_vat" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '22.00' NOT NULL,
	"status" "seller_offer_status" DEFAULT 'published' NOT NULL,
	"is_priority" boolean DEFAULT false NOT NULL,
	"moderation_comment" text,
	"submitted_at" timestamp with time zone,
	"moderated_at" timestamp with time zone,
	"moderated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "invoices_order_idx";--> statement-breakpoint
ALTER TABLE "buyer_companies" ADD COLUMN "director_name" varchar(255);--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "seller_offer_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "replaced_by_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "seller_offer_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "priority_offer_id" uuid;--> statement-breakpoint
INSERT INTO "seller_offers" (
	"product_id",
	"seller_id",
	"price_with_vat",
	"vat_rate",
	"status",
	"is_priority",
	"submitted_at",
	"created_at",
	"updated_at"
)
SELECT
	"products"."id",
	"products"."seller_id",
	"products"."price_with_vat",
	coalesce("products"."vat_rate", '22.00'),
	'published',
	false,
	"products"."created_at",
	"products"."created_at",
	"products"."updated_at"
FROM "products"
WHERE "products"."seller_id" IS NOT NULL;--> statement-breakpoint
UPDATE "products"
SET "priority_offer_id" = "seller_offers"."id"
FROM "seller_offers"
WHERE
	"seller_offers"."product_id" = "products"."id"
	AND "seller_offers"."seller_id" = "products"."seller_id";--> statement-breakpoint
UPDATE "cart_items"
SET "seller_offer_id" = "seller_offers"."id"
FROM "seller_offers"
WHERE
	"seller_offers"."product_id" = "cart_items"."product_id"
	AND "seller_offers"."status" = 'published';--> statement-breakpoint
UPDATE "order_items"
SET "seller_offer_id" = "seller_offers"."id"
FROM "seller_offers"
WHERE
	"seller_offers"."product_id" = "order_items"."product_id"
	AND "seller_offers"."seller_id" = "order_items"."seller_id";--> statement-breakpoint
UPDATE "orders"
SET "status" = 'accepted'
WHERE "status" IN ('new', 'awaiting_payment');--> statement-breakpoint
UPDATE "orders"
SET "status" = 'issued'
WHERE "status" = 'closed';--> statement-breakpoint
SELECT setval(
  '"city_market_invoice_number_seq"',
  greatest(
    coalesce(
      (SELECT max((substring("number" from '^СТ-([0-9]+)$'))::bigint) FROM "invoices"),
      coalesce(
        (SELECT max((substring("number" from '^INV-([0-9]+)$'))::bigint) FROM "invoices"),
        0
      )
    ) + 1,
    1
  ),
  false
);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_buyer_company_id_buyer_companies_id_fk" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."buyer_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_to_seller" ADD CONSTRAINT "payments_to_seller_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_to_seller" ADD CONSTRAINT "payments_to_seller_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_offers" ADD CONSTRAINT "seller_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_offers" ADD CONSTRAINT "seller_offers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_offers" ADD CONSTRAINT "seller_offers_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_number_idx" ON "contracts" USING btree ("number");--> statement-breakpoint
CREATE INDEX "contracts_company_idx" ON "contracts" USING btree ("buyer_company_id");--> statement-breakpoint
CREATE INDEX "contracts_current_idx" ON "contracts" USING btree ("buyer_company_id","is_current");--> statement-breakpoint
CREATE INDEX "payments_to_seller_seller_idx" ON "payments_to_seller" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "payments_to_seller_period_idx" ON "payments_to_seller" USING btree ("period_from","period_to");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_offers_product_seller_idx" ON "seller_offers" USING btree ("product_id","seller_id");--> statement-breakpoint
CREATE INDEX "seller_offers_product_idx" ON "seller_offers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "seller_offers_seller_idx" ON "seller_offers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_offers_status_idx" ON "seller_offers" USING btree ("status");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_seller_offer_id_seller_offers_id_fk" FOREIGN KEY ("seller_offer_id") REFERENCES "public"."seller_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_offer_id_seller_offers_id_fk" FOREIGN KEY ("seller_offer_id") REFERENCES "public"."seller_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_current_idx" ON "invoices" USING btree ("order_id","is_current");--> statement-breakpoint
CREATE INDEX "order_items_offer_idx" ON "order_items" USING btree ("seller_offer_id");--> statement-breakpoint
CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");
