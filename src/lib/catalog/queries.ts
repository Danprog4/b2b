import { and, asc, desc, eq, gte, ilike, lte, ne, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  files,
  orderItems,
  productImages,
  products,
  sellers,
  subcategories,
} from "@/db/schema";
import { getPublicFileUrl } from "@/lib/files/urls";

export type CatalogSort = "price_asc" | "price_desc" | "new" | "popular";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  subcategoryName: string | null;
  subcategorySlug: string | null;
  priceWithVat: string;
  unit: string;
  size: string | null;
  isPopular: boolean;
  mainImageUrl: string | null;
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
  const rows = await db
    .select({ unit: products.unit })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.unit));

  return Array.from(new Set(rows.map((row) => row.unit)));
}

export async function getCatalogProducts({
  q,
  categorySlug,
  subcategorySlug,
  minPrice,
  maxPrice,
  unit,
  sort = "popular",
  limit = 60,
}: {
  q?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  unit?: string;
  sort?: CatalogSort;
  limit?: number;
} = {}): Promise<ProductListItem[]> {
  const filters = [eq(products.isActive, true)];
  const normalizedQuery = q?.trim();

  if (categorySlug) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, categorySlug), eq(categories.isActive, true)))
      .limit(1);

    if (!category) {
      return [];
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
      return [];
    }

    filters.push(eq(products.subcategoryId, subcategory.id));

    if (categorySlug) {
      filters.push(eq(products.categoryId, subcategory.categoryId));
    }
  }

  if (typeof minPrice === "number" && Number.isFinite(minPrice) && minPrice >= 0) {
    filters.push(gte(products.priceWithVat, minPrice.toFixed(2)));
  }

  if (typeof maxPrice === "number" && Number.isFinite(maxPrice) && maxPrice >= 0) {
    filters.push(lte(products.priceWithVat, maxPrice.toFixed(2)));
  }

  if (unit) {
    filters.push(eq(products.unit, unit));
  }

  if (normalizedQuery && normalizedQuery.length >= 2) {
    const pattern = `%${normalizedQuery}%`;
    const searchCondition = or(
      ilike(products.name, pattern),
      ilike(products.sku, pattern),
      ilike(products.description, pattern),
      ilike(categories.name, pattern),
      ilike(subcategories.name, pattern),
    );

    if (searchCondition) {
      filters.push(searchCondition);
    }
  }

  const productOrderStats = db
    .select({
      productId: orderItems.productId,
      orderItemCount: sql<number>`count(${orderItems.id})`.as("order_item_count"),
    })
    .from(orderItems)
    .groupBy(orderItems.productId)
    .as("product_order_stats");

  const orderBy =
    sort === "price_asc"
      ? [asc(products.priceWithVat)]
      : sort === "price_desc"
        ? [desc(products.priceWithVat)]
        : sort === "new"
          ? [desc(products.createdAt)]
          : [
              desc(sql`coalesce(${productOrderStats.orderItemCount}, 0)`),
              desc(products.isPopular),
              desc(products.createdAt),
            ];

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      priceWithVat: products.priceWithVat,
      unit: products.unit,
      size: products.size,
      isPopular: products.isPopular,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .leftJoin(productOrderStats, eq(productOrderStats.productId, products.id))
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(limit);

  return rows.map(withMainImageUrl);
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      description: products.description,
      priceWithVat: products.priceWithVat,
      vatRate: products.vatRate,
      size: products.size,
      unit: products.unit,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      subcategoryId: products.subcategoryId,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      sellerName: sellers.name,
      isActive: products.isActive,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(sellers, eq(products.sellerId, sellers.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(eq(products.slug, slug))
    .limit(1);

  return product ? withMainImageUrl(product) : null;
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

export async function getRecommendedProducts(
  productId: string,
  categoryId: string,
  subcategoryId?: string | null,
) {
  const selected: ProductListItem[] = [];

  if (subcategoryId) {
    selected.push(
      ...(await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          slug: products.slug,
          categoryName: categories.name,
          categorySlug: categories.slug,
          subcategoryName: subcategories.name,
          subcategorySlug: subcategories.slug,
          priceWithVat: products.priceWithVat,
          unit: products.unit,
          size: products.size,
          isPopular: products.isPopular,
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
            eq(products.isActive, true),
            eq(products.subcategoryId, subcategoryId),
            ne(products.id, productId),
          ),
        )
        .orderBy(desc(products.isPopular), desc(products.createdAt))
        .limit(4)
        .then((rows) => rows.map(withMainImageUrl))),
    );
  }

  if (selected.length >= 4) {
    return selected;
  }

  const excludedIds = [productId, ...selected.map((product) => product.id)];
  const fallbackFilters = [
    eq(products.isActive, true),
    eq(products.categoryId, categoryId),
  ];

  if (excludedIds.length === 1) {
    fallbackFilters.push(ne(products.id, productId));
  } else {
    fallbackFilters.push(notInArray(products.id, excludedIds));
  }

  selected.push(
    ...(await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      priceWithVat: products.priceWithVat,
      unit: products.unit,
      size: products.size,
      isPopular: products.isPopular,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(...fallbackFilters))
    .orderBy(desc(products.isPopular), desc(products.createdAt))
    .limit(4 - selected.length)
    .then((rows) => rows.map(withMainImageUrl))),
  );

  return selected;
}
