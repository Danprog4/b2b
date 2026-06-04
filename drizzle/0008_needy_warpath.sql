ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
UPDATE "orders"
SET "status" = 'accepted'
WHERE "status" IN ('new', 'awaiting_payment');--> statement-breakpoint
UPDATE "orders"
SET "status" = 'issued'
WHERE "status" = 'closed';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'accepted'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('accepted', 'paid', 'issued', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'accepted'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
INSERT INTO "content_pages" ("title", "slug", "content", "meta_title", "meta_description", "is_published")
VALUES
  ('Юридическая информация', 'legal', 'Юридическая информация: текст будет предоставлен заказчиком.', 'Юридическая информация | Сити Маркет', 'Юридическая информация B2B-маркетплейса Сити Маркет', true),
  ('Как стать партнером', 'partners', 'Как стать партнером: текст будет предоставлен заказчиком.', 'Как стать партнером | Сити Маркет', 'Как стать партнером B2B-маркетплейса Сити Маркет', true),
  ('О нас', 'about', 'О нас: текст будет предоставлен заказчиком.', 'О нас | Сити Маркет', 'О нас B2B-маркетплейса Сити Маркет', true),
  ('Контакты', 'contacts', 'Контакты: текст будет предоставлен заказчиком.', 'Контакты | Сити Маркет', 'Контакты B2B-маркетплейса Сити Маркет', true)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "is_published" = true,
  "updated_at" = now();--> statement-breakpoint
UPDATE "content_pages"
SET "is_published" = false, "updated_at" = now()
WHERE "slug" IN ('faq', 'seller-terms', 'vacancies');
