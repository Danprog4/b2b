"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditEvents,
  orderItems,
  orders,
  products,
  sellerOffers,
  sellers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { generateOrderInvoice } from "@/lib/invoices/generation";
import {
  insertBuyerCompanyNotifications,
  insertSellerNotifications,
} from "@/lib/notifications/helpers";
import {
  canTransitionOrderStatus,
  getOrderStatusLabel,
  isOrderStatus,
} from "@/lib/orders/status";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function getQuantity(formData: FormData) {
  const parsed = Number(getString(formData, "quantity").replace(",", "."));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function regenerateInvoiceAfterOrderEdit(orderId: string, adminId: string) {
  const result = await generateOrderInvoice(orderId, adminId, {
    source: "admin",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account/notifications");
  revalidatePath("/seller");

  if (!result.ok) {
    redirect(`/admin/orders/${orderId}?orderEdited=1&invoiceError=1`);
  }

  redirect(`/admin/orders/${orderId}?orderEdited=1&invoiceRegenerated=1`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const admin = await requireUser(["admin"]);

  const orderId = getString(formData, "orderId");
  const status = getString(formData, "status");

  if (!orderId || !isOrderStatus(status)) {
    redirect("/admin/orders");
  }

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      userId: orders.userId,
      buyerCompanyId: orders.buyerCompanyId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    redirect("/admin/orders");
  }

  if (!canTransitionOrderStatus(order.status, status)) {
    redirect(`/admin/orders/${order.id}?statusError=1`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (order.status !== status) {
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
        type: "order_status_changed",
        title: `Статус заказа ${order.number} изменен`,
        body: `Новый статус: ${getOrderStatusLabel(status)}.`,
      });

      for (const sellerId of sellerIds) {
        await insertSellerNotifications(tx, {
          sellerId,
          type: "order_status_changed",
          title: `Статус заказа ${order.number} изменен`,
          body: `Новый статус: ${getOrderStatusLabel(status)}.`,
        });
      }

      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: "order.status_update",
        entityType: "order",
        entityId: order.id,
        metadata: {
          from: order.status,
          to: status,
        },
      });
    }
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath("/account/notifications");

  redirect(`/admin/orders/${order.id}`);
}

export async function updateOrderItemQuantityAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const itemId = getString(formData, "itemId");
  const quantity = getQuantity(formData);

  if (!orderId || !itemId || !quantity) {
    redirect("/admin/orders");
  }

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      redirect("/admin/orders");
    }

    if (order.status !== "accepted") {
      redirect(`/admin/orders/${order.id}?orderEditError=status`);
    }

    const [item] = await tx
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        sellerId: orderItems.sellerId,
        priceWithVat: orderItems.priceWithVat,
        vatRate: orderItems.vatRate,
        commissionRate: sellers.commissionRate,
      })
      .from(orderItems)
      .leftJoin(sellers, eq(sellers.id, orderItems.sellerId))
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)))
      .limit(1);

    if (!item) {
      redirect(`/admin/orders/${order.id}?orderEditError=item`);
    }

    const priceWithVat = Number(item.priceWithVat);
    const vatRate = Number(item.vatRate);
    const lineTotal = toMoney(quantity * priceWithVat);
    const commissionRate = Number(item.commissionRate ?? 5);
    const vatAmount = calculateVatAmount(lineTotal, vatRate);

    await tx
      .update(orderItems)
      .set({
        quantity: String(quantity),
        vatAmount: formatMoney(vatAmount),
        lineTotal: formatMoney(lineTotal),
        commissionAmount: formatMoney(lineTotal * (commissionRate / 100)),
        updatedAt: new Date(),
      })
      .where(eq(orderItems.id, item.id));

    const totals = await tx
      .select({
        totalAmount: orderItems.lineTotal,
        vatAmount: orderItems.vatAmount,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const totalAmount = totals.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );
    const totalVatAmount = totals.reduce(
      (sum, row) => sum + Number(row.vatAmount),
      0,
    );

    await tx
      .update(orders)
      .set({
        totalAmount: formatMoney(totalAmount),
        vatAmount: formatMoney(totalVatAmount),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "order.item_quantity_update",
      entityType: "order",
      entityId: order.id,
      metadata: {
        itemId: item.id,
        quantity,
      },
    });
  });

  await regenerateInvoiceAfterOrderEdit(orderId, admin.id);
}

export async function removeOrderItemAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const itemId = getString(formData, "itemId");

  if (!orderId || !itemId) {
    redirect("/admin/orders");
  }

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      redirect("/admin/orders");
    }

    if (order.status !== "accepted") {
      redirect(`/admin/orders/${order.id}?orderEditError=status`);
    }

    const existingItems = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    if (existingItems.length <= 1) {
      redirect(`/admin/orders/${order.id}?orderEditError=empty`);
    }

    const [item] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)))
      .limit(1);

    if (!item) {
      redirect(`/admin/orders/${order.id}?orderEditError=item`);
    }

    await tx.delete(orderItems).where(eq(orderItems.id, item.id));

    const totals = await tx
      .select({
        totalAmount: orderItems.lineTotal,
        vatAmount: orderItems.vatAmount,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const totalAmount = totals.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );
    const totalVatAmount = totals.reduce(
      (sum, row) => sum + Number(row.vatAmount),
      0,
    );

    await tx
      .update(orders)
      .set({
        totalAmount: formatMoney(totalAmount),
        vatAmount: formatMoney(totalVatAmount),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "order.item_remove",
      entityType: "order",
      entityId: order.id,
      metadata: {
        itemId: item.id,
      },
    });
  });

  await regenerateInvoiceAfterOrderEdit(orderId, admin.id);
}

export async function addOrderItemAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const sellerOfferId = getString(formData, "sellerOfferId");
  const quantity = getQuantity(formData);

  if (!orderId || !sellerOfferId || !quantity) {
    redirect("/admin/orders");
  }

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      redirect("/admin/orders");
    }

    if (order.status !== "accepted") {
      redirect(`/admin/orders/${order.id}?orderEditError=status`);
    }

    const [offer] = await tx
      .select({
        productId: products.id,
        sellerOfferId: sellerOffers.id,
        sellerId: sellerOffers.sellerId,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        priceWithVat: sellerOffers.priceWithVat,
        vatRate: sellerOffers.vatRate,
        commissionRate: sellers.commissionRate,
      })
      .from(sellerOffers)
      .innerJoin(products, eq(products.id, sellerOffers.productId))
      .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(
        and(
          eq(sellerOffers.id, sellerOfferId),
          eq(sellerOffers.status, "published"),
          eq(products.isActive, true),
        ),
      )
      .limit(1);

    if (!offer) {
      redirect(`/admin/orders/${order.id}?orderEditError=offer`);
    }

    const [existingItem] = await tx
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order.id),
          eq(orderItems.sellerOfferId, offer.sellerOfferId),
        ),
      )
      .limit(1);

    const nextQuantity = existingItem
      ? Number(existingItem.quantity) + quantity
      : quantity;
    const priceWithVat = Number(offer.priceWithVat);
    const vatRate = Number(offer.vatRate ?? 22);
    const lineTotal = toMoney(nextQuantity * priceWithVat);
    const vatAmount = calculateVatAmount(lineTotal, vatRate);
    const commissionRate = Number(offer.commissionRate ?? 5);
    const values = {
      productId: offer.productId,
      sellerOfferId: offer.sellerOfferId,
      sellerId: offer.sellerId,
      productNameSnapshot: offer.productName,
      skuSnapshot: offer.sku,
      unitSnapshot: offer.unit,
      quantity: String(nextQuantity),
      priceWithVat: formatMoney(priceWithVat),
      vatRate: formatMoney(vatRate),
      vatAmount: formatMoney(vatAmount),
      lineTotal: formatMoney(lineTotal),
      commissionAmount: formatMoney(lineTotal * (commissionRate / 100)),
      updatedAt: new Date(),
    };

    if (existingItem) {
      await tx
        .update(orderItems)
        .set(values)
        .where(eq(orderItems.id, existingItem.id));
    } else {
      await tx.insert(orderItems).values({
        orderId: order.id,
        ...values,
      });
    }

    const totals = await tx
      .select({
        totalAmount: orderItems.lineTotal,
        vatAmount: orderItems.vatAmount,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const totalAmount = totals.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );
    const totalVatAmount = totals.reduce(
      (sum, row) => sum + Number(row.vatAmount),
      0,
    );

    await tx
      .update(orders)
      .set({
        totalAmount: formatMoney(totalAmount),
        vatAmount: formatMoney(totalVatAmount),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: existingItem ? "order.item_quantity_update" : "order.item_add",
      entityType: "order",
      entityId: order.id,
      metadata: {
        sellerOfferId: offer.sellerOfferId,
        quantity,
        nextQuantity,
      },
    });
  });

  await regenerateInvoiceAfterOrderEdit(orderId, admin.id);
}

export async function changeOrderItemOfferAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");
  const itemId = getString(formData, "itemId");
  const sellerOfferId = getString(formData, "sellerOfferId");

  if (!orderId || !itemId || !sellerOfferId) {
    redirect("/admin/orders");
  }

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      redirect("/admin/orders");
    }

    if (order.status !== "accepted") {
      redirect(`/admin/orders/${order.id}?orderEditError=status`);
    }

    const [item] = await tx
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        sellerOfferId: orderItems.sellerOfferId,
      })
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)))
      .limit(1);

    if (!item || !item.productId) {
      redirect(`/admin/orders/${order.id}?orderEditError=item`);
    }

    const [offer] = await tx
      .select({
        productId: products.id,
        sellerOfferId: sellerOffers.id,
        sellerId: sellerOffers.sellerId,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        priceWithVat: sellerOffers.priceWithVat,
        vatRate: sellerOffers.vatRate,
        commissionRate: sellers.commissionRate,
      })
      .from(sellerOffers)
      .innerJoin(products, eq(products.id, sellerOffers.productId))
      .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(
        and(
          eq(sellerOffers.id, sellerOfferId),
          eq(sellerOffers.productId, item.productId),
          eq(sellerOffers.status, "published"),
          eq(products.isActive, true),
        ),
      )
      .limit(1);

    if (!offer) {
      redirect(`/admin/orders/${order.id}?orderEditError=offer`);
    }

    if (offer.sellerOfferId === item.sellerOfferId) {
      redirect(`/admin/orders/${order.id}`);
    }

    const quantity = Number(item.quantity);
    const priceWithVat = Number(offer.priceWithVat);
    const vatRate = Number(offer.vatRate ?? 22);
    const lineTotal = toMoney(quantity * priceWithVat);
    const vatAmount = calculateVatAmount(lineTotal, vatRate);
    const commissionRate = Number(offer.commissionRate ?? 5);

    await tx
      .update(orderItems)
      .set({
        productId: offer.productId,
        sellerOfferId: offer.sellerOfferId,
        sellerId: offer.sellerId,
        productNameSnapshot: offer.productName,
        skuSnapshot: offer.sku,
        unitSnapshot: offer.unit,
        priceWithVat: formatMoney(priceWithVat),
        vatRate: formatMoney(vatRate),
        vatAmount: formatMoney(vatAmount),
        lineTotal: formatMoney(lineTotal),
        commissionAmount: formatMoney(lineTotal * (commissionRate / 100)),
        updatedAt: new Date(),
      })
      .where(eq(orderItems.id, item.id));

    const totals = await tx
      .select({
        totalAmount: orderItems.lineTotal,
        vatAmount: orderItems.vatAmount,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const totalAmount = totals.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );
    const totalVatAmount = totals.reduce(
      (sum, row) => sum + Number(row.vatAmount),
      0,
    );

    await tx
      .update(orders)
      .set({
        totalAmount: formatMoney(totalAmount),
        vatAmount: formatMoney(totalVatAmount),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "order.item_offer_change",
      entityType: "order",
      entityId: order.id,
      metadata: {
        itemId: item.id,
        fromSellerOfferId: item.sellerOfferId,
        toSellerOfferId: offer.sellerOfferId,
      },
    });
  });

  await regenerateInvoiceAfterOrderEdit(orderId, admin.id);
}

export async function regenerateInvoiceAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const orderId = getString(formData, "orderId");

  if (!orderId) {
    redirect("/admin/orders");
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    redirect("/admin/orders");
  }

  const result = await generateOrderInvoice(order.id, admin.id, {
    source: "admin",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath("/account/notifications");

  if (!result.ok) {
    redirect(`/admin/orders/${order.id}?invoiceError=1`);
  }

  redirect(`/admin/orders/${order.id}?invoiceRegenerated=1`);
}
