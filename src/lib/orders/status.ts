import { orderStatuses } from "@/lib/constants";

export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusLabels: Record<OrderStatus, string> = {
  accepted: "Принят",
  paid: "Оплачен",
  issued: "Выдан",
  cancelled: "Отменен",
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
