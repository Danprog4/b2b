"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { generateOrderInvoice } from "@/lib/invoices/generation";
import { insertBuyerCompanyNotifications } from "@/lib/notifications/helpers";
import { getOrderStatusLabel } from "@/lib/orders/status";

const allowedStatuses = new Set([
  "new",
  "awaiting_payment",
  "paid",
  "issued",
  "closed",
  "cancelled",
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateOrderStatusAction(formData: FormData) {
  const admin = await requireUser(["admin"]);

  const orderId = getString(formData, "orderId");
  const status = getString(formData, "status");

  if (!orderId || !allowedStatuses.has(status)) {
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

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: status as typeof order.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (order.status !== status) {
      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: order.buyerCompanyId,
        type: "order_status_changed",
        title: `Статус заказа ${order.number} изменен`,
        body: `Новый статус: ${getOrderStatusLabel(status)}.`,
      });

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
