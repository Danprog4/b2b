import { asc, count, desc, isNotNull, sql } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { orderItems, products, sellers } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function getSellerStatusLabel(status: string) {
  return status === "active" ? "Активен" : "Неактивен";
}

export default async function AdminSellersPage() {
  await requireUser(["admin"]);

  const [sellerRows, productStats, orderStats] = await Promise.all([
    db
      .select()
      .from(sellers)
      .orderBy(desc(sellers.updatedAt), asc(sellers.name)),
    db
      .select({
        sellerId: products.sellerId,
        productCount: count(products.id),
      })
      .from(products)
      .where(isNotNull(products.sellerId))
      .groupBy(products.sellerId),
    db
      .select({
        sellerId: orderItems.sellerId,
        orderCount: sql<number>`count(distinct ${orderItems.orderId})`,
        commissionAmount: sql<string>`coalesce(sum(${orderItems.commissionAmount}), 0)`,
      })
      .from(orderItems)
      .where(isNotNull(orderItems.sellerId))
      .groupBy(orderItems.sellerId),
  ]);

  const productsBySeller = new Map(
    productStats.map((row) => [row.sellerId, row.productCount]),
  );
  const ordersBySeller = new Map(orderStats.map((row) => [row.sellerId, row]));

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
          <span>Продавцы</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
              ← Админ-панель
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Продавцы
            </h1>
            <p className="mt-2 text-slate-600">
              Юридические лица поставщиков, ставки комиссии и связь с товарами.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
            href="/admin/sellers/new"
          >
            <Plus size={18} />
            Добавить продавца
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Продавец</th>
                <th className="px-5 py-4">Контакты</th>
                <th className="px-5 py-4">Комиссия</th>
                <th className="px-5 py-4">Товары</th>
                <th className="px-5 py-4">Заказы</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Обновлен</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sellerRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                    Продавцов пока нет.
                  </td>
                </tr>
              ) : null}
              {sellerRows.map((seller) => {
                const orderStat = ordersBySeller.get(seller.id);

                return (
                  <tr key={seller.id} className="align-top hover:bg-slate-50">
                    <td className="p-0">
                      <Link
                        className="flex gap-3 px-5 py-4"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1157ff]">
                          <Building2 size={22} />
                        </span>
                        <span>
                          <span className="block font-black text-[#1157ff]">
                            {seller.name}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            ИНН {seller.inn}
                            {seller.kpp ? ` · КПП ${seller.kpp}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        <span className="block font-bold text-slate-950">
                          {seller.contactName ?? "Контакт не указан"}
                        </span>
                        <span className="mt-1 block">
                          {seller.email ?? seller.phone ?? "Нет email/телефона"}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-black"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        {Number(seller.commissionRate).toFixed(2)}%
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 font-bold"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        {productsBySeller.get(seller.id) ?? 0}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        <span className="block font-bold text-slate-950">
                          {orderStat?.orderCount ?? 0}
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {formatCurrency(orderStat?.commissionAmount ?? "0")}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            seller.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {getSellerStatusLabel(seller.status)}
                        </span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        className="block px-5 py-4 text-slate-600"
                        href={`/admin/sellers/${seller.id}`}
                      >
                        {formatDateTime(seller.updatedAt)}
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
