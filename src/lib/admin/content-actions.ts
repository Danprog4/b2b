"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { auditEvents, banners, contentPages, files } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { writeStorageFile } from "@/lib/files/storage";

const allowedBannerMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxBannerImageSizeBytes = 10 * 1024 * 1024;
const maxBannerSlides = 4;
const bannerTextLimits = {
  title: 72,
  headline: 96,
  subheadline: 160,
  ctaText: 32,
  mobileTitle: 56,
  mobileHeadline: 72,
  mobileSubheadline: 120,
  mobileCtaText: 28,
  href: 320,
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

function redirectWithBannerError(bannerId: string | null, message: string) {
  const params = new URLSearchParams({ error: message });
  redirect(
    bannerId
      ? `/admin/banners/${bannerId}?${params.toString()}`
      : `/admin/banners/new?${params.toString()}`,
  );
}

function validateBannerImage(file: File, bannerId: string | null) {
  if (!allowedBannerMimeTypes.has(file.type)) {
    redirectWithBannerError(bannerId, "Поддерживаются только JPG, PNG и WEBP.");
  }

  if (file.size > maxBannerImageSizeBytes) {
    redirectWithBannerError(bannerId, "Изображение должно быть не больше 10 МБ.");
  }
}

async function persistBannerImageFile({
  file,
  bannerId,
  uploadedById,
  variant,
}: {
  file: File;
  bannerId: string;
  uploadedById: string;
  variant: "desktop" | "mobile";
}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = normalizeFileName(file.name) || "banner-image";
  const storageKey = `banners/${bannerId}/${variant}/${randomUUID()}-${fileName}`;
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

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertTextLength({
  bannerId,
  label,
  limit,
  value,
}: {
  bannerId: string | null;
  label: string;
  limit: number;
  value: string;
}) {
  if (value.length > limit) {
    redirectWithBannerError(
      bannerId,
      `${label}: максимум ${limit} символов.`,
    );
  }
}

function getBannerValues(formData: FormData, bannerId: string | null) {
  const title = getString(formData, "title");
  const mobileTitle = getString(formData, "mobileTitle");
  const headline = getString(formData, "headline");
  const mobileHeadline = getString(formData, "mobileHeadline");
  const subheadline = getString(formData, "subheadline");
  const mobileSubheadline = getString(formData, "mobileSubheadline");
  const ctaText = getString(formData, "ctaText");
  const mobileCtaText = getString(formData, "mobileCtaText");
  const href = getString(formData, "href");
  const sortOrder = Number(getString(formData, "sortOrder") || "0");

  if (!title) {
    redirect("/admin/banners/new?error=required");
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > maxBannerSlides) {
    redirectWithBannerError(
      bannerId,
      `Порядок баннера должен быть от 1 до ${maxBannerSlides}.`,
    );
  }

  assertTextLength({
    bannerId,
    label: "Название",
    limit: bannerTextLimits.title,
    value: title,
  });
  assertTextLength({
    bannerId,
    label: "Mobile-название",
    limit: bannerTextLimits.mobileTitle,
    value: mobileTitle,
  });
  assertTextLength({
    bannerId,
    label: "Дополнительный заголовок",
    limit: bannerTextLimits.headline,
    value: headline,
  });
  assertTextLength({
    bannerId,
    label: "Mobile-дополнительный заголовок",
    limit: bannerTextLimits.mobileHeadline,
    value: mobileHeadline,
  });
  assertTextLength({
    bannerId,
    label: "Подзаголовок",
    limit: bannerTextLimits.subheadline,
    value: subheadline,
  });
  assertTextLength({
    bannerId,
    label: "Mobile-подзаголовок",
    limit: bannerTextLimits.mobileSubheadline,
    value: mobileSubheadline,
  });
  assertTextLength({
    bannerId,
    label: "CTA",
    limit: bannerTextLimits.ctaText,
    value: ctaText,
  });
  assertTextLength({
    bannerId,
    label: "Mobile-CTA",
    limit: bannerTextLimits.mobileCtaText,
    value: mobileCtaText,
  });
  assertTextLength({
    bannerId,
    label: "Ссылка",
    limit: bannerTextLimits.href,
    value: href,
  });

  return {
    title,
    mobileTitle: mobileTitle || null,
    headline: headline || null,
    mobileHeadline: mobileHeadline || null,
    subheadline: subheadline || null,
    mobileSubheadline: mobileSubheadline || null,
    ctaText: ctaText || null,
    mobileCtaText: mobileCtaText || null,
    href: href || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive: formData.get("isActive") === "on",
    startsAt: parseOptionalDate(getString(formData, "startsAt")),
    endsAt: parseOptionalDate(getString(formData, "endsAt")),
  };
}

async function assertBannerSortOrderAvailable(sortOrder: number, bannerId: string | null) {
  const filters = bannerId
    ? and(eq(banners.sortOrder, sortOrder), ne(banners.id, bannerId))
    : eq(banners.sortOrder, sortOrder);
  const [existingBanner] = await db
    .select({ id: banners.id, title: banners.title })
    .from(banners)
    .where(filters)
    .limit(1);

  if (existingBanner) {
    redirectWithBannerError(
      bannerId,
      `Порядок ${sortOrder} уже занят баннером «${existingBanner.title}».`,
    );
  }
}

async function applyBannerImages({
  formData,
  bannerId,
  uploadedById,
}: {
  formData: FormData;
  bannerId: string;
  uploadedById: string;
}) {
  const desktopImage = formData.get("desktopImage");
  const mobileImage = formData.get("mobileImage");
  const updates: Partial<{
    desktopImageFileId: string;
    mobileImageFileId: string;
    updatedAt: Date;
  }> = {};

  if (isUploadedFile(desktopImage)) {
    validateBannerImage(desktopImage, bannerId);
    const storedFile = await persistBannerImageFile({
      file: desktopImage,
      bannerId,
      uploadedById,
      variant: "desktop",
    });
    updates.desktopImageFileId = storedFile.id;
  }

  if (isUploadedFile(mobileImage)) {
    validateBannerImage(mobileImage, bannerId);
    const storedFile = await persistBannerImageFile({
      file: mobileImage,
      bannerId,
      uploadedById,
      variant: "mobile",
    });
    updates.mobileImageFileId = storedFile.id;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(banners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(banners.id, bannerId));
  }
}

export async function createBannerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const desktopImage = formData.get("desktopImage");
  const mobileImage = formData.get("mobileImage");

  if (!isUploadedFile(desktopImage)) {
    redirectWithBannerError(null, "Загрузите изображение баннера.");
  }

  if (isUploadedFile(desktopImage)) {
    validateBannerImage(desktopImage, null);
  }

  if (isUploadedFile(mobileImage)) {
    validateBannerImage(mobileImage, null);
  }

  const values = getBannerValues(formData, null);
  await assertBannerSortOrderAvailable(values.sortOrder, null);
  const [banner] = await db.insert(banners).values(values).returning({ id: banners.id });

  await applyBannerImages({ formData, bannerId: banner.id, uploadedById: admin.id });

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "banner.create",
    entityType: "banner",
    entityId: banner.id,
    metadata: { title: values.title },
  });

  revalidatePath("/");
  revalidatePath("/admin/banners");

  redirect(`/admin/banners/${banner.id}?created=1`);
}

export async function updateBannerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const bannerId = getString(formData, "bannerId");

  if (!bannerId) {
    redirect("/admin/banners");
  }

  const values = getBannerValues(formData, bannerId);
  await assertBannerSortOrderAvailable(values.sortOrder, bannerId);
  await db
    .update(banners)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(banners.id, bannerId));

  await applyBannerImages({ formData, bannerId, uploadedById: admin.id });

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "banner.update",
    entityType: "banner",
    entityId: bannerId,
    metadata: { title: values.title, active: values.isActive },
  });

  revalidatePath("/");
  revalidatePath("/admin/banners");
  revalidatePath(`/admin/banners/${bannerId}`);

  redirect(`/admin/banners/${bannerId}?saved=1`);
}

export async function clearBannerImageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const bannerId = getString(formData, "bannerId");
  const imageType = getString(formData, "imageType");

  if (!bannerId) {
    redirect("/admin/banners");
  }

  const [banner] = await db
    .select({
      desktopImageFileId: banners.desktopImageFileId,
      mobileImageFileId: banners.mobileImageFileId,
    })
    .from(banners)
    .where(eq(banners.id, bannerId))
    .limit(1);

  if (!banner) {
    redirect("/admin/banners");
  }

  const fileId =
    imageType === "mobile" ? banner.mobileImageFileId : banner.desktopImageFileId;

  await db.transaction(async (tx) => {
    await tx
      .update(banners)
      .set(
        imageType === "mobile"
          ? { mobileImageFileId: null, updatedAt: new Date() }
          : { desktopImageFileId: null, updatedAt: new Date() },
      )
      .where(eq(banners.id, bannerId));

    if (fileId) {
      await tx
        .update(files)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(files.id, fileId));
    }

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "banner.image_clear",
      entityType: "banner",
      entityId: bannerId,
      metadata: { imageType },
    });
  });

  revalidatePath("/");
  revalidatePath(`/admin/banners/${bannerId}`);

  redirect(`/admin/banners/${bannerId}?saved=1`);
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

  return slug || "page";
}

async function getUniquePageSlug(slugSource: string, excludePageId?: string) {
  const base = slugify(slugSource);
  let slug = base;
  let index = 2;

  while (true) {
    const filters = excludePageId
      ? and(eq(contentPages.slug, slug), ne(contentPages.id, excludePageId))
      : eq(contentPages.slug, slug);
    const [existing] = await db
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(filters)
      .limit(1);

    if (!existing) {
      return slug;
    }

    slug = `${base}-${index}`;
    index += 1;
  }
}

function getContentPageValues(formData: FormData) {
  const title = getString(formData, "title");
  const slugSource = getString(formData, "slug") || title;

  if (!title) {
    redirect("/admin/pages/new?error=required");
  }

  return {
    title,
    slugSource,
    content: getString(formData, "content") || null,
    metaTitle: getString(formData, "metaTitle") || null,
    metaDescription: getString(formData, "metaDescription") || null,
    isPublished: formData.get("isPublished") === "on",
  };
}

export async function createContentPageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const values = getContentPageValues(formData);
  const slug = await getUniquePageSlug(values.slugSource);

  const [page] = await db
    .insert(contentPages)
    .values({
      title: values.title,
      slug,
      content: values.content,
      metaTitle: values.metaTitle,
      metaDescription: values.metaDescription,
      isPublished: values.isPublished,
    })
    .returning({ id: contentPages.id });

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "content_page.create",
    entityType: "content_page",
    entityId: page.id,
    metadata: { slug, title: values.title },
  });

  revalidatePath("/");
  revalidatePath(`/info/${slug}`);
  revalidatePath("/admin/pages");

  redirect(`/admin/pages/${page.id}?created=1`);
}

export async function updateContentPageAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const pageId = getString(formData, "pageId");

  if (!pageId) {
    redirect("/admin/pages");
  }

  const values = getContentPageValues(formData);
  const slug = await getUniquePageSlug(values.slugSource, pageId);

  await db
    .update(contentPages)
    .set({
      title: values.title,
      slug,
      content: values.content,
      metaTitle: values.metaTitle,
      metaDescription: values.metaDescription,
      isPublished: values.isPublished,
      updatedAt: new Date(),
    })
    .where(eq(contentPages.id, pageId));

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "content_page.update",
    entityType: "content_page",
    entityId: pageId,
    metadata: { slug, title: values.title, published: values.isPublished },
  });

  revalidatePath("/");
  revalidatePath(`/info/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);

  redirect(`/admin/pages/${pageId}?saved=1`);
}
