import { orderStatuses } from "@/lib/constants";

export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusLabels: Record<OrderStatus, string> = {
  accepted: "Принят",
  paid: "Оплачен",
  issued: "Выдан",
  cancelled: "Отменен",
};

export const orderStatusClassNames: Record<OrderStatus, string> = {
  accepted: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  issued: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const allowedOrderStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  accepted: ["paid", "cancelled"],
  paid: ["issued", "cancelled"],
  issued: [],
  cancelled: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}

export function canTransitionOrderStatus(from: string, to: string) {
  if (!isOrderStatus(from) || !isOrderStatus(to)) {
    return false;
  }

  return from === to || allowedOrderStatusTransitions[from].includes(to);
}

export function getOrderStatusLabel(status: string) {
  return isOrderStatus(status) ? orderStatusLabels[status] : status;
}

export function getOrderStatusClassName(status: string) {
  return isOrderStatus(status)
    ? orderStatusClassNames[status]
    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}
