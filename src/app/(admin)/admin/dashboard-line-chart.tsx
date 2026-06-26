"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  type YAxisTickContentProps,
  XAxis,
  YAxis,
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

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatAxisDate(value: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function formatTooltipDate(value: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatChartValue(value: number, mode: "currency" | "number") {
  if (mode === "currency") {
    return `${new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(value)} ₽`;
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAxisValue(value: number, mode: "currency" | "number") {
  if (mode === "currency") {
    if (Math.abs(value) >= 1000) {
      const compactValue = value / 1000;

      return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 1,
      })
        .format(compactValue)
        .replace(",", ".")}к`;
    }

    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function renderYAxisTick(
  props: YAxisTickContentProps,
  mode: "currency" | "number",
) {
  return (
    <text
      className="fill-muted-foreground"
      dy={4}
      fontSize={12}
      textAnchor="start"
      x={0}
      y={props.y}
    >
      {formatAxisValue(Number(props.payload.value), mode)}
    </text>
  );
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
  const yAxisWidth = 44;
  const chartKey = `${points[0]?.date ?? "empty"}-${points[points.length - 1]?.date ?? "empty"}-${points.length}`;
  const chartConfig = {
    value: {
      label: title,
      color: accentColor,
    },
  } satisfies ChartConfig;

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
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
            data={points}
            key={chartKey}
            margin={{
              left: 0,
              right: 28,
            }}
          >
            <CartesianGrid vertical={false} />
            <YAxis
              allowDecimals={valueMode !== "number"}
              axisLine={false}
              tickLine={false}
              tickMargin={16}
              tick={(props) => renderYAxisTick(props, valueMode)}
              width={yAxisWidth}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => formatAxisDate(String(value))}
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
