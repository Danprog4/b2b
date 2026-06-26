import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  buyerCompanies,
  chats,
  files,
  messages,
  notifications,
  users,
} from "@/db/schema";
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

export async function getBuyerPendingChatCount() {
  const user = await requireUser(["buyer"]);
  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.isRead, false),
        eq(notifications.type, "chat_message_answered"),
      ),
    );

  return row?.count ?? 0;
}

export async function getAdminChatList() {
  const user = await requireUser(["admin"]);
  const unreadChatNotifications = await db
    .select({ buyerCompanyId: notifications.buyerCompanyId })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.isRead, false),
        eq(notifications.type, "chat_message_created"),
      ),
    );
  const unreadCountByCompanyId = new Map<string, number>();

  for (const notification of unreadChatNotifications) {
    if (!notification.buyerCompanyId) {
      continue;
    }

    unreadCountByCompanyId.set(
      notification.buyerCompanyId,
      (unreadCountByCompanyId.get(notification.buyerCompanyId) ?? 0) + 1,
    );
  }

  const rows = await db
    .select({
      chatId: chats.id,
      chatStatus: chats.status,
      chatCreatedAt: chats.createdAt,
      companyId: buyerCompanies.id,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      messageId: messages.id,
      senderType: messages.senderType,
      text: messages.text,
      deliveryStatus: messages.deliveryStatus,
      messageCreatedAt: messages.createdAt,
      attachmentFileId: messages.attachmentFileId,
      attachmentName: files.originalName,
    })
    .from(chats)
    .innerJoin(buyerCompanies, eq(buyerCompanies.id, chats.buyerCompanyId))
    .innerJoin(users, eq(users.id, chats.userId))
    .leftJoin(messages, eq(messages.chatId, chats.id))
    .leftJoin(files, eq(files.id, messages.attachmentFileId))
    .orderBy(desc(messages.createdAt), desc(chats.createdAt))
    .limit(500);

  const grouped = new Map<
    string,
    {
      id: string;
      status: string;
      createdAt: Date;
      companyId: string;
      companyName: string;
      companyInn: string;
      userName: string | null;
      userEmail: string;
      userPhone: string | null;
      incomingCount: number;
      lastMessage: {
        id: string;
        senderType: string;
        text: string | null;
        deliveryStatus: string;
        createdAt: Date;
        attachmentFileId: string | null;
        attachmentName: string | null;
      } | null;
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.chatId);
    const chat =
      existing ??
      {
        id: row.chatId,
        status: row.chatStatus,
        createdAt: row.chatCreatedAt,
        companyId: row.companyId,
        companyName: row.companyName,
        companyInn: row.companyInn,
        userName: row.userName,
        userEmail: row.userEmail,
        userPhone: row.userPhone,
        incomingCount: unreadCountByCompanyId.get(row.companyId) ?? 0,
        lastMessage: null,
      };

    if (row.messageId && !chat.lastMessage) {
      chat.lastMessage = {
        id: row.messageId,
        senderType: row.senderType ?? "buyer",
        text: row.text,
        deliveryStatus: row.deliveryStatus ?? "pending",
        createdAt: row.messageCreatedAt ?? row.chatCreatedAt,
        attachmentFileId: row.attachmentFileId,
        attachmentName: row.attachmentName,
      };
    }

    grouped.set(row.chatId, chat);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aDate = a.lastMessage?.createdAt ?? a.createdAt;
    const bDate = b.lastMessage?.createdAt ?? b.createdAt;
    return bDate.getTime() - aDate.getTime();
  });
}

export async function getAdminPendingChatCount() {
  const chats = await getAdminChatList();

  return chats.filter((chat) => chat.incomingCount > 0).length;
}

export async function getAdminChat(chatId: string) {
  await requireUser(["admin"]);

  const [chat] = await db
    .select({
      id: chats.id,
      status: chats.status,
      createdAt: chats.createdAt,
      companyId: buyerCompanies.id,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
    })
    .from(chats)
    .innerJoin(buyerCompanies, eq(buyerCompanies.id, chats.buyerCompanyId))
    .innerJoin(users, eq(users.id, chats.userId))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat) {
    return null;
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
    .limit(160);

  return {
    ...chat,
    messages: rows,
  };
}
