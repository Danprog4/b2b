import { and, desc, eq } from "drizzle-orm";
import { Building2, Download, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  buyerCompanies,
  documentVersions,
  documents,
  files,
  orders,
  users,
} from "@/db/schema";
import { updateBuyerCompanyAdminAction } from "@/lib/admin/company-actions";
import { requireUser } from "@/lib/auth/session";
import { getDocumentTypeLabel } from "@/lib/documents/types";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type CompanyPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions = ["active", "blocked"] as const;

function getBankValue(
  bankDetails: Record<string, string> | null | undefined,
  key: string,
) {
  return bankDetails?.[key] ?? "";
}

function getCompanyTypeLabel(type: string) {
  return type === "ip" ? "ИП" : "ООО";
}

function getCompanyStatusLabel(status: string) {
  if (status === "active") {
    return "Активна";
  }

  if (status === "blocked") {
    return "Заблокирована";
  }

  return status;
}

function getCompanyStatusClassName(status: string) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "blocked") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

function getUserRoleLabel(role: string) {
  if (role === "buyer") {
    return "Покупатель";
  }

  if (role === "seller") {
    return "Продавец";
  }

  if (role === "admin") {
    return "Администратор";
  }

  return role;
}

function getUserStatusLabel(status: string) {
  if (status === "active") {
    return "Активен";
  }

  if (status === "blocked") {
    return "Заблокирован";
  }

  if (status === "pending_join") {
    return "Ожидает привязки";
  }

  return status;
}

function getErrorMessage(error: string | undefined) {
  if (error === "inn") {
    return "Компания с таким ИНН уже есть в системе.";
  }

  if (error === "required") {
    return "Заполните название, ИНН и статус.";
  }

  return null;
}

export default async function AdminCompanyPage({
  params,
  searchParams,
}: CompanyPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const error = getErrorMessage(
    typeof search.error === "string" ? search.error : undefined,
  );

  const [company] = await db
    .select()
    .from(buyerCompanies)
    .where(eq(buyerCompanies.id, id))
    .limit(1);

  if (!company) {
    notFound();
  }

  const [companyUsers, recentOrders, companyDocuments] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.buyerCompanyId, company.id))
      .orderBy(desc(users.createdAt)),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        userEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(orders.buyerCompanyId, company.id))
      .orderBy(desc(orders.createdAt))
      .limit(10),
    db
      .select({
        id: documents.id,
        type: documents.type,
        title: documents.title,
        target: documents.target,
        currentVersion: documents.currentVersion,
        isVisibleToBuyer: documents.isVisibleToBuyer,
        createdAt: documents.createdAt,
        versionId: documentVersions.id,
        fileName: files.originalName,
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
      .where(and(eq(documents.buyerCompanyId, company.id), eq(documents.isActive, true)))
      .orderBy(desc(documents.createdAt))
      .limit(10),
  ]);

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
          <Link className="text-[#1157ff]" href="/admin/companies">
            Компании
          </Link>
          <span>/</span>
          <span>{company.name}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              className="text-sm font-bold text-[#1157ff]"
              href="/admin/companies"
            >
              ← Компании
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {company.name}
            </h1>
            <p className="mt-2 text-slate-600">
              {getCompanyTypeLabel(company.type)} · ИНН {company.inn}
              {company.kpp ? ` · КПП ${company.kpp}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${getCompanyStatusClassName(company.status)}`}
          >
            {getCompanyStatusLabel(company.status)}
          </span>
        </div>

        {saved ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Компания сохранена.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_380px]">
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Реквизиты компании
            </h2>
            <form action={updateBuyerCompanyAdminAction} className="mt-5 grid gap-5">
              <input name="companyId" type="hidden" value={company.id} />

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">Тип</span>
                  <select
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.type}
                    name="type"
                  >
                    <option value="ooo">ООО</option>
                    <option value="ip">ИП</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">Статус</span>
                  <select
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.status}
                    name="status"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {getCompanyStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">
                  Название
                </span>
                <input
                  className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={company.name}
                  name="name"
                  required
                />
              </label>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">ИНН</span>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.inn}
                    name="inn"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">КПП</span>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.kpp ?? ""}
                    name="kpp"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">
                    ОГРН / ОГРНИП
                  </span>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.ogrn ?? ""}
                    name="ogrn"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">
                  Юридический адрес
                </span>
                <textarea
                  className="min-h-24 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                  defaultValue={company.legalAddress ?? ""}
                  name="legalAddress"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">
                    Email компании
                  </span>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.contactEmail ?? ""}
                    name="contactEmail"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-600">
                    Телефон компании
                  </span>
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                    defaultValue={company.contactPhone ?? ""}
                    name="contactPhone"
                  />
                </label>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-black text-slate-950">
                  Банковские реквизиты
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-600">Банк</span>
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                      defaultValue={getBankValue(company.bankDetails, "bankName")}
                      name="bankName"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-600">БИК</span>
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                      defaultValue={getBankValue(company.bankDetails, "bik")}
                      name="bik"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-600">
                      Расчетный счет
                    </span>
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                      defaultValue={getBankValue(
                        company.bankDetails,
                        "checkingAccount",
                      )}
                      name="checkingAccount"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-600">
                      Корреспондентский счет
                    </span>
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#1157ff]"
                      defaultValue={getBankValue(
                        company.bankDetails,
                        "correspondentAccount",
                      )}
                      name="correspondentAccount"
                    />
                  </label>
                </div>
              </div>

              <button className="h-11 w-fit rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]">
                Сохранить компанию
              </button>
            </form>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">Сводка</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Создана</span>
                  <span className="font-black">
                    {formatDateTime(company.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Обновлена</span>
                  <span className="font-black">
                    {formatDateTime(company.updatedAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Пользователи</span>
                  <span className="font-black">{companyUsers.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Заказы</span>
                  <span className="font-black">{recentOrders.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Документы</span>
                  <span className="font-black">{companyDocuments.length}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <Building2 size={20} />
                Для админа
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Эти данные используются для регистрации юрлица, выставления счета
                и проверки готовности к оформлению заказа.
              </p>
              <Link
                className="mt-4 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                href={`/admin/documents`}
              >
                Управление документами
              </Link>
            </section>
          </aside>
        </div>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <UserRound size={20} />
              Пользователи
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {companyUsers.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Пользователей у компании пока нет.
                </div>
              ) : (
                companyUsers.map((companyUser) => (
                  <Link
                    className="block py-3 text-sm transition hover:text-[#1157ff]"
                    href={`/admin/users/${companyUser.id}`}
                    key={companyUser.id}
                  >
                    <span className="block font-black text-slate-950">
                      {companyUser.name ?? "Без имени"}
                    </span>
                    <span className="mt-1 block text-slate-500">
                      {companyUser.email} · {getUserRoleLabel(companyUser.role)} ·{" "}
                      {getUserStatusLabel(companyUser.status)}
                    </span>
                    <span className="mt-1 block text-slate-500">
                      {companyUser.phone ?? "Телефон не указан"} ·{" "}
                      {companyUser.lastLoginAt
                        ? formatDateTime(companyUser.lastLoginAt)
                        : "Не входил"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <FileText size={20} />
                Заказы
              </h2>
              <Link
                className="text-sm font-bold text-[#1157ff]"
                href={`/admin/orders?q=${encodeURIComponent(company.inn)}`}
              >
                Все
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Заказов пока нет.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    className="grid gap-2 py-3 text-sm transition hover:text-[#1157ff]"
                    href={`/admin/orders/${order.id}`}
                    key={order.id}
                  >
                    <span className="flex justify-between gap-3">
                      <span className="font-black text-slate-950">
                        {order.number}
                      </span>
                      <span className="font-black">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      {getOrderStatusLabel(order.status)} · {order.userEmail} ·{" "}
                      {formatDateTime(order.createdAt)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <FileText size={20} />
                Документы
              </h2>
              <Link className="text-sm font-bold text-[#1157ff]" href="/admin/documents">
                Все
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {companyDocuments.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Документов компании пока нет.
                </div>
              ) : (
                companyDocuments.map((document) => (
                  <div className="py-3 text-sm" key={document.id}>
                    <p className="font-black text-slate-950">{document.title}</p>
                    <p className="mt-1 text-slate-500">
                      {getDocumentTypeLabel(document.type)} · версия{" "}
                      {document.currentVersion} ·{" "}
                      {document.isVisibleToBuyer
                        ? "виден покупателю"
                        : "только админ"}
                    </p>
                    <Link
                      className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#1157ff]"
                      href={`/documents/${document.versionId}/download`}
                    >
                      <Download size={16} />
                      Скачать
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
