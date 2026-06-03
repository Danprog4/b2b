import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentBuyerOrder } from "@/lib/orders/queries";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type CheckoutSuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const params = (await searchParams) ?? {};
  const orderId = typeof params.orderId === "string" ? params.orderId : "";

  if (!orderId) {
    redirect("/account/orders");
  }

  const order = await getCurrentBuyerOrder(orderId);

  if (!order) {
    redirect("/account/orders");
  }

  const invoiceReady = order.invoiceStatus === "generated";
  const invoiceFailed = order.invoiceStatus === "failed";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/cart">
            Корзина
          </Link>
          <span>/</span>
          <span>Заказ оформлен</span>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                {invoiceFailed ? (
                  <AlertTriangle className="text-amber-600" size={34} />
                ) : (
                  <CheckCircle2 className="text-emerald-600" size={34} />
                )}
                <h1 className="text-3xl font-black text-slate-950">
                  Заказ оформлен
                </h1>
              </div>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                {invoiceReady
                  ? `Заказ ${order.number} создан, счет на оплату сформирован и доступен в личном кабинете. Письмо со счетом поставлено в очередь на отправку.`
                  : invoiceFailed
                    ? `Заказ ${order.number} создан, но счет не удалось сформировать автоматически. Администратор увидит ошибку и сможет сформировать счет повторно.`
                    : `Заказ ${order.number} создан, счет на оплату формируется и появится в личном кабинете после готовности.`}
              </p>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {getOrderStatusLabel(order.status)}
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Дата</p>
              <p className="mt-2 font-black text-slate-950">
                {formatDateTime(order.createdAt)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Компания</p>
              <p className="mt-2 font-black text-slate-950">{order.companyName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                ИНН {order.companyInn}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Итого с НДС</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatCurrency(order.totalAmount)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                В том числе НДС {formatCurrency(order.vatAmount)}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-5 font-bold text-white transition hover:bg-[#0b49e0]"
              href={`/account/orders/${order.id}`}
            >
              <FileText size={18} />
              Открыть заказ
            </Link>
            {invoiceReady ? (
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 font-bold text-[#1157ff] ring-1 ring-slate-200 transition hover:ring-[#1157ff]"
                href={`/account/orders/${order.id}/invoice`}
                target="_blank"
              >
                <Download size={18} />
                Скачать счет
              </Link>
            ) : null}
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-100 px-5 font-bold text-slate-700 transition hover:bg-slate-200"
              href="/catalog"
            >
              <ShoppingCart size={18} />
              Вернуться в каталог
            </Link>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <PackageCheck className="text-[#1157ff]" size={22} />
            <h2 className="text-xl font-black text-slate-950">
              Состав заказа
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <article
                className="grid gap-3 p-5 md:grid-cols-[1fr_auto]"
                key={item.id}
              >
                <div>
                  <h3 className="font-black text-slate-950">{item.productName}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.sku} · {Number(item.quantity)} × {item.unit}
                  </p>
                </div>
                <div className="font-black text-slate-950">
                  {formatCurrency(item.lineTotal)}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
