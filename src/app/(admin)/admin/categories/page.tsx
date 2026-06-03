import { asc, eq } from "drizzle-orm";
import { FolderTree, ImageIcon, Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { categories, files, subcategories } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";

export default async function AdminCategoriesPage() {
  await requireUser(["admin"]);

  const [categoryRows, subcategoryRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        sortOrder: categories.sortOrder,
        isActive: categories.isActive,
        imageFileId: files.id,
        imageStorageKey: files.storageKey,
        imageIsActive: files.isActive,
      })
      .from(categories)
      .leftJoin(files, eq(files.id, categories.imageFileId))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        slug: subcategories.slug,
        sortOrder: subcategories.sortOrder,
        isActive: subcategories.isActive,
        categoryId: subcategories.categoryId,
        categoryName: categories.name,
        imageFileId: files.id,
        imageStorageKey: files.storageKey,
        imageIsActive: files.isActive,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .leftJoin(files, eq(files.id, subcategories.imageFileId))
      .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name)),
  ]);

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
          <span>Категории</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Категории
            </h1>
            <p className="mt-2 text-slate-600">
              Управление структурой публичного каталога.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
              href="/admin/categories/subcategories/new"
            >
              <Plus size={18} />
              Подкатегория
            </Link>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              href="/admin/categories/new"
            >
              <Plus size={18} />
              Категория
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {categoryRows.map((category) => {
            const nested = subcategoryRows.filter(
              (subcategory) => subcategory.categoryId === category.id,
            );
            const imageUrl = category.imageIsActive
              ? getPublicFileUrl({
                  id: category.imageFileId,
                  storageKey: category.imageStorageKey,
                })
              : null;

            return (
              <article
                key={category.id}
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                        {imageUrl ? (
                          <img
                            alt={category.name}
                            className="h-full w-full object-cover"
                            src={imageUrl}
                          />
                        ) : (
                          <FolderTree className="text-[#1157ff]" size={24} />
                        )}
                      </span>
                      <Link
                        className="min-w-0 truncate text-xl font-black text-[#1157ff]"
                        href={`/admin/categories/${category.id}`}
                      >
                        {category.name}
                      </Link>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {category.slug} · порядок {category.sortOrder}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      category.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {category.isActive ? "Активна" : "Неактивна"}
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                    Подкатегории
                  </h2>
                  <div className="mt-3 grid gap-2">
                    {nested.length === 0 ? (
                      <p className="text-sm font-semibold text-slate-500">
                        Подкатегорий пока нет.
                      </p>
                    ) : null}
                    {nested.map((subcategory) => (
                      <Link
                        className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:text-[#1157ff]"
                        href={`/admin/categories/subcategories/${subcategory.id}`}
                        key={subcategory.id}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-300">
                            {subcategory.imageIsActive ? (
                              <img
                                alt={subcategory.name}
                                className="h-full w-full object-cover"
                                src={
                                  getPublicFileUrl({
                                    id: subcategory.imageFileId,
                                    storageKey: subcategory.imageStorageKey,
                                  }) ?? ""
                                }
                              />
                            ) : (
                              <ImageIcon size={16} />
                            )}
                          </span>
                          <span className="truncate">{subcategory.name}</span>
                        </span>
                        <span
                          className={
                            subcategory.isActive
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {subcategory.isActive ? "активна" : "неактивна"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
