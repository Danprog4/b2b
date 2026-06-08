"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import {
  auditEvents,
  files,
  products,
  sellerOffers,
  sellerProductChangeRequests,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";
import { getNextProductSku } from "@/lib/numbering/sequences";
import { insertAdminNotifications } from "@/lib/notifications/helpers";

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
};

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

export async function createSellerProductAction(formData: FormData) {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    redirect("/seller");
  }

  const sellerId = user.sellerId;
  const payload = getSellerProductPayload(formData);
  const mainImage = formData.get("mainImage");

  if (isUploadedFile(mainImage)) {
    validateProductImage("/seller/products/new", mainImage);
  }

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

  if (isUploadedFile(mainImage)) {
    const fileId = await persistProductImageFile({
      file: mainImage,
      productId: created.productId,
      uploadedById: user.id,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({ mainImageFileId: fileId, updatedAt: new Date() })
        .where(eq(products.id, created.productId));

      await tx
        .update(sellerProductChangeRequests)
        .set({
          payload: { ...payload, mainImageFileId: fileId },
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

export async function requestExistingProductOfferAction(formData: FormData) {
  const user = await requireUser(["seller"]);
  const productId = getString(formData, "productId");
  const priceWithVat = normalizeMoney(getString(formData, "priceWithVat"));
  const vatRate = "22.00";
  const returnPath = "/seller/products/existing";

  if (!user.sellerId || !productId || Number(priceWithVat) <= 0) {
    redirectWithProductError(returnPath, "Заполните цену предложения.");
  }

  const sellerId = user.sellerId;
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      subcategoryId: products.subcategoryId,
      description: products.description,
      size: products.size,
      unit: products.unit,
      mainImageFileId: products.mainImageFileId,
      isActive: products.isActive,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product || !product.isActive) {
    redirectWithProductError(returnPath, "Товар не найден или недоступен.");
  }

  const [existingOffer] = await db
    .select({ id: sellerOffers.id, status: sellerOffers.status })
    .from(sellerOffers)
    .where(
      and(
        eq(sellerOffers.productId, product.id),
        eq(sellerOffers.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (existingOffer && existingOffer.status !== "rejected") {
    redirectWithProductError(
      returnPath,
      "У вас уже есть предложение по этому товару.",
    );
  }

  const [existingPendingRequest] = await db
    .select({ id: sellerProductChangeRequests.id })
    .from(sellerProductChangeRequests)
    .where(
      and(
        eq(sellerProductChangeRequests.productId, product.id),
        eq(sellerProductChangeRequests.sellerId, sellerId),
        eq(sellerProductChangeRequests.status, "on_moderation"),
      ),
    )
    .limit(1);

  if (existingPendingRequest) {
    redirectWithProductError(
      returnPath,
      "По этому товару уже есть заявка на модерации.",
    );
  }

  const payload: SellerProductPayload = {
    name: product.name,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId,
    description: product.description,
    priceWithVat,
    vatRate,
    size: product.size,
    unit: product.unit,
    mainImageFileId: product.mainImageFileId,
  };

  await db.transaction(async (tx) => {
    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId: product.id,
        sellerId,
        priceWithVat,
        vatRate,
        status: "on_moderation",
        submittedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat,
          vatRate,
          status: "on_moderation",
          moderationComment: null,
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ id: sellerOffers.id });

    const [request] = await tx
      .insert(sellerProductChangeRequests)
      .values({
        productId: product.id,
        sellerOfferId: offer.id,
        sellerId,
        type: "offer_create",
        status: "on_moderation",
        payload,
      })
      .returning({ id: sellerProductChangeRequests.id });

    await insertAdminNotifications(tx, {
      type: "product_offer_moderation_requested",
      title: "Предложение продавца отправлено на модерацию",
      body: product.name,
      sellerId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "seller_product.offer_create_request",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId: product.id,
        offerId: offer.id,
      },
    });
  });

  revalidatePath("/seller");
  revalidatePath("/seller/products/existing");
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

  if (isUploadedFile(mainImage)) {
    validateProductImage(returnPath, mainImage);
  }

  const [row] = await db
    .select({
      productId: products.id,
      offerId: sellerOffers.id,
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
    .select({ id: sellerProductChangeRequests.id })
    .from(sellerProductChangeRequests)
    .where(
      and(
        eq(sellerProductChangeRequests.productId, productId),
        eq(sellerProductChangeRequests.sellerId, sellerId),
        eq(sellerProductChangeRequests.status, "on_moderation"),
      ),
    )
    .limit(1);

  if (existingPendingRequest) {
    redirectWithProductError(
      returnPath,
      "У товара уже есть изменения на модерации.",
    );
  }

  const nextPayload: SellerProductPayload = { ...payload };
  if (isUploadedFile(mainImage)) {
    nextPayload.mainImageFileId = await persistProductImageFile({
      file: mainImage,
      productId,
      uploadedById: user.id,
    });
  }

  await db.transaction(async (tx) => {
    const [request] = await tx
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

    await insertAdminNotifications(tx, {
      type: "product_update_moderation_requested",
      title: "Изменение товара отправлено на модерацию",
      body: payload.name,
      sellerId,
    });

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "seller_product.update_request",
      entityType: "seller_product_change_request",
      entityId: request.id,
      metadata: {
        productId,
        offerId: row.offerId,
      },
    });
  });

  revalidatePath("/seller");
  revalidatePath("/admin");
  revalidatePath("/admin/products/moderation");
  revalidatePath("/admin/notifications");

  redirect("/seller?productSubmitted=1");
}
