import { FileText, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { repeatOrderAction } from "@/lib/orders/actions";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { getCurrentBuyerOrders } from "@/lib/orders/queries";
import { formatCurrency, formatDateTime } from "@/lib/utils";

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

export default async function AccountOrdersPage() {
  const orders = await getCurrentBuyerOrders();

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/account">
            Личный кабинет
          </Link>
          <span>/</span>
          <span>Заказы</span>
        </div>

        <Link href="/account" className="text-sm font-bold text-[#1157ff]">
          ← Личный кабинет
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Заказы</h1>

        {orders.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
            <div>
              <ShoppingCart className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Заказов пока нет
              </h2>
              <Link
                className="mt-6 inline-flex rounded-lg bg-[#1157ff] px-5 py-3 font-bold text-white"
                href="/catalog"
              >
                Перейти в каталог
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_220px_160px]"
                >
                  <Link href={`/account/orders/${order.id}`} className="block">
                    <div className="flex items-center gap-3">
                      <FileText className="text-[#1157ff]" size={22} />
                      <h2 className="text-lg font-black text-slate-950">
                        {order.number}
                      </h2>
                      {order.isNew ? (
                        <span className="rounded-full bg-[#1157ff] px-2.5 py-1 text-xs font-black text-white">
                          Не просмотрен
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatDateTime(order.createdAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DocumentFlag active={order.hasInvoice} label="Счет" />
                      <DocumentFlag active={order.hasContract} label="Договор" />
                      <DocumentFlag active={order.hasUpd} label="УПД" />
                      <DocumentFlag active={order.hasSpecification} label="Спец." />
                      <DocumentFlag active={order.hasAct} label="Акт" />
                    </div>
                  </Link>
                  <div className="grid gap-2 text-sm">
                    <span className="w-fit rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-800">
                      {getOrderStatusLabel(order.status)}
                    </span>
                    <span className="text-slate-500">
                      Товаров:{" "}
                      <span className="font-bold text-slate-700">
                        {order.itemCount}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      НДС:{" "}
                      <span className="font-bold text-slate-700">
                        {formatCurrency(order.vatAmount)}
                      </span>
                    </span>
                  </div>
                  <div className="grid gap-3 lg:justify-items-end">
                    <div className="text-xl font-black">
                      {formatCurrency(order.totalAmount)}
                    </div>
                    <form action={repeatOrderAction}>
                      <input name="orderId" type="hidden" value={order.id} />
                      <SubmitButton
                        className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                        pendingText="Добавляем"
                      >
                        Повторить заказ
                      </SubmitButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
