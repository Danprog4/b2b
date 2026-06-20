import { and, desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { chats, notifications, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function AdminNotificationsPage() {
  const user = await requireUser(["admin"]);
  const items = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      buyerCompanyId: notifications.buyerCompanyId,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt));
  const orderRows = await db
    .select({
      id: orders.id,
      number: orders.number,
    })
    .from(orders);
  const chatRows = await db
    .select({
      id: chats.id,
      buyerCompanyId: chats.buyerCompanyId,
    })
    .from(chats);
  const getNotificationHref = (item: {
    title: string;
    body: string | null;
    type: string;
    buyerCompanyId: string | null;
  }) => {
    const text = `${item.title} ${item.body ?? ""}`;
    const orderNumber = text.match(/ORD-\d+/)?.[0];
    const order = orderNumber
      ? orderRows.find((row) => row.number === orderNumber)
      : null;

    if (order) {
      return `/admin/orders/${order.id}`;
    }

    if (item.type.includes("chat")) {
      const chat = item.buyerCompanyId
        ? chatRows.find((row) => row.buyerCompanyId === item.buyerCompanyId)
        : null;

      return chat ? `/admin/chats/${chat.id}` : "/admin/chats";
    }

    if (item.type === "seller_product_deleted") {
      return "/admin/products";
    }

    if (item.type.includes("product")) {
      return "/admin/products/moderation";
    }

    if (item.type.includes("document")) {
      return "/admin/documents";
    }

    if (item.type.includes("company_join")) {
      return "/admin/company-join-requests";
    }

    return null;
  };
  const unreadCount = items.filter((item) => !item.isRead).length;

  if (unreadCount > 0) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  }

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
          <span>Уведомления</span>
        </div>

        <Link href="/admin" className="text-sm font-bold text-[#1157ff]">
          ← В админ-панель
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          Уведомления
        </h1>

        {items.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div>
              <Bell className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Уведомлений пока нет
              </h2>
            </div>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
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
                    <p className="mt-3 text-sm text-slate-500">
                      {formatDateTime(item.createdAt)}
                    </p>
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
                  <article key={item.id} className="p-5">
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
