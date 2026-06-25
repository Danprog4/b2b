import { count, desc, eq, sql } from "drizzle-orm";
import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withSellerBreadcrumbSource } from "@/lib/seller/breadcrumbs";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function SellerOrdersPage() {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    notFound();
  }

  const orderRows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      createdAt: orders.createdAt,
      itemCount: count(orderItems.id),
      sellerAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orderItems.sellerId, user.sellerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  const totalAmount = orderRows.reduce(
    (sum, order) => sum + Number(order.sellerAmount),
    0,
  );

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <span>Заказы</span>
        </div>

        <Link href="/seller" className="text-sm font-bold text-[#1157ff]">
          ← В кабинет продавца
        </Link>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <ReceiptText className="text-[#1157ff]" size={28} />
                <h1 className="text-3xl font-black text-slate-950">Заказы</h1>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Все заказы, где есть товары вашей компании.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-950">
                {formatCurrency(totalAmount)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {orderRows.length} заказов
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3">
          {orderRows.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-500">
              Заказов с товарами продавца пока нет.
            </div>
          ) : null}

          {orderRows.map((order) => {
            const amount = Number(order.sellerAmount);

            return (
              <Link
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1157ff] hover:bg-blue-50/30"
                href={withSellerBreadcrumbSource(
                  `/seller/orders/${order.id}`,
                  "orders",
                )}
                key={order.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">
                      {order.number}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-500">
                        {formatDateTime(order.createdAt)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-950">
                      {formatCurrency(amount)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {Number(order.itemCount)} поз.
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                  К выплате: {formatCurrency(amount)}
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
