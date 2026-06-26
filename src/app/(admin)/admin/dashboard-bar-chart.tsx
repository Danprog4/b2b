"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
  label: string;
  value: number;
};

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

export function DashboardBarChart({
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
  const visibleTickGap = points.length > 14 ? 28 : 18;
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
        <ChartContainer config={chartConfig} className="h-[360px] w-full">
          <BarChart
            accessibilityLayer
            data={points}
            margin={{ top: 24, right: 18, bottom: 12, left: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              minTickGap={visibleTickGap}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              allowDecimals={valueMode !== "number"}
              axisLine={false}
              tickFormatter={(value) => formatChartValue(Number(value), valueMode)}
              tickLine={false}
              tickMargin={10}
              tickCount={4}
              width={72}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-mono font-semibold tabular-nums text-slate-950">
                      {formatChartValue(Number(value), valueMode)}
                    </span>
                  )}
                  indicator="dot"
                  labelClassName="text-slate-500"
                  nameKey="value"
                />
              }
              cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              maxBarSize={34}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}
