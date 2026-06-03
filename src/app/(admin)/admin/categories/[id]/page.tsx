import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { categories, files } from "@/db/schema";
import { updateCategoryAction } from "@/lib/admin/category-actions";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { CategoryForm } from "../category-form";

type CategoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminEditCategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const created = search.created === "1";
  const error = typeof search.error === "string" ? search.error : undefined;
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!category) {
    notFound();
  }

  const [image] = category.imageFileId
    ? await db
        .select({ id: files.id, storageKey: files.storageKey })
        .from(files)
        .where(and(eq(files.id, category.imageFileId), eq(files.isActive, true)))
        .limit(1)
    : [];
  const categoryWithImage = {
    ...category,
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
          <span>{category.name}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/categories">
          ← Категории
        </Link>

        {saved || created ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {created ? "Категория создана." : "Категория сохранена."}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black text-slate-950">{category.name}</h1>
          <div className="mt-6">
            <CategoryForm
              action={updateCategoryAction}
              category={categoryWithImage}
              submitText="Сохранить"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
