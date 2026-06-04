import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { categories, subcategories } from "@/db/schema";
import { createSellerProductAction } from "@/lib/seller/product-actions";
import { SellerProductForm } from "../product-form";

type NewSellerProductPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSellerProductPage({
  searchParams,
}: NewSellerProductPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
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
          <span>Новый товар</span>
        </div>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-3xl font-black text-slate-950">Новый товар</h1>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <SellerProductForm
              action={createSellerProductAction}
              categories={categoryOptions}
              subcategories={subcategoryOptions}
              submitText="Отправить на модерацию"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
