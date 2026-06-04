import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { Download, ExternalLink, FileText, Search, X } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  documents,
  invoices,
  orders,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type AdminOrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions = [
  "accepted",
  "paid",
  "issued",
  "cancelled",
] as const;

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseDateInput(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMoneyInput(value: string) {
  if (!value) {
    return null;
  }

  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null;
}

function buildExportHref(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/admin/orders/export?${query}` : "/admin/orders/export";
}

function DocumentFlag({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-black ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const query = getParam(search, "q");
  const status = getParam(search, "status");
  const company = getParam(search, "company");
  const inn = getParam(search, "inn");
  const documentsFilter = getParam(search, "documents");
  const dateFrom = getParam(search, "dateFrom");
  const dateTo = getParam(search, "dateTo");
  const amountFrom = getParam(search, "amountFrom");
  const amountTo = getParam(search, "amountTo");
  const exportHref = buildExportHref(search);

  const documentCounts = db
    .select({
      orderId: documents.orderId,
      count: count(documents.id).as("documents_count"),
    })
    .from(documents)
    .where(eq(documents.isActive, true))
    .groupBy(documents.orderId)
    .as("document_counts");

  const whereConditions = [];

  if (statusOptions.includes(status as (typeof statusOptions)[number])) {
    whereConditions.push(eq(orders.status, status as (typeof statusOptions)[number]));
  }

  if (query.length >= 2) {
    const pattern = `%${query}%`;
    whereConditions.push(
      or(
        ilike(orders.number, pattern),
        ilike(buyerCompanies.name, pattern),
        ilike(buyerCompanies.inn, pattern),
        ilike(users.email, pattern),
      ),
    );
  }

  if (company) {
    whereConditions.push(ilike(buyerCompanies.name, `%${company}%`));
  }

  if (inn) {
    whereConditions.push(ilike(buyerCompanies.inn, `%${inn}%`));
  }

  const parsedDateFrom = parseDateInput(dateFrom);
  const parsedDateTo = parseDateInput(dateTo, true);
  const parsedAmountFrom = parseMoneyInput(amountFrom);
  const parsedAmountTo = parseMoneyInput(amountTo);

  if (parsedDateFrom) {
    whereConditions.push(gte(orders.createdAt, parsedDateFrom));
  }

  if (parsedDateTo) {
    whereConditions.push(lte(orders.createdAt, parsedDateTo));
  }

  if (parsedAmountFrom) {
    whereConditions.push(gte(orders.totalAmount, parsedAmountFrom));
  }

  if (parsedAmountTo) {
    whereConditions.push(lte(orders.totalAmount, parsedAmountTo));
  }

  if (documentsFilter === "with") {
    whereConditions.push(isNotNull(documentCounts.orderId));
  }

  if (documentsFilter === "without") {
    whereConditions.push(isNull(documentCounts.orderId));
  }

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalAmount: orders.totalAmount,
      comment: orders.comment,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      userEmail: users.email,
      invoiceNumber: invoices.number,
      documentsCount: documentCounts.count,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(orders.buyerCompanyId, buyerCompanies.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(
      invoices,
      and(eq(invoices.orderId, orders.id), eq(invoices.isCurrent, true)),
    )
    .leftJoin(documentCounts, eq(documentCounts.orderId, orders.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const documentRows =
    rows.length > 0
      ? await db
          .select({
            orderId: documents.orderId,
            type: documents.type,
          })
          .from(documents)
          .where(
            and(
              inArray(
                documents.orderId,
                rows.map((order) => order.id),
              ),
              eq(documents.isActive, true),
              inArray(documents.type, [
                "payment_invoice",
                "invoice",
                "contract",
                "upd",
                "specification",
                "act",
              ]),
            ),
          )
      : [];

  const documentFlagsByOrder = new Map<
    string,
    {
      hasInvoice: boolean;
      hasContract: boolean;
      hasUpd: boolean;
      hasSpecification: boolean;
      hasAct: boolean;
    }
  >();

  for (const document of documentRows) {
    if (!document.orderId) {
      continue;
    }

    const flags = documentFlagsByOrder.get(document.orderId) ?? {
      hasInvoice: false,
      hasContract: false,
      hasUpd: false,
      hasSpecification: false,
      hasAct: false,
    };

    if (document.type === "payment_invoice" || document.type === "invoice") {
      flags.hasInvoice = true;
    }

    if (document.type === "contract") {
      flags.hasContract = true;
    }

    if (document.type === "upd") {
      flags.hasUpd = true;
    }

    if (document.type === "specification") {
      flags.hasSpecification = true;
    }

    if (document.type === "act") {
      flags.hasAct = true;
    }

    documentFlagsByOrder.set(document.orderId, flags);
  }

  const viewedRows =
    rows.length > 0
      ? await db
          .select({
            orderId: auditEvents.entityId,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.action, "order.admin_view"),
              eq(auditEvents.entityType, "order"),
              inArray(
                auditEvents.entityId,
                rows.map((order) => order.id),
              ),
            ),
          )
      : [];

  const viewedOrderIds = new Set(
    viewedRows
      .map((row) => row.orderId)
      .filter((orderId): orderId is string => orderId !== null),
  );

  const ordersWithViewState = rows.map((order) => ({
    ...order,
    isNew: !viewedOrderIds.has(order.id),
    hasInvoice:
      Boolean(order.invoiceNumber) ||
      (documentFlagsByOrder.get(order.id)?.hasInvoice ?? false),
    hasContract: documentFlagsByOrder.get(order.id)?.hasContract ?? false,
    hasUpd: documentFlagsByOrder.get(order.id)?.hasUpd ?? false,
    hasSpecification:
      documentFlagsByOrder.get(order.id)?.hasSpecification ?? false,
    hasAct: documentFlagsByOrder.get(order.id)?.hasAct ?? false,
  }));

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
          <span>Заказы</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Заказы</h1>
            <p className="mt-2 text-slate-600">
              Операционная обработка заказов, счетов и статусов.
            </p>
          </div>
          <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Всего: {rows.length}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
            href={exportHref}
          >
            <Download size={18} />
            Выгрузить Excel
          </Link>
        </div>

        <form
          className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          method="get"
        >
          <div className="grid gap-3 xl:grid-cols-[1.25fr_180px_180px_160px]">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Поиск
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={query}
                  name="q"
                  placeholder="Заказ, компания, ИНН, email"
                />
              </div>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Статус
              <select
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={status}
                name="status"
              >
                <option value="">Все статусы</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {getOrderStatusLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Документы
              <select
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={documentsFilter}
                name="documents"
              >
                <option value="">Все</option>
                <option value="with">Есть документы</option>
                <option value="without">Без документов</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                type="submit"
              >
                Применить
              </button>
              <Link
                className="inline-flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                href="/admin/orders"
                title="Сбросить фильтры"
              >
                <X size={18} />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Компания
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={company}
                name="company"
                placeholder="Название"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              ИНН
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={inn}
                name="inn"
                placeholder="7702..."
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Дата от
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={dateFrom}
                name="dateFrom"
                type="date"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Дата до
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={dateTo}
                name="dateTo"
                type="date"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Сумма от
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={amountFrom}
                inputMode="decimal"
                name="amountFrom"
                placeholder="0"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Сумма до
              <input
                className="h-11 rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#1157ff]"
                defaultValue={amountTo}
                inputMode="decimal"
                name="amountTo"
                placeholder="100000"
              />
            </label>
          </div>
        </form>

        <section className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1480px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Заказ</th>
                <th className="px-5 py-4">Создан</th>
                <th className="px-5 py-4">Компания</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Счет</th>
                <th className="px-5 py-4">Документы</th>
                <th className="px-5 py-4">Комментарий</th>
                <th className="px-5 py-4">Сумма</th>
                <th className="px-5 py-4">Обновлен</th>
                <th className="px-5 py-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={10}>
                    Заказы не найдены.
                  </td>
                </tr>
              ) : null}
              {ordersWithViewState.map((order) => (
                <tr key={order.id} className="align-top hover:bg-slate-50">
                  <td className="p-0">
                    <Link
                      className="flex px-5 py-4 font-black text-[#1157ff]"
                      href={`/admin/orders/${order.id}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileText size={18} />
                        {order.number}
                        {order.isNew ? (
                          <span className="whitespace-nowrap rounded-full bg-[#1157ff] px-2.5 py-1 text-xs font-black text-white">
                            Не просмотрен
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/orders/${order.id}`}
                    >
                      {formatDateTime(order.createdAt)}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={`/admin/orders/${order.id}`}
                    >
                      <div className="font-bold text-slate-950">
                        {order.companyName}
                      </div>
                      <div className="mt-1 text-slate-500">
                        ИНН {order.companyInn}
                      </div>
                      <div className="mt-1 text-slate-400">
                        {order.userEmail}
                      </div>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={`/admin/orders/${order.id}`}
                    >
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/orders/${order.id}`}
                    >
                      {order.invoiceNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="flex flex-wrap gap-1.5 px-5 py-4 text-slate-600"
                      href={`/admin/orders/${order.id}`}
                    >
                      <DocumentFlag active={order.hasInvoice} label="Счет" />
                      <DocumentFlag active={order.hasContract} label="Договор" />
                      <DocumentFlag active={order.hasUpd} label="УПД" />
                      <DocumentFlag active={order.hasSpecification} label="Спец." />
                      <DocumentFlag active={order.hasAct} label="Акт" />
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block max-w-[260px] px-5 py-4 text-slate-600"
                      href={`/admin/orders/${order.id}`}
                    >
                      <span className="line-clamp-2">
                        {order.comment || "—"}
                      </span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-black"
                      href={`/admin/orders/${order.id}`}
                    >
                      {formatCurrency(order.totalAmount)}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/orders/${order.id}`}
                    >
                      {formatDateTime(order.updatedAt)}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="inline-flex items-center gap-2 px-5 py-4 font-bold text-[#1157ff]"
                      href={`/admin/orders/${order.id}`}
                    >
                      <ExternalLink size={16} />
                      Открыть
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
