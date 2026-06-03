import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { emailOutbox, invoices, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

function statusLabel(status: string) {
  if (status === "queued") {
    return "В очереди";
  }

  if (status === "sent") {
    return "Отправлено";
  }

  if (status === "failed") {
    return "Ошибка";
  }

  return status;
}

export default async function AdminEmailOutboxPage() {
  await requireUser(["admin"]);

  const emails = await db
    .select({
      id: emailOutbox.id,
      toEmail: emailOutbox.toEmail,
      subject: emailOutbox.subject,
      status: emailOutbox.status,
      attempts: emailOutbox.attempts,
      lastError: emailOutbox.lastError,
      createdAt: emailOutbox.createdAt,
      sentAt: emailOutbox.sentAt,
      orderNumber: orders.number,
      invoiceNumber: invoices.number,
    })
    .from(emailOutbox)
    .leftJoin(orders, eq(emailOutbox.orderId, orders.id))
    .leftJoin(invoices, eq(emailOutbox.invoiceId, invoices.id))
    .orderBy(desc(emailOutbox.createdAt));

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
          <span>Email-очередь</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
          ← Админ-панель
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          Email-очередь
        </h1>
        <p className="mt-2 text-slate-600">
          Пока без SMTP: письма со счетами ставятся в очередь, чтобы событие
          было видно и не терялось.
        </p>

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Получатель</th>
                <th className="px-5 py-4">Тема</th>
                <th className="px-5 py-4">Заказ / счет</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Создано</th>
                <th className="px-5 py-4">Ошибка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {emails.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Писем пока нет.
                  </td>
                </tr>
              ) : null}
              {emails.map((email) => (
                <tr key={email.id} className="align-top">
                  <td className="px-5 py-4 font-bold text-slate-950">
                    {email.toEmail}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{email.subject}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {email.orderNumber ?? "—"} / {email.invoiceNumber ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {statusLabel(email.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDateTime(email.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {email.lastError ?? "—"}
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
