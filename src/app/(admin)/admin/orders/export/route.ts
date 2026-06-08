import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
  buyerCompanies,
  documents,
  invoices,
  orderItems,
  orders,
  sellers,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildMoscowDateStamp,
  formatMoscowDateTime,
  parseMoscowDateInput,
} from "@/lib/datetime";
import { getOrderStatusLabel } from "@/lib/orders/status";

const statusOptions = [
  "accepted",
  "paid",
  "issued",
  "cancelled",
] as const;

function formatDate(value: Date) {
  return formatMoscowDateTime(value);
}

function buildFilename() {
  const date = buildMoscowDateStamp();

  return `city-market-orders-${date}.xlsx`;
}

function parseDateInput(value: string | null, endOfDay = false) {
  return parseMoscowDateInput(value, endOfDay);
}

function parseMoneyInput(value: string | null) {
  if (!value) {
    return null;
  }

  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin" || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const company = searchParams.get("company")?.trim() ?? "";
  const inn = searchParams.get("inn")?.trim() ?? "";
  const documentsFilter = searchParams.get("documents")?.trim() ?? "";
  const dateFrom = parseDateInput(searchParams.get("dateFrom"));
  const dateTo = parseDateInput(searchParams.get("dateTo"), true);
  const amountFrom = parseMoneyInput(searchParams.get("amountFrom"));
  const amountTo = parseMoneyInput(searchParams.get("amountTo"));

  const documentCounts = db
    .select({
      orderId: documents.orderId,
      count: count(documents.id).as("documents_count"),
    })
    .from(documents)
    .where(eq(documents.isActive, true))
    .groupBy(documents.orderId)
    .as("document_counts");

  const whereConditions = [];

  if (statusOptions.includes(status as (typeof statusOptions)[number])) {
    whereConditions.push(eq(orders.status, status as (typeof statusOptions)[number]));
  }

  if (query.length >= 2) {
    const pattern = `%${query}%`;
    whereConditions.push(
      or(
        ilike(orders.number, pattern),
        ilike(buyerCompanies.name, pattern),
        ilike(buyerCompanies.inn, pattern),
        ilike(users.email, pattern),
      ),
    );
  }

  if (company) {
    whereConditions.push(ilike(buyerCompanies.name, `%${company}%`));
  }

  if (inn) {
    whereConditions.push(ilike(buyerCompanies.inn, `%${inn}%`));
  }

  if (dateFrom) {
    whereConditions.push(gte(orders.createdAt, dateFrom));
  }

  if (dateTo) {
    whereConditions.push(lte(orders.createdAt, dateTo));
  }

  if (amountFrom) {
    whereConditions.push(gte(orders.totalAmount, amountFrom));
  }

  if (amountTo) {
    whereConditions.push(lte(orders.totalAmount, amountTo));
  }

  if (documentsFilter === "with") {
    whereConditions.push(isNotNull(documentCounts.orderId));
  }

  if (documentsFilter === "without") {
    whereConditions.push(isNull(documentCounts.orderId));
  }

  const rows = await db
    .select({
      orderId: orders.id,
      number: orders.number,
      status: orders.status,
      totalAmount: orders.totalAmount,
      vatAmount: orders.vatAmount,
      comment: orders.comment,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      buyerName: users.name,
      buyerEmail: users.email,
      buyerPhone: users.phone,
      companyPhone: buyerCompanies.contactPhone,
      invoiceNumber: invoices.number,
      documentsCount: documentCounts.count,
      itemSku: orderItems.skuSnapshot,
      itemName: orderItems.productNameSnapshot,
      itemQuantity: orderItems.quantity,
      itemUnit: orderItems.unitSnapshot,
      itemPriceWithVat: orderItems.priceWithVat,
      itemLineTotal: orderItems.lineTotal,
      itemVatAmount: orderItems.vatAmount,
      itemCommissionAmount: orderItems.commissionAmount,
      sellerName: sellers.name,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(orders.buyerCompanyId, buyerCompanies.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(
      invoices,
      and(eq(invoices.orderId, orders.id), eq(invoices.isCurrent, true)),
    )
    .leftJoin(documentCounts, eq(documentCounts.orderId, orders.id))
    .leftJoin(sellers, eq(sellers.id, orderItems.sellerId))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((order) => ({
      "Номер заказа": order.number,
      Дата: formatDate(order.createdAt),
      "Дата обновления": formatDate(order.updatedAt),
      Компания: order.companyName,
      ИНН: order.companyInn,
      "Контактное лицо": order.buyerName ?? "",
      Email: order.buyerEmail,
      Телефон: order.buyerPhone ?? order.companyPhone ?? "",
      Статус: getOrderStatusLabel(order.status),
      "Сумма с НДС": Number(order.totalAmount),
      "НДС в сумме": Number(order.vatAmount),
      "Номер счета": order.invoiceNumber ?? "",
      Артикул: order.itemSku,
      Товар: order.itemName,
      Количество: Number(order.itemQuantity),
      "Ед. изм.": order.itemUnit,
      Цена: Number(order.itemPriceWithVat),
      "Сумма позиции": Number(order.itemLineTotal),
      "НДС позиции": Number(order.itemVatAmount),
      "Продавец по позиции": order.sellerName ?? "",
      Комиссия: Number(order.itemCommissionAmount),
      Комментарий: order.comment ?? "",
      Документы:
        Number(order.documentsCount ?? 0) > 0
          ? `Есть (${Number(order.documentsCount)})`
          : "Нет",
    })),
  );

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 30 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 36 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 30 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Заказы");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
  const filename = buildFilename();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
