import { and, desc, eq, or } from "drizzle-orm";
import { Bell } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { notifications, orderItems, orders, products } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function SellerNotificationsPage() {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    return null;
  }

  const [items, orderRows, productRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        or(
          eq(notifications.sellerId, user.sellerId),
          eq(notifications.userId, user.id),
        ),
      )
      .orderBy(desc(notifications.createdAt)),
    db
      .select({
        id: orders.id,
        number: orders.number,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orderItems.sellerId, user.sellerId))
      .groupBy(orders.id),
    db
      .select({
        id: products.id,
        name: products.name,
      })
      .from(products)
      .where(eq(products.sellerId, user.sellerId)),
  ]);

  const unreadCount = items.filter((item) => !item.isRead).length;

  if (unreadCount > 0) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          or(
            eq(notifications.sellerId, user.sellerId),
            eq(notifications.userId, user.id),
          ),
          eq(notifications.isRead, false),
        ),
      );
  }

  const getNotificationHref = (item: { title: string; body: string | null }) => {
    const text = `${item.title} ${item.body ?? ""}`;
    const orderNumber = text.match(/ORD-\d+/)?.[0];
    const order = orderNumber
      ? orderRows.find((row) => row.number === orderNumber)
      : null;

    if (order) {
      return `/seller/orders/${order.id}`;
    }

    const product = productRows.find((row) => text.includes(row.name));

    return product ? `/seller/products/${product.id}` : null;
  };

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <span>Уведомления</span>
        </div>

        <Link href="/seller" className="text-sm font-bold text-[#1157ff]">
          ← В кабинет продавца
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          Уведомления
        </h1>

        {items.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
            <div>
              <Bell className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Уведомлений пока нет
              </h2>
            </div>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const href = getNotificationHref(item);
                const content = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-950">
                          {item.title}
                        </h2>
                        {item.body ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {item.body}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                        {item.isRead ? "Прочитано" : "Новое"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>{formatDateTime(item.createdAt)}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                        {item.type}
                      </span>
                    </div>
                  </>
                );

                return href ? (
                  <Link
                    className="block p-5 transition hover:bg-blue-50/40"
                    href={href}
                    key={item.id}
                  >
                    {content}
                  </Link>
                ) : (
                  <article className="p-5" key={item.id}>
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
