"use server";

import { and, eq } from "drizzle-orm";
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

  let wasAlreadyProcessed = false;

  await db.transaction(async (tx) => {
    const [moderatedRequest] = await tx
      .update(sellerProductChangeRequests)
      .set({
        status: "published",
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellerProductChangeRequests.id, request.id),
          eq(sellerProductChangeRequests.status, "on_moderation"),
        ),
      )
      .returning({ id: sellerProductChangeRequests.id });

    if (!moderatedRequest) {
      wasAlreadyProcessed = true;
      return;
    }

    const [productBeforeModeration] = await tx
      .select({ priorityOfferId: products.priorityOfferId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    const currentPublishedOffers = await tx
      .select({
        id: sellerOffers.id,
        sellerId: sellerOffers.sellerId,
        priceWithVat: sellerOffers.priceWithVat,
      })
      .from(sellerOffers)
      .where(
        and(
          eq(sellerOffers.productId, productId),
          eq(sellerOffers.status, "published"),
        ),
      );
    const currentPriorityOffer =
      currentPublishedOffers.find(
        (offer) => offer.id === productBeforeModeration?.priorityOfferId,
      ) ??
      currentPublishedOffers.reduce<(typeof currentPublishedOffers)[number] | null>(
        (best, offer) =>
          !best || Number(offer.priceWithVat) < Number(best.priceWithVat)
            ? offer
            : best,
        null,
      );
    let selectedPublishedOffer = currentPriorityOffer;

    if (request.type !== "offer_create") {
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
    } else {
      await tx
        .update(products)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));
    }

    await tx
      .update(sellerOffers)
      .set({ isPriority: false, updatedAt: new Date() })
      .where(eq(sellerOffers.productId, productId));

    await tx
      .update(sellerOffers)
      .set({
        priceWithVat: payload.priceWithVat,
        vatRate: payload.vatRate,
        status: "published",
        isPriority: request.type !== "offer_create",
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(sellerOffers.id, sellerOfferId));

    if (request.type === "offer_create") {
      const publishedOffers = await tx
        .select({
          id: sellerOffers.id,
          sellerId: sellerOffers.sellerId,
          priceWithVat: sellerOffers.priceWithVat,
        })
        .from(sellerOffers)
        .where(
          and(
            eq(sellerOffers.productId, productId),
            eq(sellerOffers.status, "published"),
          ),
        );
      const newPublishedOffer = publishedOffers.find(
        (offer) => offer.id === sellerOfferId,
      );
      const minPublishedOffer = publishedOffers.reduce<
        (typeof publishedOffers)[number] | null
      >(
        (best, offer) =>
          !best || Number(offer.priceWithVat) < Number(best.priceWithVat)
            ? offer
            : best,
        null,
      );
      selectedPublishedOffer =
        currentPriorityOffer &&
        newPublishedOffer &&
        Number(newPublishedOffer.priceWithVat) < Number(currentPriorityOffer.priceWithVat)
          ? newPublishedOffer
          : currentPriorityOffer ?? minPublishedOffer;

      if (selectedPublishedOffer) {
        await tx
          .update(sellerOffers)
          .set({ isPriority: false, updatedAt: new Date() })
          .where(eq(sellerOffers.productId, productId));

        await tx
          .update(sellerOffers)
          .set({ isPriority: true, updatedAt: new Date() })
          .where(eq(sellerOffers.id, selectedPublishedOffer.id));

        await tx
          .update(products)
          .set({
            priorityOfferId: selectedPublishedOffer.id,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));
      }
    } else {
      selectedPublishedOffer = {
        id: sellerOfferId,
        sellerId: request.sellerId,
        priceWithVat: payload.priceWithVat,
      };
    }

    await insertSellerNotifications(tx, {
      sellerId: request.sellerId,
      type: "product_published",
      title:
        request.type === "offer_create"
          ? selectedPublishedOffer?.id === sellerOfferId
            ? "Предложение вышло на витрину"
            : "Предложение товара опубликовано"
          : request.type === "update"
          ? "Изменения товара опубликованы"
          : "Товар опубликован",
      body:
        request.type === "offer_create" && selectedPublishedOffer?.id === sellerOfferId
          ? comment
            ? `${payload.name}: покупатели теперь видят вашу цену в каталоге. ${comment}`
            : `${payload.name}: покупатели теперь видят вашу цену в каталоге.`
          : comment
            ? `${payload.name}: ${comment}`
            : payload.name,
    });

    if (
      request.type === "offer_create" &&
      selectedPublishedOffer &&
      selectedPublishedOffer.id !== sellerOfferId
    ) {
      await insertSellerNotifications(tx, {
        sellerId: request.sellerId,
        type: "product_offer_displaced",
        title: "Цена перебита",
        body: `${payload.name}: предложение опубликовано, но покупатели сейчас видят более выгодную цену другого продавца. Снизьте цену, чтобы выйти на витрину.`,
      });
    }

    if (
      currentPriorityOffer &&
      selectedPublishedOffer &&
      currentPriorityOffer.id !== selectedPublishedOffer.id &&
      currentPriorityOffer.sellerId !== selectedPublishedOffer.sellerId
    ) {
      await insertSellerNotifications(tx, {
        sellerId: currentPriorityOffer.sellerId,
        type: "product_offer_displaced",
        title: "Вашу цену перебили",
        body: `${payload.name}: ваше предложение больше не активно на витрине. Обновите цену, если хотите вернуть товар в продажу.`,
      });
    }

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

  if (wasAlreadyProcessed) {
    redirect("/admin/products/moderation?error=not-found");
  }

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/seller");
  revalidatePath("/seller/notifications");
  revalidatePath(`/seller/products/${productId}`);
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

  let wasAlreadyProcessed = false;

  await db.transaction(async (tx) => {
    const [moderatedRequest] = await tx
      .update(sellerProductChangeRequests)
      .set({
        status: "rejected",
        moderationComment: comment || null,
        moderatedAt: new Date(),
        moderatedById: admin.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellerProductChangeRequests.id, request.id),
          eq(sellerProductChangeRequests.status, "on_moderation"),
        ),
      )
      .returning({ id: sellerProductChangeRequests.id });

    if (!moderatedRequest) {
      wasAlreadyProcessed = true;
      return;
    }

    if (
      (request.type === "create" || request.type === "offer_create") &&
      request.sellerOfferId
    ) {
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
      title: "Модерация товара не пройдена",
      body: `${normalizePayload(request.payload).name || "Товар"}: ${
        comment || "Проверьте карточку товара."
      }`,
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

  if (wasAlreadyProcessed) {
    redirect("/admin/products/moderation?error=not-found");
  }

  revalidatePath("/seller");
  revalidatePath("/seller/notifications");
  revalidatePath(`/seller/products/${request.productId}`);
  revalidatePath("/admin/products/moderation");

  redirect("/admin/products/moderation?moderated=1");
}
