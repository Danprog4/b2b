"use server";

import { and, count, eq, ne } from "drizzle-orm";
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
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";
import { getNextProductSku } from "@/lib/numbering/sequences";
import { insertSellerNotifications } from "@/lib/notifications/helpers";
import {
  recalculateAutomaticProductPriority,
  setManualProductPriorityOffer,
  syncStoredProductPriorityOffer,
} from "@/lib/admin/product-priority";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxProductImageSizeBytes = 10 * 1024 * 1024;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

function redirectWithImageError(productId: string | null, message: string) {
  const params = new URLSearchParams({ error: message });

  if (productId) {
    redirect(`/admin/products/${productId}?${params.toString()}`);
  }

  redirect(`/admin/products/new?${params.toString()}`);
}

function validateProductImage(file: File, productId: string | null) {
  if (!allowedImageMimeTypes.has(file.type)) {
    redirectWithImageError(productId, "Поддерживаются только JPG, PNG и WEBP.");
  }

  if (file.size > maxProductImageSizeBytes) {
    redirectWithImageError(productId, "Изображение должно быть не больше 10 МБ.");
  }
}

function getProductImageUploads(formData: FormData) {
  return {
    mainImage: formData.get("mainImage"),
    galleryFiles: formData.getAll("galleryImages").filter(isUploadedFile).slice(0, 10),
  };
}

function validateProductImageUploads(formData: FormData, productId: string | null) {
  const { mainImage, galleryFiles } = getProductImageUploads(formData);

  if (isUploadedFile(mainImage)) {
    validateProductImage(mainImage, productId);
  }

  galleryFiles.forEach((file) => validateProductImage(file, productId));
}

async function persistProductImageFile({
  file,
  productId,
  uploadedById,
  variant,
}: {
  file: File;
  productId: string;
  uploadedById: string;
  variant: "main" | "gallery";
}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name) || "product-image";
  const storageKey = `products/${productId}/${variant}/${randomUUID()}-${fileName}`;
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

  return storedFile;
}

async function insertGalleryImages({
  galleryFiles,
  productId,
  uploadedById,
}: {
  galleryFiles: File[];
  productId: string;
  uploadedById: string;
}) {
  if (galleryFiles.length === 0) {
    return;
  }

  const [existingCounter] = await db
    .select({ count: count() })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  const startOrder = existingCounter?.count ?? 0;
  const filesToInsert = galleryFiles.slice(0, Math.max(0, 10 - startOrder));

  if (filesToInsert.length === 0) {
    return;
  }

  const insertedFiles = [];
  for (const file of filesToInsert) {
    insertedFiles.push(
      await persistProductImageFile({
        file,
        productId,
        uploadedById,
        variant: "gallery",
      }),
    );
  }

  await db.insert(productImages).values(
    insertedFiles.map((file, index) => ({
      productId,
      fileId: file.id,
      sortOrder: startOrder + index + 1,
    })),
  );
}

async function applyProductImageUploads({
  formData,
  productId,
  uploadedById,
}: {
  formData: FormData;
  productId: string;
  uploadedById: string;
}) {
  const { mainImage, galleryFiles } = getProductImageUploads(formData);

  if (isUploadedFile(mainImage)) {
    const storedFile = await persistProductImageFile({
      file: mainImage,
      productId,
      uploadedById,
      variant: "main",
    });

    await db
      .update(products)
      .set({
        mainImageFileId: storedFile.id,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  }

  await insertGalleryImages({ galleryFiles, productId, uploadedById });
}

function normalizeMoney(value: string, fallback = "0.00") {
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed.toFixed(2);
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

function getProductValues(formData: FormData) {
  const name = getString(formData, "name");
  const categoryId = getString(formData, "categoryId");
  const subcategoryId = getString(formData, "subcategoryId");
  const sellerId = getString(formData, "sellerId");
  const priceWithVat = normalizeMoney(getString(formData, "priceWithVat"));
  const vatRate = normalizeMoney(getString(formData, "vatRate") || "22.00", "22.00");
  const unit = getString(formData, "unit");
  const size = getString(formData, "size");
  const description = getString(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (!name || !categoryId || !sellerId || !unit || Number(priceWithVat) <= 0) {
    redirect("/admin/products/new?error=required");
  }

  return {
    name,
    categoryId,
    subcategoryId: subcategoryId || null,
    sellerId,
    priceWithVat,
    vatRate,
    unit,
    size: size || null,
    description: description || null,
    isActive,
  };
}

export async function createProductAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const values = getProductValues(formData);
  validateProductImageUploads(formData, null);
  const sku = await getNextProductSku();
  const slug = await getUniqueSlug(values.name);

  const [product] = await db.transaction(async (tx) => {
    const [createdProduct] = await tx
      .insert(products)
      .values({
        sku,
        slug,
        ...values,
      })
      .returning({ id: products.id });

    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId: createdProduct.id,
        sellerId: values.sellerId,
        priceWithVat: values.priceWithVat,
        vatRate: values.vatRate,
        status: "published",
        isPriority: true,
        submittedAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: admin.id,
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat: values.priceWithVat,
          vatRate: values.vatRate,
          status: "published",
          isPriority: true,
          moderatedAt: new Date(),
          moderatedById: admin.id,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sellerOffers.id });

    await tx
      .update(products)
      .set({
        priorityOfferId: offer.id,
        updatedAt: new Date(),
      })
      .where(eq(products.id, createdProduct.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product.create",
      entityType: "product",
      entityId: createdProduct.id,
      metadata: {
        sku,
        name: values.name,
        sellerId: values.sellerId,
        offerId: offer.id,
      },
    });

    return [createdProduct];
  });

  await applyProductImageUploads({
    formData,
    productId: product.id,
    uploadedById: admin.id,
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin");
  revalidatePath("/admin/products");

  redirect(`/admin/products/${product.id}?created=1`);
}

export async function updateProductAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");

  if (!productId) {
    redirect("/admin/products");
  }

  const values = getProductValues(formData);
  validateProductImageUploads(formData, productId);
  const slug = await getUniqueSlug(values.name, productId);

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        slug,
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId,
        sellerId: values.sellerId,
        priceWithVat: values.priceWithVat,
        vatRate: values.vatRate,
        status: "published",
        submittedAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: admin.id,
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat: values.priceWithVat,
          vatRate: values.vatRate,
          status: "published",
          moderatedAt: new Date(),
          moderatedById: admin.id,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sellerOffers.id });

    const [productPriorityState] = await tx
      .select({ priorityIsManual: products.priorityIsManual })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (productPriorityState?.priorityIsManual) {
      await syncStoredProductPriorityOffer(tx, productId);
    } else {
      await recalculateAutomaticProductPriority(tx, productId);
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product.update",
      entityType: "product",
      entityId: productId,
      metadata: {
        name: values.name,
        active: values.isActive,
        sellerId: values.sellerId,
        offerId: offer.id,
      },
    });
  });

  await applyProductImageUploads({
    formData,
    productId,
    uploadedById: admin.id,
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${slug}`);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);

  redirect(`/admin/products/${productId}?saved=1`);
}

export async function clearProductMainImageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");

  if (!productId) {
    redirect("/admin/products");
  }

  const [product] = await db
    .select({ slug: products.slug, mainImageFileId: products.mainImageFileId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    redirect("/admin/products");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        mainImageFileId: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    if (product.mainImageFileId) {
      await tx
        .update(files)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(files.id, product.mainImageFileId));
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product.main_image_clear",
      entityType: "product",
      entityId: productId,
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function removeProductGalleryImageAction(
  productImageId: string,
  formData: FormData,
) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");

  if (!productId || !productImageId) {
    redirect("/admin/products");
  }

  const [row] = await db
    .select({
      productSlug: products.slug,
      fileId: productImages.fileId,
    })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(
      and(eq(productImages.id, productImageId), eq(productImages.productId, productId)),
    )
    .limit(1);

  if (!row) {
    redirect(`/admin/products/${productId}`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.id, productImageId));
    await tx
      .update(files)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(files.id, row.fileId));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product.gallery_image_remove",
      entityType: "product",
      entityId: productId,
      metadata: {
        productImageId,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${row.productSlug}`);
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function upsertProductOfferAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");
  const sellerId = getString(formData, "sellerId");
  const priceWithVat = normalizeMoney(getString(formData, "priceWithVat"));
  const vatRate = normalizeMoney(getString(formData, "vatRate") || "22.00", "22.00");
  const status = getString(formData, "status") || "published";
  const isPriority = formData.get("isPriority") === "on";

  if (
    !productId ||
    !sellerId ||
    Number(priceWithVat) <= 0 ||
    !["draft", "on_moderation", "published", "rejected", "hidden"].includes(status)
  ) {
    redirect("/admin/products");
  }

  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      priorityOfferId: products.priorityOfferId,
      priorityIsManual: products.priorityIsManual,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    redirect("/admin/products");
  }

  await db.transaction(async (tx) => {
    const [currentPriorityOffer] = product.priorityOfferId
      ? await tx
          .select({
            id: sellerOffers.id,
            sellerId: sellerOffers.sellerId,
          })
          .from(sellerOffers)
          .where(eq(sellerOffers.id, product.priorityOfferId))
          .limit(1)
      : [];

    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId,
        sellerId,
        priceWithVat,
        vatRate,
        status: status as "draft" | "on_moderation" | "published" | "rejected" | "hidden",
        isPriority: false,
        submittedAt: new Date(),
        moderatedAt: status === "published" || status === "rejected" ? new Date() : null,
        moderatedById: status === "published" || status === "rejected" ? admin.id : null,
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat,
          vatRate,
          status: status as "draft" | "on_moderation" | "published" | "rejected" | "hidden",
          moderatedAt: status === "published" || status === "rejected" ? new Date() : null,
          moderatedById: status === "published" || status === "rejected" ? admin.id : null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sellerOffers.id });

    if (isPriority) {
      await setManualProductPriorityOffer(tx, productId, offer.id);

      if (
        currentPriorityOffer &&
        currentPriorityOffer.id !== offer.id &&
        currentPriorityOffer.sellerId !== sellerId
      ) {
        await insertSellerNotifications(tx, {
          sellerId: currentPriorityOffer.sellerId,
          type: "product_offer_displaced",
          title: "Вашу цену перебили",
          body: `${product.name}: ваше предложение больше не активно на витрине. Обновите цену, если хотите вернуть товар в продажу.`,
        });
      }
    } else if (!product.priorityIsManual) {
      await recalculateAutomaticProductPriority(tx, productId);
    } else {
      await syncStoredProductPriorityOffer(tx, productId);
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product_offer.upsert",
      entityType: "seller_offer",
      entityId: offer.id,
      metadata: {
        productId,
        sellerId,
        status,
        isPriority,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");

  redirect(`/admin/products/${productId}?offerSaved=1`);
}

export async function setPriorityProductOfferAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");
  const offerId = getString(formData, "offerId");

  if (!productId || !offerId) {
    redirect("/admin/products");
  }

  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      priorityOfferId: products.priorityOfferId,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    redirect("/admin/products");
  }

  await db.transaction(async (tx) => {
    const [selectedOffer] = await tx
      .select({
        id: sellerOffers.id,
        sellerId: sellerOffers.sellerId,
      })
      .from(sellerOffers)
      .where(and(eq(sellerOffers.id, offerId), eq(sellerOffers.productId, productId)))
      .limit(1);

    if (!selectedOffer) {
      redirect(`/admin/products/${productId}?offerError=1`);
    }

    const [currentPriorityOffer] = product.priorityOfferId
      ? await tx
          .select({
            id: sellerOffers.id,
            sellerId: sellerOffers.sellerId,
          })
          .from(sellerOffers)
          .where(eq(sellerOffers.id, product.priorityOfferId))
          .limit(1)
      : [];

    await setManualProductPriorityOffer(tx, productId, offerId);

    if (
      currentPriorityOffer &&
      currentPriorityOffer.id !== selectedOffer.id &&
      currentPriorityOffer.sellerId !== selectedOffer.sellerId
    ) {
      await insertSellerNotifications(tx, {
        sellerId: currentPriorityOffer.sellerId,
        type: "product_offer_displaced",
        title: "Вашу цену перебили",
        body: `${product.name}: ваше предложение больше не активно на витрине. Обновите цену, если хотите вернуть товар в продажу.`,
      });
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product_offer.priority_set",
      entityType: "seller_offer",
      entityId: offerId,
      metadata: { productId },
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath(`/admin/products/${productId}`);

  redirect(`/admin/products/${productId}?offerSaved=1`);
}

export async function resetProductPriorityOfferAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const productId = getString(formData, "productId");

  if (!productId) {
    redirect("/admin/products");
  }

  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      priorityOfferId: products.priorityOfferId,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    redirect("/admin/products");
  }

  const selectedOffer = await db.transaction(async (tx) => {
    const offer = await recalculateAutomaticProductPriority(tx, productId);

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product_offer.priority_reset",
      entityType: "product",
      entityId: productId,
      metadata: {
        previousPriorityOfferId: product.priorityOfferId,
        selectedPriorityOfferId: offer?.id ?? null,
      },
    });

    return offer;
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath(`/admin/products/${productId}`);

  redirect(
    `/admin/products/${productId}?offerSaved=1${
      selectedOffer ? "" : "&offerWarning=no-published-offers"
    }`,
  );
}
