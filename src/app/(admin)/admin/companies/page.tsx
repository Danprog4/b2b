import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Building2 } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { buyerCompanies, documents, orders, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const statusOptions = ["active", "blocked"] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function getCompanyTypeLabel(type: string) {
  return type === "ip" ? "ИП" : "ООО";
}

function getCompanyStatusLabel(status: string) {
  if (status === "active") {
    return "Активна";
  }

  if (status === "blocked") {
    return "Заблокирована";
  }

  return status;
}

function getCompanyStatusClassName(status: string) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "blocked") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const q = getParam(search, "q");
  const status = getParam(search, "status");
  const whereConditions = [];

  if (q) {
    whereConditions.push(
      or(
        ilike(buyerCompanies.name, `%${q}%`),
        ilike(buyerCompanies.inn, `%${q}%`),
        ilike(buyerCompanies.kpp, `%${q}%`),
        ilike(buyerCompanies.contactEmail, `%${q}%`),
        ilike(buyerCompanies.contactPhone, `%${q}%`),
      ),
    );
  }

  if (statusOptions.includes(status as (typeof statusOptions)[number])) {
    whereConditions.push(eq(buyerCompanies.status, status));
  }

  const companiesQuery = db
    .select()
    .from(buyerCompanies);

  const [companyRows, userStats, orderStats, documentStats] = await Promise.all([
    whereConditions.length > 0
      ? companiesQuery
          .where(and(...whereConditions))
          .orderBy(desc(buyerCompanies.updatedAt), desc(buyerCompanies.createdAt))
      : companiesQuery.orderBy(
          desc(buyerCompanies.updatedAt),
          desc(buyerCompanies.createdAt),
        ),
    db
      .select({
        companyId: users.buyerCompanyId,
        userCount: count(users.id),
      })
      .from(users)
      .where(sql`${users.buyerCompanyId} is not null`)
      .groupBy(users.buyerCompanyId),
    db
      .select({
        companyId: orders.buyerCompanyId,
        orderCount: count(orders.id),
        totalAmount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .groupBy(orders.buyerCompanyId),
    db
      .select({
        companyId: documents.buyerCompanyId,
        documentCount: count(documents.id),
      })
      .from(documents)
      .where(sql`${documents.buyerCompanyId} is not null`)
      .groupBy(documents.buyerCompanyId),
  ]);

  const usersByCompany = new Map(userStats.map((row) => [row.companyId, row]));
  const ordersByCompany = new Map(orderStats.map((row) => [row.companyId, row]));
  const documentsByCompany = new Map(
    documentStats.map((row) => [row.companyId, row]),
  );

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
          <span>Компании покупателей</span>
        </div>

        <div>
          <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
            ← Админ-панель
          </Link>
          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Компании покупателей
          </h1>
          <p className="mt-2 text-slate-600">
            Юридические лица и ИП покупателей, реквизиты, пользователи, заказы
            и документы.
          </p>
        </div>

        <form className="mt-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[1fr_220px_auto]">
          <input
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
            defaultValue={q}
            name="q"
            placeholder="Название, ИНН, КПП, email или телефон"
          />
          <select
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
            defaultValue={status}
            name="status"
          >
            <option value="">Все статусы</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {getCompanyStatusLabel(option)}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
            Найти
          </button>
        </form>

        <section className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1340px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Компания</th>
                <th className="px-5 py-4">Контакты</th>
                <th className="px-5 py-4">Пользователи</th>
                <th className="px-5 py-4">Заказы</th>
                <th className="px-5 py-4">Документы</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Создана</th>
                <th className="px-5 py-4">Обновлена</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {companyRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={8}>
                    Компании не найдены.
                  </td>
                </tr>
              ) : null}
              {companyRows.map((company) => {
                const orderStat = ordersByCompany.get(company.id);

                return (
                  <tr key={company.id} className="align-top hover:bg-slate-50">
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={`/admin/companies/${company.id}`}
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1157ff]">
                          <Building2 size={22} />
                        </span>
                        <span>
                          <span className="block font-black text-[#1157ff]">
                            {company.name}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            {getCompanyTypeLabel(company.type)} · ИНН {company.inn}
                            {company.kpp ? ` · КПП ${company.kpp}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/companies/${company.id}`}
                      >
                        <span className="block font-bold text-slate-950">
                          {company.contactEmail ?? "Email не указан"}
                        </span>
                        <span className="mt-1 block">
                          {company.contactPhone ?? "Телефон не указан"}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-black"
                        href={`/admin/companies/${company.id}`}
                      >
                        {usersByCompany.get(company.id)?.userCount ?? 0}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={`/admin/companies/${company.id}`}
                      >
                        <span className="block font-black">
                          {orderStat?.orderCount ?? 0}
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {formatCurrency(orderStat?.totalAmount ?? "0")}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-black"
                        href={`/admin/companies/${company.id}`}
                      >
                        {documentsByCompany.get(company.id)?.documentCount ?? 0}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={`/admin/companies/${company.id}`}
                      >
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getCompanyStatusClassName(company.status)}`}
                        >
                          {getCompanyStatusLabel(company.status)}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/companies/${company.id}`}
                      >
                        {formatDateTime(company.createdAt)}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/companies/${company.id}`}
                      >
                        {formatDateTime(company.updatedAt)}
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
