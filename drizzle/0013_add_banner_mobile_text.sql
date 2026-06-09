ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "mobile_title" varchar(255);--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "mobile_headline" varchar(255);--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "mobile_subheadline" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "mobile_cta_text" varchar(64);--> statement-breakpoint
