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
  sellerOffers,
  sellers,
} from "@/db/schema";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { requireUser } from "@/lib/auth/session";
import { addProductToBuyerCart } from "@/lib/cart/actions";
import { getCurrentCart } from "@/lib/cart/queries";
import { generateOrderInvoice } from "@/lib/invoices/generation";
import {
  getNextInvoiceNumber,
  getNextOrderNumber,
} from "@/lib/numbering/sequences";
import {
  insertAdminNotifications,
  insertBuyerCompanyNotifications,
  insertSellerNotifications,
} from "@/lib/notifications/helpers";

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
  const orderNumber = await getNextOrderNumber();
  const invoiceNumber = await getNextInvoiceNumber();

  await db.transaction(async (tx) => {
    const [company] = await tx
      .select({
        type: buyerCompanies.type,
        name: buyerCompanies.name,
        inn: buyerCompanies.inn,
        kpp: buyerCompanies.kpp,
        ogrn: buyerCompanies.ogrn,
        directorName: buyerCompanies.directorName,
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
        sellerOfferId: sellerOffers.id,
        sellerId: sellerOffers.sellerId,
        sellerCommissionRate: sellers.commissionRate,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        quantity: cartItems.quantity,
        priceWithVat: sellerOffers.priceWithVat,
        vatRate: sellerOffers.vatRate,
        isActive: products.isActive,
        offerStatus: sellerOffers.status,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(sellerOffers, eq(cartItems.sellerOfferId, sellerOffers.id))
      .innerJoin(sellers, eq(sellerOffers.sellerId, sellers.id))
      .where(eq(cartItems.cartId, cartId));

    if (
      rows.length === 0 ||
      rows.some((row) => !row.isActive || row.offerStatus !== "published")
    ) {
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
        sellerOfferId: row.sellerOfferId,
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

    const [order] = await tx
      .insert(orders)
      .values({
        number: orderNumber,
        userId: user.id,
        buyerCompanyId,
        status: "accepted",
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
      isCurrent: true,
    });

    await tx.insert(orderItems).values(
      calculatedItems.map((item) => ({
        orderId: order.id,
        ...item,
      })),
    );

    const sellerIds = Array.from(
      new Set(
        calculatedItems
          .map((item) => item.sellerId)
          .filter((sellerId): sellerId is string => Boolean(sellerId)),
      ),
    );

    for (const sellerId of sellerIds) {
      await insertSellerNotifications(tx, {
        sellerId,
        type: "new_order",
        title: `Новый заказ ${orderNumber}`,
        body: "В заказе есть товары вашей компании.",
      });
    }

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "order.create",
      entityType: "order",
      entityId: order.id,
      metadata: {
        status: "accepted",
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
      sellerOfferId: orderItems.sellerOfferId,
      quantity: orderItems.quantity,
      isActive: products.isActive,
      offerStatus: sellerOffers.status,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(sellerOffers, eq(sellerOffers.id, orderItems.sellerOfferId))
    .where(eq(orderItems.orderId, order.id));

  let addedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!item.productId || !item.isActive || item.offerStatus !== "published") {
      skippedCount += 1;
      continue;
    }

    const result = await addProductToBuyerCart(
      item.productId,
      Number(item.quantity),
      item.sellerOfferId,
    );

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

export async function cancelAcceptedOrderAction(formData: FormData) {
  const user = await requireUser(["buyer"]);
  const orderId = getString(formData, "orderId");

  if (!user.buyerCompanyId || !orderId) {
    redirect("/account/orders");
  }

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      buyerCompanyId: orders.buyerCompanyId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.buyerCompanyId !== user.buyerCompanyId) {
    redirect("/account/orders");
  }

  if (order.status !== "accepted") {
    redirect(`/account/orders/${order.id}?cancelError=status`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    const sellerRows = await tx
      .select({ sellerId: orderItems.sellerId })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const sellerIds = Array.from(
      new Set(
        sellerRows
          .map((row) => row.sellerId)
          .filter((sellerId): sellerId is string => Boolean(sellerId)),
      ),
    );

    await insertBuyerCompanyNotifications(tx, {
      buyerCompanyId: order.buyerCompanyId,
      type: "order_cancelled",
      title: `Заказ ${order.number} отменен`,
      body: "Заказ отменен покупателем.",
    });

    await insertAdminNotifications(tx, {
      type: "order_cancelled_by_buyer",
      title: `Покупатель отменил заказ ${order.number}`,
      body: "Заказ был в статусе «Принят».",
      buyerCompanyId: order.buyerCompanyId,
    });

    for (const sellerId of sellerIds) {
      await insertSellerNotifications(tx, {
        sellerId,
        type: "order_cancelled",
        title: `Заказ ${order.number} отменен`,
        body: "Покупатель отменил заказ до оплаты.",
      });
    }

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "order.status_update",
      entityType: "order",
      entityId: order.id,
      metadata: {
        from: "accepted",
        to: "cancelled",
        source: "buyer_cancel",
      },
    });
  });

  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath("/account/notifications");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/notifications");
  revalidatePath("/seller");

  redirect(`/account/orders/${order.id}?cancelled=1`);
}
