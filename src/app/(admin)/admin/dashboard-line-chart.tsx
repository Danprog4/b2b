"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PeriodPicker } from "./period-picker";

export type DashboardChartPoint = {
  date: string;
  label: string;
  value: number;
};

type DashboardChartDataPoint = DashboardChartPoint & {
  timestamp: number;
};

function getLocalTimestamp(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return Number.NaN;
  }

  return new Date(year, month - 1, day).getTime();
}

function formatAxisDate(value: number | string) {
  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function buildTimeTicks(points: DashboardChartDataPoint[]) {
  const first = points[0]?.timestamp;
  const last = points[points.length - 1]?.timestamp;

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return [];
  }

  if (points.length <= 8) {
    return points.map((point) => point.timestamp);
  }

  const tickCount = points.length <= 16 ? 5 : 6;
  const step = (last - first) / (tickCount - 1);

  return Array.from({ length: tickCount }, (_, index) => {
    if (index === 0) {
      return first;
    }

    if (index === tickCount - 1) {
      return last;
    }

    return first + step * index;
  });
}

function formatTooltipDate(value: number | string) {
  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
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

export function DashboardLineChart({
  accentColor,
  title,
  points,
  periodEndValue,
  periodEndParamName,
  periodLabel,
  periodStartParamName,
  periodStartValue,
  valueMode,
}: {
  accentColor: string;
  title: string;
  points: DashboardChartPoint[];
  periodEndValue: string;
  periodEndParamName: string;
  periodLabel: string;
  periodStartParamName: string;
  periodStartValue: string;
  valueMode: "currency" | "number";
}) {
  const totalValue = points.reduce((sum, point) => sum + point.value, 0);
  const chartData = points.map((point) => ({
    ...point,
    timestamp: getLocalTimestamp(point.date),
  }));
  const timeTicks = buildTimeTicks(chartData);
  const chartConfig = {
    value: {
      label: title,
      color: accentColor,
    },
  } satisfies ChartConfig;

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {formatChartValue(totalValue, valueMode)} за период
          </p>
        </div>
        <PeriodPicker
          endDateValue={periodEndValue}
          endParamName={periodEndParamName}
          periodLabel={periodLabel}
          startDateValue={periodStartValue}
          startParamName={periodStartParamName}
        />
      </div>
      <div className="mx-4 mb-4 rounded-xl bg-gradient-to-b from-slate-50 to-white p-3 ring-1 ring-slate-100">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 28,
              right: 28,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              padding={{ left: 8, right: 8 }}
              ticks={timeTicks}
              tickFormatter={(value) => formatAxisDate(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  formatter={(value) => (
                    <span className="font-mono font-semibold tabular-nums text-slate-950">
                      {formatChartValue(Number(value), valueMode)}
                    </span>
                  )}
                  indicator="dot"
                  labelClassName="text-slate-500"
                  labelFormatter={(value) => formatTooltipDate(String(value))}
                  nameKey="value"
                />
              }
              cursor={{ stroke: accentColor, strokeDasharray: "4 4" }}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  );
}
