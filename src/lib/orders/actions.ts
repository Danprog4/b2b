"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  cartItems,
  invoices,
  orders,
  orderItems,
  products,
  sellers,
} from "@/db/schema";
import { getCompanyDocumentReadiness } from "@/lib/account/company-documents";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { requireUser } from "@/lib/auth/session";
import { addProductToBuyerCart } from "@/lib/cart/actions";
import { getCurrentCart } from "@/lib/cart/queries";
import { generateOrderInvoice } from "@/lib/invoices/generation";
import {
  getNextInvoiceNumber,
  getNextOrderNumber,
} from "@/lib/numbering/sequences";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return toMoney(value).toFixed(2);
}

function calculateVatAmount(amountWithVat: number, vatRate: number) {
  if (vatRate <= 0) {
    return 0;
  }

  return toMoney(amountWithVat * (vatRate / (100 + vatRate)));
}

export async function createOrderAction(formData: FormData) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    redirect("/checkout?error=company");
  }

  const buyerCompanyId = user.buyerCompanyId;
  const cart = await getCurrentCart();

  if (!cart.cartId || cart.lines.length === 0) {
    redirect("/cart");
  }

  const cartId = cart.cartId;

  if (cart.lines.some((line) => !line.isActive)) {
    redirect("/cart?error=product_unavailable");
  }

  const comment = getString(formData, "comment");
  let createdOrderId = "";
  const documentReadiness = await getCompanyDocumentReadiness(buyerCompanyId);

  if (!documentReadiness.isReady) {
    redirect("/checkout?error=company_documents");
  }

  await db.transaction(async (tx) => {
    const [company] = await tx
      .select({
        type: buyerCompanies.type,
        name: buyerCompanies.name,
        inn: buyerCompanies.inn,
        kpp: buyerCompanies.kpp,
        ogrn: buyerCompanies.ogrn,
        legalAddress: buyerCompanies.legalAddress,
        bankDetails: buyerCompanies.bankDetails,
        contactEmail: buyerCompanies.contactEmail,
        contactPhone: buyerCompanies.contactPhone,
        status: buyerCompanies.status,
      })
      .from(buyerCompanies)
      .where(eq(buyerCompanies.id, buyerCompanyId))
      .limit(1);

    if (!company) {
      throw new Error("buyer_company_not_found");
    }

    if (getCompanyMissingFields(company).length > 0) {
      redirect("/checkout?error=company_details");
    }

    if (company.status === "blocked") {
      redirect("/checkout?error=company_blocked");
    }

    const rows = await tx
      .select({
        itemId: cartItems.id,
        productId: products.id,
        sellerId: products.sellerId,
        sellerCommissionRate: sellers.commissionRate,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        quantity: cartItems.quantity,
        priceWithVat: products.priceWithVat,
        vatRate: products.vatRate,
        isActive: products.isActive,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(sellers, eq(products.sellerId, sellers.id))
      .where(eq(cartItems.cartId, cartId));

    if (rows.length === 0 || rows.some((row) => !row.isActive)) {
      throw new Error("cart_unavailable");
    }

    const calculatedItems = rows.map((row) => {
      const quantity = Number(row.quantity);
      const priceWithVat = Number(row.priceWithVat);
      const vatRate = Number(row.vatRate ?? 22);
      const lineTotal = toMoney(quantity * priceWithVat);
      const vatAmount = calculateVatAmount(lineTotal, vatRate);
      const commissionRate = Number(row.sellerCommissionRate ?? 5);

      return {
        productId: row.productId,
        sellerId: row.sellerId,
        productNameSnapshot: row.productName,
        skuSnapshot: row.sku,
        unitSnapshot: row.unit,
        quantity: String(quantity),
        priceWithVat: formatMoney(priceWithVat),
        vatRate: formatMoney(vatRate),
        vatAmount: formatMoney(vatAmount),
        lineTotal: formatMoney(lineTotal),
        commissionAmount: formatMoney(lineTotal * (commissionRate / 100)),
      };
    });

    const totalAmount = toMoney(
      calculatedItems.reduce((sum, item) => sum + Number(item.lineTotal), 0),
    );
    const vatAmount = toMoney(
      calculatedItems.reduce((sum, item) => sum + Number(item.vatAmount), 0),
    );

    const orderNumber = await getNextOrderNumber();
    const invoiceNumber = await getNextInvoiceNumber();
    const [order] = await tx
      .insert(orders)
      .values({
        number: orderNumber,
        userId: user.id,
        buyerCompanyId,
        status: "new",
        totalAmount: formatMoney(totalAmount),
        vatAmount: formatMoney(vatAmount),
        comment: comment || null,
        technicalState: {
          invoiceGenerated: false,
          invoiceGenerating: true,
          emailSent: false,
        },
      })
      .returning({ id: orders.id });

    await tx.insert(invoices).values({
      number: invoiceNumber,
      orderId: order.id,
      status: "pending",
    });

    await tx.insert(orderItems).values(
      calculatedItems.map((item) => ({
        orderId: order.id,
        ...item,
      })),
    );

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      metadata: {
        status: "new",
        totalAmount: formatMoney(totalAmount),
      },
    });

    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));

    createdOrderId = order.id;
  });

  await generateOrderInvoice(createdOrderId, user.id, { source: "checkout" });

  revalidatePath("/cart");
  revalidatePath("/account");
  revalidatePath("/account/orders");

  redirect(`/checkout/success?orderId=${createdOrderId}`);
}

export async function repeatOrderAction(formData: FormData) {
  const user = await requireUser(["buyer"]);
  const orderId = getString(formData, "orderId");

  if (!user.buyerCompanyId || !orderId) {
    redirect("/account/orders");
  }

  const [order] = await db
    .select({
      id: orders.id,
      buyerCompanyId: orders.buyerCompanyId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.buyerCompanyId !== user.buyerCompanyId) {
    redirect("/account/orders");
  }

  const items = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      isActive: products.isActive,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));

  let addedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!item.productId || !item.isActive) {
      skippedCount += 1;
      continue;
    }

    const result = await addProductToBuyerCart(item.productId, Number(item.quantity));

    if (result.ok) {
      addedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  revalidatePath("/cart");
  revalidatePath(`/account/orders/${order.id}`);

  const params = new URLSearchParams({
    repeated: String(addedCount),
  });

  if (skippedCount > 0) {
    params.set("skipped", String(skippedCount));
  }

  redirect(`/cart?${params.toString()}`);
}
