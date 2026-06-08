import { and, eq } from "drizzle-orm";
import {
  AlertTriangle,
  Clock3,
  Download,
  FileText,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderLineCard } from "@/components/orders/order-line-card";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import {
  buyerCompanies,
  emailOutbox,
  files,
  invoices,
  orderItems,
  orders,
  products,
  sellerOffers,
  sellers,
  users,
} from "@/db/schema";
import {
  addOrderItemAction,
  regenerateInvoiceAction,
  removeOrderItemAction,
  updateOrderItemQuantityAction,
  updateOrderStatusAction,
} from "@/lib/admin/order-actions";
import { requireUser } from "@/lib/auth/session";
import {
  uploadOrderDocumentAction,
  uploadOrderDocumentVersionAction,
} from "@/lib/documents/actions";
import { getAdminOrderDocuments } from "@/lib/documents/queries";
import {
  getDocumentTypeLabel,
  orderDocumentTypes,
} from "@/lib/documents/types";
import { getPublicFileUrl } from "@/lib/files/urls";
import {
  canTransitionOrderStatus,
  getOrderStatusLabel,
} from "@/lib/orders/status";
import { getAdminOrderStatusHistory } from "@/lib/orders/queries";
import { markAdminOrderViewed } from "@/lib/orders/view-actions";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type AdminOrderPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions = [
  "accepted",
  "paid",
  "issued",
  "cancelled",
] as const;

export default async function AdminOrderPage({
  params,
  searchParams,
}: AdminOrderPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const documentUploaded = search.documentUploaded === "1";
  const invoiceRegenerated = search.invoiceRegenerated === "1";
  const invoiceError = search.invoiceError === "1";
  const orderEdited = search.orderEdited === "1";
  const statusError = search.statusError === "1";
  const orderEditError =
    typeof search.orderEditError === "string" ? search.orderEditError : null;
  const documentError =
    !documentUploaded && typeof search.documentError === "string"
      ? search.documentError
      : null;

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalAmount: orders.totalAmount,
      vatAmount: orders.vatAmount,
      comment: orders.comment,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      companyAddress: buyerCompanies.legalAddress,
      userEmail: users.email,
      userName: users.name,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
      invoiceErrorMessage: invoices.errorMessage,
      invoiceGeneratedAt: invoices.generatedAt,
      emailStatus: emailOutbox.status,
      emailAttempts: emailOutbox.attempts,
      emailLastError: emailOutbox.lastError,
      emailSentAt: emailOutbox.sentAt,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(orders.buyerCompanyId, buyerCompanies.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(
      invoices,
      and(eq(invoices.orderId, orders.id), eq(invoices.isCurrent, true)),
    )
    .leftJoin(emailOutbox, eq(emailOutbox.invoiceId, invoices.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }
  const availableStatusOptions = statusOptions.filter((status) =>
    canTransitionOrderStatus(order.status, status),
  );

  await markAdminOrderViewed(order.id);

  const [items, orderDocuments, statusHistory, offerOptions] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        sellerOfferId: orderItems.sellerOfferId,
        productName: orderItems.productNameSnapshot,
        sku: orderItems.skuSnapshot,
        unit: orderItems.unitSnapshot,
        quantity: orderItems.quantity,
        priceWithVat: orderItems.priceWithVat,
        vatRate: orderItems.vatRate,
        vatAmount: orderItems.vatAmount,
        lineTotal: orderItems.lineTotal,
        commissionAmount: orderItems.commissionAmount,
        sellerId: orderItems.sellerId,
        sellerName: sellers.name,
        mainImageFileId: files.id,
        mainImageStorageKey: files.storageKey,
        mainImageIsActive: files.isActive,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(files, eq(files.id, products.mainImageFileId))
      .leftJoin(sellers, eq(sellers.id, orderItems.sellerId))
      .where(eq(orderItems.orderId, order.id)),
    getAdminOrderDocuments(order.id),
    getAdminOrderStatusHistory(order.id),
    order.status === "accepted"
      ? db
          .select({
            id: sellerOffers.id,
            productName: products.name,
            sku: products.sku,
            unit: products.unit,
            priceWithVat: sellerOffers.priceWithVat,
            vatRate: sellerOffers.vatRate,
            sellerName: sellers.name,
          })
          .from(sellerOffers)
          .innerJoin(products, eq(products.id, sellerOffers.productId))
          .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
          .where(
            and(
              eq(sellerOffers.status, "published"),
              eq(products.isActive, true),
            ),
          )
          .orderBy(products.name, sellers.name)
          .limit(1000)
      : Promise.resolve([]),
  ]);
  const commissionBySeller = Array.from(
    items
      .reduce(
        (map, item) => {
          const key = item.sellerId ?? "no-seller";
          const current = map.get(key) ?? {
            sellerId: item.sellerId,
            sellerName: item.sellerName ?? "Без продавца",
            amount: 0,
            commission: 0,
            itemCount: 0,
          };
          current.amount += Number(item.lineTotal);
          current.commission += Number(item.commissionAmount);
          current.itemCount += 1;
          map.set(key, current);
          return map;
        },
        new Map<
          string,
          {
            sellerId: string | null;
            sellerName: string;
            amount: number;
            commission: number;
            itemCount: number;
          }
        >(),
      )
      .values(),
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
          <Link className="text-[#1157ff]" href="/admin/orders">
            Заказы
          </Link>
          <span>/</span>
          <span>{order.number}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/orders">
          ← Все заказы
        </Link>

        {documentUploaded ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Документ сохранен.
          </div>
        ) : null}

        {documentError ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {documentError}
          </div>
        ) : null}

        {invoiceRegenerated ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Счет повторно сформирован.
          </div>
        ) : null}

        {invoiceError ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            Не удалось сформировать счет. Детали ошибки показаны в технических
            состояниях.
          </div>
        ) : null}

        {orderEdited ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Состав заказа обновлен. Актуальный счет сформирован заново.
          </div>
        ) : null}

        {statusError ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            Этот переход статуса недоступен для текущего заказа.
          </div>
        ) : null}

        {orderEditError ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {getOrderEditErrorLabel(orderEditError)}
          </div>
        ) : null}

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Обновлен: {formatDateTime(order.updatedAt)}
            </p>
          </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {getOrderStatusLabel(order.status)}
            </span>
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-5">
            <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
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
                    imageUrl={
                      item.mainImageIsActive
                        ? getPublicFileUrl({
                            id: item.mainImageFileId,
                            storageKey: item.mainImageStorageKey,
                          })
                        : null
                    }
                    meta={
                      <>
                        Продавец:{" "}
                        {item.sellerId ? (
                          <Link
                            className="text-[#1157ff]"
                            href={`/admin/sellers/${item.sellerId}`}
                          >
                            {item.sellerName ?? "Не указан"}
                          </Link>
                        ) : (
                          "Не указан"
                        )}
                        <span className="mt-2 block text-slate-500">
                          Комиссия: {formatCurrency(item.commissionAmount)}
                        </span>
                      </>
                    }
                    actions={
                      order.status === "accepted" ? (
                        <div className="mt-4 grid gap-2">
                          <form
                            action={updateOrderItemQuantityAction}
                            className="flex justify-end gap-2"
                          >
                            <input name="orderId" type="hidden" value={order.id} />
                            <input name="itemId" type="hidden" value={item.id} />
                            <input
                              className="h-10 w-24 rounded-lg border border-slate-200 px-3 text-right text-sm font-bold"
                              min="1"
                              name="quantity"
                              step="1"
                              type="number"
                              defaultValue={Number(item.quantity)}
                            />
                            <SubmitButton
                              className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800"
                              pendingText="..."
                            >
                              OK
                            </SubmitButton>
                          </form>
                          <form action={removeOrderItemAction}>
                            <input name="orderId" type="hidden" value={order.id} />
                            <input name="itemId" type="hidden" value={item.id} />
                            <SubmitButton
                              className="ml-auto h-10 rounded-lg bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                              pendingText="..."
                            >
                              <Trash2 size={15} />
                              Удалить
                            </SubmitButton>
                          </form>
                        </div>
                      ) : null
                    }
                  />
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Редактирование состава
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Доступно только для заказа в статусе «Принят». После изменения
                    автоматически формируется новый актуальный счет.
                  </p>
                </div>
              </div>
              {order.status === "accepted" ? (
                <form
                  action={addOrderItemAction}
                  className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_140px_auto]"
                >
                  <input name="orderId" type="hidden" value={order.id} />
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Опубликованное предложение
                    <select
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                      name="sellerOfferId"
                      required
                    >
                      <option value="">Выберите позицию</option>
                      {offerOptions.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.sku} · {offer.productName} · {offer.sellerName} ·{" "}
                          {formatCurrency(offer.priceWithVat)} за {offer.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Количество
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                      min="1"
                      name="quantity"
                      step="1"
                      type="number"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <div className="flex items-end">
                    <SubmitButton
                      className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                      pendingText="Добавляем"
                    >
                      <Plus size={17} />
                      Добавить
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                  Состав можно менять только пока заказ находится в статусе
                  «Принят».
                </div>
              )}
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Документы по заказу
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    УПД, счета-фактуры, договоры и другие файлы по заказу.
                  </p>
                </div>
              </div>

              <form
                action={uploadOrderDocumentAction}
                className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4"
              >
                <input name="orderId" type="hidden" value={order.id} />
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Название
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                      name="title"
                      placeholder="Например, УПД по заказу"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Тип
                    <select
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                      name="type"
                      defaultValue="upd"
                    >
                      {orderDocumentTypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <FileUploadField
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  name="file"
                  required
                />

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Комментарий к файлу
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                      name="comment"
                      placeholder="Необязательно"
                    />
                  </label>
                  <div className="flex items-end">
                    <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700">
                      <input
                        className="size-4"
                        name="isVisibleToBuyer"
                        type="checkbox"
                      />
                      Видно покупателю
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <SubmitButton
                    className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                    pendingText="Сохраняем"
                  >
                    Сохранить
                  </SubmitButton>
                </div>
              </form>

              <div className="mt-5 grid gap-3">
                {orderDocuments.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                    Документы еще не загружены.
                  </div>
                ) : (
                  orderDocuments.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Paperclip className="text-[#1157ff]" size={20} />
                            <h3 className="text-base font-black text-slate-950">
                              {document.title}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            {getDocumentTypeLabel(document.type)} ·{" "}
                            {document.isVisibleToBuyer
                              ? "видно покупателю"
                              : "скрыто от покупателя"}
                          </p>
                        </div>
                        <Link
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                          href={`/documents/${document.versionId}/download`}
                        >
                          <Download size={16} />
                          Скачать
                        </Link>
                      </div>

                      <form
                        action={uploadOrderDocumentVersionAction}
                        className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3"
                      >
                        <input name="orderId" type="hidden" value={order.id} />
                        <input
                          name="documentId"
                          type="hidden"
                          value={document.id}
                        />
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <FileUploadField
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                            name="file"
                            required
                          />
                          <input
                            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                            name="comment"
                            placeholder="Комментарий к файлу"
                          />
                          <SubmitButton
                            className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                            pendingText="Сохраняем"
                          >
                            Сохранить
                          </SubmitButton>
                        </div>
                      </form>

                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="grid gap-5 self-start">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Итого</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Сумма с НДС</span>
                  <span className="font-black">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">НДС в сумме</span>
                  <span className="font-bold">{formatCurrency(order.vatAmount)}</span>
                </div>
              </div>
              {order.invoiceStatus === "generated" ? (
                <Link
                  className="mt-5 flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
                  href={`/admin/orders/${order.id}/invoice`}
                  target="_blank"
                >
                  <Download size={18} />
                  Скачать счет
                </Link>
              ) : null}
              {order.invoiceStatus === "failed" ||
              order.invoiceStatus === "pending" ||
              !order.invoiceNumber ? (
                <form action={regenerateInvoiceAction} className="mt-3">
                  <input name="orderId" type="hidden" value={order.id} />
                  <SubmitButton
                    className="h-11 w-full rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                    pendingText="Формируем"
                  >
                    Сформировать счет повторно
                  </SubmitButton>
                </form>
              ) : null}
              <a
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                href={`/admin/orders/export?q=${encodeURIComponent(order.number)}`}
              >
                <Download size={16} />
                Экспортировать заказ
              </a>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-[#1157ff]" size={20} />
                <h2 className="text-xl font-black text-slate-950">
                  Технические состояния
                </h2>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <TechnicalStateRow
                  label="Счет"
                  status={getInvoiceStatusLabel(order.invoiceStatus)}
                  tone={order.invoiceStatus === "failed" ? "error" : "normal"}
                  details={
                    order.invoiceGeneratedAt
                      ? `Сформирован: ${formatDateTime(order.invoiceGeneratedAt)}`
                      : order.invoiceNumber
                        ? order.invoiceErrorMessage
                          ? `Номер: ${order.invoiceNumber}. Ошибка: ${order.invoiceErrorMessage}`
                          : `Номер: ${order.invoiceNumber}`
                        : "Счет еще не создан"
                  }
                />
                <TechnicalStateRow
                  label="Email со счетом"
                  status={order.emailStatus ? getEmailStatusLabel(order.emailStatus) : "Нет задачи"}
                  tone={order.emailStatus === "failed" ? "error" : "normal"}
                  details={
                    order.emailStatus === "sent" && order.emailSentAt
                      ? `Отправлен: ${formatDateTime(order.emailSentAt)}`
                      : order.emailStatus === "failed"
                        ? order.emailLastError ?? "Ошибка без текста"
                        : order.emailStatus === "queued"
                          ? `В очереди, попыток: ${order.emailAttempts}`
                          : "Email-задача не создана"
                  }
                />
                <TechnicalStateRow
                  label="Документы"
                  status={
                    Number(orderDocuments.length) > 0
                      ? `Загружено: ${orderDocuments.length}`
                      : "Нет документов"
                  }
                  tone="normal"
                  details="Ручные документы по заказу отображаются в основном блоке."
                />
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">
                Комиссия по продавцам
              </h2>
              <div className="mt-5 divide-y divide-slate-100 text-sm">
                {commissionBySeller.map((seller) => (
                  <div
                    className="grid gap-2 py-3 md:grid-cols-[1fr_auto]"
                    key={seller.sellerId ?? "no-seller"}
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {seller.sellerId ? (
                          <Link
                            className="text-[#1157ff]"
                            href={`/admin/sellers/${seller.sellerId}`}
                          >
                            {seller.sellerName}
                          </Link>
                        ) : (
                          seller.sellerName
                        )}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Позиций: {seller.itemCount} · сумма{" "}
                        {formatCurrency(seller.amount)}
                      </p>
                    </div>
                    <div className="font-black text-slate-950">
                      {formatCurrency(seller.commission)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Статус</h2>
              <form action={updateOrderStatusAction} className="mt-5 grid gap-3">
                <input name="orderId" type="hidden" value={order.id} />
                <select
                  className="h-12 rounded-lg border border-slate-200 px-3 font-bold"
                  name="status"
                  defaultValue={order.status}
                >
                  {availableStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {getOrderStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <SubmitButton
                  className="h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
                  pendingText="Сохраняем"
                >
                  Сохранить статус
                </SubmitButton>
              </form>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                Для первой версии используются статусы: «Принят», «Оплачен»,
                «Выдан», «Отменен». УПД, спецификацию и акт загружает администратор.
              </p>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <Clock3 className="text-[#1157ff]" size={20} />
                <h2 className="text-xl font-black text-slate-950">
                  История статуса
                </h2>
              </div>
              <div className="mt-4 grid gap-3">
                {statusHistory.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-950">
                          {entry.title}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatDateTime(entry.createdAt)}
                          {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                        {entry.statusLabel}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Клиент</h2>
              <div className="mt-4 grid gap-2 text-slate-600">
                <p>
                  <span className="font-bold text-slate-950">Контакт:</span>{" "}
                  {order.userName ?? "Без имени"} · {order.userEmail}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Компания:</span>{" "}
                  {order.companyName}, ИНН {order.companyInn}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Адрес:</span>{" "}
                  {order.companyAddress ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Счет:</span>{" "}
                  {order.invoiceNumber ?? "—"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Email:</span>{" "}
                  {order.emailStatus ? getEmailStatusLabel(order.emailStatus) : "—"}
                </p>
              </div>
              {order.comment ? (
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 leading-6 text-slate-700">
                  <span className="font-bold">Комментарий:</span> {order.comment}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function getEmailStatusLabel(status: string) {
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

function getInvoiceStatusLabel(status: string | null) {
  if (status === "pending") {
    return "Формируется";
  }

  if (status === "generated") {
    return "Сформирован";
  }

  if (status === "failed") {
    return "Ошибка формирования";
  }

  return "Нет счета";
}

function getOrderEditErrorLabel(error: string) {
  if (error === "status") {
    return "Состав можно менять только у заказа в статусе «Принят».";
  }

  if (error === "item") {
    return "Позиция заказа не найдена.";
  }

  if (error === "offer") {
    return "Выбранное предложение недоступно для добавления.";
  }

  if (error === "empty") {
    return "В заказе должна остаться хотя бы одна позиция.";
  }

  return "Не удалось изменить состав заказа.";
}

function TechnicalStateRow({
  label,
  status,
  details,
  tone,
}: {
  label: string;
  status: string;
  details: string;
  tone: "normal" | "error";
}) {
  return (
    <article
      className={`rounded-lg border p-3 ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-black text-slate-950">{label}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            tone === "error"
              ? "bg-red-100 text-red-700"
              : "bg-white text-slate-600"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-2 leading-6">{details}</p>
    </article>
  );
}
