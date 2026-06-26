import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { Check, Download } from "lucide-react";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { db } from "@/db";
import {
  orderItems,
  orders,
  paymentsToSeller,
  sellers,
} from "@/db/schema";
import { withAdminBreadcrumbSource } from "@/lib/admin/breadcrumbs";
import { requireUser } from "@/lib/auth/session";
import { parseMoscowDateInput } from "@/lib/datetime";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type CommissionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const orderStatusOptions = ["paid", "issued"] as const;
const payoutStatusOptions = ["unpaid", "planned", "paid"] as const;

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function getDateParam(value: string, endOfDay = false) {
  return parseMoscowDateInput(value, endOfDay);
}

function toDateInputValue(value: string) {
  return value;
}

function getPayoutStatusLabel(status: string) {
  if (status === "paid") {
    return "Выплачено";
  }

  if (status === "planned") {
    return "Запланировано";
  }

  return "Не выплачено";
}

function getPayoutStatusClassName(status: string) {
  if (status === "paid") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "planned") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
}

export default async function AdminCommissionsPage({
  searchParams,
}: CommissionsPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const sellerId = getParam(params, "sellerId");
  const status = getParam(params, "status");
  const payoutStatus = getParam(params, "payoutStatus");
  const dateFromValue = getParam(params, "dateFrom");
  const dateToValue = getParam(params, "dateTo");
  const dateFrom = getDateParam(dateFromValue);
  const dateTo = getDateParam(dateToValue, true);

  const sellersList = await db
    .select({
      id: sellers.id,
      name: sellers.name,
    })
    .from(sellers)
    .orderBy(sellers.name);

  const conditions = [
    inArray(orders.status, orderStatusOptions),
    sellerId ? eq(orderItems.sellerId, sellerId) : undefined,
    orderStatusOptions.includes(status as (typeof orderStatusOptions)[number])
      ? eq(orders.status, status as (typeof orderStatusOptions)[number])
      : undefined,
    dateFrom ? gte(orders.createdAt, dateFrom) : undefined,
    dateTo ? lte(orders.createdAt, dateTo) : undefined,
  ].filter((condition) => Boolean(condition));

  const [rows, paymentRows] = await Promise.all([
    db
      .select({
        itemId: orderItems.id,
        orderId: orders.id,
        orderNumber: orders.number,
        orderStatus: orders.status,
        orderCreatedAt: orders.createdAt,
        sellerId: sellers.id,
        sellerName: sellers.name,
        productName: orderItems.productNameSnapshot,
        sku: orderItems.skuSnapshot,
        lineTotal: orderItems.lineTotal,
        storedCommissionAmount: orderItems.commissionAmount,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(sellers, eq(sellers.id, orderItems.sellerId))
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(500),
    db
      .select({
        id: paymentsToSeller.id,
        sellerId: paymentsToSeller.sellerId,
        periodFrom: paymentsToSeller.periodFrom,
        periodTo: paymentsToSeller.periodTo,
        paidAt: paymentsToSeller.paidAt,
      })
      .from(paymentsToSeller),
  ]);

  const reportRows = rows.map((row) => {
    const coveringPayment = paymentRows.find(
      (payment) =>
        payment.sellerId === row.sellerId &&
        payment.periodFrom <= row.orderCreatedAt &&
        payment.periodTo >= row.orderCreatedAt,
    );
    const rowPayoutStatus = coveringPayment
      ? coveringPayment.paidAt
        ? "paid"
        : "planned"
      : "unpaid";
    const amount = Number(row.lineTotal);
    const storedCommissionAmount = Number(row.storedCommissionAmount);

    return {
      ...row,
      payoutStatus: rowPayoutStatus,
      commissionAmount:
        Number.isFinite(storedCommissionAmount) && storedCommissionAmount > 0
          ? storedCommissionAmount
          : Math.round(amount * 0.05 * 100) / 100,
    };
  });
  const filteredRows = payoutStatusOptions.includes(
    payoutStatus as (typeof payoutStatusOptions)[number],
  )
    ? reportRows.filter((row) => row.payoutStatus === payoutStatus)
    : reportRows;
  const totalSales = filteredRows.reduce(
    (sum, row) => sum + Number(row.lineTotal),
    0,
  );
  const totalCommission = filteredRows.reduce(
    (sum, row) => sum + row.commissionAmount,
    0,
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
          <span>Комиссии</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Отчет по комиссиям
            </h1>
            <p className="mt-2 text-slate-600">
              5% от суммы оплаченных и выданных позиций с НДС.
            </p>
          </div>
          <div className="rounded-xl bg-white px-5 py-4 text-right shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">Комиссия</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatCurrency(totalCommission)}
            </p>
          </div>
        </div>

        <form className="mt-5 overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid min-w-[900px] gap-2 lg:grid-cols-[minmax(180px,1fr)_150px_140px_140px_140px_auto]">
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              Продавец
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold"
                name="sellerId"
                defaultValue={sellerId}
              >
                <option value="">Все продавцы</option>
                {sellersList.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              Статус заказа
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold"
                name="status"
                defaultValue={status}
              >
                <option value="">Оплачен + выдан</option>
                {orderStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {getOrderStatusLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              Статус выплаты
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold"
                name="payoutStatus"
                defaultValue={payoutStatus}
              >
                <option value="">Все</option>
                {payoutStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {getPayoutStatusLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              С даты
              <input
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold"
                name="dateFrom"
                type="date"
                defaultValue={toDateInputValue(dateFromValue)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              По дату
              <input
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold"
                name="dateTo"
                type="date"
                defaultValue={toDateInputValue(dateToValue)}
              />
            </label>
            <div className="flex items-end">
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1157ff] px-3 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
                <Check size={16} />
                Применить
              </button>
            </div>
          </div>
        </form>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">Позиций</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {filteredRows.length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">Сумма с НДС</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatCurrency(totalSales)}
            </p>
          </div>
          <Link
            className="flex items-center justify-between rounded-xl bg-slate-900 p-5 text-white shadow-sm transition hover:bg-slate-800"
            href="/admin/orders/export"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-300">
                Детализация
              </span>
              <span className="mt-1 block text-lg font-black">
                Экспорт заказов
              </span>
            </span>
            <Download size={22} />
          </Link>
        </section>

        <section className="mt-5 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Заказ</th>
                <th className="px-5 py-4">Продавец</th>
                <th className="px-5 py-4">Позиция</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Выплата</th>
                <th className="px-5 py-4 text-right">Сумма</th>
                <th className="px-5 py-4 text-right">Комиссия 5%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={7}>
                    Нет позиций для выбранных фильтров.
                  </td>
                </tr>
              ) : null}
              {filteredRows.map((row) => (
                <tr className="align-top hover:bg-slate-50" key={row.itemId}>
                  <td className="px-5 py-4">
                    <Link
                      className="font-black text-[#1157ff]"
                      href={withAdminBreadcrumbSource(
                        `/admin/orders/${row.orderId}`,
                        "commissions",
                      )}
                    >
                      {row.orderNumber}
                    </Link>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {formatDateTime(row.orderCreatedAt)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      className="font-black text-[#1157ff]"
                      href={withAdminBreadcrumbSource(
                        `/admin/sellers/${row.sellerId}`,
                        "commissions",
                      )}
                    >
                      {row.sellerName}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-black text-slate-950">
                      {row.productName}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {row.sku}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusBadge status={row.orderStatus} />
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getPayoutStatusClassName(row.payoutStatus)}`}
                    >
                      {getPayoutStatusLabel(row.payoutStatus)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-black">
                    {formatCurrency(row.lineTotal)}
                  </td>
                  <td className="px-5 py-4 text-right font-black">
                    {formatCurrency(row.commissionAmount)}
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
