import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { formatMoscowDateTime } from "@/lib/datetime"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDateTime(value: Date | string) {
  return formatMoscowDateTime(value)
}
