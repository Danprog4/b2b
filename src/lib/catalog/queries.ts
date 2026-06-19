import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  files,
  productImages,
  products,
  sellerOffers,
  subcategories,
} from "@/db/schema";
import { getPublicFileUrl } from "@/lib/files/urls";

export type CatalogSort = "price_asc" | "price_desc" | "new";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  subcategorySlug: string | null;
  sellerOfferId: string;
  priceWithVat: string;
  vatRate: string;
  unit: string;
  size: string | null;
  isActive: boolean;
  createdAt: Date;
  mainImageUrl: string | null;
};

export type CatalogProductsResult = {
  items: ProductListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProductDetailsItem = Omit<
  ProductListItem,
  "sellerOfferId" | "priceWithVat" | "vatRate"
> & {
  sellerOfferId: string | null;
  priceWithVat: string | null;
  vatRate: string | null;
  unavailable: boolean;
};

function withMainImageUrl<
  T extends {
    mainImageFileId: string | null;
    mainImageStorageKey: string | null;
    mainImageIsActive: boolean | null;
  },
>(row: T) {
  const { mainImageFileId, mainImageStorageKey, mainImageIsActive, ...product } = row;

  return {
    ...product,
    mainImageUrl: mainImageIsActive
      ? getPublicFileUrl({
          id: mainImageFileId,
          storageKey: mainImageStorageKey,
        })
      : null,
  };
}

export async function getActiveCategories() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageFileId: files.id,
      imageStorageKey: files.storageKey,
      imageIsActive: files.isActive,
    })
    .from(categories)
    .leftJoin(files, eq(files.id, categories.imageFileId))
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return rows.map(({ imageFileId, imageStorageKey, imageIsActive, ...category }) => ({
    ...category,
    imageUrl: imageIsActive
      ? getPublicFileUrl({
          id: imageFileId,
          storageKey: imageStorageKey,
        })
      : null,
  }));
}

export async function getActiveSubcategories(categorySlug?: string) {
  const filters = [eq(subcategories.isActive, true), eq(categories.isActive, true)];

  if (categorySlug) {
    filters.push(eq(categories.slug, categorySlug));
  }

  const rows = await db
    .select({
      id: subcategories.id,
      name: subcategories.name,
      slug: subcategories.slug,
      categoryId: subcategories.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      imageFileId: files.id,
      imageStorageKey: files.storageKey,
      imageIsActive: files.isActive,
    })
    .from(subcategories)
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .leftJoin(files, eq(files.id, subcategories.imageFileId))
    .where(and(...filters))
    .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name));

  return rows.map(({ imageFileId, imageStorageKey, imageIsActive, ...subcategory }) => ({
    ...subcategory,
    imageUrl: imageIsActive
      ? getPublicFileUrl({
          id: imageFileId,
          storageKey: imageStorageKey,
        })
      : null,
  }));
}

export async function getActiveProductUnits() {
  return [];
}

type ProductOfferRow = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  subcategorySlug: string | null;
  priorityOfferId: string | null;
  sellerOfferId: string;
  offerPriceWithVat: string;
  offerVatRate: string;
  offerPublishedAt: Date | null;
  offerCreatedAt: Date;
  unit: string;
  size: string | null;
  isActive: boolean;
  createdAt: Date;
  mainImageFileId: string | null;
  mainImageStorageKey: string | null;
  mainImageIsActive: boolean | null;
};

function getOfferPublishedTime(row: Pick<ProductOfferRow, "offerCreatedAt" | "offerPublishedAt">) {
  return (row.offerPublishedAt ?? row.offerCreatedAt).getTime();
}

function isBetterStorefrontOffer(candidate: ProductOfferRow, current: ProductOfferRow) {
  const priceDelta =
    Number(candidate.offerPriceWithVat) - Number(current.offerPriceWithVat);

  if (priceDelta !== 0) {
    return priceDelta < 0;
  }

  return getOfferPublishedTime(candidate) < getOfferPublishedTime(current);
}

function toProductListItems(rows: ProductOfferRow[]) {
  const byProduct = new Map<string, ProductOfferRow[]>();

  for (const row of rows) {
    byProduct.set(row.id, [...(byProduct.get(row.id) ?? []), row]);
  }

  return Array.from(byProduct.values()).map((offerRows) => {
    const priorityOffer = offerRows.find(
      (row) => row.sellerOfferId === row.priorityOfferId,
    );
    const selectedOffer =
      priorityOffer ??
      offerRows.reduce((best, row) =>
        isBetterStorefrontOffer(row, best) ? row : best,
      );

    return withMainImageUrl({
      ...selectedOffer,
      sellerOfferId: selectedOffer.sellerOfferId,
      priceWithVat: selectedOffer.offerPriceWithVat,
      vatRate: selectedOffer.offerVatRate,
    });
  });
}

export async function getCatalogProducts({
  q,
  categorySlug,
  subcategorySlug,
  minPrice,
  maxPrice,
  sort = "new",
  page = 1,
  pageSize = 24,
  limit,
}: {
  q?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
  limit?: number;
} = {}): Promise<CatalogProductsResult> {
  const filters = [eq(products.isActive, true), eq(categories.isActive, true)];
  const normalizedQuery = q?.trim().toLocaleLowerCase("ru-RU") ?? "";
  const normalizedPageSize = Math.max(1, Math.min(limit ?? pageSize, 100));

  if (categorySlug) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, categorySlug), eq(categories.isActive, true)))
      .limit(1);

    if (!category) {
      return {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: normalizedPageSize,
        totalPages: 1,
      };
    }

    filters.push(eq(products.categoryId, category.id));
  }

  if (subcategorySlug) {
    const [subcategory] = await db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(
        and(
          eq(subcategories.slug, subcategorySlug),
          eq(subcategories.isActive, true),
          eq(categories.isActive, true),
        ),
      )
      .limit(1);

    if (!subcategory) {
      return {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: normalizedPageSize,
        totalPages: 1,
      };
    }

    filters.push(eq(products.subcategoryId, subcategory.id));

    if (categorySlug) {
      filters.push(eq(products.categoryId, subcategory.categoryId));
    }
  }

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      description: products.description,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      subcategoryId: products.subcategoryId,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      priorityOfferId: products.priorityOfferId,
      sellerOfferId: sellerOffers.id,
      offerPriceWithVat: sellerOffers.priceWithVat,
      offerVatRate: sellerOffers.vatRate,
      offerPublishedAt: sellerOffers.moderatedAt,
      offerCreatedAt: sellerOffers.createdAt,
      unit: products.unit,
      size: products.size,
      isActive: products.isActive,
      createdAt: products.createdAt,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(sellerOffers, eq(sellerOffers.productId, products.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(...filters, eq(sellerOffers.status, "published")))
    .orderBy(desc(products.createdAt), asc(products.name));

  const items = toProductListItems(rows).filter((item) => {
    if (
      normalizedQuery.length >= 2 &&
      !item.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery)
    ) {
      return false;
    }

    const price = Number(item.priceWithVat);

    if (typeof minPrice === "number" && Number.isFinite(minPrice) && price < minPrice) {
      return false;
    }

    if (typeof maxPrice === "number" && Number.isFinite(maxPrice) && price > maxPrice) {
      return false;
    }

    return true;
  });

  items.sort((a, b) => {
    if (sort === "price_asc") {
      return Number(a.priceWithVat) - Number(b.priceWithVat);
    }

    if (sort === "price_desc") {
      return Number(b.priceWithVat) - Number(a.priceWithVat);
    }

    const createdAtDelta = b.createdAt.getTime() - a.createdAt.getTime();
    return createdAtDelta || a.name.localeCompare(b.name, "ru");
  });

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const normalizedPage =
    Number.isInteger(page) && page >= 1 && page <= totalPages ? page : 1;
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: items.slice(start, start + normalizedPageSize),
    totalCount,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages,
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailsItem | null> {
  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      description: products.description,
      categoryId: products.categoryId,
      priceWithVat: products.priceWithVat,
      vatRate: products.vatRate,
      size: products.size,
      unit: products.unit,
      categoryName: categories.name,
      categorySlug: categories.slug,
      subcategoryId: products.subcategoryId,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      priorityOfferId: products.priorityOfferId,
      isActive: products.isActive,
      createdAt: products.createdAt,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(
      and(
        eq(products.slug, slug),
        eq(products.isActive, true),
        eq(categories.isActive, true),
      ),
    )
    .limit(1);

  if (!product) {
    return null;
  }

  const offerRows = await db
    .select({
      sellerOfferId: sellerOffers.id,
      offerPriceWithVat: sellerOffers.priceWithVat,
      offerVatRate: sellerOffers.vatRate,
      offerPublishedAt: sellerOffers.moderatedAt,
      offerCreatedAt: sellerOffers.createdAt,
    })
    .from(sellerOffers)
    .where(
      and(eq(sellerOffers.productId, product.id), eq(sellerOffers.status, "published")),
    );

  if (offerRows.length === 0) {
    return {
      ...withMainImageUrl(product),
      sellerOfferId: null,
      priceWithVat: null,
      vatRate: null,
      unavailable: true,
    };
  }

  const [item] = toProductListItems(
    offerRows.map((offer) => ({
      ...product,
      ...offer,
    })),
  );

  return item ? { ...item, unavailable: false } : null;
}

export async function getProductGalleryImages(productId: string) {
  const rows = await db
    .select({
      id: productImages.id,
      fileId: files.id,
      fileName: files.originalName,
      storageKey: files.storageKey,
    })
    .from(productImages)
    .innerJoin(files, eq(files.id, productImages.fileId))
    .where(and(eq(productImages.productId, productId), eq(files.isActive, true)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    url: getPublicFileUrl({
      id: row.fileId,
      storageKey: row.storageKey,
    }),
  }));
}
