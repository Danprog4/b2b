import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chats, files, messages, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

export async function getCurrentBuyerChatMessages() {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return {
      chatId: null,
      messages: [],
    };
  }

  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.buyerCompanyId, user.buyerCompanyId), isNull(chats.orderId)))
    .limit(1);

  if (!chat) {
    return {
      chatId: null,
      messages: [],
    };
  }

  const rows = await db
    .select({
      id: messages.id,
      senderType: messages.senderType,
      text: messages.text,
      deliveryStatus: messages.deliveryStatus,
      createdAt: messages.createdAt,
      attachmentFileId: messages.attachmentFileId,
      attachmentName: files.originalName,
      attachmentSize: files.sizeBytes,
      senderName: users.name,
      senderEmail: users.email,
    })
    .from(messages)
    .leftJoin(files, eq(files.id, messages.attachmentFileId))
    .leftJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.chatId, chat.id))
    .orderBy(asc(messages.createdAt))
    .limit(80);

  return {
    chatId: chat.id,
    messages: rows,
  };
}
