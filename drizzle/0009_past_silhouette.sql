CREATE TABLE "seller_product_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"seller_offer_id" uuid,
	"seller_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"status" "seller_offer_status" DEFAULT 'on_moderation' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"moderation_comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_at" timestamp with time zone,
	"moderated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seller_product_change_requests" ADD CONSTRAINT "seller_product_change_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_product_change_requests" ADD CONSTRAINT "seller_product_change_requests_seller_offer_id_seller_offers_id_fk" FOREIGN KEY ("seller_offer_id") REFERENCES "public"."seller_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_product_change_requests" ADD CONSTRAINT "seller_product_change_requests_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_product_change_requests" ADD CONSTRAINT "seller_product_change_requests_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_product_change_requests_product_idx" ON "seller_product_change_requests" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "seller_product_change_requests_offer_idx" ON "seller_product_change_requests" USING btree ("seller_offer_id");--> statement-breakpoint
CREATE INDEX "seller_product_change_requests_seller_idx" ON "seller_product_change_requests" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_product_change_requests_status_idx" ON "seller_product_change_requests" USING btree ("status");