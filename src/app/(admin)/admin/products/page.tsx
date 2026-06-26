import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { Clock3, FileSpreadsheet, Package, Plus, Search, X } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import {
  categories,
  files,
  products,
  sellerOffers,
  sellers,
  subcategories,
} from "@/db/schema";
import { withAdminBreadcrumbSource } from "@/lib/admin/breadcrumbs";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { isSellerDeletedOffer } from "@/lib/products/offer-status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const activityOptions = ["active", "inactive"] as const;
const offerStatusOptions = [
  "draft",
  "on_moderation",
  "published",
  "rejected",
  "hidden",
  "none",
] as const;

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getOfferStatusLabel(status: string) {
  if (status === "draft") {
    return "Черновик";
  }

  if (status === "on_moderation") {
    return "На модерации";
  }

  if (status === "published") {
    return "Опубликовано";
  }

  if (status === "rejected") {
    return "Отклонено";
  }

  if (status === "hidden") {
    return "Скрыто";
  }

  if (status === "none") {
    return "Без предложений";
  }

  return status;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const q = getParam(search, "q");
  const sellerId = getParam(search, "sellerId");
  const categoryId = getParam(search, "categoryId");
  const subcategoryId = getParam(search, "subcategoryId");
  const activity = getParam(search, "activity");
  const offerStatus = getParam(search, "offerStatus");
  const whereConditions = [];

  if (q) {
    whereConditions.push(
      or(
        ilike(products.name, `%${q}%`),
        ilike(products.sku, `%${q}%`),
        ilike(products.slug, `%${q}%`),
        ilike(categories.name, `%${q}%`),
        ilike(subcategories.name, `%${q}%`),
        ilike(sellers.name, `%${q}%`),
        ilike(sellers.inn, `%${q}%`),
      ),
    );
  }

  if (isUuid(sellerId)) {
    whereConditions.push(eq(sellerOffers.sellerId, sellerId));
  }

  if (isUuid(categoryId)) {
    whereConditions.push(eq(products.categoryId, categoryId));
  }

  if (isUuid(subcategoryId)) {
    whereConditions.push(eq(products.subcategoryId, subcategoryId));
  }

  if (activityOptions.includes(activity as (typeof activityOptions)[number])) {
    whereConditions.push(eq(products.isActive, activity === "active"));
  }

  if (offerStatusOptions.includes(offerStatus as (typeof offerStatusOptions)[number])) {
    whereConditions.push(
      offerStatus === "none"
        ? isNull(sellerOffers.id)
        : eq(
            sellerOffers.status,
            offerStatus as Exclude<(typeof offerStatusOptions)[number], "none">,
          ),
    );
  }

  const productsQuery = db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      unit: products.unit,
      isActive: products.isActive,
      priorityOfferId: products.priorityOfferId,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      offerId: sellerOffers.id,
      offerPriceWithVat: sellerOffers.priceWithVat,
      offerStatus: sellerOffers.status,
      offerModerationComment: sellerOffers.moderationComment,
      offerPublishedAt: sellerOffers.moderatedAt,
      offerCreatedAt: sellerOffers.createdAt,
      offerSellerName: sellers.name,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .leftJoin(sellerOffers, eq(sellerOffers.productId, products.id))
    .leftJoin(sellers, eq(sellerOffers.sellerId, sellers.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId));

  const [sellerOptions, categoryOptions, subcategoryOptions, rows] =
    await Promise.all([
      db
        .select({ id: sellers.id, name: sellers.name })
        .from(sellers)
        .orderBy(sellers.name),
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(categories.name),
      db
        .select({
          id: subcategories.id,
          name: subcategories.name,
          categoryName: categories.name,
        })
        .from(subcategories)
        .innerJoin(categories, eq(categories.id, subcategories.categoryId))
        .orderBy(categories.name, subcategories.name),
      whereConditions.length > 0
        ? productsQuery
            .where(and(...whereConditions))
            .orderBy(desc(products.updatedAt), asc(products.name))
        : productsQuery.orderBy(desc(products.updatedAt), asc(products.name)),
    ]);

  const rowsByProduct = new Map<string, typeof rows>();

  for (const row of rows) {
    rowsByProduct.set(row.id, [...(rowsByProduct.get(row.id) ?? []), row]);
  }

  const productRows = Array.from(rowsByProduct.values()).map((productOffers) => {
    const first = productOffers[0];
    const offers = productOffers.filter((offer) => offer.offerId);
    const publishedOffers = offers.filter((offer) => offer.offerStatus === "published");
    const sellerDeletedOffers = offers.filter((offer) =>
      isSellerDeletedOffer({
        status: offer.offerStatus,
        moderationComment: offer.offerModerationComment,
      }),
    );
    const priorityOffer = publishedOffers.find(
      (offer) => offer.offerId === first.priorityOfferId,
    );
    const selectedOffer =
      priorityOffer ??
      publishedOffers.reduce<(typeof publishedOffers)[number] | null>(
        (best, offer) =>
          !best ||
          Number(offer.offerPriceWithVat ?? Infinity) <
            Number(best.offerPriceWithVat ?? Infinity) ||
          (Number(offer.offerPriceWithVat ?? Infinity) ===
            Number(best.offerPriceWithVat ?? Infinity) &&
            ((offer.offerPublishedAt ?? offer.offerCreatedAt)?.getTime() ?? Infinity) <
              ((best.offerPublishedAt ?? best.offerCreatedAt)?.getTime() ?? Infinity))
            ? offer
            : best,
        null,
      );

    return {
      ...first,
      offerCount: offers.length,
      sellerDeletedOfferCount: sellerDeletedOffers.length,
      sellerDeletedOfferNames: sellerDeletedOffers
        .map((offer) => offer.offerSellerName)
        .filter((name): name is string => Boolean(name)),
      selectedOffer,
    };
  });
  const hasFilters = Boolean(
    q || sellerId || categoryId || subcategoryId || activity || offerStatus,
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <span>Товары</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Товары</h1>
            <p className="mt-2 text-slate-600">
              Управление публичным каталогом, ценами, активностью и привязкой к
              продавцам.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#1157ff] shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              href="/admin/products/moderation"
            >
              <Clock3 size={18} />
              Модерация
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#1157ff] shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              href="/admin/products/import"
            >
              <FileSpreadsheet size={18} />
              Импорт Excel
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              href="/admin/products/new"
            >
              <Plus size={18} />
              Добавить товар
            </Link>
          </div>
        </div>

        <form
          className="mt-5 overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
          method="get"
        >
          <div className="grid min-w-[1170px] items-end gap-3 xl:grid-cols-[220px_145px_145px_170px_105px_125px_180px]">
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Поиск
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={q}
                  name="q"
                  placeholder="Название, SKU, продавец"
                />
              </div>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Продавец
              <select
                className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={sellerId}
                name="sellerId"
              >
                <option value="">Все продавцы</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Категория
              <select
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={categoryId}
                name="categoryId"
              >
                <option value="">Все категории</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Подкатегория
              <select
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={subcategoryId}
                name="subcategoryId"
              >
                <option value="">Все подкатегории</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.categoryName} · {subcategory.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Активность
              <select
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={activity}
                name="activity"
              >
                <option value="">Все</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-700">
              Статус
              <select
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={offerStatus}
                name="offerStatus"
              >
                <option value="">Все статусы</option>
                {offerStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getOfferStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 items-end gap-2">
              <button
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#1157ff] px-3 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                type="submit"
              >
                Применить
              </button>
              {hasFilters ? (
                <Link
                  className="inline-flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                  href="/admin/products"
                  title="Сбросить фильтры"
                >
                  <X size={18} />
                </Link>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Найдено товаров: {productRows.length}
          </p>
        </form>

        <section className="mt-8 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Товар</th>
                <th className="px-5 py-4">Категория</th>
                <th className="px-5 py-4">Продавец</th>
                <th className="px-5 py-4">Цена</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Обновлен</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {productRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Товаров пока нет.
                  </td>
                </tr>
              ) : null}
              {productRows.map((product) => {
                const imageUrl = product.mainImageIsActive
                  ? getPublicFileUrl({
                      id: product.mainImageFileId,
                      storageKey: product.mainImageStorageKey,
                    })
                  : null;
                const productHref = withAdminBreadcrumbSource(
                  `/admin/products/${product.id}`,
                  "products",
                );

                return (
                  <tr key={product.id} className="align-top hover:bg-slate-50">
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={productHref}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                          {imageUrl ? (
                            <img
                              alt={product.name}
                              className="h-full w-full object-cover"
                              src={imageUrl}
                            />
                          ) : (
                            <Package size={22} />
                          )}
                        </span>
                        <span>
                          <span className="block font-black text-[#1157ff]">
                            {product.name}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            {product.sku} · {product.unit}
                          </span>
                        </span>
                      </Link>
                    </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={productHref}
                    >
                      <span className="block font-bold text-slate-950">
                        {product.categoryName}
                      </span>
                      <span className="mt-1 block text-slate-500">
                        {product.subcategoryName ?? "Без подкатегории"}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={productHref}
                    >
                      {product.selectedOffer?.offerSellerName ??
                        (product.sellerDeletedOfferCount > 0
                          ? `Удалено продавцом${
                              product.sellerDeletedOfferNames.length > 0
                                ? `: ${product.sellerDeletedOfferNames.join(", ")}`
                                : ""
                            }`
                          : "Нет published offer")}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-black"
                      href={productHref}
                    >
                      {product.selectedOffer?.offerPriceWithVat
                        ? formatCurrency(product.selectedOffer.offerPriceWithVat)
                        : "Нет цены"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={productHref}
                    >
                      <span className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            product.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {product.offerCount} предл. ·{" "}
                          {product.isActive ? "активен" : "неактивен"}
                        </span>
                        {product.sellerDeletedOfferCount > 0 ? (
                          <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            Удалено продавцом
                            {product.sellerDeletedOfferCount > 1
                              ? `: ${product.sellerDeletedOfferCount}`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={productHref}
                    >
                      {formatDateTime(product.updatedAt)}
                    </Link>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
