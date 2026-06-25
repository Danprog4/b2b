import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { CreditCard, Download, FileText, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { db } from "@/db";
import {
  buyerCompanies,
  documentVersions,
  documents,
  files,
  orderItems,
  orders,
  paymentsToSeller,
  products,
  sellers,
  users,
} from "@/db/schema";
import {
  createSellerPaymentAction,
  deleteSellerPaymentAction,
  updateSellerAction,
  updateSellerPaymentAction,
} from "@/lib/admin/seller-actions";
import {
  getAdminBreadcrumbSource,
  withAdminBreadcrumbSource,
} from "@/lib/admin/breadcrumbs";
import { requireUser } from "@/lib/auth/session";
import {
  uploadAdminDocumentAction,
  uploadAdminDocumentVersionAction,
} from "@/lib/documents/actions";
import {
  formatFileSize,
  getDocumentTypeLabel,
  sellerDocumentTypes,
} from "@/lib/documents/types";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { SellerForm } from "../seller-form";

type SellerPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSellerStatusLabel(status: string) {
  return status === "active" ? "Активен" : "Неактивен";
}

function getErrorMessage(error: string | undefined) {
  if (error === "inn") {
    return "Продавец с таким ИНН уже существует.";
  }

  if (error === "required") {
    return "Заполните название, ИНН, комиссию и статус.";
  }

  if (error === "account-required") {
    return "Для доступа продавца укажите email и пароль. Для существующего аккаунта пароль можно оставить пустым.";
  }

  if (error === "account-password") {
    return "Пароль должен быть не короче 8 символов и содержать буквы и цифры.";
  }

  if (error === "account-email") {
    return "Пользователь с таким email уже существует.";
  }

  return null;
}

function toDateInputValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default async function AdminSellerPage({
  params,
  searchParams,
}: SellerPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const created = search.created === "1";
  const saved = search.saved === "1";
  const accountCreated = search.accountCreated === "1";
  const accountSaved = search.accountSaved === "1";
  const paymentSaved = search.paymentSaved === "1";
  const paymentDeleted = search.paymentDeleted === "1";
  const paymentError = search.paymentError === "1";
  const documentUploaded = search.documentUploaded === "1";
  const documentUpdated = search.documentUpdated === "1";
  const breadcrumbSource = getAdminBreadcrumbSource(search, "sellers");
  const documentError =
    !documentUploaded && !documentUpdated && typeof search.documentError === "string"
      ? search.documentError
      : null;
  const error = getErrorMessage(
    typeof search.error === "string" ? search.error : undefined,
  );

  const [seller] = await db
    .select()
    .from(sellers)
    .where(eq(sellers.id, id))
    .limit(1);

  if (!seller) {
    notFound();
  }

  const [
    productCounter,
    orderSummary,
    recentProducts,
    recentOrders,
    sellerPayments,
    sellerDocuments,
    sellerAccount,
  ] =
    await Promise.all([
      db
        .select({ count: count(products.id) })
        .from(products)
        .where(eq(products.sellerId, seller.id))
        .then(([row]) => row),
      db
        .select({
          orderCount: sql<number>`count(distinct ${orderItems.orderId})`,
          sellerAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
          commissionAmount: sql<string>`coalesce(sum(${orderItems.commissionAmount}), 0)`,
        })
        .from(orderItems)
        .where(eq(orderItems.sellerId, seller.id))
        .then(([row]) => row),
      db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          priceWithVat: products.priceWithVat,
          unit: products.unit,
          isActive: products.isActive,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(eq(products.sellerId, seller.id))
        .orderBy(desc(products.updatedAt), asc(products.name))
        .limit(8),
      db
        .select({
          id: orders.id,
          number: orders.number,
          status: orders.status,
          createdAt: orders.createdAt,
          companyName: buyerCompanies.name,
          itemCount: count(orderItems.id),
          sellerAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
          commissionAmount: sql<string>`coalesce(sum(${orderItems.commissionAmount}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(buyerCompanies, eq(buyerCompanies.id, orders.buyerCompanyId))
        .where(eq(orderItems.sellerId, seller.id))
        .groupBy(orders.id, buyerCompanies.name)
        .orderBy(desc(orders.createdAt))
        .limit(8),
      db
        .select({
          id: paymentsToSeller.id,
          periodFrom: paymentsToSeller.periodFrom,
          periodTo: paymentsToSeller.periodTo,
          salesAmount: paymentsToSeller.salesAmount,
          commissionAmount: paymentsToSeller.commissionAmount,
          payoutAmount: paymentsToSeller.payoutAmount,
          paidAt: paymentsToSeller.paidAt,
          comment: paymentsToSeller.comment,
          createdAt: paymentsToSeller.createdAt,
        })
        .from(paymentsToSeller)
        .where(eq(paymentsToSeller.sellerId, seller.id))
        .orderBy(desc(paymentsToSeller.createdAt))
        .limit(20),
      db
        .select({
          id: documents.id,
          type: documents.type,
          title: documents.title,
          currentVersion: documents.currentVersion,
          isVisibleToSeller: documents.isVisibleToSeller,
          createdAt: documents.createdAt,
          versionId: documentVersions.id,
          fileName: files.originalName,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
          uploadedAt: documentVersions.createdAt,
        })
        .from(documents)
        .innerJoin(
          documentVersions,
          and(
            eq(documentVersions.documentId, documents.id),
            eq(documentVersions.version, documents.currentVersion),
          ),
        )
        .innerJoin(files, eq(files.id, documentVersions.fileId))
        .where(
          and(
            eq(documents.sellerId, seller.id),
            eq(documents.target, "seller"),
            eq(documents.isActive, true),
          ),
        )
        .orderBy(desc(documents.createdAt))
        .limit(10),
      db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .where(and(eq(users.sellerId, seller.id), eq(users.role, "seller")))
        .limit(1)
        .then(([row]) => row ?? null),
    ]);
  const paidPaymentsAmount = sellerPayments.reduce(
    (sum, payment) => sum + Number(payment.payoutAmount),
    0,
  );
  const defaultSalesAmount = Number(orderSummary?.sellerAmount ?? 0);
  const defaultCommissionAmount = Number(orderSummary?.commissionAmount ?? 0);
  const defaultPayoutAmount = Math.max(
    defaultSalesAmount - defaultCommissionAmount,
    0,
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
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <span>{seller.name}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              className="text-sm font-bold text-[#1157ff]"
              href={breadcrumbSource.href}
            >
              ← {breadcrumbSource.label}
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {seller.name}
            </h1>
            <p className="mt-2 text-slate-600">
              ИНН {seller.inn}
              {seller.kpp ? ` · КПП ${seller.kpp}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              seller.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {getSellerStatusLabel(seller.status)}
          </span>
        </div>

        <ToastMessages
          items={[
            ...(created || saved
              ? [{ message: created ? "Продавец создан." : "Продавец сохранен." }]
              : []),
            ...(accountCreated || accountSaved
              ? [
                  {
                    message: accountCreated
                      ? "Доступ продавца создан."
                      : "Доступ продавца сохранен.",
                  },
                ]
              : []),
            ...(error ? [{ message: error, tone: "error" as const }] : []),
            ...(paymentSaved || paymentDeleted
              ? [
                  {
                    message: paymentDeleted
                      ? "Выплата удалена."
                      : "Выплата сохранена.",
                  },
                ]
              : []),
            ...(paymentError
              ? [
                  {
                    message: "Проверьте период и суммы выплаты.",
                    tone: "error" as const,
                  },
                ]
              : []),
            ...(documentUploaded || documentUpdated
              ? [
                  {
                    message: documentUploaded
                      ? "Документ сохранен."
                      : "Документ обновлен.",
                  },
                ]
              : []),
            ...(documentError
              ? [{ message: documentError, tone: "error" as const }]
              : []),
          ]}
        />

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_360px]">
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SellerForm
              action={updateSellerAction}
              seller={seller}
              sellerAccount={sellerAccount}
              submitText="Сохранить продавца"
            />
          </section>

          <aside className="grid gap-5">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Сводка</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Номер договора</span>
                  <span className="font-black">
                    {seller.contractNumber ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Товары</span>
                  <span className="font-black">{productCounter?.count ?? 0}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Заказы</span>
                  <span className="font-black">
                    {orderSummary?.orderCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Сумма по позициям</span>
                  <span className="font-black">
                    {formatCurrency(orderSummary?.sellerAmount ?? "0")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Комиссия</span>
                  <span className="font-black">
                    {formatCurrency(orderSummary?.commissionAmount ?? "0")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Выплачено</span>
                  <span className="font-black">
                    {formatCurrency(paidPaymentsAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Документы</span>
                  <span className="font-black">{sellerDocuments.length}</span>
                </div>
              </div>
              <Link
                className="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                href={`/admin/sellers/${seller.id}/report`}
              >
                <Download size={16} />
                Скачать отчет
              </Link>
            </section>

            <section className="rounded-xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Контакты</h2>
              <div className="mt-4 grid gap-2 text-slate-600">
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
                  <span className="font-bold text-slate-950">Адрес:</span>{" "}
                  {seller.legalAddress ?? "Не указан"}
                </p>
              </div>
            </section>
          </aside>
        </div>

        <section
          className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          id="payments"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <CreditCard size={20} />
                Финансы и выплаты
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Выплаты фиксируются вручную. Продавец видит сумму, период, дату
                оплаты и комментарий без комиссии.
              </p>
            </div>
          </div>

          <form
            action={createSellerPaymentAction}
            className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4"
          >
            <input name="sellerId" type="hidden" value={seller.id} />
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Период с
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="periodFrom"
                  type="date"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Период по
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="periodTo"
                  type="date"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Продажи
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="salesAmount"
                  step="1"
                  type="number"
                  defaultValue={defaultSalesAmount.toFixed(2)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Комиссия
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="commissionAmount"
                  step="1"
                  type="number"
                  defaultValue={defaultCommissionAmount.toFixed(2)}
                  required
                />
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                К выплате
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="payoutAmount"
                  step="1"
                  type="number"
                  defaultValue={defaultPayoutAmount.toFixed(2)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Дата оплаты
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="paidAt"
                  type="date"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Комментарий
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="comment"
                  placeholder="Необязательно"
                />
              </label>
              <div className="flex items-end">
                <SubmitButton
                  className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  pendingText="Сохраняем"
                >
                  Сохранить выплату
                </SubmitButton>
              </div>
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {sellerPayments.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                Выплаты продавцу пока не зафиксированы.
              </div>
            ) : (
              sellerPayments.map((payment) => (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  id={`payments-${payment.id}`}
                  key={payment.id}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">
                        {formatCurrency(payment.payoutAmount)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {formatDateTime(payment.periodFrom)} -{" "}
                        {formatDateTime(payment.periodTo)} ·{" "}
                        {payment.paidAt
                          ? `оплачено ${formatDateTime(payment.paidAt)}`
                          : "ожидает оплаты"}
                      </p>
                    </div>
                    <form action={deleteSellerPaymentAction}>
                      <input name="sellerId" type="hidden" value={seller.id} />
                      <input name="paymentId" type="hidden" value={payment.id} />
                      <SubmitButton
                        className="h-10 rounded-lg bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                        pendingText="..."
                      >
                        <Trash2 size={15} />
                        Удалить
                      </SubmitButton>
                    </form>
                  </div>
                  <form
                    action={updateSellerPaymentAction}
                    className="grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-4"
                  >
                    <input name="sellerId" type="hidden" value={seller.id} />
                    <input name="paymentId" type="hidden" value={payment.id} />
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Период с
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="periodFrom"
                        type="date"
                        defaultValue={toDateInputValue(payment.periodFrom)}
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Период по
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="periodTo"
                        type="date"
                        defaultValue={toDateInputValue(payment.periodTo)}
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Продажи
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="salesAmount"
                        step="1"
                        type="number"
                        defaultValue={payment.salesAmount}
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Комиссия
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="commissionAmount"
                        step="1"
                        type="number"
                        defaultValue={payment.commissionAmount}
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      К выплате
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="payoutAmount"
                        step="1"
                        type="number"
                        defaultValue={payment.payoutAmount}
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700">
                      Дата оплаты
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="paidAt"
                        type="date"
                        defaultValue={toDateInputValue(payment.paidAt)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
                      Комментарий
                      <input
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                        name="comment"
                        defaultValue={payment.comment ?? ""}
                      />
                    </label>
                    <div className="flex items-end lg:col-span-4">
                      <SubmitButton
                        className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                        pendingText="Сохраняем"
                      >
                        Сохранить изменения
                      </SubmitButton>
                    </div>
                  </form>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <FileText size={20} />
                Документы продавца
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Документы привязаны к продавцу, а не к отдельному пользователю.
                Их видит админ, а продавцу они доступны только при включенной
                видимости.
              </p>
            </div>
            <Link
              className="text-sm font-bold text-[#1157ff]"
              href={`/admin/documents?sellerId=${seller.id}`}
            >
              Все документы
            </Link>
          </div>

          <form
            action={uploadAdminDocumentAction}
            className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4"
          >
            <input name="returnPath" type="hidden" value={`/admin/sellers/${seller.id}`} />
            <input name="targetObject" type="hidden" value={`seller:${seller.id}`} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Название
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="title"
                  placeholder="Например, карточка компании продавца"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Тип
                <select
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  defaultValue="seller_company_card"
                  name="type"
                >
                  {sellerDocumentTypes.map(([value, label]) => (
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

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                name="comment"
                placeholder="Комментарий к файлу"
              />
              <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  className="size-4"
                  defaultChecked
                  name="isVisibleToSeller"
                  type="checkbox"
                />
                Видно продавцу
              </label>
              <SubmitButton
                className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                pendingText="Сохраняем"
              >
                Сохранить
              </SubmitButton>
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {sellerDocuments.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                Документы продавца пока не загружены.
              </div>
            ) : (
              sellerDocuments.map((document) => (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={document.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{document.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {getDocumentTypeLabel(document.type)} ·{" "}
                        {formatFileSize(document.sizeBytes)} ·{" "}
                        {document.isVisibleToSeller
                          ? "виден продавцу"
                          : "только админ"}
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
                    action={uploadAdminDocumentVersionAction}
                    className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <input
                      name="returnPath"
                      type="hidden"
                      value={`/admin/sellers/${seller.id}`}
                    />
                    <input name="documentId" type="hidden" value={document.id} />
                    <FileUploadField
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      buttonText="Загрузить новую версию"
                      name="file"
                      required
                    />
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                      name="comment"
                      placeholder="Комментарий"
                    />
                    <SubmitButton
                      className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
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

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">Товары</h2>
              <Link className="text-sm font-bold text-[#1157ff]" href="/admin/products">
                Все товары
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {recentProducts.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Товары не привязаны.
                </div>
              ) : (
                recentProducts.map((product) => (
                  <Link
                    className="flex items-start justify-between gap-4 py-3 text-sm transition hover:text-[#1157ff]"
                    href={withAdminBreadcrumbSource(
                      `/admin/products/${product.id}`,
                      "sellers",
                    )}
                    key={product.id}
                  >
                    <span className="flex gap-3">
                      <Package className="text-[#1157ff]" size={20} />
                      <span>
                        <span className="block font-black text-slate-950">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {product.sku} · {product.unit} ·{" "}
                          {product.isActive ? "активен" : "неактивен"}
                        </span>
                      </span>
                    </span>
                    <span className="font-black">
                      {formatCurrency(product.priceWithVat)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">Заказы</h2>
              <Link className="text-sm font-bold text-[#1157ff]" href="/admin/orders">
                Все заказы
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Заказов по продавцу пока нет.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    className="grid gap-3 py-3 text-sm transition hover:text-[#1157ff] md:grid-cols-[1fr_auto]"
                    href={withAdminBreadcrumbSource(
                      `/admin/orders/${order.id}`,
                      "sellers",
                    )}
                    key={order.id}
                  >
                    <span className="flex gap-3">
                      <FileText className="text-[#1157ff]" size={20} />
                      <span>
                        <span className="block font-black text-slate-950">
                          {order.number}
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {order.companyName} · {formatDateTime(order.createdAt)}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-black">
                        {formatCurrency(order.sellerAmount)}
                      </span>
                      <span className="mt-1 block text-slate-500">
                        {getOrderStatusLabel(order.status)} · комиссия{" "}
                        {formatCurrency(order.commissionAmount)}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
