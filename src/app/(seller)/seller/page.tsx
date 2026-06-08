import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  Bell,
  Boxes,
  Download,
  FileText,
  Landmark,
  Package,
  Pencil,
  Plus,
  Paperclip,
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
  paymentsToSeller,
  products,
  sellerOffers,
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
import { formatCurrency, formatDateTime } from "@/lib/utils";

type SellerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSellerStatusLabel(status: string) {
  return status === "active" ? "Активен" : "Неактивен";
}

function getOfferStatusLabel(status: string) {
  if (status === "published") {
    return "Продается";
  }

  if (status === "on_moderation") {
    return "Не продается";
  }

  if (status === "rejected") {
    return "Отклонен";
  }

  if (status === "hidden") {
    return "Скрыт";
  }

  return "Черновик";
}

function getOfferStatusClassName(status: string) {
  if (status === "published") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "on_moderation") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-500";
}

export default async function SellerPage({ searchParams }: SellerPageProps) {
  const user = await requireUser(["seller"]);
  const search = (await searchParams) ?? {};
  const documentUploaded = search.documentUploaded === "1";
  const productSubmitted = search.productSubmitted === "1";
  const documentError =
    !documentUploaded && typeof search.documentError === "string"
      ? search.documentError
      : null;

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
    orderCounter,
    financeSummary,
    latestPayments,
    notificationCounter,
  ] = await Promise.all([
    getCurrentSellerDocuments(),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        priceWithVat: sellerOffers.priceWithVat,
        vatRate: sellerOffers.vatRate,
        unit: products.unit,
        isActive: products.isActive,
        offerStatus: sellerOffers.status,
        pendingRequestId: sql<string | null>`(
          select "id"
          from "seller_product_change_requests"
          where
            "product_id" = ${products.id}
            and "seller_id" = ${seller.id}
            and "status" = 'on_moderation'
          order by "submitted_at" desc
          limit 1
        )`,
        latestRequestStatus: sql<string | null>`(
          select "status"
          from "seller_product_change_requests"
          where
            "product_id" = ${products.id}
            and "seller_id" = ${seller.id}
          order by "submitted_at" desc
          limit 1
        )`,
        latestRequestComment: sql<string | null>`(
          select "moderation_comment"
          from "seller_product_change_requests"
          where
            "product_id" = ${products.id}
            and "seller_id" = ${seller.id}
          order by "submitted_at" desc
          limit 1
        )`,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        imageFileId: files.id,
        imageStorageKey: files.storageKey,
        imageIsActive: files.isActive,
      })
      .from(products)
      .innerJoin(
        sellerOffers,
        and(
          eq(sellerOffers.productId, products.id),
          eq(sellerOffers.sellerId, seller.id),
        ),
      )
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, products.subcategoryId))
      .leftJoin(files, eq(files.id, products.mainImageFileId))
      .where(eq(products.sellerId, seller.id))
      .orderBy(asc(products.name))
      .limit(80),
    db
      .select({
        count: sql<number>`count(distinct ${orderItems.orderId})`,
      })
      .from(orderItems)
      .where(eq(orderItems.sellerId, seller.id))
      .then(([row]) => row),
    db
      .select({
        orderCount: sql<number>`count(distinct ${orderItems.orderId})`,
        salesAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.sellerId, seller.id),
          inArray(orders.status, ["paid", "issued"]),
        ),
      )
      .then(([row]) => row),
    db
      .select({
        id: paymentsToSeller.id,
        periodFrom: paymentsToSeller.periodFrom,
        periodTo: paymentsToSeller.periodTo,
        payoutAmount: paymentsToSeller.payoutAmount,
        paidAt: paymentsToSeller.paidAt,
        comment: paymentsToSeller.comment,
      })
      .from(paymentsToSeller)
      .where(eq(paymentsToSeller.sellerId, seller.id))
      .orderBy(desc(paymentsToSeller.createdAt))
      .limit(5),
    db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          or(
            eq(notifications.sellerId, seller.id),
            eq(notifications.userId, user.id),
          ),
          eq(notifications.isRead, false),
        ),
      )
      .then(([row]) => row),
  ]);

  const salesAmount = Number(financeSummary?.salesAmount ?? 0);
  const sellerCompanyCardDocument = documents.find(
    (document) => document.type === "seller_company_card",
  );
  const publishedProductsCount = productRows.filter(
    (product) => product.offerStatus === "published",
  ).length;
  const moderationProductsCount = productRows.filter(
    (product) =>
      product.offerStatus === "on_moderation" || Boolean(product.pendingRequestId),
  ).length;
  const rejectedProductsCount = productRows.filter(
    (product) =>
      product.offerStatus === "rejected" ||
      product.latestRequestStatus === "rejected",
  ).length;
  const unreadSellerNotifications = notificationCounter?.count ?? 0;
  const summaryCards = [
    {
      title: "Товары",
      value: publishedProductsCount,
      description: `Продается · на модерации ${moderationProductsCount} · отклонено ${rejectedProductsCount}`,
      Icon: Boxes,
    },
    {
      title: "Заказы",
      value: orderCounter?.count ?? 0,
      description: `Оплаченные/выданные: ${financeSummary?.orderCount ?? 0}`,
      Icon: ReceiptText,
      href: "/seller/orders",
    },
    {
      title: "Продажи",
      value: formatCurrency(salesAmount),
      description: "Сумма по оплаченным/выданным позициям",
      Icon: Landmark,
    },
    {
      title: "Карточка компании",
      value: sellerCompanyCardDocument ? "Загружена" : "Не загружена",
      description: "Документ продавца",
      Icon: Paperclip,
    },
    {
      title: "Уведомления",
      value: unreadSellerNotifications,
      description:
        unreadSellerNotifications > 0
          ? "Есть непрочитанные события"
          : "Новых уведомлений нет",
      Icon: Bell,
      href: "/seller/notifications",
      badge: unreadSellerNotifications,
    },
  ] as const;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
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
          {summaryCards.map(({ title, value, description, Icon, ...card }) => {
            const content = (
              <>
                {"badge" in card && card.badge > 0 ? (
                  <span className="absolute right-4 top-4 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                    {card.badge > 99 ? "99+" : card.badge}
                  </span>
                ) : null}
                <Icon className="text-[#1157ff]" size={24} />
                <p className="mt-4 text-sm font-bold text-slate-500">{title}</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                  {description}
                </p>
              </>
            );

            return "href" in card ? (
              <Link
                className="relative rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                href={card.href}
                key={title}
              >
                {content}
              </Link>
            ) : (
              <article
                className="relative rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
                key={title}
              >
                {content}
              </article>
            );
          })}
        </section>

        {productSubmitted ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Товар отправлен на модерацию.
          </div>
        ) : null}

        <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-5">
            <section
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
              id="products"
            >
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="text-[#1157ff]" size={22} />
                  <h2 className="text-2xl font-black text-slate-950">Товары</h2>
                </div>
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  href="/seller/products/new"
                >
                  <Plus size={17} />
                  Добавить
                </Link>
              </div>
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Товар</th>
                      <th className="px-4 py-3">Категория</th>
                      <th className="px-4 py-3">Цена</th>
                      <th className="px-4 py-3">НДС</th>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
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

                      const hasPendingChanges = Boolean(product.pendingRequestId);
                      const hasRejectedRequest =
                        product.latestRequestStatus === "rejected";

                      return (
                        <tr
                          className="group cursor-pointer transition hover:bg-blue-50/40"
                          key={product.id}
                        >
                          <td className="px-4 py-3">
                            <Link
                              className="flex items-center gap-3 transition hover:text-[#1157ff]"
                              href={`/seller/products/${product.id}`}
                            >
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
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <Link
                              className="block transition group-hover:text-[#1157ff]"
                              href={`/seller/products/${product.id}`}
                            >
                              <span className="block font-bold text-slate-950">
                                {product.categoryName}
                              </span>
                              <span className="mt-1 block">
                                {product.subcategoryName ?? "Без подкатегории"}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              className="block font-black transition group-hover:text-[#1157ff]"
                              href={`/seller/products/${product.id}`}
                            >
                              {formatCurrency(product.priceWithVat)}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              className="block font-bold text-slate-700 transition group-hover:text-[#1157ff]"
                              href={`/seller/products/${product.id}`}
                            >
                              {Number(product.vatRate ?? 22).toFixed(0)}%
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              className="block"
                              href={`/seller/products/${product.id}`}
                            >
                              <div className="flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${getOfferStatusClassName(
                                    product.offerStatus,
                                  )}`}
                                >
                                  {getOfferStatusLabel(product.offerStatus)}
                                </span>
                                {hasPendingChanges ? (
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                    {product.offerStatus === "published"
                                      ? "Изменения на модерации"
                                      : "Товар на модерации"}
                                  </span>
                                ) : null}
                                {hasRejectedRequest && product.offerStatus !== "rejected" ? (
                                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                    Правки отклонены
                                  </span>
                                ) : null}
                              </div>
                              {product.offerStatus === "published" && hasPendingChanges ? (
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                                  Текущая версия остаётся в каталоге до решения админа.
                                </p>
                              ) : null}
                              {hasRejectedRequest ? (
                                <p className="mt-2 text-xs font-semibold leading-5 text-red-700">
                                  {product.latestRequestComment
                                    ? `Комментарий админа: ${product.latestRequestComment}`
                                    : "Проверьте карточку и отправьте исправления повторно."}
                                </p>
                              ) : null}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                              href={`/seller/products/${product.id}/edit`}
                            >
                              <Pencil size={15} />
                              Изменить
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

          </div>

          <aside className="grid min-w-0 gap-5 self-start">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <ReceiptText className="text-[#1157ff]" size={22} />
                <h2 className="text-xl font-black text-slate-950">Финансы</h2>
              </div>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Оплаченные продажи</span>
                  <span className="font-black">{formatCurrency(salesAmount)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">К выплате</span>
                  <span className="font-black">{formatCurrency(salesAmount)}</span>
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
              <div className="mt-4 grid gap-2">
                <h3 className="text-sm font-black text-slate-950">
                  Последние выплаты
                </h3>
                {latestPayments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                    Выплат пока нет.
                  </div>
                ) : (
                  latestPayments.map((payment) => (
                    <article
                      className="rounded-lg bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600"
                      key={payment.id}
                    >
                      <div className="flex justify-between gap-3">
                        <span>
                          {formatDateTime(payment.periodFrom)} -{" "}
                          {formatDateTime(payment.periodTo)}
                        </span>
                        <span className="font-black text-slate-950">
                          {formatCurrency(Number(payment.payoutAmount))}
                        </span>
                      </div>
                      <p>
                        {payment.paidAt
                          ? `Оплачено ${formatDateTime(payment.paidAt)}`
                          : "Ожидает оплаты"}
                      </p>
                      {payment.comment ? (
                        <p className="text-xs text-slate-500">{payment.comment}</p>
                      ) : null}
                    </article>
                  ))
                )}
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
                    placeholder="Например, карточка компании"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Тип
                  <select
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                    name="type"
                    defaultValue="seller_company_card"
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
                  placeholder="Комментарий к файлу"
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
                            {getDocumentTypeLabel(document.type)} ·{" "}
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
                          buttonText="Заменить файл"
                          name="file"
                          required
                        />
                        <input
                          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                          name="comment"
                          placeholder="Комментарий к файлу"
                        />
                        <SubmitButton
                          className="h-10 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                          pendingText="Сохраняем"
                        >
                          Сохранить файл
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
