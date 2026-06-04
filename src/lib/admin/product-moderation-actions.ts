"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditEvents,
  products,
  sellerOffers,
  sellerProductChangeRequests,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { insertSellerNotifications } from "@/lib/notifications/helpers";

type ProductModerationPayload = {
  name?: unknown;
  categoryId?: unknown;
  subcategoryId?: unknown;
  description?: unknown;
  priceWithVat?: unknown;
  vatRate?: unknown;
  size?: unknown;
  unit?: unknown;
  mainImageFileId?: unknown;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePayload(payload: ProductModerationPayload) {
  return {
    name: toRequiredString(payload.name),
    categoryId: toRequiredString(payload.categoryId),
    subcategoryId: toNullableString(payload.subcategoryId),
    description: toNullableString(payload.description),
    priceWithVat: toRequiredString(payload.priceWithVat),
    vatRate: toRequiredString(payload.vatRate) || "22.00",
    size: toNullableString(payload.size),
    unit: toRequiredString(payload.unit),
    mainImageFileId: toNullableString(payload.mainImageFileId),
  };
}

async function getModerationRequest(requestId: string) {
  const [request] = await db
    .select({
      id: sellerProductChangeRequests.id,
      productId: sellerProductChangeRequests.productId,
      sellerOfferId: sellerProductChangeRequests.sellerOfferId,
      sellerId: sellerProductChangeRequests.sellerId,
      type: sellerProductChangeRequests.type,
      status: sellerProductChangeRequests.status,
      payload: sellerProductChangeRequests.payload,
    })
    .from(sellerProductChangeRequests)
    .where(eq(sellerProductChangeRequests.id, requestId))
    .limit(1);

  return request ?? null;
}

export async function approveProductModerationRequestAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const requestId = getString(formData, "requestId");
  const comment = getString(formData, "comment");

  if (!requestId) {
    redirect("/admin/products/moderation");
  }

  const request = await getModerationRequest(requestId);

  if (
    !request ||
    request.status !== "on_moderation" ||
    !request.productId ||
    !request.sellerOfferId
  ) {
    redirect("/admin/products/moderation?error=not-found");
  }

  const productId = request.productId;
  const sellerOfferId = request.sellerOfferId;
  const payload = normalizePayload(request.payload);

  if (!payload.name || !payload.categoryId || !payload.unit || !payload.priceWithVat) {
    redirect("/admin/products/moderation?error=payload");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        name: payload.name,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId,
        description: payload.description,
        priceWithVat: payload.priceWithVat,
        vatRate: payload.vatRate,
        size: payload.size,
        unit: payload.unit,
        mainImageFileId: payload.mainImageFileId ?? undefined,
        isActive: true,
        priorityOfferId: request.sellerOfferId,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    await tx
      .update(sellerOffers)
      .set({
        priceWithVat: payload.priceWithVat,
        vatRate: payload.vatRate,
        status: "published",
        isPriority: true,
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(sellerOffers.id, sellerOfferId));

    await tx
      .update(sellerProductChangeRequests)
      .set({
        status: "published",
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(sellerProductChangeRequests.id, request.id));

    await insertSellerNotifications(tx, {
      sellerId: request.sellerId,
      type: "product_published",
      title: "Товар опубликован",
      body: payload.name,
    });

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller_product_moderation.approve",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId,
        offerId: sellerOfferId,
        type: request.type,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/seller");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/moderation");

  redirect("/admin/products/moderation?moderated=1");
}

export async function rejectProductModerationRequestAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const requestId = getString(formData, "requestId");
  const comment = getString(formData, "comment");

  if (!requestId) {
    redirect("/admin/products/moderation");
  }

  const request = await getModerationRequest(requestId);

  if (!request || request.status !== "on_moderation") {
    redirect("/admin/products/moderation?error=not-found");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sellerProductChangeRequests)
      .set({
        status: "rejected",
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(sellerProductChangeRequests.id, request.id));

    if (request.type === "create" && request.sellerOfferId) {
      await tx
        .update(sellerOffers)
        .set({
          status: "rejected",
          moderationComment: comment || null,
          moderatedAt: new Date(),
          moderatedById: admin.id,
          updatedAt: new Date(),
        })
        .where(eq(sellerOffers.id, request.sellerOfferId));
    }

    await insertSellerNotifications(tx, {
      sellerId: request.sellerId,
      type: "product_rejected",
      title: "Товар отклонен",
      body: comment || "Проверьте карточку товара.",
    });

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller_product_moderation.reject",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId: request.productId,
        offerId: request.sellerOfferId,
        type: request.type,
      },
    });
  });

  revalidatePath("/seller");
  revalidatePath("/admin/products/moderation");

  redirect("/admin/products/moderation?moderated=1");
}
