"use server";

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, chats, files, messages, notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";
import {
  insertAdminNotifications,
  insertBuyerCompanyNotifications,
} from "@/lib/notifications/helpers";
import {
  deliverBuyerMessageToTelegram,
  mirrorAdminMessageToTelegram,
} from "@/lib/telegram/chat-sync";

const maxChatAttachmentSizeBytes = 50 * 1024 * 1024;
const allowedExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "xls",
  "xlsx",
]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFileName(fileName: string) {
  const normalized = fileName
    .replace(/[^\w.\-а-яА-ЯёЁ ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return normalized || "chat-file";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && Boolean(value.name);
}

function validateAttachment(file: File) {
  if (file.size > maxChatAttachmentSizeBytes) {
    redirect("/account/chat?error=size");
  }

  const extension = getFileExtension(file.name);

  if (!allowedExtensions.has(extension)) {
    redirect("/account/chat?error=type");
  }

  if (file.type && !allowedMimeTypes.has(file.type)) {
    redirect("/account/chat?error=type");
  }
}

async function getOrCreateBuyerChat(userId: string, buyerCompanyId: string) {
  const [existingChat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.buyerCompanyId, buyerCompanyId), isNull(chats.orderId)))
    .limit(1);

  if (existingChat) {
    return existingChat.id;
  }

  const [chat] = await db
    .insert(chats)
    .values({
      userId,
      buyerCompanyId,
      status: "open",
    })
    .returning({ id: chats.id });

  return chat.id;
}

async function persistAttachment(file: File, chatId: string, uploadedById: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name);
  const storageKey = `chat/${chatId}/${randomUUID()}-${fileName}`;
  const { sizeBytes } = await writeStorageFile(storageKey, bytes, {
    contentType: file.type || "application/octet-stream",
  });

  const [storedFile] = await db
    .insert(files)
    .values({
      originalName: file.name,
      storageKey,
      mimeType: file.type || "application/octet-stream",
      sizeBytes,
      access: "private",
      uploadedById,
    })
    .returning({ id: files.id });

  return storedFile.id;
}

export async function sendBuyerChatMessageAction(formData: FormData) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    redirect("/account");
  }

  const text = getString(formData, "text");
  const attachment = formData.get("attachment");

  if (!text && !isUploadedFile(attachment)) {
    redirect("/account/chat?error=empty");
  }

  if (isUploadedFile(attachment)) {
    validateAttachment(attachment);
  }

  const chatId = await getOrCreateBuyerChat(user.id, user.buyerCompanyId);
  const attachmentFileId = isUploadedFile(attachment)
    ? await persistAttachment(attachment, chatId, user.id)
    : null;

  const messageId = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        chatId,
        senderId: user.id,
        senderType: "buyer",
        text: text || null,
        attachmentFileId,
        deliveryStatus: "pending",
      })
      .returning({ id: messages.id });

    await insertAdminNotifications(tx, {
      type: "chat_message_created",
      title: "Новое сообщение в чате",
      body: text || "Покупатель отправил вложение.",
      buyerCompanyId: user.buyerCompanyId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "chat.message_create",
      entityType: "message",
      entityId: message.id,
      metadata: {
        chatId,
        hasAttachment: Boolean(attachmentFileId),
      },
    });

    return message.id;
  });

  await deliverBuyerMessageToTelegram({ chatId, messageId });

  revalidatePath("/account");
  revalidatePath("/account/chat");
  revalidatePath("/admin");
  revalidatePath("/admin/chats");
  revalidatePath("/admin/notifications");

  redirect("/account/chat?sent=1");
}

export async function sendAdminChatMessageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const chatId = getString(formData, "chatId");
  const text = getString(formData, "text");

  if (!chatId) {
    redirect("/admin/chats");
  }

  if (!text) {
    redirect(`/admin/chats/${chatId}?error=empty`);
  }

  const [chat] = await db
    .select({
      id: chats.id,
      buyerCompanyId: chats.buyerCompanyId,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) {
    redirect("/admin/chats");
  }

  const messageId = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        chatId: chat.id,
        senderId: admin.id,
        senderType: "admin",
        text,
        deliveryStatus: "sent",
      })
      .returning({ id: messages.id });

    await insertBuyerCompanyNotifications(tx, {
      buyerCompanyId: chat.buyerCompanyId,
      type: "chat_message_answered",
      title: "Ответ оператора в чате",
      body: text,
    });

    await tx
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, admin.id),
          eq(notifications.buyerCompanyId, chat.buyerCompanyId),
          eq(notifications.type, "chat_message_created"),
          eq(notifications.isRead, false),
        ),
      );

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "chat.admin_message_create",
      entityType: "message",
      entityId: message.id,
      metadata: {
        chatId: chat.id,
      },
    });

    return message.id;
  });

  await mirrorAdminMessageToTelegram({ chatId: chat.id, messageId });

  revalidatePath("/admin");
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${chat.id}`);
  revalidatePath("/admin/notifications");
  revalidatePath("/account");
  revalidatePath("/account/chat");
  revalidatePath("/account/notifications");

  redirect(`/admin/chats/${chat.id}?sent=1`);
}
