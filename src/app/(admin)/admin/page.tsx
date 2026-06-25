import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Bell } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { notifications, orderItems, orders, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/utils";
import { PeriodPicker } from "./period-picker";

type ChartPoint = {
  label: string;
  value: number;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const chartDays = 7;

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
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function getChartPeriod(searchParams: Awaited<SearchParams>) {
  const defaultStartDate = getDefaultChartStartDate();
  const defaultEndDate = getDefaultChartEndDate();
  const fromParam = getParam(searchParams, "from");
  const toParam = getParam(searchParams, "to");
  const parsedStartDate = parseDateInput(fromParam);
  const parsedEndDate = parseDateInput(toParam, true);

  if (parsedStartDate && parsedEndDate && parsedStartDate <= parsedEndDate) {
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

function getPeriodLabel(dayCount: number) {
  return `${dayCount} ${dayCount === 1 ? "день" : "дней"}`;
}

function getDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatChartValue(value: number, mode: "currency" | "number") {
  if (mode === "currency") {
    return new Intl.NumberFormat("ru-RU", {
      currency: "RUB",
      notation: "compact",
      style: "currency",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildChartPoints(
  dateKeys: string[],
  rows: { day: string; value: number | string }[],
) {
  const valuesByDay = new Map(
    rows.map((row) => [row.day, Number(row.value) || 0]),
  );

  return dateKeys.map((dateKey) => ({
    label: getDayLabel(dateKey),
    value: valuesByDay.get(dateKey) ?? 0,
  }));
}

function LineChart({
  title,
  points,
  periodEndValue,
  periodLabel,
  periodStartValue,
  valueMode,
  strokeClassName,
}: {
  title: string;
  points: ChartPoint[];
  periodEndValue: string;
  periodLabel: string;
  periodStartValue: string;
  valueMode: "currency" | "number";
  strokeClassName: string;
}) {
  const width = 980;
  const height = 300;
  const paddingX = 54;
  const paddingTop = 58;
  const paddingBottom = 46;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const realMaxValue = Math.max(...points.map((point) => point.value), 0);
  const scaleMaxValue = realMaxValue > 0 ? realMaxValue : 1;
  const coordinates = points.map((point, index) => {
    const x =
      paddingX + (plotWidth * index) / Math.max(points.length - 1, 1);
    const y =
      paddingTop + plotHeight - (point.value / scaleMaxValue) * plotHeight;

    return { ...point, x, y };
  });
  const linePoints = coordinates
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const labelStep = Math.max(1, Math.ceil(points.length / 10));
  const gridLines = [0, 1, 2, 3].map((index) => {
    const y = paddingTop + (plotHeight * index) / 3;
    const value = realMaxValue - (realMaxValue * index) / 3;

    return { y, value };
  });

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <PeriodPicker
          endDateValue={periodEndValue}
          periodLabel={periodLabel}
          startDateValue={periodStartValue}
        />
      </div>
      <div className="mt-4 rounded-lg bg-slate-100 p-3">
        <svg
          aria-label={title}
          className="h-[300px] w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {gridLines.map((line) => (
            <g key={line.y}>
              <line
                className="stroke-slate-200"
                strokeWidth="1"
                x1={paddingX}
                x2={width - paddingX}
                y1={line.y}
                y2={line.y}
              />
              <text
                className="fill-slate-400 text-[11px] font-bold"
                x={paddingX - 14}
                y={line.y + 4}
                textAnchor="end"
              >
                {formatChartValue(line.value, valueMode)}
              </text>
            </g>
          ))}
          <polyline
            className={strokeClassName}
            fill="none"
            points={linePoints}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {coordinates.map((point, index) => (
            <g key={point.label}>
              <circle
                className="fill-white stroke-slate-950"
                cx={point.x}
                cy={point.y}
                r="5"
                strokeWidth="3"
              />
              {index % labelStep === 0 || index === coordinates.length - 1 ? (
                <text
                  className="fill-slate-500 text-[12px] font-bold"
                  textAnchor="middle"
                  x={point.x}
                  y={height - 14}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireUser(["admin"]);
  const search = (await searchParams) ?? {};
  const { startDate: chartStartDate, endDate: chartEndDate } =
    getChartPeriod(search);
  const dateKeys = getDateKeys(chartStartDate, chartEndDate);
  const periodLabel = getPeriodLabel(dateKeys.length);
  const salesDay = sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`;
  const userDay = sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`;
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
          gte(users.createdAt, chartStartDate),
          lte(users.createdAt, chartEndDate),
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
          gte(users.createdAt, chartStartDate),
          lte(users.createdAt, chartEndDate),
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
  const newBuyerPoints = buildChartPoints(dateKeys, newBuyerRows);
  const periodStartValue = toDateInputValue(chartStartDate);
  const periodEndValue = toDateInputValue(chartEndDate);
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
      label: "Новые покупатели",
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

        <div className="mt-5 grid gap-5">
          <LineChart
            periodEndValue={periodEndValue}
            periodLabel={periodLabel}
            periodStartValue={periodStartValue}
            points={commissionPoints}
            strokeClassName="stroke-[#1157ff]"
            title="Комиссия"
            valueMode="currency"
          />
          <LineChart
            periodEndValue={periodEndValue}
            periodLabel={periodLabel}
            periodStartValue={periodStartValue}
            points={newBuyerPoints}
            strokeClassName="stroke-emerald-600"
            title="Новые юзеры"
            valueMode="number"
          />
        </div>
      </div>
    </main>
  );
}
