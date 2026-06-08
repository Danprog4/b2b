import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Package, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import {
  categories,
  files,
  products,
  subcategories,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { requestExistingProductOfferAction } from "@/lib/seller/product-actions";
import { formatCurrency } from "@/lib/utils";

type ExistingProductOfferPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function ExistingProductOfferPage({
  searchParams,
}: ExistingProductOfferPageProps) {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    notFound();
  }

  const search = (await searchParams) ?? {};
  const q = getSearchParam(search.q);
  const error = getSearchParam(search.error);
  const sellerId = user.sellerId;
  const filters = [
    eq(products.isActive, true),
    sql`exists (
      select 1
      from "seller_offers" public_offer
      where public_offer."product_id" = ${products.id}
        and public_offer."status" = 'published'
    )`,
    sql`not exists (
      select 1
      from "seller_offers" own_offer
      where own_offer."product_id" = ${products.id}
        and own_offer."seller_id" = ${sellerId}
    )`,
    sql`not exists (
      select 1
      from "seller_product_change_requests" own_request
      where own_request."product_id" = ${products.id}
        and own_request."seller_id" = ${sellerId}
        and own_request."status" = 'on_moderation'
    )`,
  ];

  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(ilike(products.name, pattern), ilike(products.sku, pattern))!);
  }

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      size: products.size,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      imageFileId: files.id,
      imageStorageKey: files.storageKey,
      imageIsActive: files.isActive,
      minPriceWithVat: sql<string>`(
        select min(public_offer."price_with_vat")
        from "seller_offers" public_offer
        where public_offer."product_id" = ${products.id}
          and public_offer."status" = 'published'
      )`,
      offerCount: sql<number>`(
        select count(*)
        from "seller_offers" public_offer
        where public_offer."product_id" = ${products.id}
          and public_offer."status" = 'published'
      )`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, products.subcategoryId))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(...filters))
    .orderBy(asc(products.name))
    .limit(60);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/seller#products">
            Товары
          </Link>
          <span>/</span>
          <span>Предложение к товару</span>
        </div>

        <Link
          className="mb-5 inline-flex text-sm font-bold text-[#1157ff] transition hover:text-[#0b49e0]"
          href="/seller#products"
        >
          ← К списку товаров
        </Link>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Добавить предложение
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Выберите существующий товар, укажите свою цену и отправьте
                предложение на модерацию. Покупатель увидит одну общую карточку
                товара после одобрения администратором.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <form className="mt-6 flex flex-wrap gap-3" action="/seller/products/existing">
            <label className="relative min-w-[260px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="h-12 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm font-semibold text-slate-950"
                defaultValue={q}
                name="q"
                placeholder="Название или артикул"
              />
            </label>
            <button
              className="h-12 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
              type="submit"
            >
              Найти
            </button>
          </form>
        </section>

        <section className="mt-5 grid gap-4">
          {rows.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-5 text-center text-sm font-bold text-slate-500">
              Подходящих товаров не найдено.
            </div>
          ) : null}

          {rows.map((product) => {
            const imageUrl = product.imageIsActive
              ? getPublicFileUrl({
                  id: product.imageFileId,
                  storageKey: product.imageStorageKey,
                })
              : null;

            return (
              <article
                className="grid gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:grid-cols-[96px_minmax(0,1fr)_300px]"
                key={product.id}
              >
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                  {imageUrl ? (
                    <Image
                      alt={product.name}
                      className="h-full w-full object-cover"
                      height={96}
                      src={imageUrl}
                      width={96}
                    />
                  ) : (
                    <Package size={34} />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-slate-950">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {product.sku} · {product.categoryName}
                    {product.subcategoryName ? ` · ${product.subcategoryName}` : ""}
                    {product.size ? ` · ${product.size}` : ""} · {product.unit}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      Опубликованных предложений: {product.offerCount}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[#1157ff]">
                      Цена на витрине от{" "}
                      {formatCurrency(product.minPriceWithVat ?? "0")}
                    </span>
                  </div>
                </div>

                <form
                  action={requestExistingProductOfferAction}
                  className="grid content-start gap-3 rounded-lg bg-slate-50 p-4"
                >
                  <input name="productId" type="hidden" value={product.id} />
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Ваша цена с НДС
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-950"
                      inputMode="decimal"
                      min="0"
                      name="priceWithVat"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <div className="grid gap-2 text-sm font-bold text-slate-700">
                    НДС
                    <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700">
                      22%
                    </div>
                  </div>
                  <SubmitButton
                    className="h-11 rounded-lg bg-[#1157ff] text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                    pendingText="Отправляем"
                  >
                    Отправить на модерацию
                  </SubmitButton>
                </form>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
