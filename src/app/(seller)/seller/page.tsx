import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  Bell,
  Boxes,
  Download,
  FileText,
  Landmark,
  Package,
  Paperclip,
  Percent,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { LogoutButton } from "@/components/logout-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import {
  categories,
  files,
  notifications,
  orderItems,
  orders,
  products,
  sellers,
  subcategories,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import {
  uploadSellerDocumentAction,
  uploadSellerDocumentVersionAction,
} from "@/lib/documents/actions";
import { getCurrentSellerDocuments } from "@/lib/documents/queries";
import {
  formatFileSize,
  getDocumentTypeLabel,
  sellerDocumentTypes,
} from "@/lib/documents/types";
import { getPublicFileUrl } from "@/lib/files/urls";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type SellerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSellerStatusLabel(status: string) {
  return status === "active" ? "Активен" : "Неактивен";
}

export default async function SellerPage({ searchParams }: SellerPageProps) {
  const user = await requireUser(["seller"]);
  const search = (await searchParams) ?? {};
  const documentUploaded = search.documentUploaded === "1";
  const documentError =
    typeof search.documentError === "string" ? search.documentError : null;

  if (!user.sellerId) {
    return (
      <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
            <h1 className="text-2xl font-black text-slate-950">
              Продавец не привязан
            </h1>
            <p className="mt-2 text-slate-600">
              Пользователь должен быть связан с продавцом администратором.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const [seller] = await db
    .select()
    .from(sellers)
    .where(eq(sellers.id, user.sellerId))
    .limit(1);

  if (!seller) {
    return (
      <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
            <h1 className="text-2xl font-black text-slate-950">
              Продавец не найден
            </h1>
          </section>
        </div>
      </main>
    );
  }

  const [
    documents,
    productRows,
    orderRows,
    financeSummary,
    productCounter,
    notificationRows,
  ] = await Promise.all([
    getCurrentSellerDocuments(),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        priceWithVat: products.priceWithVat,
        vatRate: products.vatRate,
        unit: products.unit,
        isActive: products.isActive,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        imageFileId: files.id,
        imageStorageKey: files.storageKey,
        imageIsActive: files.isActive,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, products.subcategoryId))
      .leftJoin(files, eq(files.id, products.mainImageFileId))
      .where(eq(products.sellerId, seller.id))
      .orderBy(asc(products.name))
      .limit(80),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        createdAt: orders.createdAt,
        itemCount: count(orderItems.id),
        sellerAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        commissionAmount: sql<string>`coalesce(sum(${orderItems.commissionAmount}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orderItems.sellerId, seller.id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt))
      .limit(30),
    db
      .select({
        orderCount: sql<number>`count(distinct ${orderItems.orderId})`,
        salesAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        commissionAmount: sql<string>`coalesce(sum(${orderItems.commissionAmount}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.sellerId, seller.id),
          inArray(orders.status, ["paid", "issued", "closed"]),
        ),
      )
      .then(([row]) => row),
    db
      .select({ count: count(products.id) })
      .from(products)
      .where(eq(products.sellerId, seller.id))
      .then(([row]) => row),
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
          eq(notifications.sellerId, seller.id),
          eq(notifications.userId, user.id),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20),
  ]);

  const salesAmount = Number(financeSummary?.salesAmount ?? 0);
  const commissionAmount = Number(financeSummary?.commissionAmount ?? 0);
  const payoutAmount = salesAmount - commissionAmount;
  const sellerUpdDocument = documents.find((document) => document.type === "upd");
  const unreadSellerNotifications = notificationRows.filter(
    (notification) => !notification.isRead,
  ).length;
  const summaryCards = [
    ["Товары", productCounter?.count ?? 0, Boxes],
    ["К выплате", financeSummary?.orderCount ?? 0, ReceiptText],
    ["Продажи", formatCurrency(salesAmount), Landmark],
    ["Комиссия", formatCurrency(commissionAmount), Percent],
    ["УПД", sellerUpdDocument ? "Загружен" : "Не загружен", Paperclip],
  ] as const;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Кабинет продавца
            </h1>
            <p className="mt-2 text-slate-600">
              {seller.name} · ИНН {seller.inn}
            </p>
          </div>
          <LogoutButton />
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(([title, value, Icon]) => (
            <article
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
              key={title}
            >
              <Icon className="text-[#1157ff]" size={24} />
              <p className="mt-4 text-sm font-bold text-slate-500">{title}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-5">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <Landmark className="text-[#1157ff]" size={22} />
                <h2 className="text-2xl font-black text-slate-950">
                  Профиль и реквизиты
                </h2>
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <p>
                  <span className="font-bold text-slate-950">Компания:</span>{" "}
                  {seller.name}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Статус:</span>{" "}
                  {getSellerStatusLabel(seller.status)}
                </p>
                <p>
                  <span className="font-bold text-slate-950">ИНН:</span>{" "}
                  {seller.inn}
                </p>
                <p>
                  <span className="font-bold text-slate-950">КПП:</span>{" "}
                  {seller.kpp ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">ОГРН:</span>{" "}
                  {seller.ogrn ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Комиссия:</span>{" "}
                  {Number(seller.commissionRate).toFixed(2)}%
                </p>
                <p>
                  <span className="font-bold text-slate-950">Контакт:</span>{" "}
                  {seller.contactName ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Email:</span>{" "}
                  {seller.email ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Телефон:</span>{" "}
                  {seller.phone ?? "Не указан"}
                </p>
                <p>
                  <span className="font-bold text-slate-950">Обновлен:</span>{" "}
                  {formatDateTime(seller.updatedAt)}
                </p>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <span className="font-bold text-slate-950">Адрес:</span>{" "}
                {seller.legalAddress ?? "Не указан"}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <Package className="text-[#1157ff]" size={22} />
                <h2 className="text-2xl font-black text-slate-950">Товары</h2>
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Товар</th>
                      <th className="px-4 py-3">Категория</th>
                      <th className="px-4 py-3">Цена</th>
                      <th className="px-4 py-3">НДС</th>
                      <th className="px-4 py-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                          Товаров пока нет.
                        </td>
                      </tr>
                    ) : null}
                    {productRows.map((product) => {
                      const imageUrl = product.imageIsActive
                        ? getPublicFileUrl({
                            id: product.imageFileId,
                            storageKey: product.imageStorageKey,
                          })
                        : null;

                      return (
                        <tr key={product.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                                {imageUrl ? (
                                  <img
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    src={imageUrl}
                                  />
                                ) : (
                                  <Package size={20} />
                                )}
                              </span>
                              <span>
                                <span className="block font-black text-slate-950">
                                  {product.name}
                                </span>
                                <span className="mt-1 block text-slate-500">
                                  {product.sku} · {product.unit}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <span className="block font-bold text-slate-950">
                              {product.categoryName}
                            </span>
                            <span className="mt-1 block">
                              {product.subcategoryName ?? "Без подкатегории"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black">
                            {formatCurrency(product.priceWithVat)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {Number(product.vatRate ?? 22).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                product.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {product.isActive ? "Активен" : "Неактивен"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <ReceiptText className="text-[#1157ff]" size={22} />
                <h2 className="text-2xl font-black text-slate-950">Заказы</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {orderRows.length === 0 ? (
                  <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                    Заказов с товарами продавца пока нет.
                  </div>
                ) : (
                  orderRows.map((order) => {
                    const amount = Number(order.sellerAmount);
                    const commission = Number(order.commissionAmount);

                    return (
                      <Link
                        className="block rounded-xl border border-slate-200 p-4 transition hover:border-[#1157ff] hover:bg-blue-50/30"
                        href={`/seller/orders/${order.id}`}
                        key={order.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black text-slate-950">
                              {order.number}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {formatDateTime(order.createdAt)} ·{" "}
                              {getOrderStatusLabel(order.status)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black">
                              {formatCurrency(amount)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {Number(order.itemCount)} поз. · комиссия{" "}
                              {formatCurrency(commission)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                          К выплате: {formatCurrency(amount - commission)}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <aside className="grid gap-5 self-start">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="text-[#1157ff]" size={22} />
                  <h2 className="text-xl font-black text-slate-950">
                    Уведомления
                  </h2>
                </div>
                {unreadSellerNotifications > 0 ? (
                  <span className="rounded-full bg-[#1157ff] px-2.5 py-1 text-xs font-black text-white">
                    {unreadSellerNotifications}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3">
                {notificationRows.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                    Уведомлений пока нет.
                  </div>
                ) : (
                  notificationRows.map((notification) => (
                    <article
                      className={`rounded-xl border p-4 ${
                        notification.isRead
                          ? "border-slate-200"
                          : "border-blue-100 bg-blue-50/50"
                      }`}
                      key={notification.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-slate-950">
                            {notification.title}
                          </h3>
                          {notification.body ? (
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {notification.body}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                          {notification.type}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <Percent className="text-[#1157ff]" size={22} />
                <h2 className="text-xl font-black text-slate-950">Финансы</h2>
              </div>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Оплаченные продажи</span>
                  <span className="font-black">{formatCurrency(salesAmount)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Комиссия</span>
                  <span className="font-black">
                    {formatCurrency(commissionAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">К выплате</span>
                  <span className="font-black">{formatCurrency(payoutAmount)}</span>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                Расчет справочный. Выплаты фиксируются вручную администратором.
              </p>
              <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Расчетный период</span>
                  <span className="font-bold text-slate-950">
                    Оплаченные заказы
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Статус выплат</span>
                  <span className="font-bold text-slate-950">
                    Ручной расчет
                  </span>
                </div>
              </div>
              <Link
                className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                href="/seller/orders/export"
              >
                <Download size={16} />
                Скачать отчет
              </Link>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <Paperclip className="text-[#1157ff]" size={22} />
                <h2 className="text-xl font-black text-slate-950">Документы</h2>
              </div>

              {documentUploaded ? (
                <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                  Документ сохранен.
                </div>
              ) : null}

              {documentError ? (
                <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {documentError}
                </div>
              ) : null}

              <form
                action={uploadSellerDocumentAction}
                className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4"
              >
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Название
                  <input
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                    name="title"
                    placeholder="Например, УПД продавца"
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
                    {sellerDocumentTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <FileUploadField
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  name="file"
                  required
                />
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                  name="comment"
                  placeholder="Комментарий к версии"
                />
                <SubmitButton
                  className="h-11 rounded-lg bg-[#1157ff] text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  pendingText="Сохраняем"
                >
                  Сохранить
                </SubmitButton>
              </form>

              <div className="mt-5 grid gap-3">
                {documents.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                    Документы продавца пока не загружены.
                  </div>
                ) : (
                  documents.map((document) => (
                    <article
                      className="rounded-xl border border-slate-200 p-4"
                      key={document.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="text-[#1157ff]" size={18} />
                            <h3 className="font-black text-slate-950">
                              {document.title}
                            </h3>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {getDocumentTypeLabel(document.type)} · версия{" "}
                            {document.currentVersion} ·{" "}
                            {formatFileSize(document.sizeBytes)}
                          </p>
                        </div>
                        <Link
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                          href={`/documents/${document.versionId}/download`}
                        >
                          <Download size={15} />
                          Скачать
                        </Link>
                      </div>
                      <form
                        action={uploadSellerDocumentVersionAction}
                        className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3"
                      >
                        <input
                          name="documentId"
                          type="hidden"
                          value={document.id}
                        />
                        <FileUploadField
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                          buttonText="Загрузить новую версию"
                          name="file"
                          required
                        />
                        <input
                          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                          name="comment"
                          placeholder="Комментарий"
                        />
                        <SubmitButton
                          className="h-10 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                          pendingText="Сохраняем"
                        >
                          Сохранить версию
                        </SubmitButton>
                      </form>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
