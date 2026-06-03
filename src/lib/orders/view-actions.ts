import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditEvents, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

export async function markCurrentBuyerOrderViewed(orderId: string) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return;
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.buyerCompanyId, user.buyerCompanyId)),
    )
    .limit(1);

  if (!order) {
    return;
  }

  const [existingView] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, "order.view"),
        eq(auditEvents.entityType, "order"),
        eq(auditEvents.entityId, order.id),
        eq(auditEvents.actorId, user.id),
      ),
    )
    .limit(1);

  if (existingView) {
    return;
  }

  await db.insert(auditEvents).values({
    actorId: user.id,
    action: "order.view",
    entityType: "order",
    entityId: order.id,
    metadata: {
      role: "buyer",
    },
  });
}

export async function markAdminOrderViewed(orderId: string) {
  const admin = await requireUser(["admin"]);

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return;
  }

  const [existingAdminView] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, "order.admin_view"),
        eq(auditEvents.entityType, "order"),
        eq(auditEvents.entityId, order.id),
      ),
    )
    .limit(1);

  if (existingAdminView) {
    return;
  }

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "order.admin_view",
    entityType: "order",
    entityId: order.id,
    metadata: {
      role: "admin",
    },
  });
}
