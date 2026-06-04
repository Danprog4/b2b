import { asc, eq } from "drizzle-orm";
import { ImageIcon, Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { banners, files } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { formatDateTime } from "@/lib/utils";

export default async function AdminBannersPage() {
  await requireUser(["admin"]);

  const rows = await db
    .select({
      id: banners.id,
      title: banners.title,
      href: banners.href,
      sortOrder: banners.sortOrder,
      isActive: banners.isActive,
      startsAt: banners.startsAt,
      endsAt: banners.endsAt,
      updatedAt: banners.updatedAt,
      imageFileId: files.id,
      imageStorageKey: files.storageKey,
      imageIsActive: files.isActive,
    })
    .from(banners)
    .leftJoin(files, eq(files.id, banners.desktopImageFileId))
    .orderBy(asc(banners.sortOrder), asc(banners.createdAt));

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
          <span>Баннеры</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Баннеры</h1>
            <p className="mt-2 text-slate-600">
              Управление промо-блоком главной страницы.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
            href="/admin/banners/new"
          >
            <Plus size={18} />
            Добавить баннер
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Баннер</th>
                <th className="px-5 py-4">Ссылка</th>
                <th className="px-5 py-4">Порядок</th>
                <th className="px-5 py-4">Период</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Обновлен</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Баннеров пока нет. Главная использует fallback-блок.
                  </td>
                </tr>
              ) : null}
              {rows.map((banner) => {
                const imageUrl = banner.imageIsActive
                  ? getPublicFileUrl({
                      id: banner.imageFileId,
                      storageKey: banner.imageStorageKey,
                    })
                  : null;

                return (
                  <tr className="align-top hover:bg-slate-50" key={banner.id}>
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={`/admin/banners/${banner.id}`}
                      >
                        <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                          {imageUrl ? (
                            <img
                              alt={banner.title}
                              className="h-full w-full object-cover"
                              src={imageUrl}
                            />
                          ) : (
                            <ImageIcon size={22} />
                          )}
                        </span>
                        <span>
                          <span className="block font-black text-[#1157ff]">
                            {banner.title}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            {imageUrl ? "Изображение загружено" : "Нет изображения"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/banners/${banner.id}`}
                      >
                        {banner.href || "Не указана"}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-bold"
                        href={`/admin/banners/${banner.id}`}
                      >
                        {banner.sortOrder}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/banners/${banner.id}`}
                      >
                        {banner.startsAt ? formatDateTime(banner.startsAt) : "сразу"}
                        {" - "}
                        {banner.endsAt ? formatDateTime(banner.endsAt) : "без срока"}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link className="block px-5 py-4" href={`/admin/banners/${banner.id}`}>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            banner.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {banner.isActive ? "Активен" : "Отключен"}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/banners/${banner.id}`}
                      >
                        {formatDateTime(banner.updatedAt)}
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
