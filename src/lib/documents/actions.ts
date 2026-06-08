"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  documentVersions,
  documents,
  files,
  notifications,
  orders,
  sellers,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";
import { insertBuyerCompanyNotifications } from "@/lib/notifications/helpers";
import {
  buyerCompanyDocumentTypes,
  documentTypes,
  orderDocumentTypes,
  sellerDocumentTypes,
} from "@/lib/documents/types";

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
const maxDocumentSizeBytes = 50 * 1024 * 1024;
const buyerCompanyDocumentTypeValues = new Set(
  buyerCompanyDocumentTypes.map(([value]) => value),
);
const sellerDocumentTypeValues = new Set(sellerDocumentTypes.map(([value]) => value));
const orderDocumentTypeValues = new Set(orderDocumentTypes.map(([value]) => value));
const adminDocumentTypeValues = new Set(documentTypes.map(([value]) => value));

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeFileName(fileName: string) {
  const normalized = fileName
    .replace(/[^\w.\-а-яА-ЯёЁ ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return normalized || "document";
}

function redirectWithDocumentError(returnPath: string, message: string): never {
  redirect(getRedirectPath(returnPath, "documentError", message));
}

function getAdminDocumentReturnPath(formData: FormData) {
  const returnPath = getString(formData, "returnPath");

  if (returnPath.startsWith("/admin/")) {
    return sanitizeDocumentReturnPath(returnPath, "/admin/documents");
  }

  return "/admin/documents";
}

function sanitizeDocumentReturnPath(returnPath: string, fallback: string) {
  let url: URL;

  try {
    url = new URL(returnPath, "http://city-market.local");
  } catch {
    return fallback;
  }

  const isAllowedPath =
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/account/") ||
    url.pathname === "/seller";

  if (!isAllowedPath) {
    return fallback;
  }

  url.searchParams.delete("documentError");
  url.searchParams.delete("documentUploaded");
  url.searchParams.delete("documentUpdated");

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function getRedirectPath(returnPath: string, key: string, value = "1") {
  const cleanedPath = sanitizeDocumentReturnPath(returnPath, returnPath);
  const url = new URL(cleanedPath, "http://city-market.local");
  url.searchParams.set(key, value);

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function validateDocumentFile(returnPath: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    redirectWithDocumentError(returnPath, "Выберите файл документа.");
  }

  const extension = getFileExtension(value.name);

  if (!allowedExtensions.has(extension)) {
    redirectWithDocumentError(
      returnPath,
      "Поддерживаются только PDF, DOC, DOCX, JPG, PNG, XLS и XLSX.",
    );
  }

  if (value.type && !allowedMimeTypes.has(value.type)) {
    redirectWithDocumentError(returnPath, "Формат файла не поддерживается.");
  }

  if (value.size > maxDocumentSizeBytes) {
    redirectWithDocumentError(returnPath, "Файл должен быть не больше 50 МБ.");
  }

  return value;
}

function assertDocumentType(
  returnPath: string,
  type: string,
  allowedTypes: Set<string>,
) {
  if (!allowedTypes.has(type)) {
    redirectWithDocumentError(returnPath, "Тип документа не поддерживается.");
  }
}

async function persistDocumentFile(file: File, uploadedById: string, storagePrefix: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name);
  const storageKey = `${storagePrefix}/${randomUUID()}-${fileName}`;
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

  return storedFile;
}

function getDocumentStoragePrefix(document: {
  target: string;
  orderId: string | null;
  buyerCompanyId: string | null;
  sellerId: string | null;
}) {
  if (document.target === "order" && document.orderId) {
    return `documents/orders/${document.orderId}`;
  }

  if (document.target === "buyer_company" && document.buyerCompanyId) {
    return `documents/buyer-companies/${document.buyerCompanyId}`;
  }

  if (document.target === "seller" && document.sellerId) {
    return `documents/sellers/${document.sellerId}`;
  }

  return "documents/admin";
}

async function insertAdminNotifications(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  values: {
    type: string;
    title: string;
    body: string;
    buyerCompanyId?: string | null;
    sellerId?: string | null;
  },
) {
  const admins = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (admins.length === 0) {
    return;
  }

  await tx.insert(notifications).values(
    admins.map((admin) => ({
      userId: admin.id,
      buyerCompanyId: values.buyerCompanyId ?? null,
      sellerId: values.sellerId ?? null,
      type: values.type,
      title: values.title,
      body: values.body,
    })),
  );
}

export async function uploadOrderDocumentAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const returnPath = `/admin/orders/${orderId}`;
  const type = getString(formData, "type") || "other";
  const title = getString(formData, "title");
  const comment = getString(formData, "comment");
  const isVisibleToBuyer = formData.get("isVisibleToBuyer") === "on";

  if (!orderId) {
    redirect("/admin/orders");
  }

  if (!title) {
    redirectWithDocumentError(returnPath, "Укажите название документа.");
  }

  assertDocumentType(returnPath, type, orderDocumentTypeValues);

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      userId: orders.userId,
      buyerCompanyId: orders.buyerCompanyId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    redirect("/admin/orders");
  }

  const storedFile = await persistDocumentFile(
    file,
    user.id,
    `documents/orders/${order.id}`,
  );

  await db.transaction(async (tx) => {
    const [document] = await tx
      .insert(documents)
      .values({
        type,
        title,
        target: "order",
        buyerCompanyId: order.buyerCompanyId,
        orderId: order.id,
        currentVersion: 1,
        isVisibleToBuyer,
        uploadedById: user.id,
      })
      .returning({ id: documents.id });

    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: 1,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "order",
        orderId: order.id,
        title,
        visibleToBuyer: isVisibleToBuyer,
      },
    });

    if (isVisibleToBuyer) {
      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: order.buyerCompanyId,
        type: "document_uploaded",
        title: `Новый документ по заказу ${order.number}`,
        body: title,
      });
    }
  });

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath("/account/notifications");

  redirect(`/admin/orders/${order.id}?documentUploaded=1`);
}

export async function uploadOrderDocumentVersionAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const documentId = getString(formData, "documentId");
  const returnPath = `/admin/orders/${orderId}`;
  const comment = getString(formData, "comment");

  if (!orderId || !documentId) {
    redirect("/admin/orders");
  }

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const [document] = await db
    .select({
      id: documents.id,
      title: documents.title,
      currentVersion: documents.currentVersion,
      isVisibleToBuyer: documents.isVisibleToBuyer,
      orderId: documents.orderId,
      buyerCompanyId: documents.buyerCompanyId,
      orderNumber: orders.number,
    })
    .from(documents)
    .innerJoin(orders, eq(orders.id, documents.orderId))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!document || document.orderId !== orderId) {
    redirectWithDocumentError(returnPath, "Документ не найден.");
  }

  const nextVersion = document.currentVersion + 1;
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    `documents/orders/${orderId}`,
  );

  await db.transaction(async (tx) => {
    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: nextVersion,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx
      .update(documents)
      .set({
        currentVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, document.id));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.version_upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "order",
        orderId,
        version: nextVersion,
      },
    });

    if (document.isVisibleToBuyer) {
      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: document.buyerCompanyId,
        type: "document_updated",
        title: `Документ по заказу ${document.orderNumber} обновлен`,
        body: document.title,
      });
    }
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account/notifications");

  redirect(`/admin/orders/${orderId}?documentUploaded=1`);
}

export async function uploadBuyerCompanyDocumentAction(formData: FormData) {
  const user = await requireUser(["buyer"]);
  const returnPath = "/account/documents";
  const type = getString(formData, "type") || "other";
  const title = getString(formData, "title");
  const comment = getString(formData, "comment");

  if (!user.buyerCompanyId) {
    redirect(returnPath);
  }

  if (!title) {
    redirectWithDocumentError(returnPath, "Укажите название документа.");
  }

  assertDocumentType(returnPath, type, buyerCompanyDocumentTypeValues);

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    `documents/buyer-companies/${user.buyerCompanyId}`,
  );

  await db.transaction(async (tx) => {
    const [document] = await tx
      .insert(documents)
      .values({
        type,
        title,
        target: "buyer_company",
        buyerCompanyId: user.buyerCompanyId,
        currentVersion: 1,
        isVisibleToBuyer: true,
        uploadedById: user.id,
      })
      .returning({ id: documents.id });

    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: 1,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "buyer_company",
        buyerCompanyId: user.buyerCompanyId,
        title,
      },
    });

    await insertAdminNotifications(tx, {
      type: "document_uploaded_by_buyer",
      title: "Покупатель загрузил документ",
      body: title,
      buyerCompanyId: user.buyerCompanyId,
    });
  });

  revalidatePath("/account");
  revalidatePath("/account/company");
  revalidatePath("/account/documents");
  revalidatePath("/checkout");
  revalidatePath("/admin/documents");
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  redirect("/account/documents?documentUploaded=1");
}

export async function uploadBuyerCompanyDocumentVersionAction(formData: FormData) {
  const user = await requireUser(["buyer"]);
  const returnPath = "/account/documents";
  const documentId = getString(formData, "documentId");
  const comment = getString(formData, "comment");

  if (!user.buyerCompanyId || !documentId) {
    redirect(returnPath);
  }

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const [document] = await db
    .select({
      id: documents.id,
      title: documents.title,
      target: documents.target,
      currentVersion: documents.currentVersion,
      buyerCompanyId: documents.buyerCompanyId,
      orderId: documents.orderId,
      sellerId: documents.sellerId,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (
    !document ||
    document.buyerCompanyId !== user.buyerCompanyId
  ) {
    redirectWithDocumentError(returnPath, "Документ не найден.");
  }

  if (document.target !== "buyer_company") {
    redirectWithDocumentError(
      returnPath,
      "Этот документ нельзя заменить из кабинета покупателя. Счета и документы по заказу обновляет администратор.",
    );
  }

  const nextVersion = document.currentVersion + 1;
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    getDocumentStoragePrefix(document),
  );

  await db.transaction(async (tx) => {
    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: nextVersion,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx
      .update(documents)
      .set({
        currentVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, document.id));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.version_upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "buyer_company",
        buyerCompanyId: user.buyerCompanyId,
        version: nextVersion,
      },
    });

    await insertAdminNotifications(tx, {
      type: "document_updated_by_buyer",
      title: "Покупатель обновил документ",
      body: document.title,
      buyerCompanyId: user.buyerCompanyId,
    });
  });

  revalidatePath("/account/documents");
  revalidatePath("/admin/documents");
  revalidatePath("/account/notifications");
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  redirect("/account/documents?documentUploaded=1");
}

export async function uploadSellerDocumentAction(formData: FormData) {
  const user = await requireUser(["seller"]);
  const returnPath = "/seller";
  const type = getString(formData, "type") || "other";
  const title = getString(formData, "title");
  const comment = getString(formData, "comment");

  if (!user.sellerId) {
    redirect(returnPath);
  }

  if (!title) {
    redirectWithDocumentError(returnPath, "Укажите название документа.");
  }

  assertDocumentType(returnPath, type, sellerDocumentTypeValues);

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    `documents/sellers/${user.sellerId}`,
  );

  await db.transaction(async (tx) => {
    const [document] = await tx
      .insert(documents)
      .values({
        type,
        title,
        target: "seller",
        sellerId: user.sellerId,
        currentVersion: 1,
        isVisibleToSeller: true,
        uploadedById: user.id,
      })
      .returning({ id: documents.id });

    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: 1,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "seller",
        sellerId: user.sellerId,
        title,
      },
    });

    await insertAdminNotifications(tx, {
      type: "document_uploaded_by_seller",
      title: "Продавец загрузил документ",
      body: title,
      sellerId: user.sellerId,
    });
  });

  revalidatePath("/seller");
  revalidatePath("/admin/documents");
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  redirect("/seller?documentUploaded=1");
}

export async function uploadSellerDocumentVersionAction(formData: FormData) {
  const user = await requireUser(["seller"]);
  const returnPath = "/seller";
  const documentId = getString(formData, "documentId");
  const comment = getString(formData, "comment");

  if (!user.sellerId || !documentId) {
    redirect(returnPath);
  }

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const [document] = await db
    .select({
      id: documents.id,
      title: documents.title,
      target: documents.target,
      currentVersion: documents.currentVersion,
      buyerCompanyId: documents.buyerCompanyId,
      orderId: documents.orderId,
      sellerId: documents.sellerId,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (
    !document ||
    document.target !== "seller" ||
    document.sellerId !== user.sellerId
  ) {
    redirectWithDocumentError(returnPath, "Документ не найден.");
  }

  const nextVersion = document.currentVersion + 1;
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    getDocumentStoragePrefix(document),
  );

  await db.transaction(async (tx) => {
    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: nextVersion,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx
      .update(documents)
      .set({
        currentVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, document.id));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.version_upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: "seller",
        sellerId: user.sellerId,
        version: nextVersion,
      },
    });

    await insertAdminNotifications(tx, {
      type: "document_updated_by_seller",
      title: "Продавец обновил документ",
      body: document.title,
      sellerId: user.sellerId,
    });
  });

  revalidatePath("/seller");
  revalidatePath("/admin/documents");
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  redirect("/seller?documentUploaded=1");
}

export async function uploadAdminDocumentAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const returnPath = getAdminDocumentReturnPath(formData);
  const targetObject = getString(formData, "targetObject");
  const [targetFromObject, targetIdFromObject] = targetObject.split(":");
  const target = getString(formData, "target") || targetFromObject;
  const targetId = getString(formData, "targetId") || targetIdFromObject;
  const type = getString(formData, "type") || "other";
  const title = getString(formData, "title");
  const comment = getString(formData, "comment");
  const isVisibleToBuyer = formData.get("isVisibleToBuyer") === "on";
  const isVisibleToSeller = formData.get("isVisibleToSeller") === "on";

  if (!title || !target || !targetId) {
    redirectWithDocumentError(returnPath, "Укажите название, привязку и объект.");
  }

  assertDocumentType(returnPath, type, adminDocumentTypeValues);

  const file = validateDocumentFile(returnPath, formData.get("file"));
  let buyerCompanyId: string | null = null;
  let orderId: string | null = null;
  let sellerId: string | null = null;
  let storagePrefix = "documents/admin";

  if (target === "order") {
    assertDocumentType(returnPath, type, orderDocumentTypeValues);

    const [order] = await db
      .select({
        id: orders.id,
        buyerCompanyId: orders.buyerCompanyId,
      })
      .from(orders)
      .where(eq(orders.id, targetId))
      .limit(1);

    if (!order) {
      redirectWithDocumentError(returnPath, "Заказ не найден.");
    }

    orderId = order.id;
    buyerCompanyId = order.buyerCompanyId;
    storagePrefix = `documents/orders/${order.id}`;
  } else if (target === "buyer_company") {
    assertDocumentType(returnPath, type, buyerCompanyDocumentTypeValues);

    const [company] = await db
      .select({ id: buyerCompanies.id })
      .from(buyerCompanies)
      .where(eq(buyerCompanies.id, targetId))
      .limit(1);

    if (!company) {
      redirectWithDocumentError(returnPath, "Компания не найдена.");
    }

    buyerCompanyId = company.id;
    storagePrefix = `documents/buyer-companies/${company.id}`;
  } else if (target === "seller") {
    assertDocumentType(returnPath, type, sellerDocumentTypeValues);

    const [seller] = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.id, targetId))
      .limit(1);

    if (!seller) {
      redirectWithDocumentError(returnPath, "Продавец не найден.");
    }

    sellerId = seller.id;
    storagePrefix = `documents/sellers/${seller.id}`;
  } else {
    redirectWithDocumentError(returnPath, "Тип привязки не поддерживается.");
  }

  const storedFile = await persistDocumentFile(file, user.id, storagePrefix);

  await db.transaction(async (tx) => {
    const [document] = await tx
      .insert(documents)
      .values({
        type,
        title,
        target: target as "order" | "buyer_company" | "seller",
        buyerCompanyId,
        orderId,
        sellerId,
        currentVersion: 1,
        isVisibleToBuyer,
        isVisibleToSeller,
        uploadedById: user.id,
      })
      .returning({ id: documents.id });

    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: 1,
      comment: comment || null,
      uploadedById: user.id,
    });

    if (isVisibleToBuyer) {
      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId,
        type: "document_uploaded",
        title: "Новый документ",
        body: title,
      });
    }

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target,
        targetId,
        title,
        visibleToBuyer: isVisibleToBuyer,
        visibleToSeller: isVisibleToSeller,
      },
    });
  });

  revalidatePath("/admin/documents");
  revalidatePath("/account/company");
  revalidatePath("/account/documents");
  revalidatePath("/account/notifications");
  revalidatePath("/checkout");
  revalidatePath(returnPath);

  if (buyerCompanyId) {
    revalidatePath(`/admin/companies/${buyerCompanyId}`);
  }

  if (sellerId) {
    revalidatePath(`/admin/sellers/${sellerId}`);
    revalidatePath("/seller");
  }

  redirect(getRedirectPath(returnPath, "documentUploaded"));
}

export async function uploadAdminDocumentVersionAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const returnPath = getAdminDocumentReturnPath(formData);
  const documentId = getString(formData, "documentId");
  const comment = getString(formData, "comment");

  if (!documentId) {
    redirect(returnPath);
  }

  const file = validateDocumentFile(returnPath, formData.get("file"));
  const [document] = await db
    .select({
      id: documents.id,
      title: documents.title,
      target: documents.target,
      currentVersion: documents.currentVersion,
      isVisibleToBuyer: documents.isVisibleToBuyer,
      isVisibleToSeller: documents.isVisibleToSeller,
      buyerCompanyId: documents.buyerCompanyId,
      orderId: documents.orderId,
      sellerId: documents.sellerId,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!document) {
    redirectWithDocumentError(returnPath, "Документ не найден.");
  }

  const nextVersion = document.currentVersion + 1;
  const storedFile = await persistDocumentFile(
    file,
    user.id,
    getDocumentStoragePrefix(document),
  );

  await db.transaction(async (tx) => {
    await tx.insert(documentVersions).values({
      documentId: document.id,
      fileId: storedFile.id,
      version: nextVersion,
      comment: comment || null,
      uploadedById: user.id,
    });

    await tx
      .update(documents)
      .set({
        currentVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, document.id));

    if (document.isVisibleToBuyer) {
      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: document.buyerCompanyId,
        type: "document_updated",
        title: "Документ обновлен",
        body: document.title,
      });
    }

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.version_upload",
      entityType: "document",
      entityId: document.id,
      metadata: {
        target: document.target,
        version: nextVersion,
      },
    });
  });

  revalidatePath("/admin/documents");
  revalidatePath("/account/documents");
  revalidatePath("/account/notifications");
  revalidatePath(returnPath);

  if (document.buyerCompanyId) {
    revalidatePath(`/admin/companies/${document.buyerCompanyId}`);
  }

  if (document.sellerId) {
    revalidatePath(`/admin/sellers/${document.sellerId}`);
    revalidatePath("/seller");
  }

  redirect(getRedirectPath(returnPath, "documentUpdated"));
}

export async function updateDocumentVisibilityAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const documentId = getString(formData, "documentId");
  const returnPath = getAdminDocumentReturnPath(formData);

  if (!documentId) {
    redirect(returnPath);
  }

  const isVisibleToBuyer = formData.get("isVisibleToBuyer") === "on";
  const isVisibleToSeller = formData.get("isVisibleToSeller") === "on";

  await db.transaction(async (tx) => {
    await tx
      .update(documents)
      .set({
        isVisibleToBuyer,
        isVisibleToSeller,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.visibility_update",
      entityType: "document",
      entityId: documentId,
      metadata: {
        visibleToBuyer: isVisibleToBuyer,
        visibleToSeller: isVisibleToSeller,
      },
    });
  });

  revalidatePath("/admin/documents");
  revalidatePath("/account/company");
  revalidatePath("/account/documents");
  revalidatePath("/checkout");
  revalidatePath("/seller");
  revalidatePath(returnPath);
  redirect(getRedirectPath(returnPath, "documentUpdated"));
}

export async function hideDocumentAction(formData: FormData) {
  const user = await requireUser(["admin"]);
  const documentId = getString(formData, "documentId");
  const returnPath = getAdminDocumentReturnPath(formData);

  if (!documentId) {
    redirect(returnPath);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(documents)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "document.hide",
      entityType: "document",
      entityId: documentId,
    });
  });

  revalidatePath("/admin/documents");
  revalidatePath("/account/documents");
  revalidatePath("/seller");
  revalidatePath(returnPath);
  redirect(getRedirectPath(returnPath, "documentUpdated"));
}
