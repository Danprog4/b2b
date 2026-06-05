import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { db } from "@/db";
import {
  buyerCompanies,
  chats,
  contracts,
  documents,
  emailOutbox,
  invoices,
  messages,
  notifications,
  orderItems,
  orders,
  sellerProductChangeRequests,
  sellers,
  systemEvents,
} from "@/db/schema";
import { getCompanyDocumentReadiness } from "@/lib/account/company-documents";
import { requireUser } from "@/lib/auth/session";
import { getAdminPendingChatCount } from "@/lib/chat/queries";
import { getDocumentTypeLabel } from "@/lib/documents/types";
import { getOrderStatusLabel } from "@/lib/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const adminModules = [
  {
    title: "Заказы",
    href: "/admin/orders",
    description: "Обработка заказов, смена статусов, документы и счета.",
  },
  {
    title: "Товары",
    href: "/admin/products",
    description: "Создание, редактирование, цены, НДС, фото и активность товаров.",
  },
  {
    title: "Модерация товаров",
    href: "/admin/products/moderation",
    description: "Новые товары и изменения продавцов, ожидающие решения.",
  },
  {
    title: "Категории",
    href: "/admin/categories",
    description: "Структура каталога: категории, подкатегории и изображения.",
  },
  {
    title: "Пользователи",
    href: "/admin/users",
    description: "Аккаунты покупателей, продавцов и администраторов.",
  },
  {
    title: "Компании",
    href: "/admin/companies",
    description: "Карточки компаний, реквизиты, документы и связанные пользователи.",
  },
  {
    title: "Заявки на присоединение",
    href: "/admin/company-join-requests",
    description: "Подтверждение пользователей, которые хотят подключиться к компании.",
  },
  {
    title: "Продавцы",
    href: "/admin/sellers",
    description: "Профили продавцов, документы, заказы и финансовые отчеты.",
  },
  {
    title: "Комиссии",
    href: "/admin/commissions",
    description: "Отчет 5% по оплаченным и выданным позициям с фильтрами.",
  },
  {
    title: "Документы",
    href: "/admin/documents",
    description: "Загрузка, актуальные файлы, видимость и управление документами.",
  },
  {
    title: "Баннеры",
    href: "/admin/banners",
    description: "Промо-блоки главной страницы и их порядок показа.",
  },
  {
    title: "Страницы",
    href: "/admin/pages",
    description: "Информационные страницы сайта: публикация и редактирование.",
  },
  {
    title: "Чаты",
    href: "/admin/chats",
    description: "Сообщения покупателей и временные ответы до Telegram-бота.",
  },
  {
    title: "Импорт товаров",
    href: "/admin/products/import",
    description: "Массовое создание и обновление товаров через Excel-файл.",
  },
  {
    title: "Экспорт заказов",
    href: "/admin/orders/export",
    description: "Выгрузка списка заказов в Excel для учета и сверки.",
    actionLabel: "Скачать",
  },
  {
    title: "Email-очередь",
    href: "/admin/email-outbox",
    description: "Контроль исходящих писем, статусов отправки и ошибок.",
  },
  {
    title: "Уведомления",
    href: "/admin/notifications",
    description: "Системные уведомления администратора и история событий.",
  },
  {
    title: "Ошибки системы",
    href: "/admin/system-events?severity=error",
    description: "Журнал технических ошибок и событий, требующих внимания.",
  },
];

const dashboardStatuses = [
  ["accepted", "Приняты"],
  ["paid", "Оплачены"],
  ["issued", "Выданные"],
  ["cancelled", "Отменены"],
] as const;

async function countOrdersByStatus(status: (typeof dashboardStatuses)[number][0]) {
  const [row] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.status, status));

  return row?.count ?? 0;
}

export default async function AdminPage() {
  const user = await requireUser(["admin"]);
  const [
    notificationCounter,
    acceptedOrdersCount,
    paidOrdersCount,
    issuedOrdersCount,
    cancelledOrdersCount,
    latestOrders,
    latestCompanies,
    latestMessages,
    companyDocumentCandidates,
    latestDocuments,
    invoiceErrorCounter,
    emailErrorCounter,
    telegramErrorCounter,
    systemErrorCounter,
    moderationCounter,
    contractErrorCounter,
    newDocumentsCounter,
    pendingChatCount,
    financeSummary,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .then(([row]) => row),
    countOrdersByStatus("accepted"),
    countOrdersByStatus("paid"),
    countOrdersByStatus("issued"),
    countOrdersByStatus("cancelled"),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        companyName: buyerCompanies.name,
      })
      .from(orders)
      .innerJoin(buyerCompanies, eq(buyerCompanies.id, orders.buyerCompanyId))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({
        id: buyerCompanies.id,
        name: buyerCompanies.name,
        inn: buyerCompanies.inn,
        createdAt: buyerCompanies.createdAt,
      })
      .from(buyerCompanies)
      .orderBy(desc(buyerCompanies.createdAt))
      .limit(5),
    db
      .select({
        id: messages.id,
        chatId: chats.id,
        text: messages.text,
        senderType: messages.senderType,
        deliveryStatus: messages.deliveryStatus,
        createdAt: messages.createdAt,
        companyName: buyerCompanies.name,
      })
      .from(messages)
      .innerJoin(chats, eq(chats.id, messages.chatId))
      .innerJoin(buyerCompanies, eq(buyerCompanies.id, chats.buyerCompanyId))
      .orderBy(desc(messages.createdAt))
      .limit(5),
    db
      .select({
        id: buyerCompanies.id,
        name: buyerCompanies.name,
        inn: buyerCompanies.inn,
      })
      .from(buyerCompanies)
      .orderBy(desc(buyerCompanies.createdAt))
      .limit(80),
    db
      .select({
        id: documents.id,
        type: documents.type,
        title: documents.title,
        target: documents.target,
        createdAt: documents.createdAt,
        buyerCompanyName: buyerCompanies.name,
        sellerName: sellers.name,
      })
      .from(documents)
      .leftJoin(buyerCompanies, eq(buyerCompanies.id, documents.buyerCompanyId))
      .leftJoin(sellers, eq(sellers.id, documents.sellerId))
      .where(
        and(
          eq(documents.isActive, true),
          sql`${documents.target} in ('buyer_company', 'seller')`,
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(8),
    db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.status, "failed"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(emailOutbox)
      .where(eq(emailOutbox.status, "failed"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.deliveryStatus, "failed"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(systemEvents)
      .where(eq(systemEvents.severity, "error"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(sellerProductChangeRequests)
      .where(eq(sellerProductChangeRequests.status, "on_moderation"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(contracts)
      .where(eq(contracts.status, "failed"))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(documents)
      .where(
        and(
          eq(documents.isActive, true),
          inArray(documents.target, ["buyer_company", "seller"]),
        ),
      )
      .then(([row]) => row),
    getAdminPendingChatCount(),
    db
      .select({
        salesAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        commissionAmount: sql<string>`coalesce(sum(${orderItems.lineTotal} * 0.05), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(inArray(orders.status, ["paid", "issued"]))
      .then(([row]) => row),
  ]);
  const unreadNotifications = notificationCounter?.count ?? 0;
  const companyDocumentReadiness = await Promise.all(
    companyDocumentCandidates.map(async (company) => {
      const readiness = await getCompanyDocumentReadiness(company.id);

      return {
        ...company,
        hasCompanyCard: readiness.uploadedTypes.includes("company_card"),
        hasCharter: readiness.uploadedTypes.includes("charter"),
      };
    }),
  );
  const companiesMissingRequiredDocuments = companyDocumentReadiness
    .filter((company) => !company.hasCompanyCard || !company.hasCharter)
    .slice(0, 6);
  const statusCounters = [
    [dashboardStatuses[0][1], acceptedOrdersCount, "/admin/orders?status=accepted"],
    [dashboardStatuses[1][1], paidOrdersCount, "/admin/orders?status=paid"],
    [dashboardStatuses[2][1], issuedOrdersCount, "/admin/orders?status=issued"],
    [
      dashboardStatuses[3][1],
      cancelledOrdersCount,
      "/admin/orders?status=cancelled",
    ],
  ] as const;
  const errorCounters = [
    ["Ошибки счетов", invoiceErrorCounter?.count ?? 0, "/admin/orders"],
    ["Ошибки email", emailErrorCounter?.count ?? 0, "/admin/email-outbox"],
    [
      "Ошибки Telegram",
      telegramErrorCounter?.count ?? 0,
      "/admin/system-events?type=telegram&severity=error",
    ],
    [
      "Системные ошибки",
      systemErrorCounter?.count ?? 0,
      "/admin/system-events?severity=error",
    ],
  ] as const;
  const operationalCounters = [
    [
      "Товары на модерации",
      moderationCounter?.count ?? 0,
      "/admin/products/moderation",
    ],
    [
      "Ошибки договора",
      contractErrorCounter?.count ?? 0,
      "/admin/companies",
    ],
    ["Новые документы", newDocumentsCounter?.count ?? 0, "/admin/documents"],
    [
      "Сумма продаж",
      formatCurrency(financeSummary?.salesAmount ?? "0"),
      "/admin/commissions",
    ],
    [
      "Комиссия 5%",
      formatCurrency(financeSummary?.commissionAmount ?? "0"),
      "/admin/commissions",
    ],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Админ-панель
            </h1>
            <p className="mt-2 text-slate-600">
              Вы вошли как {user.email}. Desktop-only рабочее место для
              обработки заказов и управления платформой.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              className="relative inline-flex h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
              href="/admin/notifications"
            >
              Уведомления
              {unreadNotifications > 0 ? (
                <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <LogoutButton />
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {statusCounters.map(([label, value, href]) => (
            <Link
              key={label}
              className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
              href={href}
            >
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-3 text-4xl font-black text-slate-950">{value}</p>
            </Link>
          ))}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {operationalCounters.map(([label, value, href]) => (
            <Link
              key={label}
              className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
              href={href}
            >
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">
                Последние заказы
              </h2>
              <Link
                className="text-sm font-bold text-[#1157ff]"
                href="/admin/orders"
              >
                Все заказы
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {latestOrders.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm font-bold text-slate-500">
                  Заказов пока нет.
                </div>
              ) : (
                latestOrders.map((order) => (
                  <Link
                    key={order.id}
                    className="grid gap-3 py-3 text-sm transition hover:text-[#1157ff] md:grid-cols-[1fr_auto]"
                    href={`/admin/orders/${order.id}`}
                  >
                    <span>
                      <span className="font-black">{order.number}</span>
                      <span className="ml-2 text-slate-500">
                        {order.companyName}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-slate-500">
                        {formatDateTime(order.createdAt)} ·{" "}
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </span>
                    <span className="font-black">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">
                Ошибки интеграций
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {errorCounters.map(([label, value, href]) => (
                  <Link
                    key={label}
                    className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100 transition hover:text-[#1157ff]"
                    href={href}
                  >
                    <p className="text-sm font-bold text-slate-500">{label}</p>
                    <p
                      className={
                        value > 0
                          ? "mt-2 text-3xl font-black text-red-600"
                          : "mt-2 text-3xl font-black text-slate-950"
                      }
                    >
                      {value}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-950">
                Последние компании
              </h2>
              <div className="mt-4 divide-y divide-slate-100">
                {latestCompanies.length === 0 ? (
                  <div className="flex min-h-20 items-center justify-center text-sm font-bold text-slate-500">
                    Компаний пока нет.
                  </div>
                ) : (
                  latestCompanies.map((company) => (
                    <Link
                      key={company.id}
                      className="block py-3 text-sm transition hover:text-[#1157ff]"
                      href={`/admin/companies/${company.id}`}
                    >
                      <p className="font-black text-slate-950">{company.name}</p>
                      <p className="mt-1 font-semibold text-slate-500">
                        ИНН {company.inn} · {formatDateTime(company.createdAt)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-950">
            Последние сообщения
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {latestMessages.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center text-sm font-bold text-slate-500">
                Сообщений пока нет.
              </div>
            ) : (
              latestMessages.map((message) => (
                <Link
                  key={message.id}
                  className="block py-3 text-sm transition hover:text-[#1157ff]"
                  href={`/admin/chats/${message.chatId}`}
                >
                  <p className="font-black text-slate-950">
                    {message.companyName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-slate-600">
                    {message.text ?? "Вложение без текста"}
                  </p>
                  <p className="mt-1 font-semibold text-slate-500">
                    {message.senderType} · {message.deliveryStatus} ·{" "}
                    {formatDateTime(message.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">
                Компании без рекомендуемых документов
              </h2>
              <Link
                className="text-sm font-bold text-[#1157ff]"
                href="/admin/companies"
              >
                Все компании
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {companiesMissingRequiredDocuments.length === 0 ? (
                <div className="flex min-h-20 items-center justify-center text-sm font-bold text-emerald-700">
                  У всех компаний есть рекомендуемые документы.
                </div>
              ) : (
                companiesMissingRequiredDocuments.map((company) => (
                  <Link
                    className="block py-3 text-sm transition hover:text-[#1157ff]"
                    href={`/admin/companies/${company.id}`}
                    key={company.id}
                  >
                    <p className="font-black text-slate-950">{company.name}</p>
                    <p className="mt-1 font-semibold text-slate-500">
                      ИНН {company.inn}
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-700">
                      {!company.hasCompanyCard ? "Нет карточки компании" : null}
                      {!company.hasCompanyCard && !company.hasCharter ? " · " : null}
                      {!company.hasCharter ? "Нет уставных документов" : null}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-950">
                Новые документы покупателей и продавцов
              </h2>
              <Link
                className="text-sm font-bold text-[#1157ff]"
                href="/admin/documents"
              >
                Все документы
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {latestDocuments.length === 0 ? (
                <div className="flex min-h-20 items-center justify-center text-sm font-bold text-slate-500">
                  Новых документов пока нет.
                </div>
              ) : (
                latestDocuments.map((document) => (
                  <Link
                    className="block py-3 text-sm transition hover:text-[#1157ff]"
                    href="/admin/documents"
                    key={document.id}
                  >
                    <p className="font-black text-slate-950">{document.title}</p>
                    <p className="mt-1 font-semibold text-slate-500">
                      {getDocumentTypeLabel(document.type)} ·{" "}
                      {document.buyerCompanyName ??
                        document.sellerName ??
                        document.target}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {formatDateTime(document.createdAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {adminModules.map((module) => {
            const badge =
              module.title === "Уведомления"
                ? unreadNotifications
                : module.title === "Заказы"
                  ? acceptedOrdersCount
                  : module.title === "Товары" ||
                      module.title === "Модерация товаров"
                    ? moderationCounter?.count ?? 0
                    : module.title === "Чаты"
                      ? pendingChatCount
                    : 0;

            return (
            <section
              key={module.title}
              className="relative rounded-lg bg-white p-5 shadow-sm"
            >
              {badge > 0 ? (
                <span className="absolute right-4 top-4 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
              <h2 className="text-base font-bold">{module.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {module.description}
              </p>
              {module.href ? (
                <Link
                  className="mt-4 inline-flex rounded-lg bg-[#1157ff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  href={module.href}
                >
                  {module.actionLabel ?? "Открыть"}
                </Link>
              ) : null}
            </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
