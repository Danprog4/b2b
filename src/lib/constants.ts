export const APP_NAME = "Сити Маркет";

export const marketplaceCategories = [
  "Строительные материалы",
  "Металлопрокат",
  "Запчасти",
  "Оборудование",
  "Материалы для складов",
  "Продукты питания",
  "Бытовая химия",
  "Электроника",
];

export const orderStatuses = [
  "new",
  "awaiting_payment",
  "paid",
  "issued",
  "closed",
  "cancelled",
] as const;

export const documentFormats = [
  "pdf",
  "docx",
  "jpg",
  "png",
  "xls",
  "xlsx",
] as const;
