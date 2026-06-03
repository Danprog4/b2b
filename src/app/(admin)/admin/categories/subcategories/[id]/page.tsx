import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { categories, files, subcategories } from "@/db/schema";
import { updateSubcategoryAction } from "@/lib/admin/category-actions";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { SubcategoryForm } from "../../subcategory-form";

type SubcategoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminEditSubcategoryPage({
  params,
  searchParams,
}: SubcategoryPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const created = search.created === "1";
  const error = typeof search.error === "string" ? search.error : undefined;
  const [subcategory] = await db
    .select()
    .from(subcategories)
    .where(eq(subcategories.id, id))
    .limit(1);

  if (!subcategory) {
    notFound();
  }

  const categoryOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const [image] = subcategory.imageFileId
    ? await db
        .select({ id: files.id, storageKey: files.storageKey })
        .from(files)
        .where(and(eq(files.id, subcategory.imageFileId), eq(files.isActive, true)))
        .limit(1)
    : [];
  const subcategoryWithImage = {
    ...subcategory,
    imageUrl: image ? getPublicFileUrl(image) : null,
  };

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
          <span>{subcategory.name}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/categories">
          ← Категории
        </Link>

        {saved || created ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {created ? "Подкатегория создана." : "Подкатегория сохранена."}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black text-slate-950">
            {subcategory.name}
          </h1>
          <div className="mt-6">
            <SubcategoryForm
              action={updateSubcategoryAction}
              categories={categoryOptions}
              subcategory={subcategoryWithImage}
              submitText="Сохранить"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
