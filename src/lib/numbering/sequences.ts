import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { invoices, orders, products, sellers } from "@/db/schema";

async function getNextSequenceValue(sequenceName: string) {
  const [row] = await db.execute<{ value: string }>(
    sql`select nextval(${sql.raw(`'"${sequenceName}"'`)})::text as value`,
  );

  if (!row?.value) {
    throw new Error(`sequence_next_value_failed:${sequenceName}`);
  }

  const value = Number(row.value);

  if (!Number.isFinite(value)) {
    throw new Error(`sequence_next_value_invalid:${sequenceName}`);
  }

  return value;
}

function formatNumber(prefix: string, value: number) {
  return `${prefix}-${String(value).padStart(6, "0")}`;
}

export async function getNextOrderNumber() {
  while (true) {
    const number = formatNumber(
      "ORD",
      await getNextSequenceValue("city_market_order_number_seq"),
    );
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.number, number))
      .limit(1);

    if (!existing) {
      return number;
    }
  }
}

export async function getNextInvoiceNumber() {
  while (true) {
    const number = formatNumber(
      "INV",
      await getNextSequenceValue("city_market_invoice_number_seq"),
    );
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.number, number))
      .limit(1);

    if (!existing) {
      return number;
    }
  }
}

export async function getNextProductSku() {
  while (true) {
    const sku = formatNumber(
      "CM",
      await getNextSequenceValue("city_market_product_sku_seq"),
    );
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    if (!existing) {
      return sku;
    }
  }
}

export async function getNextSellerContractNumber() {
  while (true) {
    const contractNumber = formatNumber(
      "SC",
      await getNextSequenceValue("city_market_seller_contract_seq"),
    );
    const [existing] = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.contractNumber, contractNumber))
      .limit(1);

    if (!existing) {
      return contractNumber;
    }
  }
}
