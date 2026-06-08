"use server";

import { and, eq, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
  auditEvents,
  categories,
  files,
  importJobRows,
  importJobs,
  products,
  sellerOffers,
  sellers,
  subcategories,
  systemEvents,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";
import { getNextProductSku } from "@/lib/numbering/sequences";

const maxImportFileSizeBytes = 8 * 1024 * 1024;
const maxImportRows = 1000;
const allowedExtensions = new Set(["xlsx", "xls", "csv"]);
const importReadErrorParam = "read";
const requiredColumnGroups = [
  ["name", "название", "товар", "название товара"],
  ["category", "categoryName", "категория"],
  ["priceWithVat", "price", "цена", "цена с ндс"],
  ["unit", "единица", "единица измерения", "ед"],
] as const;
const sellerColumnGroup = [
  "seller",
  "sellerName",
  "продавец",
  "поставщик",
  "sellerInn",
  "инн продавца",
  "инн поставщика",
] as const;

type ImportPayload = {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  seller: string;
  sellerInn: string;
  priceWithVat: string;
  vatRate: string;
  size: string;
  unit: string;
  description: string;
};

type ResolvedImportRow = {
  rowNumber: number;
  payload: ImportPayload;
  errors: string[];
  categoryId?: string;
  subcategoryId?: string | null;
  sellerId?: string | null;
  existingProductId?: string;
  existingOfferId?: string;
};

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

function getFile(formData: FormData) {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getNumberString(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : "";
}

function getOptionalNumberString(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : "";
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function readField(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      return getStringValue(value);
    }
  }

  return "";
}

function hasColumn(row: Record<string, unknown>, aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  return Object.keys(row).some((key) => normalizedAliases.has(normalizeHeader(key)));
}

function getMissingRequiredColumns(rows: Record<string, unknown>[]) {
  const firstRow = rows[0];

  if (!firstRow) {
    return [];
  }

  const missing: string[] = requiredColumnGroups
    .filter((aliases) => !hasColumn(firstRow, aliases))
    .map((aliases) => aliases[0]);

  if (!hasColumn(firstRow, sellerColumnGroup)) {
    missing.push("seller или sellerInn");
  }

  return missing;
}

function getPayload(row: Record<string, unknown>): ImportPayload {
  return {
    sku: readField(row, ["sku", "артикул"]),
    name: readField(row, ["name", "название", "товар", "название товара"]),
    category: readField(row, ["category", "categoryName", "категория"]),
    subcategory: readField(row, [
      "subcategory",
      "subcategoryName",
      "подкатегория",
    ]),
    seller: readField(row, ["seller", "sellerName", "продавец", "поставщик"]),
    sellerInn: readField(row, [
      "sellerInn",
      "инн продавца",
      "инн поставщика",
    ]),
    priceWithVat: readField(row, [
      "priceWithVat",
      "price",
      "цена",
      "цена с ндс",
    ]),
    vatRate: readField(row, ["vatRate", "vat", "ндс", "ндс %"]),
    size: readField(row, ["size", "размер"]),
    unit: readField(row, ["unit", "единица", "единица измерения", "ед"]),
    description: readField(row, ["description", "описание"]),
  };
}

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

async function persistImportFile(file: File, uploadedById: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name) || "products-import.xlsx";
  const storageKey = `imports/products/${randomUUID()}-${fileName}`;
  const { sizeBytes } = await writeStorageFile(storageKey, bytes, {
    contentType:
      file.type ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const [storedFile] = await db
    .insert(files)
    .values({
      originalName: file.name,
      storageKey,
      mimeType:
        file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes,
      access: "private",
      uploadedById,
    })
    .returning({ id: files.id });

  return storedFile.id;
}

function readWorkbookRows(bytes: Uint8Array) {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(bytes, { type: "array" });
  } catch {
    return null;
  }

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

async function resolveRow(
  row: Record<string, unknown>,
  rowNumber: number,
  seenSkus: Map<string, number>,
): Promise<ResolvedImportRow> {
  const payload = getPayload(row);
  const errors: string[] = [];
  const priceWithVat = getNumberString(payload.priceWithVat);
  const vatRate = getOptionalNumberString(payload.vatRate, "22.00");
  const normalizedSku = payload.sku.toUpperCase();

  if (!payload.name) {
    errors.push("Не указано название товара.");
  }

  if (!payload.category) {
    errors.push("Не указана категория.");
  }

  if (!payload.unit) {
    errors.push("Не указана единица измерения.");
  }

  if (!priceWithVat) {
    errors.push("Цена с НДС должна быть больше 0.");
  }

  if (!payload.seller && !payload.sellerInn) {
    errors.push("Продавец обязателен для товара маркетплейса.");
  }

  if (!vatRate) {
    errors.push("НДС должен быть числом 0 или больше.");
  }

  const [category] = payload.category
    ? await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, payload.category))
        .limit(1)
    : [];

  if (payload.category && !category) {
    errors.push(`Категория "${payload.category}" не найдена.`);
  }

  const [subcategory] =
    payload.subcategory && category
      ? await db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(
            and(
              eq(subcategories.name, payload.subcategory),
              eq(subcategories.categoryId, category.id),
            ),
          )
          .limit(1)
      : [];

  if (payload.subcategory && category && !subcategory) {
    errors.push(
      `Подкатегория "${payload.subcategory}" не найдена в категории "${payload.category}".`,
    );
  }

  const sellerFilters = [];
  if (payload.sellerInn) {
    sellerFilters.push(eq(sellers.inn, payload.sellerInn));
  }

  if (payload.seller) {
    sellerFilters.push(eq(sellers.name, payload.seller));
  }

  const [seller] =
    sellerFilters.length > 0
      ? await db
          .select({ id: sellers.id })
          .from(sellers)
          .where(
            sellerFilters.length === 1
              ? sellerFilters[0]
              : or(...sellerFilters),
          )
          .limit(1)
      : [];

  if ((payload.seller || payload.sellerInn) && !seller) {
    errors.push("Продавец не найден по названию или ИНН.");
  }

  if (normalizedSku && seller) {
    const duplicateKey = `${normalizedSku}:${seller.id}`;
    const previousRowNumber = seenSkus.get(duplicateKey);

    if (previousRowNumber) {
      errors.push(
        `Артикул "${payload.sku}" для этого продавца уже указан в строке ${previousRowNumber}.`,
      );
    } else {
      seenSkus.set(duplicateKey, rowNumber);
    }
  }

  const [existingProduct] = normalizedSku
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, normalizedSku))
        .limit(1)
    : [];

  const [existingOffer] =
    existingProduct && seller
      ? await db
          .select({ id: sellerOffers.id })
          .from(sellerOffers)
          .where(
            and(
              eq(sellerOffers.productId, existingProduct.id),
              eq(sellerOffers.sellerId, seller.id),
            ),
          )
          .limit(1)
      : [];

  return {
    rowNumber,
    payload: {
      ...payload,
      sku: normalizedSku || payload.sku,
      priceWithVat,
      vatRate: vatRate || "22.00",
    },
    errors,
    categoryId: category?.id,
    subcategoryId: subcategory?.id ?? null,
    sellerId: seller?.id ?? null,
    existingProductId: existingProduct?.id,
    existingOfferId: existingOffer?.id,
  };
}

async function applyResolvedRow(row: ResolvedImportRow, adminId: string) {
  const slug = await getUniqueSlug(row.payload.name, row.existingProductId);
  const values = {
    name: row.payload.name,
    slug,
    categoryId: row.categoryId ?? "",
    subcategoryId: row.subcategoryId ?? null,
    sellerId: row.sellerId ?? null,
    description: row.payload.description || null,
    priceWithVat: row.payload.priceWithVat,
    vatRate: row.payload.vatRate,
    size: row.payload.size || null,
    unit: row.payload.unit,
    isActive: true,
    updatedAt: new Date(),
  };

  if (row.existingProductId) {
    const [offer] = await db
      .insert(sellerOffers)
      .values({
        productId: row.existingProductId,
        sellerId: row.sellerId ?? "",
        priceWithVat: row.payload.priceWithVat,
        vatRate: row.payload.vatRate,
        status: "published",
        submittedAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: adminId,
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat: row.payload.priceWithVat,
          vatRate: row.payload.vatRate,
          status: "published",
          moderatedAt: new Date(),
          moderatedById: adminId,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sellerOffers.id });

    const [product] = await db
      .select({ priorityOfferId: products.priorityOfferId })
      .from(products)
      .where(eq(products.id, row.existingProductId))
      .limit(1);

    if (!product?.priorityOfferId) {
      await db
        .update(products)
        .set({
          priorityOfferId: offer.id,
          updatedAt: new Date(),
        })
        .where(eq(products.id, row.existingProductId));
    }

    await db.insert(auditEvents).values({
      actorId: adminId,
      action: row.existingOfferId ? "offer.import_update" : "offer.import_create",
      entityType: "seller_offer",
      entityId: offer.id,
      metadata: {
        sku: row.payload.sku,
        rowNumber: row.rowNumber,
        productId: row.existingProductId,
        sellerId: row.sellerId,
      },
    });

    return {
      status: row.existingOfferId ? "updated" : "created",
      productId: row.existingProductId,
    };
  }

  const sku = row.payload.sku || (await getNextProductSku());
  const [product] = await db.transaction(async (tx) => {
    const [createdProduct] = await tx
      .insert(products)
      .values({
        ...values,
        sku,
      })
      .returning({ id: products.id });

    const [offer] = await tx
      .insert(sellerOffers)
      .values({
        productId: createdProduct.id,
        sellerId: row.sellerId ?? "",
        priceWithVat: row.payload.priceWithVat,
        vatRate: row.payload.vatRate,
        status: "published",
        isPriority: true,
        submittedAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: adminId,
      })
      .returning({ id: sellerOffers.id });

    await tx
      .update(products)
      .set({
        priorityOfferId: offer.id,
        updatedAt: new Date(),
      })
      .where(eq(products.id, createdProduct.id));

    return [createdProduct];
  });

  await db.insert(auditEvents).values({
    actorId: adminId,
    action: "product.import_create",
    entityType: "product",
    entityId: product.id,
    metadata: {
      sku,
      rowNumber: row.rowNumber,
    },
  });

  return { status: "created", productId: product.id };
}

export async function importProductsAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const file = getFile(formData);

  if (!file) {
    redirect("/admin/products/import?error=file");
  }

  const extension = getExtension(file.name);
  if (!allowedExtensions.has(extension)) {
    redirect("/admin/products/import?error=type");
  }

  if (file.size > maxImportFileSizeBytes) {
    redirect("/admin/products/import?error=size");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rows = readWorkbookRows(bytes);

  if (!rows) {
    redirect(`/admin/products/import?error=${importReadErrorParam}`);
  }

  if (rows.length === 0) {
    redirect("/admin/products/import?error=empty");
  }

  if (rows.length > maxImportRows) {
    redirect("/admin/products/import?error=rows");
  }

  const missingColumns = getMissingRequiredColumns(rows);

  if (missingColumns.length > 0) {
    redirect("/admin/products/import?error=columns");
  }

  const fileId = await persistImportFile(file, admin.id);
  const [job] = await db
    .insert(importJobs)
    .values({
      fileId,
      status: "uploaded",
      totalRows: rows.length,
      createdById: admin.id,
    })
    .returning({ id: importJobs.id });

  let createdRows = 0;
  let updatedRows = 0;
  let errorRows = 0;
  const seenSkus = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    const resolvedRow = await resolveRow(row, index + 2, seenSkus);

    if (resolvedRow.errors.length > 0) {
      errorRows += 1;
      await db.insert(importJobRows).values({
        importJobId: job.id,
        rowNumber: resolvedRow.rowNumber,
        status: "error",
        payload: resolvedRow.payload,
        errors: resolvedRow.errors,
      });
      continue;
    }

    const previewStatus = resolvedRow.existingOfferId
      ? "ready_update"
      : "ready_create";
    if (previewStatus === "ready_create") {
      createdRows += 1;
    } else {
      updatedRows += 1;
    }

    await db.insert(importJobRows).values({
      importJobId: job.id,
      rowNumber: resolvedRow.rowNumber,
      status: previewStatus,
      payload: {
        ...resolvedRow.payload,
        categoryId: resolvedRow.categoryId,
        subcategoryId: resolvedRow.subcategoryId,
        sellerId: resolvedRow.sellerId,
        existingProductId: resolvedRow.existingProductId,
        existingOfferId: resolvedRow.existingOfferId,
      },
      errors: [],
    });
  }

  await db
    .update(importJobs)
    .set({
      status: errorRows === rows.length ? "failed" : "validated",
      createdRows,
      updatedRows,
      errorRows,
      updatedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "product.import_validate",
    entityType: "import_job",
    entityId: job.id,
    metadata: {
      totalRows: rows.length,
      createdRows,
      updatedRows,
      errorRows,
    },
  });

  if (errorRows > 0) {
    await db.insert(systemEvents).values({
      type: "product_import",
      severity: errorRows === rows.length ? "error" : "warn",
      message: `Проверка импорта товаров завершена с ошибками: ${errorRows} из ${rows.length}.`,
      metadata: {
        importJobId: job.id,
        createdRows,
        updatedRows,
        errorRows,
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products/import");

  redirect(`/admin/products/import?job=${job.id}`);
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getResolvedRowFromPreview(row: {
  rowNumber: number;
  payload: Record<string, unknown>;
  errors: string[] | null;
}): ResolvedImportRow {
  return {
    rowNumber: row.rowNumber,
    payload: {
      sku: getPayloadString(row.payload, "sku"),
      name: getPayloadString(row.payload, "name"),
      category: getPayloadString(row.payload, "category"),
      subcategory: getPayloadString(row.payload, "subcategory"),
      seller: getPayloadString(row.payload, "seller"),
      sellerInn: getPayloadString(row.payload, "sellerInn"),
      priceWithVat: getPayloadString(row.payload, "priceWithVat"),
      vatRate: getPayloadString(row.payload, "vatRate"),
      size: getPayloadString(row.payload, "size"),
      unit: getPayloadString(row.payload, "unit"),
      description: getPayloadString(row.payload, "description"),
    },
    errors: row.errors ?? [],
    categoryId: getPayloadString(row.payload, "categoryId"),
    subcategoryId: getPayloadString(row.payload, "subcategoryId") || null,
    sellerId: getPayloadString(row.payload, "sellerId"),
    existingProductId: getPayloadString(row.payload, "existingProductId") || undefined,
    existingOfferId: getPayloadString(row.payload, "existingOfferId") || undefined,
  };
}

export async function confirmProductImportAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const jobId = getFormString(formData, "jobId");

  if (!jobId) {
    redirect("/admin/products/import");
  }

  const importedJobId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${jobId}))`);

    const [job] = await tx
      .select({
        id: importJobs.id,
        status: importJobs.status,
      })
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);

    if (!job || job.status !== "validated") {
      return null;
    }

    const rows = await tx
      .select({
        id: importJobRows.id,
        rowNumber: importJobRows.rowNumber,
        status: importJobRows.status,
        payload: importJobRows.payload,
        errors: importJobRows.errors,
      })
      .from(importJobRows)
      .where(eq(importJobRows.importJobId, job.id));
    let createdRows = 0;
    let updatedRows = 0;
    const errorRows = rows.filter((row) => row.status === "error").length;

    for (const row of rows) {
      if (row.status !== "ready_create" && row.status !== "ready_update") {
        continue;
      }

      const resolvedRow = getResolvedRowFromPreview(row);
      const result = await applyResolvedRow(resolvedRow, admin.id);

      if (result.status === "created") {
        createdRows += 1;
      } else {
        updatedRows += 1;
      }

      await tx
        .update(importJobRows)
        .set({
          status: result.status,
          payload: {
            ...row.payload,
            productId: result.productId,
          },
        })
        .where(eq(importJobRows.id, row.id));
    }

    await tx
      .update(importJobs)
      .set({
        status: "imported",
        createdRows,
        updatedRows,
        errorRows,
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "product.import",
      entityType: "import_job",
      entityId: job.id,
      metadata: {
        createdRows,
        updatedRows,
        errorRows,
      },
    });

    return job.id;
  });

  if (!importedJobId) {
    redirect("/admin/products/import");
  }

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");

  redirect(`/admin/products/import?job=${importedJobId}&imported=1`);
}
