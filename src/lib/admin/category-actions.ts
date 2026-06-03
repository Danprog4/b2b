"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { auditEvents, categories, files, subcategories } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxCategoryImageSizeBytes = 10 * 1024 * 1024;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const parsed = Number(getString(formData, key));
  return Number.isFinite(parsed) ? parsed : 0;
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

function redirectWithImageError(entity: "category" | "subcategory", id: string | null, message: string) {
  const params = new URLSearchParams({ error: message });

  if (id) {
    const path =
      entity === "category"
        ? `/admin/categories/${id}`
        : `/admin/categories/subcategories/${id}`;
    redirect(`${path}?${params.toString()}`);
  }

  const path =
    entity === "category"
      ? "/admin/categories/new"
      : "/admin/categories/subcategories/new";
  redirect(`${path}?${params.toString()}`);
}

function validateImageFile(
  file: File,
  entity: "category" | "subcategory",
  id: string | null,
) {
  if (!allowedImageMimeTypes.has(file.type)) {
    redirectWithImageError(entity, id, "Поддерживаются только JPG, PNG и WEBP.");
  }

  if (file.size > maxCategoryImageSizeBytes) {
    redirectWithImageError(entity, id, "Изображение должно быть не больше 10 МБ.");
  }
}

function validateImageUpload(
  formData: FormData,
  entity: "category" | "subcategory",
  id: string | null,
) {
  const image = formData.get("image");

  if (isUploadedFile(image)) {
    validateImageFile(image, entity, id);
  }
}

async function persistImageFile({
  file,
  uploadedById,
  storagePrefix,
}: {
  file: File;
  uploadedById: string;
  storagePrefix: string;
}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name) || "image";
  const storageKey = `${storagePrefix}/${randomUUID()}-${fileName}`;
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

async function applyCategoryImageUpload(formData: FormData, categoryId: string, uploadedById: string) {
  const image = formData.get("image");

  if (!isUploadedFile(image)) {
    return;
  }

  const storedFile = await persistImageFile({
    file: image,
    uploadedById,
    storagePrefix: `categories/${categoryId}`,
  });

  await db
    .update(categories)
    .set({ imageFileId: storedFile.id, updatedAt: new Date() })
    .where(eq(categories.id, categoryId));
}

async function applySubcategoryImageUpload(
  formData: FormData,
  subcategoryId: string,
  uploadedById: string,
) {
  const image = formData.get("image");

  if (!isUploadedFile(image)) {
    return;
  }

  const storedFile = await persistImageFile({
    file: image,
    uploadedById,
    storagePrefix: `subcategories/${subcategoryId}`,
  });

  await db
    .update(subcategories)
    .set({ imageFileId: storedFile.id, updatedAt: new Date() })
    .where(eq(subcategories.id, subcategoryId));
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
  return (
    value
      .toLowerCase()
      .split("")
      .map((char) => translit[char] ?? char)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "category"
  );
}

async function getUniqueCategorySlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  let index = 2;

  while (true) {
    const filters = excludeId
      ? and(eq(categories.slug, slug), ne(categories.id, excludeId))
      : eq(categories.slug, slug);
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(filters)
      .limit(1);

    if (!existing) {
      return slug;
    }

    slug = `${base}-${index}`;
    index += 1;
  }
}

async function getUniqueSubcategorySlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  let index = 2;

  while (true) {
    const filters = excludeId
      ? and(eq(subcategories.slug, slug), ne(subcategories.id, excludeId))
      : eq(subcategories.slug, slug);
    const [existing] = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(filters)
      .limit(1);

    if (!existing) {
      return slug;
    }

    slug = `${base}-${index}`;
    index += 1;
  }
}

export async function createCategoryAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const sortOrder = getNumber(formData, "sortOrder");
  const isActive = formData.get("isActive") === "on";

  if (!name) {
    redirect("/admin/categories/new?error=required");
  }

  validateImageUpload(formData, "category", null);

  const slug = await getUniqueCategorySlug(name);
  const [category] = await db
    .insert(categories)
    .values({
      name,
      slug,
      description: description || null,
      sortOrder,
      isActive,
    })
    .returning({ id: categories.id });

  await applyCategoryImageUpload(formData, category.id, admin.id);

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "category.create",
    entityType: "category",
    entityId: category.id,
    metadata: { name, slug },
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");

  redirect(`/admin/categories/${category.id}?created=1`);
}

export async function updateCategoryAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const categoryId = getString(formData, "categoryId");
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const sortOrder = getNumber(formData, "sortOrder");
  const isActive = formData.get("isActive") === "on";

  if (!categoryId || !name) {
    redirect("/admin/categories");
  }

  validateImageUpload(formData, "category", categoryId);

  const slug = await getUniqueCategorySlug(name, categoryId);

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({
        name,
        slug,
        description: description || null,
        sortOrder,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "category.update",
      entityType: "category",
      entityId: categoryId,
      metadata: { name, slug, active: isActive },
    });
  });

  await applyCategoryImageUpload(formData, categoryId, admin.id);

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);

  redirect(`/admin/categories/${categoryId}?saved=1`);
}

export async function createSubcategoryAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const categoryId = getString(formData, "categoryId");
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const sortOrder = getNumber(formData, "sortOrder");
  const isActive = formData.get("isActive") === "on";

  if (!categoryId || !name) {
    redirect("/admin/categories/subcategories/new?error=required");
  }

  validateImageUpload(formData, "subcategory", null);

  const slug = await getUniqueSubcategorySlug(name);
  const [subcategory] = await db
    .insert(subcategories)
    .values({
      categoryId,
      name,
      slug,
      description: description || null,
      sortOrder,
      isActive,
    })
    .returning({ id: subcategories.id });

  await applySubcategoryImageUpload(formData, subcategory.id, admin.id);

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "subcategory.create",
    entityType: "subcategory",
    entityId: subcategory.id,
    metadata: { categoryId, name, slug },
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");

  redirect(`/admin/categories/subcategories/${subcategory.id}?created=1`);
}

export async function updateSubcategoryAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const subcategoryId = getString(formData, "subcategoryId");
  const categoryId = getString(formData, "categoryId");
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const sortOrder = getNumber(formData, "sortOrder");
  const isActive = formData.get("isActive") === "on";

  if (!subcategoryId || !categoryId || !name) {
    redirect("/admin/categories");
  }

  validateImageUpload(formData, "subcategory", subcategoryId);

  const slug = await getUniqueSubcategorySlug(name, subcategoryId);

  await db.transaction(async (tx) => {
    await tx
      .update(subcategories)
      .set({
        categoryId,
        name,
        slug,
        description: description || null,
        sortOrder,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(subcategories.id, subcategoryId));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "subcategory.update",
      entityType: "subcategory",
      entityId: subcategoryId,
      metadata: { categoryId, name, slug, active: isActive },
    });
  });

  await applySubcategoryImageUpload(formData, subcategoryId, admin.id);

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/subcategories/${subcategoryId}`);

  redirect(`/admin/categories/subcategories/${subcategoryId}?saved=1`);
}

export async function clearCategoryImageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const categoryId = getString(formData, "categoryId");

  if (!categoryId) {
    redirect("/admin/categories");
  }

  const [category] = await db
    .select({ imageFileId: categories.imageFileId })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    redirect("/admin/categories");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ imageFileId: null, updatedAt: new Date() })
      .where(eq(categories.id, categoryId));

    if (category.imageFileId) {
      await tx
        .update(files)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(files.id, category.imageFileId));
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "category.image_clear",
      entityType: "category",
      entityId: categoryId,
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  redirect(`/admin/categories/${categoryId}?saved=1`);
}

export async function clearSubcategoryImageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const subcategoryId = getString(formData, "subcategoryId");

  if (!subcategoryId) {
    redirect("/admin/categories");
  }

  const [subcategory] = await db
    .select({ imageFileId: subcategories.imageFileId })
    .from(subcategories)
    .where(eq(subcategories.id, subcategoryId))
    .limit(1);

  if (!subcategory) {
    redirect("/admin/categories");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(subcategories)
      .set({ imageFileId: null, updatedAt: new Date() })
      .where(eq(subcategories.id, subcategoryId));

    if (subcategory.imageFileId) {
      await tx
        .update(files)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(files.id, subcategory.imageFileId));
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "subcategory.image_clear",
      entityType: "subcategory",
      entityId: subcategoryId,
    });
  });

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/subcategories/${subcategoryId}`);
  redirect(`/admin/categories/subcategories/${subcategoryId}?saved=1`);
}
