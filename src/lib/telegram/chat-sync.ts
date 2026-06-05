import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  chats,
  files,
  messages,
  notifications,
  systemEvents,
  users,
} from "@/db/schema";
import { readStorageFile, writeStorageFile } from "@/lib/files/storage";
import { insertBuyerCompanyNotifications } from "@/lib/notifications/helpers";
import {
  createTelegramForumTopic,
  downloadTelegramFile,
  getTelegramConfig,
  getTelegramFile,
  sendTelegramTopicDocument,
  sendTelegramTopicMessage,
} from "@/lib/telegram/api";

const maxTelegramInboundFileSizeBytes = 50 * 1024 * 1024;

type TelegramInboundMessage = {
  message_id: number;
  message_thread_id?: number;
  chat?: {
    id?: number;
  };
  from?: {
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
  caption?: string;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  photo?: Array<{
    file_id: string;
    file_size?: number;
    width?: number;
    height?: number;
  }>;
};

function getTelegramChatId() {
  return getTelegramConfig()?.operatorChatId ?? null;
}

function formatTopicName(input: {
  companyName: string;
  companyInn: string;
  userName: string | null;
  userEmail: string;
}) {
  const contact = input.userName || input.userEmail;
  return `ИНН ${input.companyInn} · ${input.companyName} · ${contact}`.slice(0, 128);
}

function getSenderName(message: TelegramInboundMessage) {
  const from = message.from;

  if (!from) {
    return "Оператор";
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return name || from.username || "Оператор";
}

async function logTelegramError(
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(systemEvents).values({
    type: "telegram",
    severity: "error",
    message,
    metadata,
  });
}

async function ensureTelegramTopic(chatId: string) {
  const telegramChatId = getTelegramChatId();

  if (!telegramChatId) {
    throw new Error("Telegram operator chat is not configured.");
  }

  const [chat] = await db
    .select({
      id: chats.id,
      telegramChatId: chats.telegramChatId,
      telegramMessageThreadId: chats.telegramMessageThreadId,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      userName: users.name,
      userEmail: users.email,
    })
    .from(chats)
    .innerJoin(buyerCompanies, eq(buyerCompanies.id, chats.buyerCompanyId))
    .innerJoin(users, eq(users.id, chats.userId))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) {
    throw new Error("Chat not found.");
  }

  if (chat.telegramChatId && chat.telegramMessageThreadId) {
    return {
      telegramChatId: chat.telegramChatId,
      messageThreadId: chat.telegramMessageThreadId,
    };
  }

  const topicName = formatTopicName(chat);
  const topic = await createTelegramForumTopic(topicName);

  await db
    .update(chats)
    .set({
      telegramChatId,
      telegramMessageThreadId: topic.message_thread_id,
      telegramThreadKey: `${telegramChatId}:${topic.message_thread_id}`,
      telegramTopicName: topic.name || topicName,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, chat.id));

  return {
    telegramChatId,
    messageThreadId: topic.message_thread_id,
  };
}

export async function deliverBuyerMessageToTelegram(input: {
  chatId: string;
  messageId: string;
}) {
  try {
    const topic = await ensureTelegramTopic(input.chatId);
    const [message] = await db
      .select({
        id: messages.id,
        text: messages.text,
        attachmentFileId: messages.attachmentFileId,
        fileName: files.originalName,
        storageKey: files.storageKey,
        mimeType: files.mimeType,
        companyName: buyerCompanies.name,
        companyInn: buyerCompanies.inn,
        userName: users.name,
        userEmail: users.email,
      })
      .from(messages)
      .innerJoin(chats, eq(chats.id, messages.chatId))
      .innerJoin(buyerCompanies, eq(buyerCompanies.id, chats.buyerCompanyId))
      .innerJoin(users, eq(users.id, chats.userId))
      .leftJoin(files, eq(files.id, messages.attachmentFileId))
      .where(eq(messages.id, input.messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message not found.");
    }

    const header = [
      `Покупатель: ${message.userName || message.userEmail}`,
      `Компания: ${message.companyName}, ИНН ${message.companyInn}`,
    ].join("\n");
    const text = [header, message.text].filter(Boolean).join("\n\n");
    const sent = message.attachmentFileId
      ? await sendTelegramTopicDocument({
          messageThreadId: topic.messageThreadId,
          bytes: await readStorageFile(message.storageKey ?? ""),
          fileName: message.fileName ?? "attachment",
          mimeType: message.mimeType ?? "application/octet-stream",
          caption: text,
        })
      : await sendTelegramTopicMessage({
          messageThreadId: topic.messageThreadId,
          text,
        });

    await db
      .update(messages)
      .set({
        deliveryStatus: "sent",
        telegramMessageId: String(sent.message_id),
      })
      .where(eq(messages.id, input.messageId));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Telegram delivery error.";

    await db
      .update(messages)
      .set({ deliveryStatus: "failed" })
      .where(eq(messages.id, input.messageId));

    await logTelegramError("Не удалось отправить сообщение покупателя в Telegram.", {
      chatId: input.chatId,
      messageId: input.messageId,
      error: errorMessage,
    });
  }
}

export async function mirrorAdminMessageToTelegram(input: {
  chatId: string;
  messageId: string;
}) {
  try {
    const topic = await ensureTelegramTopic(input.chatId);
    const [message] = await db
      .select({
        text: messages.text,
        adminName: users.name,
        adminEmail: users.email,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.id, input.messageId))
      .limit(1);

    if (!message?.text) {
      return;
    }

    const sent = await sendTelegramTopicMessage({
      messageThreadId: topic.messageThreadId,
      text: `Админ ${message.adminName || message.adminEmail || ""}:\n\n${message.text}`,
    });

    await db
      .update(messages)
      .set({ telegramMessageId: String(sent.message_id) })
      .where(eq(messages.id, input.messageId));
  } catch (error) {
    await logTelegramError("Не удалось зеркалировать ответ админа в Telegram.", {
      chatId: input.chatId,
      messageId: input.messageId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function persistTelegramAttachment(
  telegramMessage: TelegramInboundMessage,
  chatId: string,
) {
  const document = telegramMessage.document;
  const photo = telegramMessage.photo
    ? [...telegramMessage.photo].sort(
        (a, b) => (b.file_size ?? 0) - (a.file_size ?? 0),
      )[0]
    : null;
  const fileId = document?.file_id ?? photo?.file_id;
  const fileSize = document?.file_size ?? photo?.file_size ?? 0;

  if (!fileId) {
    return null;
  }

  if (fileSize > maxTelegramInboundFileSizeBytes) {
    throw new Error("Telegram attachment exceeds 50 MB.");
  }

  const telegramFile = await getTelegramFile(fileId);

  if (!telegramFile.file_path) {
    throw new Error("Telegram file path is missing.");
  }

  const bytes = await downloadTelegramFile(telegramFile.file_path);
  const originalName =
    document?.file_name ??
    `telegram-photo-${telegramMessage.message_id}.jpg`;
  const storageKey = `chat/${chatId}/telegram-${randomUUID()}-${originalName}`;
  const mimeType = document?.mime_type ?? (photo ? "image/jpeg" : "application/octet-stream");
  const { sizeBytes } = await writeStorageFile(storageKey, bytes, {
    contentType: mimeType,
  });
  const [file] = await db
    .insert(files)
    .values({
      originalName,
      storageKey,
      mimeType,
      sizeBytes,
      access: "private",
    })
    .returning({ id: files.id });

  return file.id;
}

export async function handleTelegramInboundMessage(
  telegramMessage: TelegramInboundMessage,
) {
  const config = getTelegramConfig();
  const telegramChatId = telegramMessage.chat?.id
    ? String(telegramMessage.chat.id)
    : null;
  const messageThreadId = telegramMessage.message_thread_id;

  if (!config || !telegramChatId || telegramChatId !== config.operatorChatId) {
    return;
  }

  if (telegramMessage.from?.is_bot || !messageThreadId) {
    return;
  }

  const [chat] = await db
    .select({
      id: chats.id,
      buyerCompanyId: chats.buyerCompanyId,
    })
    .from(chats)
    .where(
      and(
        eq(chats.telegramChatId, telegramChatId),
        eq(chats.telegramMessageThreadId, messageThreadId),
      ),
    )
    .limit(1);

  if (!chat) {
    await logTelegramError("Telegram прислал сообщение в неизвестный топик.", {
      telegramChatId,
      messageThreadId,
      telegramMessageId: telegramMessage.message_id,
    });
    return;
  }

  const existing = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.telegramMessageId, String(telegramMessage.message_id)))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  const text = telegramMessage.text ?? telegramMessage.caption ?? null;
  let attachmentFileId: string | null = null;

  try {
    attachmentFileId = await persistTelegramAttachment(telegramMessage, chat.id);
  } catch (error) {
    await logTelegramError("Не удалось сохранить вложение из Telegram.", {
      chatId: chat.id,
      telegramChatId,
      messageThreadId,
      telegramMessageId: telegramMessage.message_id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (!text && !attachmentFileId) {
    return;
  }

  await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        chatId: chat.id,
        senderType: "operator",
        text,
        attachmentFileId,
        deliveryStatus: "sent",
        telegramMessageId: String(telegramMessage.message_id),
      })
      .returning({ id: messages.id });

    await insertBuyerCompanyNotifications(tx, {
      buyerCompanyId: chat.buyerCompanyId,
      type: "chat_message_answered",
      title: "Ответ оператора в чате",
      body: text || `${getSenderName(telegramMessage)} отправил вложение.`,
    });

    await tx
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.buyerCompanyId, chat.buyerCompanyId),
          eq(notifications.type, "chat_message_created"),
          eq(notifications.isRead, false),
        ),
      );

    await tx.insert(auditEvents).values({
      action: "chat.telegram_message_received",
      entityType: "message",
      entityId: message.id,
      metadata: {
        chatId: chat.id,
        telegramChatId,
        messageThreadId,
        telegramMessageId: telegramMessage.message_id,
        sender: getSenderName(telegramMessage),
        hasAttachment: Boolean(attachmentFileId),
      },
    });
  });
}
