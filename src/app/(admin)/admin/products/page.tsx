import { asc, desc, eq } from "drizzle-orm";
import { Clock3, FileSpreadsheet, Package, Plus } from "lucide-react";
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
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function AdminProductsPage() {
  await requireUser(["admin"]);

  const rows = await db
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
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .orderBy(desc(products.updatedAt), asc(products.name));
  const rowsByProduct = new Map<string, typeof rows>();

  for (const row of rows) {
    rowsByProduct.set(row.id, [...(rowsByProduct.get(row.id) ?? []), row]);
  }

  const productRows = Array.from(rowsByProduct.values()).map((productOffers) => {
    const first = productOffers[0];
    const offers = productOffers.filter((offer) => offer.offerId);
    const publishedOffers = offers.filter((offer) => offer.offerStatus === "published");
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
      selectedOffer,
    };
  });

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

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
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

                return (
                  <tr key={product.id} className="align-top hover:bg-slate-50">
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={`/admin/products/${product.id}`}
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
                      href={`/admin/products/${product.id}`}
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
                      href={`/admin/products/${product.id}`}
                    >
                      {product.selectedOffer?.offerSellerName ?? "Нет published offer"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-black"
                      href={`/admin/products/${product.id}`}
                    >
                      {product.selectedOffer?.offerPriceWithVat
                        ? formatCurrency(product.selectedOffer.offerPriceWithVat)
                        : "Нет цены"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={`/admin/products/${product.id}`}
                    >
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
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/products/${product.id}`}
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
