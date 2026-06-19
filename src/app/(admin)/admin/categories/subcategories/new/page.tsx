import { asc } from "drizzle-orm";
import Link from "next/link";

import { ToastMessage } from "@/components/ui/toast-message";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { createSubcategoryAction } from "@/lib/admin/category-actions";
import { requireUser } from "@/lib/auth/session";
import { SubcategoryForm } from "../../subcategory-form";

type AdminNewSubcategoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNewSubcategoryPage({
  searchParams,
}: AdminNewSubcategoryPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const categoryOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/categories">
            Категории
          </Link>
          <span>/</span>
          <span>Новая подкатегория</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/categories">
          ← Категории
        </Link>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black text-slate-950">
            Новая подкатегория
          </h1>
          {error ? (
            <ToastMessage
              message={
                error === "required"
                  ? "Выберите родительскую категорию и заполните название."
                  : error
              }
              tone="error"
            />
          ) : null}
          <div className="mt-6">
            <SubcategoryForm
              action={createSubcategoryAction}
              categories={categoryOptions}
              submitText="Создать"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
