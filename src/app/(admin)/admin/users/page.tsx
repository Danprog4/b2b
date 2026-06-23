import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Building2, Store, UserRound } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { buyerCompanies, orders, sellers, users } from "@/db/schema";
import { withAdminBreadcrumbSource } from "@/lib/admin/breadcrumbs";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const roleOptions = ["buyer", "seller", "admin"] as const;
const statusOptions = ["active", "blocked", "pending_join"] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function getRoleLabel(role: string) {
  if (role === "buyer") {
    return "Покупатель";
  }

  if (role === "seller") {
    return "Продавец";
  }

  if (role === "admin") {
    return "Администратор";
  }

  return role;
}

function getStatusLabel(status: string) {
  if (status === "active") {
    return "Активен";
  }

  if (status === "blocked") {
    return "Заблокирован";
  }

  if (status === "pending_join") {
    return "Ожидает привязки";
  }

  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "blocked") {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const q = getParam(search, "q");
  const role = getParam(search, "role");
  const status = getParam(search, "status");
  const whereConditions = [];

  if (q) {
    whereConditions.push(
      or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(buyerCompanies.name, `%${q}%`),
        ilike(buyerCompanies.inn, `%${q}%`),
        ilike(sellers.name, `%${q}%`),
        ilike(sellers.inn, `%${q}%`),
      ),
    );
  }

  if (roleOptions.includes(role as (typeof roleOptions)[number])) {
    whereConditions.push(eq(users.role, role as (typeof roleOptions)[number]));
  }

  if (statusOptions.includes(status as (typeof statusOptions)[number])) {
    whereConditions.push(
      eq(users.status, status as (typeof statusOptions)[number]),
    );
  }

  const usersQuery = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      buyerCompanyId: users.buyerCompanyId,
      sellerId: users.sellerId,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      sellerName: sellers.name,
      sellerInn: sellers.inn,
    })
    .from(users)
    .leftJoin(buyerCompanies, eq(buyerCompanies.id, users.buyerCompanyId))
    .leftJoin(sellers, eq(sellers.id, users.sellerId));

  const [userRows, orderStats] = await Promise.all([
    whereConditions.length > 0
      ? usersQuery
          .where(and(...whereConditions))
          .orderBy(desc(users.updatedAt), desc(users.createdAt))
      : usersQuery.orderBy(desc(users.updatedAt), desc(users.createdAt)),
    db
      .select({
        userId: orders.userId,
        orderCount: count(orders.id),
        totalAmount: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .groupBy(orders.userId),
  ]);

  const ordersByUser = new Map(orderStats.map((row) => [row.userId, row]));

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
          <span>Пользователи</span>
        </div>

        <div>
          <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
            ← Админ-панель
          </Link>
          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Пользователи
          </h1>
          <p className="mt-2 text-slate-600">
            Аккаунты покупателей, продавцов и администраторов, их статус и
            привязка к юридическим лицам.
          </p>
        </div>

        <form className="mt-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[1fr_220px_220px_auto]">
          <input
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
            defaultValue={q}
            name="q"
            placeholder="Email, имя, ИНН или компания"
          />
          <select
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
            defaultValue={role}
            name="role"
          >
            <option value="">Все роли</option>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {getRoleLabel(option)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
            defaultValue={status}
            name="status"
          >
            <option value="">Все статусы</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {getStatusLabel(option)}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
            Найти
          </button>
        </form>

        <section className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1360px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Пользователь</th>
                <th className="px-5 py-4">Роль</th>
                <th className="px-5 py-4">Привязка</th>
                <th className="px-5 py-4">Заказы</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Последний вход</th>
                <th className="px-5 py-4">Зарегистрирован</th>
                <th className="px-5 py-4">Обновлен</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {userRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={8}>
                    Пользователи не найдены.
                  </td>
                </tr>
              ) : null}
              {userRows.map((row) => {
                const orderStat = ordersByUser.get(row.id);
                const userHref = withAdminBreadcrumbSource(
                  `/admin/users/${row.id}`,
                  "users",
                );

                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={userHref}
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1157ff]">
                          <UserRound size={22} />
                        </span>
                        <span>
                          <span className="block font-black text-[#1157ff]">
                            {row.name ?? "Без имени"}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            {row.email}
                          </span>
                          {row.phone ? (
                            <span className="mt-1 block text-slate-500">
                              {row.phone}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-bold"
                        href={userHref}
                      >
                        {getRoleLabel(row.role)}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={userHref}
                      >
                        {row.companyName ? (
                          <span className="flex gap-2">
                            <Building2 className="mt-0.5 text-[#1157ff]" size={18} />
                            <span>
                              <span className="block font-bold text-slate-950">
                                {row.companyName}
                              </span>
                              <span className="mt-1 block text-slate-500">
                                ИНН {row.companyInn}
                              </span>
                            </span>
                          </span>
                        ) : row.sellerName ? (
                          <span className="flex gap-2">
                            <Store className="mt-0.5 text-[#1157ff]" size={18} />
                            <span>
                              <span className="block font-bold text-slate-950">
                                {row.sellerName}
                              </span>
                              <span className="mt-1 block text-slate-500">
                                ИНН {row.sellerInn}
                              </span>
                            </span>
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-500">
                            Не привязан
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={userHref}
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
                        className="block px-5 py-4"
                        href={userHref}
                      >
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClassName(row.status)}`}
                        >
                          {getStatusLabel(row.status)}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={userHref}
                      >
                        {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Не входил"}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={userHref}
                      >
                        {formatDateTime(row.createdAt)}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={userHref}
                      >
                        {formatDateTime(row.updatedAt)}
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
