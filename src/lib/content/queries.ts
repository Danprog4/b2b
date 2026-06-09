import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { banners, contentPages, files } from "@/db/schema";
import { getPublicFileUrl } from "@/lib/files/urls";

export async function getActiveHomeBanners() {
  const now = new Date();
  const desktopFiles = alias(files, "desktop_banner_files");
  const mobileFiles = alias(files, "mobile_banner_files");
  const rows = await db
    .select({
      id: banners.id,
      title: banners.title,
      mobileTitle: banners.mobileTitle,
      headline: banners.headline,
      mobileHeadline: banners.mobileHeadline,
      subheadline: banners.subheadline,
      mobileSubheadline: banners.mobileSubheadline,
      ctaText: banners.ctaText,
      mobileCtaText: banners.mobileCtaText,
      href: banners.href,
      sortOrder: banners.sortOrder,
      desktopImageFileId: desktopFiles.id,
      desktopImageStorageKey: desktopFiles.storageKey,
      desktopImageIsActive: desktopFiles.isActive,
      mobileImageFileId: mobileFiles.id,
      mobileImageStorageKey: mobileFiles.storageKey,
      mobileImageIsActive: mobileFiles.isActive,
    })
    .from(banners)
    .leftJoin(desktopFiles, eq(desktopFiles.id, banners.desktopImageFileId))
    .leftJoin(mobileFiles, eq(mobileFiles.id, banners.mobileImageFileId))
    .where(
      and(
        eq(banners.isActive, true),
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gte(banners.endsAt, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder), asc(banners.createdAt))
    .limit(4);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mobileTitle: row.mobileTitle,
    headline: row.headline,
    mobileHeadline: row.mobileHeadline,
    subheadline: row.subheadline,
    mobileSubheadline: row.mobileSubheadline,
    ctaText: row.ctaText,
    mobileCtaText: row.mobileCtaText,
    href: row.href,
    imageUrl: row.desktopImageIsActive
      ? getPublicFileUrl({
          id: row.desktopImageFileId,
          storageKey: row.desktopImageStorageKey,
        })
      : null,
    mobileImageUrl: row.mobileImageIsActive
      ? getPublicFileUrl({
          id: row.mobileImageFileId,
          storageKey: row.mobileImageStorageKey,
        })
      : null,
  }));
}

export async function getPublishedContentPage(slug: string) {
  const [page] = await db
    .select()
    .from(contentPages)
    .where(and(eq(contentPages.slug, slug), eq(contentPages.isPublished, true)))
    .limit(1);

  return page ?? null;
}
