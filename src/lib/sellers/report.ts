import { and, desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { buyerCompanies, orderItems, orders, sellers } from "@/db/schema";
import { getOrderStatusLabel } from "@/lib/orders/status";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getPayoutPeriod(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getPayoutStatus(status: string) {
  if (status === "paid" || status === "issued" || status === "closed") {
    return "К ручной выплате";
  }

  if (status === "cancelled") {
    return "Не выплачивается";
  }

  return "Ожидает оплаты покупателем";
}

export async function getSellerReportSource(sellerId: string) {
  const [seller] = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      inn: sellers.inn,
    })
    .from(sellers)
    .where(eq(sellers.id, sellerId))
    .limit(1);

  if (!seller) {
    return null;
  }

  const rows = await db
    .select({
      orderNumber: orders.number,
      orderStatus: orders.status,
      orderCreatedAt: orders.createdAt,
      orderUpdatedAt: orders.updatedAt,
      buyerCompanyName: buyerCompanies.name,
      buyerCompanyInn: buyerCompanies.inn,
      sku: orderItems.skuSnapshot,
      productName: orderItems.productNameSnapshot,
      quantity: orderItems.quantity,
      unit: orderItems.unitSnapshot,
      priceWithVat: orderItems.priceWithVat,
      lineTotal: orderItems.lineTotal,
      vatAmount: orderItems.vatAmount,
      commissionAmount: orderItems.commissionAmount,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(buyerCompanies, eq(buyerCompanies.id, orders.buyerCompanyId))
    .where(and(eq(orderItems.sellerId, seller.id)))
    .orderBy(desc(orders.createdAt), orderItems.createdAt);

  return { seller, rows };
}

export function buildSellerReportWorkbook(
  source: NonNullable<Awaited<ReturnType<typeof getSellerReportSource>>>,
) {
  const worksheet = XLSX.utils.json_to_sheet(
    source.rows.map((row) => {
      const lineTotal = Number(row.lineTotal);
      const commission = Number(row.commissionAmount);

      return {
        Продавец: source.seller.name,
        "ИНН продавца": source.seller.inn,
        "Номер заказа": row.orderNumber,
        "Дата заказа": formatDate(row.orderCreatedAt),
        "Дата обновления": formatDate(row.orderUpdatedAt),
        "Расчетный период": getPayoutPeriod(row.orderCreatedAt),
        "Статус заказа": getOrderStatusLabel(row.orderStatus),
        "Статус выплаты": getPayoutStatus(row.orderStatus),
        Покупатель: row.buyerCompanyName,
        "ИНН покупателя": row.buyerCompanyInn,
        Артикул: row.sku,
        Товар: row.productName,
        Количество: Number(row.quantity),
        "Ед. изм.": row.unit,
        "Цена с НДС": Number(row.priceWithVat),
        "Сумма позиции": lineTotal,
        "НДС позиции": Number(row.vatAmount),
        Комиссия: commission,
        "К выплате": lineTotal - commission,
      };
    }),
  );

  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 36 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет продавца");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}

export function buildSellerReportFilename(sellerInn: string) {
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date())
    .replaceAll(".", "-");

  return `city-market-seller-${sellerInn}-${date}.xlsx`;
}

export function createXlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
