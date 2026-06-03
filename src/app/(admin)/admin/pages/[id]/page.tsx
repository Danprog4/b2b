import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentPageForm } from "@/app/(admin)/admin/pages/content-page-form";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

type EditContentPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditContentPage({
  params,
  searchParams,
}: EditContentPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : undefined;
  const saved = query.saved === "1";
  const created = query.created === "1";

  const [page] = await db
    .select()
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);

  if (!page) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/pages">
            Страницы
          </Link>
          <span>/</span>
          <span>{page.title}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin/pages">
              ← Страницы
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {page.title}
            </h1>
          </div>
          {page.isPublished ? (
            <Link
              className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-sm font-bold text-[#1157ff] ring-1 ring-slate-200"
              href={`/info/${page.slug}`}
              target="_blank"
            >
              Открыть на сайте
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}
        {saved || created ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Страница сохранена.
          </div>
        ) : null}

        <div className="mt-6">
          <ContentPageForm page={page} />
        </div>
      </div>
    </main>
  );
}
