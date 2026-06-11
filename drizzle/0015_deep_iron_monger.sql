ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "priority_is_manual" boolean DEFAULT false NOT NULL;
