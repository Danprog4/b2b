import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function AdminContentPagesPage() {
  await requireUser(["admin"]);

  const rows = await db
    .select()
    .from(contentPages)
    .orderBy(asc(contentPages.title));

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <span>Страницы</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Информационные страницы
            </h1>
            <p className="mt-2 text-slate-600">
              Страницы из нижнего меню сайта и справочный контент.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
            href="/admin/pages/new"
          >
            <Plus size={18} />
            Добавить страницу
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Страница</th>
                <th className="px-5 py-4">Публичная ссылка</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Обновлена</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                    Страниц пока нет.
                  </td>
                </tr>
              ) : null}
              {rows.map((page) => (
                <tr className="align-top hover:bg-slate-50" key={page.id}>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={`/admin/pages/${page.id}`}
                    >
                      <span className="block font-black text-[#1157ff]">
                        {page.title}
                      </span>
                      <span className="mt-1 block text-slate-500">{page.slug}</span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-bold text-slate-700"
                      href={`/info/${page.slug}`}
                      target="_blank"
                    >
                      /info/{page.slug}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link className="block px-5 py-4" href={`/admin/pages/${page.id}`}>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          page.isPublished
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {page.isPublished ? "Опубликована" : "Черновик"}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/pages/${page.id}`}
                    >
                      {formatDateTime(page.updatedAt)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
