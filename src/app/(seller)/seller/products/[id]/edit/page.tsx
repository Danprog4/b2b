import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  categories,
  files,
  products,
  sellerOffers,
  subcategories,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { requestSellerProductUpdateAction } from "@/lib/seller/product-actions";
import { SellerProductForm } from "../../product-form";

type EditSellerProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditSellerProductPage({
  params,
  searchParams,
}: EditSellerProductPageProps) {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    notFound();
  }

  const { id } = await params;
  const search = (await searchParams) ?? {};
  const error = typeof search.error === "string" ? search.error : null;

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      subcategoryId: products.subcategoryId,
      description: products.description,
      size: products.size,
      unit: products.unit,
      priceWithVat: sellerOffers.priceWithVat,
      vatRate: sellerOffers.vatRate,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(
      sellerOffers,
      and(
        eq(sellerOffers.productId, products.id),
        eq(sellerOffers.sellerId, user.sellerId),
      ),
    )
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(eq(products.id, id), eq(products.sellerId, user.sellerId)))
    .limit(1);

  if (!product) {
    notFound();
  }

  const [categoryOptions, subcategoryOptions] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        categoryName: categories.name,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(eq(subcategories.isActive, true))
      .orderBy(asc(categories.name), asc(subcategories.sortOrder), asc(subcategories.name)),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-3xl font-black text-slate-950">
            Редактирование товара
          </h1>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <SellerProductForm
              action={requestSellerProductUpdateAction}
              categories={categoryOptions}
              product={{
                ...product,
                mainImageUrl: product.mainImageIsActive
                  ? getPublicFileUrl({
                      id: product.mainImageFileId,
                      storageKey: product.mainImageStorageKey,
                    })
                  : null,
              }}
              subcategories={subcategoryOptions}
              submitText="Отправить изменения"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
