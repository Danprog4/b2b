import Link from "next/link";

import { createSellerAction } from "@/lib/admin/seller-actions";
import { requireUser } from "@/lib/auth/session";
import { SellerForm } from "../seller-form";

type NewSellerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(error: string | undefined) {
  if (error === "inn") {
    return "Продавец с таким ИНН уже существует.";
  }

  if (error === "required") {
    return "Заполните название, ИНН, комиссию и статус.";
  }

  return null;
}

export default async function AdminNewSellerPage({
  searchParams,
}: NewSellerPageProps) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const error = getErrorMessage(
    typeof search.error === "string" ? search.error : undefined,
  );

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
          <Link className="text-[#1157ff]" href="/admin/sellers">
            Продавцы
          </Link>
          <span>/</span>
          <span>Новый продавец</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/sellers">
          ← Продавцы
        </Link>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black text-slate-950">
            Новый продавец
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Продавец будет доступен для привязки к товарам и расчета комиссии.
          </p>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <SellerForm
              action={createSellerAction}
              submitText="Создать продавца"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
