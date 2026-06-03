export const orderStatusLabels: Record<string, string> = {
  new: "Новый",
  awaiting_payment: "Ожидание оплаты",
  paid: "Оплачен",
  issued: "Выдан",
  closed: "Закрыт",
  cancelled: "Отменен",
};

export function getOrderStatusLabel(status: string) {
  return orderStatusLabels[status] ?? status;
}
