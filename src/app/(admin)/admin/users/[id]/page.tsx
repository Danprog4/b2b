import { desc, eq } from "drizzle-orm";
import { Building2, FileText, History, Mail, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ToastMessages } from "@/components/ui/toast-message";
import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  orders,
  sellers,
  users,
} from "@/db/schema";
import {
  getAdminBreadcrumbSource,
  withAdminBreadcrumbSource,
} from "@/lib/admin/breadcrumbs";
import { updateUserAction } from "@/lib/admin/user-actions";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type UserPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions = ["active", "blocked", "pending_join"] as const;

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

function getErrorMessage(error: string | undefined) {
  if (error === "self-block") {
    return "Нельзя заблокировать текущего администратора.";
  }

  if (error === "required") {
    return "Заполните корректный статус пользователя.";
  }

  return null;
}

export default async function AdminUserPage({
  params,
  searchParams,
}: UserPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const breadcrumbSource = getAdminBreadcrumbSource(search, "users");
  const error = getErrorMessage(
    typeof search.error === "string" ? search.error : undefined,
  );

  const [user] = await db
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
      companyKpp: buyerCompanies.kpp,
      companyStatus: buyerCompanies.status,
      companyContactEmail: buyerCompanies.contactEmail,
      companyContactPhone: buyerCompanies.contactPhone,
      sellerName: sellers.name,
      sellerInn: sellers.inn,
      sellerStatus: sellers.status,
      sellerEmail: sellers.email,
      sellerPhone: sellers.phone,
    })
    .from(users)
    .leftJoin(buyerCompanies, eq(buyerCompanies.id, users.buyerCompanyId))
    .leftJoin(sellers, eq(sellers.id, users.sellerId))
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    notFound();
  }

  const [recentOrders, recentAuditEvents] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(8),
    db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.actorId, user.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(8),
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
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <span>{user.email}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              className="text-sm font-bold text-[#1157ff]"
              href={breadcrumbSource.href}
            >
              ← {breadcrumbSource.label}
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {user.name ?? "Пользователь без имени"}
            </h1>
            <p className="mt-2 text-slate-600">{user.email}</p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${getStatusClassName(user.status)}`}
          >
            {getStatusLabel(user.status)}
          </span>
        </div>

        <ToastMessages
          items={[
            ...(saved ? [{ message: "Пользователь сохранен." }] : []),
            ...(error ? [{ message: error, tone: "error" as const }] : []),
          ]}
        />

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_380px]">
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Данные пользователя
            </h2>
            <form action={updateUserAction} className="mt-5 grid gap-5">
              <input name="userId" type="hidden" value={user.id} />

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">Имя</span>
                <input
                  className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={user.name ?? ""}
                  name="name"
                  placeholder="Имя пользователя"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">Телефон</span>
                <input
                  className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={user.phone ?? ""}
                  name="phone"
                  placeholder="+7..."
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Email
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-black">
                    <Mail size={18} />
                    {user.email}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Роль
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-black">
                    <UserRound size={18} />
                    {getRoleLabel(user.role)}
                  </p>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">Статус</span>
                <select
                  className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
                  defaultValue={user.status}
                  name="status"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {getStatusLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <button className="h-11 w-fit rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
                Сохранить пользователя
              </button>
            </form>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Сводка</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Создан</span>
                  <span className="font-black">{formatDateTime(user.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Обновлен</span>
                  <span className="font-black">{formatDateTime(user.updatedAt)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Последний вход</span>
                  <span className="font-black">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Не входил"}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Привязка</h2>
              {user.companyName ? (
                <div className="mt-4 text-sm">
                  <Link
                    className="flex items-center gap-2 font-black text-[#1157ff]"
                    href={withAdminBreadcrumbSource(
                      `/admin/companies/${user.buyerCompanyId}`,
                      "users",
                    )}
                  >
                    <Building2 size={18} />
                    {user.companyName}
                  </Link>
                  <p className="mt-2 text-slate-600">
                    ИНН {user.companyInn}
                    {user.companyKpp ? ` · КПП ${user.companyKpp}` : ""}
                  </p>
                  <p className="mt-2 text-slate-600">
                    Статус компании: {user.companyStatus}
                  </p>
                  <p className="mt-2 text-slate-600">
                    {user.companyContactEmail ??
                      user.companyContactPhone ??
                      "Контакты компании не указаны"}
                  </p>
                  <Link
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                    href={withAdminBreadcrumbSource(
                      `/admin/companies/${user.buyerCompanyId}`,
                      "users",
                    )}
                  >
                    <FileText size={16} />
                    Документы компании
                  </Link>
                </div>
              ) : user.sellerName ? (
                <div className="mt-4 text-sm">
                  <Link
                    className="flex items-center gap-2 font-black text-[#1157ff]"
                    href={withAdminBreadcrumbSource(
                      `/admin/sellers/${user.sellerId}`,
                      "users",
                    )}
                  >
                    <Store size={18} />
                    {user.sellerName}
                  </Link>
                  <p className="mt-2 text-slate-600">ИНН {user.sellerInn}</p>
                  <p className="mt-2 text-slate-600">
                    Статус продавца: {user.sellerStatus}
                  </p>
                  <p className="mt-2 text-slate-600">
                    {user.sellerEmail ?? user.sellerPhone ?? "Контакты продавца не указаны"}
                  </p>
                  <Link
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                    href={withAdminBreadcrumbSource(
                      `/admin/sellers/${user.sellerId}`,
                      "users",
                    )}
                  >
                    <FileText size={16} />
                    Документы продавца
                  </Link>
                </div>
              ) : (
                <div className="mt-4 flex min-h-24 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-500">
                  Пользователь пока не привязан к компании или продавцу.
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">Заказы</h2>
              <Link className="text-sm font-bold text-[#1157ff]" href="/admin/orders">
                Все заказы
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Заказов у пользователя пока нет.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    className="grid gap-3 py-3 text-sm transition hover:text-[#1157ff] md:grid-cols-[1fr_auto]"
                    href={withAdminBreadcrumbSource(
                      `/admin/orders/${order.id}`,
                      "users",
                    )}
                    key={order.id}
                  >
                    <span>
                      <span className="block font-black text-slate-950">
                        {order.number}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-slate-500">
                        <span>{formatDateTime(order.createdAt)}</span>
                        <OrderStatusBadge status={order.status} />
                      </span>
                    </span>
                    <span className="font-black">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <History size={20} />
              Последние действия
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {recentAuditEvents.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Действий пока нет.
                </div>
              ) : (
                recentAuditEvents.map((event) => (
                  <div className="py-3 text-sm" key={event.id}>
                    <p className="font-black text-slate-950">{event.action}</p>
                    <p className="mt-1 text-slate-500">
                      {event.entityType}
                      {event.entityId ? ` · ${event.entityId}` : ""} ·{" "}
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
