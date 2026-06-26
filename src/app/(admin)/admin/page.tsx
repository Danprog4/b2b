import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Bell } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { notifications, orderItems, orders, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/utils";
import { DashboardLineChart } from "./dashboard-line-chart";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const chartDays = 7;
const maxChartDays = 30;

function getDefaultChartStartDate() {
  return getRangeStartDate(chartDays);
}

function getRangeStartDate(days: number) {
  const date = getDefaultChartEndDate();
  date.setDate(date.getDate() - (days - 1));
  date.setHours(0, 0, 0, 0);

  return date;
}

function getDefaultChartEndDate() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);

  return date;
}

function getParam(search: Awaited<SearchParams>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseDateInput(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateKeys(startDate: Date, endDate: Date) {
  const keys: string[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    keys.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function getChartPeriod(
  searchParams: Awaited<SearchParams>,
  startParamName: string,
  endParamName: string,
  fallbackStartParamName?: string,
  fallbackEndParamName?: string,
) {
  const defaultStartDate = getDefaultChartStartDate();
  const defaultEndDate = getDefaultChartEndDate();
  const fromParam =
    getParam(searchParams, startParamName) ||
    (fallbackStartParamName ? getParam(searchParams, fallbackStartParamName) : "");
  const toParam =
    getParam(searchParams, endParamName) ||
    (fallbackEndParamName ? getParam(searchParams, fallbackEndParamName) : "");
  const parsedStartDate = parseDateInput(fromParam);
  const parsedEndDate = parseDateInput(toParam, true);

  if (parsedStartDate && parsedEndDate && parsedStartDate <= parsedEndDate) {
    const dayCount = getDateKeys(parsedStartDate, parsedEndDate).length;

    if (dayCount > maxChartDays) {
      return {
        startDate: getRangeStartDateFromEndDate(parsedEndDate, maxChartDays),
        endDate: parsedEndDate,
      };
    }

    return {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    };
  }

  return {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
  };
}

function getRangeStartDateFromEndDate(endDate: Date, days: number) {
  const date = new Date(endDate);
  date.setDate(date.getDate() - (days - 1));
  date.setHours(0, 0, 0, 0);

  return date;
}

function getPeriodLabel(dayCount: number) {
  return `${dayCount} ${dayCount === 1 ? "день" : "дней"}`;
}

function getDayLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-");

  return `${day}.${month}`;
}

function buildChartPoints(
  dateKeys: string[],
  rows: { day: string; value: number | string }[],
) {
  const valuesByDay = new Map(
    rows.map((row) => [row.day, Number(row.value) || 0]),
  );

  return dateKeys.map((dateKey) => ({
    date: dateKey,
    label: getDayLabel(dateKey),
    value: valuesByDay.get(dateKey) ?? 0,
  }));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const { startDate: chartStartDate, endDate: chartEndDate } =
    getChartPeriod(search, "commissionFrom", "commissionTo", "from", "to");
  const dateKeys = getDateKeys(chartStartDate, chartEndDate);
  const periodLabel = getPeriodLabel(dateKeys.length);
  const {
    startDate: newBuyerChartStartDate,
    endDate: newBuyerChartEndDate,
  } = getChartPeriod(search, "usersFrom", "usersTo");
  const newBuyerDateKeys = getDateKeys(
    newBuyerChartStartDate,
    newBuyerChartEndDate,
  );
  const newBuyerPeriodLabel = getPeriodLabel(newBuyerDateKeys.length);
  const salesDay = sql<string>`to_char(${orders.createdAt} at time zone 'Asia/Almaty', 'YYYY-MM-DD')`;
  const userDay = sql<string>`to_char(${users.createdAt} at time zone 'Asia/Almaty', 'YYYY-MM-DD')`;
  const commissionAmountSql = sql<string>`
    coalesce(
      sum(
        case
          when ${orderItems.commissionAmount}::numeric > 0
            then ${orderItems.commissionAmount}::numeric
          else ${orderItems.lineTotal}::numeric * 0.05
        end
      ),
      0
    )
  `;
  const [
    notificationCounter,
    financeSummary,
    newBuyerCounter,
    totalOrderCounter,
    commissionRows,
    newBuyerRows,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .then(([row]) => row),
    db
      .select({
        salesAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        commissionAmount: commissionAmountSql,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(inArray(orders.status, ["paid", "issued"]))
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.role, "buyer"),
          gte(users.createdAt, newBuyerChartStartDate),
          lte(users.createdAt, newBuyerChartEndDate),
        ),
      )
      .then(([row]) => row),
    db
      .select({ count: count() })
      .from(orders)
      .then(([row]) => row),
    db
      .select({
        day: salesDay,
        value: commissionAmountSql,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          inArray(orders.status, ["paid", "issued"]),
          gte(orders.createdAt, chartStartDate),
          lte(orders.createdAt, chartEndDate),
        ),
      )
      .groupBy(salesDay)
      .orderBy(salesDay),
    db
      .select({
        day: userDay,
        value: count(),
      })
      .from(users)
      .where(
        and(
          eq(users.role, "buyer"),
          gte(users.createdAt, newBuyerChartStartDate),
          lte(users.createdAt, newBuyerChartEndDate),
        ),
      )
      .groupBy(userDay)
      .orderBy(userDay),
  ]);
  const unreadNotifications = notificationCounter?.count ?? 0;
  const salesAmount = financeSummary?.salesAmount ?? "0";
  const commissionAmount = financeSummary?.commissionAmount ?? "0";
  const newBuyerUsers = newBuyerCounter?.count ?? 0;
  const totalOrders = totalOrderCounter?.count ?? 0;
  const commissionPoints = buildChartPoints(dateKeys, commissionRows);
  const newBuyerPoints = buildChartPoints(newBuyerDateKeys, newBuyerRows);
  const periodStartValue = toDateInputValue(chartStartDate);
  const periodEndValue = toDateInputValue(chartEndDate);
  const newBuyerPeriodStartValue = toDateInputValue(newBuyerChartStartDate);
  const newBuyerPeriodEndValue = toDateInputValue(newBuyerChartEndDate);
  const kpiCards = [
    {
      label: "Сумма продаж",
      value: formatCurrency(salesAmount),
      href: "/admin/commissions",
    },
    {
      label: "Моя комиссия",
      value: formatCurrency(commissionAmount),
      href: "/admin/commissions",
    },
    {
      label: "Новые пользователи",
      value: newBuyerUsers,
      href: "/admin/users?role=buyer",
    },
    {
      label: "Все заказы",
      value: totalOrders,
      href: "/admin/orders",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1157ff]">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Админ-панель
            </h1>
          </div>
          <Link
            className="relative inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
            href="/admin/notifications"
          >
            <Bell size={18} />
            Уведомления
            {unreadNotifications > 0 ? (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                +{unreadNotifications > 99 ? "99" : unreadNotifications}
              </span>
            ) : null}
          </Link>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
          {kpiCards.map((card) => (
            <Link
              className="min-w-0 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-[#1157ff] hover:shadow-md"
              href={card.href}
              key={card.label}
            >
              <p className="truncate text-sm font-bold text-slate-600">
                {card.label}
              </p>
              <p className="mt-4 break-words text-3xl font-black tracking-normal text-slate-950">
                {card.value}
              </p>
            </Link>
          ))}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <DashboardLineChart
            accentColor="#1157ff"
            periodEndValue={periodEndValue}
            periodEndParamName="commissionTo"
            periodLabel={periodLabel}
            periodStartParamName="commissionFrom"
            periodStartValue={periodStartValue}
            points={commissionPoints}
            title="Комиссия"
            valueMode="currency"
          />
          <DashboardLineChart
            accentColor="#059669"
            periodEndValue={newBuyerPeriodEndValue}
            periodEndParamName="usersTo"
            periodLabel={newBuyerPeriodLabel}
            periodStartParamName="usersFrom"
            periodStartValue={newBuyerPeriodStartValue}
            points={newBuyerPoints}
            title="Новые пользователи"
            valueMode="number"
          />
        </div>
      </div>
    </main>
  );
}
