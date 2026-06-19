import Link from "next/link";

import { ContentPageForm } from "@/app/(admin)/admin/pages/content-page-form";
import { ToastMessage } from "@/components/ui/toast-message";
import { requireUser } from "@/lib/auth/session";

type NewContentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;

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
          <span>Новая страница</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/pages">
          ← Страницы
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          Новая страница
        </h1>

        {error ? (
          <ToastMessage message={error} tone="error" />
        ) : null}

        <div className="mt-6">
          <ContentPageForm />
        </div>
      </div>
    </main>
  );
}
