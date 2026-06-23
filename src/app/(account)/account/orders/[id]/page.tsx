import { Clock3, Download, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getCurrentBuyerOrderCompanyContract,
  getCurrentBuyerOrderDocuments,
} from "@/lib/documents/queries";
import { formatFileSize, getDocumentTypeLabel } from "@/lib/documents/types";
import { getOrderStatusLabel } from "@/lib/orders/status";
import {
  getCurrentBuyerOrder,
  getCurrentBuyerOrderStatusHistory,
} from "@/lib/orders/queries";
import { repeatOrderAction } from "@/lib/orders/actions";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { OrderLineCard } from "@/components/orders/order-line-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { markCurrentBuyerOrderViewed } from "@/lib/orders/view-actions";
import { CancelOrderForm } from "./cancel-order-form";
import { EditOrderButton } from "./edit-order-button";

type OrderPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountOrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const created = search.created === "1";
  const editError = search.editError === "status";
  const cancelled = search.cancelled === "1";
  const cancelError = search.cancelError === "status";
  const order = await getCurrentBuyerOrder(id);

  if (!order) {
    notFound();
  }

  await markCurrentBuyerOrderViewed(order.id);

  const [orderDocuments, companyContract, statusHistory] = await Promise.all([
    getCurrentBuyerOrderDocuments(order.id),
    getCurrentBuyerOrderCompanyContract(order.id),
    getCurrentBuyerOrderStatusHistory(order.id),
  ]);

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
          <Link className="text-[#1157ff]" href="/account/orders">
            Заказы
          </Link>
          <span>/</span>
          <span>{order.number}</span>
        </div>

        <Link href="/account/orders" className="text-sm font-bold text-[#1157ff]">
          ← Все заказы
        </Link>

        <ToastMessages
          items={[
            ...(created
              ? [
                  {
                    message: "Заказ создан, счет сформирован и заказ ожидает оплаты.",
                  },
                ]
              : []),
            ...(editError
              ? [
                  {
                    message:
                      "Этот заказ нельзя переоформить: он уже выдан или отменен.",
                    tone: "warning" as const,
                  },
                ]
              : []),
            ...(cancelled ? [{ message: "Заказ отменен." }] : []),
            ...(cancelError
              ? [
                  {
                    message: "Отменить можно только заказ в статусе «Принят».",
                    tone: "warning" as const,
                  },
                ]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <FileText className="text-[#1157ff]" size={28} />
                <h1 className="text-3xl font-black text-slate-950">
                  {order.number}
                </h1>
              </div>
              <p className="mt-2 text-slate-500">
                {formatDateTime(order.createdAt)} · {order.companyName}, ИНН{" "}
                {order.companyInn}
              </p>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {getOrderStatusLabel(order.status)}
            </span>
          </div>

          {order.comment ? (
            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              <span className="font-bold">Комментарий: </span>
              {order.comment}
            </div>
          ) : null}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="self-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <OrderLineCard
                  key={item.id}
                  title={item.productName}
                  sku={item.sku}
                  unit={item.unit}
                  quantity={Number(item.quantity)}
                  priceWithVat={item.priceWithVat}
                  lineTotal={item.lineTotal}
                  vatRate={item.vatRate}
                  vatAmount={item.vatAmount}
                  imageUrl={item.mainImageUrl}
                />
              ))}
            </div>
          </section>

          <aside className="self-start rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-xl font-black text-slate-950">Итого</h2>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Сумма с НДС</span>
                <span className="font-black">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">НДС в сумме</span>
                <span className="font-bold">{formatCurrency(order.vatAmount)}</span>
              </div>
            </div>
            {order.invoiceStatus === "generated" ? (
              <Link
                className="mt-5 flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
                href={`/account/orders/${order.id}/invoice`}
                target="_blank"
              >
                <Download size={18} />
                Скачать счет
              </Link>
            ) : (
              <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {order.invoiceStatus === "failed"
                  ? "Счет не удалось сформировать автоматически. Администратор сформирует его повторно."
                  : "Счет на оплату еще формируется."}
              </div>
            )}
            {order.invoiceNumber ? (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Счет: {order.invoiceNumber}
              </p>
            ) : null}
            {order.invoiceStatus === "generated" ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                Письмо со счетом поставлено в очередь на отправку.
              </p>
            ) : null}
            {order.status === "accepted" ? (
              <EditOrderButton orderId={order.id} />
            ) : null}
            {order.status === "accepted" ? (
              <CancelOrderForm orderId={order.id} orderNumber={order.number} />
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                Покупатель может отменить заказ только до оплаты, пока он в
                статусе «Принят».
              </p>
            )}
            <form action={repeatOrderAction} className="mt-5">
              <input name="orderId" type="hidden" value={order.id} />
              <SubmitButton
                className="h-12 w-full rounded-lg bg-slate-100 font-bold text-slate-700 transition hover:bg-slate-200"
                pendingText="Добавляем в корзину"
              >
                Повторить заказ
              </SubmitButton>
            </form>
          </aside>
        </div>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <Clock3 className="text-[#1157ff]" size={22} />
            <h2 className="text-2xl font-black text-slate-950">
              История статуса
            </h2>
          </div>

          <div className="mt-5 grid gap-3">
            {statusHistory.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <h3 className="font-black text-slate-950">{entry.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                  {entry.statusLabel}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <Paperclip className="text-[#1157ff]" size={22} />
            <h2 className="text-2xl font-black text-slate-950">
              Документы по заказу
            </h2>
          </div>

          <div className="mt-5 grid gap-3">
            {orderDocuments.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                Документы по этому заказу еще не загружены.
              </div>
            ) : (
              orderDocuments.map((document) => (
                <article
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <h3 className="font-black text-slate-950">{document.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {getDocumentTypeLabel(document.type)} ·{" "}
                      {formatFileSize(document.sizeBytes)} ·{" "}
                      {formatDateTime(document.uploadedAt)}
                    </p>
                  </div>
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                    href={`/documents/${document.versionId}/download`}
                  >
                    <Download size={16} />
                    Скачать
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="text-[#1157ff]" size={22} />
            <h2 className="text-2xl font-black text-slate-950">
              Договор компании
            </h2>
          </div>

          <div className="mt-5">
            {companyContract ? (
              <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <h3 className="font-black text-slate-950">
                    {companyContract.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {getDocumentTypeLabel(companyContract.type)} ·{" "}
                    {formatFileSize(companyContract.sizeBytes)} ·{" "}
                    {formatDateTime(companyContract.uploadedAt)}
                  </p>
                </div>
                <Link
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  href={`/documents/${companyContract.versionId}/download`}
                >
                  <Download size={16} />
                  Скачать
                </Link>
              </article>
            ) : (
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                Договор компании пока не загружен.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
