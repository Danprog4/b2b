"use server";

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import {
  auditEvents,
  files,
  productImages,
  products,
  sellerOffers,
  sellerProductChangeRequests,
  sellers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { recalculateAutomaticProductPriority } from "@/lib/admin/product-priority";
import { writeStorageFile } from "@/lib/files/storage";
import { getNextProductSku } from "@/lib/numbering/sequences";
import { insertAdminNotifications } from "@/lib/notifications/helpers";
import { SELLER_DELETED_OFFER_COMMENT } from "@/lib/products/offer-status";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxProductImageSizeBytes = 10 * 1024 * 1024;

type SellerProductPayload = {
  name: string;
  categoryId: string;
  subcategoryId: string | null;
  description: string | null;
  priceWithVat: string;
  vatRate: string;
  size: string | null;
  unit: string;
  mainImageFileId?: string | null;
  galleryImageFileIds?: string[];
};

function getPayloadRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function getPayloadString(payload: unknown, key: string) {
  const value = getPayloadRecord(payload)?.[key];
  return typeof value === "string" ? value : "";
}

function getPayloadStringArray(payload: unknown, key: string) {
  const value = getPayloadRecord(payload)?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value: string, fallback = "0.00") {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : fallback;
}

function normalizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && Boolean(value.name);
}

function getUploadedFiles(formData: FormData, key: string) {
  return formData.getAll(key).filter(isUploadedFile).slice(0, 10);
}

function redirectWithProductError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function validateProductImage(path: string, file: File) {
  if (!allowedImageMimeTypes.has(file.type)) {
    redirectWithProductError(path, "Поддерживаются только JPG, PNG и WEBP.");
  }

  if (file.size > maxProductImageSizeBytes) {
    redirectWithProductError(path, "Изображение должно быть не больше 10 МБ.");
  }
}

async function persistProductImageFile({
  file,
  productId,
  uploadedById,
}: {
  file: File;
  productId: string;
  uploadedById: string;
}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name) || "product-image";
  const storageKey = `products/${productId}/seller-upload/${randomUUID()}-${fileName}`;
  const { sizeBytes } = await writeStorageFile(storageKey, bytes, {
    contentType: file.type,
  });

  const [storedFile] = await db
    .insert(files)
    .values({
      originalName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes,
      access: "public",
      uploadedById,
    })
    .returning({ id: files.id });

  return storedFile.id;
}

async function persistSellerGalleryFiles({
  formData,
  productId,
  uploadedById,
  returnPath,
}: {
  formData: FormData;
  productId: string;
  uploadedById: string;
  returnPath: string;
}) {
  const galleryFiles = getUploadedFiles(formData, "galleryImages");
  galleryFiles.forEach((file) => validateProductImage(returnPath, file));

  const fileIds: string[] = [];
  for (const file of galleryFiles) {
    fileIds.push(
      await persistProductImageFile({
        file,
        productId,
        uploadedById,
      }),
    );
  }

  return fileIds;
}

const translit: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

  return slug || "product";
}

async function getUniqueSlug(name: string, excludeProductId?: string) {
  const base = slugify(name);
  let slug = base;
  let index = 2;

  while (true) {
    const filters = excludeProductId
      ? and(eq(products.slug, slug), ne(products.id, excludeProductId))
      : eq(products.slug, slug);
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(filters)
      .limit(1);

    if (!existing) {
      return slug;
    }

    slug = `${base}-${index}`;
    index += 1;
  }
}

function getSellerProductPayload(
  formData: FormData,
  returnPath = "/seller/products/new",
): SellerProductPayload {
  const name = getString(formData, "name");
  const categoryId = getString(formData, "categoryId");
  const subcategoryId = getString(formData, "subcategoryId");
  const priceWithVat = normalizeMoney(getString(formData, "priceWithVat"));
  const vatRate = "22.00";
  const unit = getString(formData, "unit");
  const size = getString(formData, "size");
  const description = getString(formData, "description");

  if (!name || !categoryId || !unit || Number(priceWithVat) <= 0) {
    redirectWithProductError(returnPath, "Заполните обязательные поля.");
  }

  return {
    name,
    categoryId,
    subcategoryId: subcategoryId || null,
    description: description || null,
    priceWithVat,
    vatRate,
    size: size || null,
    unit,
  };
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeRequiredString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizePayloadForComparison(payload: SellerProductPayload) {
  return {
    name: normalizeRequiredString(payload.name),
    categoryId: normalizeRequiredString(payload.categoryId),
    subcategoryId: normalizeNullableString(payload.subcategoryId),
    description: normalizeNullableString(payload.description),
    priceWithVat: normalizeMoney(payload.priceWithVat),
    vatRate: normalizeMoney(payload.vatRate || "22.00", "22.00"),
    size: normalizeNullableString(payload.size),
    unit: normalizeRequiredString(payload.unit),
    mainImageFileId: normalizeNullableString(payload.mainImageFileId),
    galleryImageFileIds: payload.galleryImageFileIds ?? [],
  };
}

function areStringArraysEqual(first: string[], second: string[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function areSellerProductPayloadsEqual(
  first: SellerProductPayload,
  second: SellerProductPayload,
) {
  const normalizedFirst = normalizePayloadForComparison(first);
  const normalizedSecond = normalizePayloadForComparison(second);

  return (
    normalizedFirst.name === normalizedSecond.name &&
    normalizedFirst.categoryId === normalizedSecond.categoryId &&
    normalizedFirst.subcategoryId === normalizedSecond.subcategoryId &&
    normalizedFirst.description === normalizedSecond.description &&
    normalizedFirst.priceWithVat === normalizedSecond.priceWithVat &&
    normalizedFirst.vatRate === normalizedSecond.vatRate &&
    normalizedFirst.size === normalizedSecond.size &&
    normalizedFirst.unit === normalizedSecond.unit &&
    normalizedFirst.mainImageFileId === normalizedSecond.mainImageFileId &&
    areStringArraysEqual(
      normalizedFirst.galleryImageFileIds,
      normalizedSecond.galleryImageFileIds,
    )
  );
}

function revalidateSellerProductUpdatePaths(productId: string) {
  revalidatePath("/seller");
  revalidatePath(`/seller/products/${productId}`);
  revalidatePath(`/seller/products/${productId}/edit`);
  revalidatePath("/admin");
  revalidatePath("/admin/products/moderation");
  revalidatePath("/admin/notifications");
}

export async function createSellerProductAction(formData: FormData) {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    redirect("/seller");
  }

  const sellerId = user.sellerId;
  const payload = getSellerProductPayload(formData);
  const mainImage = formData.get("mainImage");
  const galleryFiles = getUploadedFiles(formData, "galleryImages");

  if (isUploadedFile(mainImage)) {
    validateProductImage("/seller/products/new", mainImage);
  }
  galleryFiles.forEach((file) => validateProductImage("/seller/products/new", file));

  const sku = await getNextProductSku();
  const slug = await getUniqueSlug(payload.name);

  const [created] = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        sku,
        slug,
        name: payload.name,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId,
        sellerId,
        description: payload.description,
        priceWithVat: payload.priceWithVat,
        vatRate: payload.vatRate,
        size: payload.size,
        unit: payload.unit,
        isActive: false,
      })
      .returning({ id: products.id });

    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId: product.id,
        sellerId,
        priceWithVat: payload.priceWithVat,
        vatRate: payload.vatRate,
        status: "on_moderation",
        submittedAt: new Date(),
      })
      .returning({ id: sellerOffers.id });

    const [request] = await tx
      .insert(sellerProductChangeRequests)
      .values({
        productId: product.id,
        sellerOfferId: offer.id,
        sellerId,
        type: "create",
        status: "on_moderation",
        payload,
      })
      .returning({ id: sellerProductChangeRequests.id });

    await insertAdminNotifications(tx, {
      type: "product_moderation_requested",
      title: "Товар отправлен на модерацию",
      body: payload.name,
      sellerId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "seller_product.create_request",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId: product.id,
        offerId: offer.id,
        sku,
      },
    });

    return [{ productId: product.id, requestId: request.id }];
  });

  const uploadedMainImageFileId = isUploadedFile(mainImage)
    ? await persistProductImageFile({
        file: mainImage,
        productId: created.productId,
        uploadedById: user.id,
      })
    : null;
  const galleryImageFileIds =
    galleryFiles.length > 0
      ? await persistSellerGalleryFiles({
          formData,
          productId: created.productId,
          uploadedById: user.id,
          returnPath: "/seller/products/new",
        })
      : [];

  if (uploadedMainImageFileId || galleryImageFileIds.length > 0) {
    await db.transaction(async (tx) => {
      if (uploadedMainImageFileId) {
        await tx
          .update(products)
          .set({ mainImageFileId: uploadedMainImageFileId, updatedAt: new Date() })
          .where(eq(products.id, created.productId));
      }

      if (galleryImageFileIds.length > 0) {
        await tx.insert(productImages).values(
          galleryImageFileIds.map((fileId, index) => ({
            productId: created.productId,
            fileId,
            sortOrder: index + 1,
          })),
        );
      }

      await tx
        .update(sellerProductChangeRequests)
        .set({
          payload: {
            ...payload,
            ...(uploadedMainImageFileId
              ? { mainImageFileId: uploadedMainImageFileId }
              : {}),
            ...(galleryImageFileIds.length > 0 ? { galleryImageFileIds } : {}),
          },
          updatedAt: new Date(),
        })
        .where(eq(sellerProductChangeRequests.id, created.requestId));
    });
  }

  revalidatePath("/seller");
  revalidatePath("/admin");
  revalidatePath("/admin/products/moderation");
  revalidatePath("/admin/notifications");

  redirect("/seller?productSubmitted=1");
}

export async function requestSellerProductUpdateAction(formData: FormData) {
  const user = await requireUser(["seller"]);
  const productId = getString(formData, "productId");

  if (!user.sellerId || !productId) {
    redirect("/seller");
  }

  const sellerId = user.sellerId;
  const returnPath = `/seller/products/${productId}/edit`;
  const payload = getSellerProductPayload(formData, returnPath);
  const mainImage = formData.get("mainImage");
  const galleryFiles = getUploadedFiles(formData, "galleryImages");

  if (isUploadedFile(mainImage)) {
    validateProductImage(returnPath, mainImage);
  }
  galleryFiles.forEach((file) => validateProductImage(returnPath, file));

  const [row] = await db
    .select({
      productId: products.id,
      name: products.name,
      categoryId: products.categoryId,
      subcategoryId: products.subcategoryId,
      description: products.description,
      priceWithVat: sellerOffers.priceWithVat,
      vatRate: sellerOffers.vatRate,
      size: products.size,
      unit: products.unit,
      mainImageFileId: products.mainImageFileId,
      offerId: sellerOffers.id,
      offerStatus: sellerOffers.status,
      offerModerationComment: sellerOffers.moderationComment,
    })
    .from(products)
    .innerJoin(
      sellerOffers,
      and(
        eq(sellerOffers.productId, products.id),
        eq(sellerOffers.sellerId, sellerId),
      ),
    )
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) {
    redirect("/seller");
  }

  const [existingPendingRequest] = await db
    .select({
      id: sellerProductChangeRequests.id,
      type: sellerProductChangeRequests.type,
      payload: sellerProductChangeRequests.payload,
    })
    .from(sellerProductChangeRequests)
    .where(
      and(
        eq(sellerProductChangeRequests.productId, productId),
        eq(sellerProductChangeRequests.sellerId, sellerId),
        eq(sellerProductChangeRequests.status, "on_moderation"),
      ),
    )
    .limit(1);

  const existingGalleryImageFileIds = await db
    .select({ fileId: productImages.fileId })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
  const publishedGalleryFileIds = existingGalleryImageFileIds.map(
    (image) => image.fileId,
  );
  const pendingGalleryFileIds = getPayloadStringArray(
    existingPendingRequest?.payload,
    "galleryImageFileIds",
  );
  const baseGalleryFileIds =
    existingPendingRequest && pendingGalleryFileIds.length > 0
      ? pendingGalleryFileIds
      : publishedGalleryFileIds;
  const allowedExistingGalleryFileIds = new Set([
    ...publishedGalleryFileIds,
    ...pendingGalleryFileIds,
  ]);
  const keptExistingGalleryFileIds =
    formData.get("galleryImagesState") === "1"
      ? formData
          .getAll("existingGalleryImageFileIds")
          .filter(
            (value): value is string =>
              typeof value === "string" && allowedExistingGalleryFileIds.has(value),
          )
      : baseGalleryFileIds;

  const nextPayload: SellerProductPayload = {
    ...payload,
    mainImageFileId:
      getPayloadString(existingPendingRequest?.payload, "mainImageFileId") ||
      row.mainImageFileId,
  };
  if (isUploadedFile(mainImage)) {
    nextPayload.mainImageFileId = await persistProductImageFile({
      file: mainImage,
      productId,
      uploadedById: user.id,
    });
  }
  const uploadedGalleryImageFileIds = await persistSellerGalleryFiles({
    formData,
    productId,
    uploadedById: user.id,
    returnPath,
  });
  nextPayload.galleryImageFileIds = Array.from(
    new Set([
      ...keptExistingGalleryFileIds,
      ...uploadedGalleryImageFileIds,
    ]),
  ).slice(0, 10);

  const currentPayload: SellerProductPayload = {
    name: row.name,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    description: row.description,
    priceWithVat: row.priceWithVat,
    vatRate: row.vatRate || "22.00",
    size: row.size,
    unit: row.unit,
    mainImageFileId: row.mainImageFileId,
    galleryImageFileIds: publishedGalleryFileIds,
  };

  if (areSellerProductPayloadsEqual(nextPayload, currentPayload)) {
    if (existingPendingRequest?.type !== "update") {
      redirectWithProductError(
        returnPath,
        "Нет изменений для отправки на модерацию.",
      );
    }

    const [previousModeratedRequest] = await db
      .select({
        status: sellerProductChangeRequests.status,
        moderationComment: sellerProductChangeRequests.moderationComment,
      })
      .from(sellerProductChangeRequests)
      .where(
        and(
          eq(sellerProductChangeRequests.productId, productId),
          eq(sellerProductChangeRequests.sellerId, sellerId),
          ne(sellerProductChangeRequests.status, "on_moderation"),
        ),
      )
      .orderBy(desc(sellerProductChangeRequests.submittedAt))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx
        .update(sellerProductChangeRequests)
        .set({
          status: "hidden",
          payload: nextPayload,
          moderationComment:
            "Изменения отменены продавцом: версия совпадает с текущей карточкой.",
          moderatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sellerProductChangeRequests.id, existingPendingRequest.id));

      const restoredOfferStatus =
        previousModeratedRequest?.status === "rejected" ||
        previousModeratedRequest?.status === "published"
          ? previousModeratedRequest.status
          : row.offerStatus;

      if (row.offerStatus !== "published" && restoredOfferStatus !== row.offerStatus) {
        await tx
          .update(sellerOffers)
          .set({
            status: restoredOfferStatus,
            moderationComment:
              restoredOfferStatus === "rejected"
                ? previousModeratedRequest?.moderationComment ??
                  row.offerModerationComment
                : null,
            updatedAt: new Date(),
          })
          .where(eq(sellerOffers.id, row.offerId));
      }

      await tx.insert(auditEvents).values({
        actorId: user.id,
        action: "seller_product.update_request_cancel",
        entityType: "seller_product_change_request",
        entityId: existingPendingRequest.id,
        metadata: {
          productId,
          offerId: row.offerId,
        },
      });
    });

    revalidateSellerProductUpdatePaths(productId);
    redirect("/seller?productUpdateCanceled=1");
  }

  await db.transaction(async (tx) => {
    const [request] = existingPendingRequest
      ? await tx
          .update(sellerProductChangeRequests)
          .set({
            payload: nextPayload,
            moderationComment: null,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sellerProductChangeRequests.id, existingPendingRequest.id))
          .returning({ id: sellerProductChangeRequests.id })
      : await tx
          .insert(sellerProductChangeRequests)
          .values({
            productId,
            sellerOfferId: row.offerId,
            sellerId,
            type: "update",
            status: "on_moderation",
            payload: nextPayload,
          })
          .returning({ id: sellerProductChangeRequests.id });

    const [offer] = await tx
      .select({ status: sellerOffers.status })
      .from(sellerOffers)
      .where(eq(sellerOffers.id, row.offerId))
      .limit(1);

    if (offer?.status !== "published") {
      await tx
        .update(sellerOffers)
        .set({
          status: "on_moderation",
          submittedAt: new Date(),
          moderationComment: null,
          updatedAt: new Date(),
        })
        .where(eq(sellerOffers.id, row.offerId));
    }

    await insertAdminNotifications(tx, {
      type: "product_update_moderation_requested",
      title: "Изменение товара отправлено на модерацию",
      body: payload.name,
      sellerId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: existingPendingRequest
        ? "seller_product.update_request_replace"
        : "seller_product.update_request",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId,
        offerId: row.offerId,
      },
    });
  });

  revalidateSellerProductUpdatePaths(productId);

  redirect("/seller?productSubmitted=1");
}

export async function deleteSellerProductAction(formData: FormData) {
  const user = await requireUser(["seller"]);
  const productId = getString(formData, "productId");

  if (!user.sellerId || !productId) {
    redirect("/seller");
  }

  const sellerId = user.sellerId;

  const [row] = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      priorityOfferId: products.priorityOfferId,
      offerId: sellerOffers.id,
      offerStatus: sellerOffers.status,
      sellerName: sellers.name,
    })
    .from(products)
    .innerJoin(
      sellerOffers,
      and(
        eq(sellerOffers.productId, products.id),
        eq(sellerOffers.sellerId, sellerId),
      ),
    )
    .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) {
    redirect("/seller?productDeleteError=not-found");
  }

  if (row.offerStatus === "hidden") {
    redirect("/seller?productDeleted=1");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sellerOffers)
      .set({
        status: "hidden",
        isPriority: false,
        moderationComment: SELLER_DELETED_OFFER_COMMENT,
        updatedAt: new Date(),
      })
      .where(eq(sellerOffers.id, row.offerId));

    await tx
      .update(sellerProductChangeRequests)
      .set({
        status: "hidden",
        moderationComment: SELLER_DELETED_OFFER_COMMENT,
        moderatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellerProductChangeRequests.productId, row.productId),
          eq(sellerProductChangeRequests.sellerId, sellerId),
          eq(sellerProductChangeRequests.status, "on_moderation"),
        ),
      );

    if (row.priorityOfferId === row.offerId) {
      await recalculateAutomaticProductPriority(tx, row.productId);
    }

    const publishedOffers = await tx
      .select({ id: sellerOffers.id })
      .from(sellerOffers)
      .where(
        and(
          eq(sellerOffers.productId, row.productId),
          eq(sellerOffers.status, "published"),
        ),
      )
      .limit(1);

    if (publishedOffers.length === 0) {
      await tx
        .update(products)
        .set({
          isActive: false,
          priorityOfferId: null,
          priorityIsManual: false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, row.productId));
    }

    await insertAdminNotifications(tx, {
      type: "seller_product_deleted",
      title: "Товар удален продавцом",
      body: `${row.productName} · ${row.sellerName}`,
      sellerId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "seller_product.delete",
      entityType: "seller_offer",
      entityId: row.offerId,
      metadata: {
        productId: row.productId,
        productName: row.productName,
        sellerId,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${row.productSlug}`);
  revalidatePath("/seller");
  revalidatePath(`/seller/products/${row.productId}`);
  revalidatePath(`/seller/products/${row.productId}/edit`);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${row.productId}`);
  revalidatePath("/admin/products/moderation");

  redirect("/seller?productDeleted=1");
}
