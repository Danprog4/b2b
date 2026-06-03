import { asc } from "drizzle-orm";
import Link from "next/link";

import { BannerForm } from "@/app/(admin)/admin/banners/banner-form";
import { db } from "@/db";
import { banners } from "@/db/schema";
import { getBannerLinkSuggestions } from "@/lib/admin/banner-link-suggestions";
import { requireUser } from "@/lib/auth/session";

type NewBannerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function dateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function NewBannerPage({ searchParams }: NewBannerPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const now = new Date();
  const monthAhead = new Date(now);
  monthAhead.setMonth(monthAhead.getMonth() + 1);
  const [linkSuggestions, occupiedOrders] = await Promise.all([
    getBannerLinkSuggestions(),
    db
      .select({
        bannerId: banners.id,
        sortOrder: banners.sortOrder,
        title: banners.title,
      })
      .from(banners)
      .orderBy(asc(banners.sortOrder), asc(banners.createdAt)),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/banners">
            Баннеры
          </Link>
          <span>/</span>
          <span>Новый баннер</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/banners">
          ← Баннеры
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Новый баннер</h1>

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <BannerForm
            defaultEndsAt={dateTimeLocalValue(monthAhead)}
            defaultStartsAt={dateTimeLocalValue(now)}
            linkSuggestions={linkSuggestions}
            occupiedOrders={occupiedOrders}
          />
        </div>
      </div>
    </main>
  );
}
