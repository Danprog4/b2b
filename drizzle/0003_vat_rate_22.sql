ALTER TABLE "products" ALTER COLUMN "vat_rate" SET DEFAULT '22.00';--> statement-breakpoint
UPDATE "products" SET "vat_rate" = '22.00' WHERE "vat_rate" IS NULL OR "vat_rate" = '20.00';
