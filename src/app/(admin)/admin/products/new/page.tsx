import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { categories, sellers, subcategories } from "@/db/schema";
import { createProductAction } from "@/lib/admin/product-actions";
import { requireUser } from "@/lib/auth/session";
import { ToastMessage } from "@/components/ui/toast-message";
import { ProductForm } from "../product-form";

type NewProductPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNewProductPage({
  searchParams,
}: NewProductPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const [categoryOptions, subcategoryOptions, sellerOptions] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        categoryName: categories.name,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .orderBy(asc(categories.name), asc(subcategories.sortOrder), asc(subcategories.name)),
    db
      .select({ id: sellers.id, name: sellers.name })
      .from(sellers)
      .orderBy(asc(sellers.name)),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/products">
            Товары
          </Link>
          <span>/</span>
          <span>Новый товар</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/products">
          ← Товары
        </Link>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black text-slate-950">Новый товар</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Артикул будет сгенерирован автоматически после сохранения.
          </p>

          {error ? (
            <ToastMessage
              message="Заполните название, категорию, цену и единицу измерения."
              tone="error"
            />
          ) : null}

          <div className="mt-6">
            <ProductForm
              action={createProductAction}
              categories={categoryOptions}
              subcategories={subcategoryOptions}
              sellers={sellerOptions}
              submitText="Создать товар"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
