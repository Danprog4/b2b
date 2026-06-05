ALTER TABLE "chats" ADD COLUMN "telegram_chat_id" varchar(64);--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "telegram_message_thread_id" integer;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "telegram_topic_name" varchar(128);--> statement-breakpoint
CREATE INDEX "messages_telegram_message_idx" ON "messages" USING btree ("telegram_message_id");