import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getTelegramConfig } from "@/lib/telegram/api";
import { handleTelegramInboundMessage } from "@/lib/telegram/chat-sync";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: Parameters<typeof handleTelegramInboundMessage>[0];
};

export async function POST(request: Request) {
  const config = getTelegramConfig();

  if (!config) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (config.webhookSecret) {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");

    if (secret !== config.webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = (await request.json()) as TelegramUpdate;

  if (update.message) {
    await handleTelegramInboundMessage(update.message);
    revalidatePath("/account");
    revalidatePath("/account/chat");
    revalidatePath("/account/notifications");
    revalidatePath("/admin");
    revalidatePath("/admin/chats");
    revalidatePath("/admin/notifications");
  }

  return NextResponse.json({ ok: true });
}
