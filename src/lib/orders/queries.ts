import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  documents,
  invoices,
  orderItems,
  orders,
  products,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getOrderStatusLabel } from "@/lib/orders/status";

export async function getCurrentBuyerOrders() {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return [];
  }

  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalAmount: orders.totalAmount,
      vatAmount: orders.vatAmount,
      createdAt: orders.createdAt,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
    })
    .from(orders)
    .leftJoin(
      invoices,
      and(eq(invoices.orderId, orders.id), eq(invoices.isCurrent, true)),
    )
    .where(eq(orders.buyerCompanyId, user.buyerCompanyId))
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const orderIds = rows.map((order) => order.id);
  const [viewedRows, itemStats, documentRows] = await Promise.all([
    db
      .select({
        orderId: auditEvents.entityId,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "order.view"),
          eq(auditEvents.entityType, "order"),
          eq(auditEvents.actorId, user.id),
          inArray(auditEvents.entityId, orderIds),
        ),
      ),
    db
      .select({
        orderId: orderItems.orderId,
        itemCount: count(orderItems.id),
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId),
    db
      .select({
        orderId: documents.orderId,
        type: documents.type,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.orderId, orderIds),
          eq(documents.isActive, true),
          eq(documents.isVisibleToBuyer, true),
          inArray(documents.type, [
            "payment_invoice",
            "invoice",
            "contract",
            "upd",
            "specification",
            "act",
          ]),
        ),
      ),
  ]);

  const viewedOrderIds = new Set(
    viewedRows
      .map((row) => row.orderId)
      .filter((orderId): orderId is string => orderId !== null),
  );
  const itemCountByOrder = new Map(
    itemStats.map((row) => [row.orderId, row.itemCount]),
  );
  const documentsByOrder = new Map<
    string,
    {
      hasInvoice: boolean;
      hasContract: boolean;
      hasUpd: boolean;
      hasSpecification: boolean;
      hasAct: boolean;
    }
  >();

  for (const document of documentRows) {
    if (!document.orderId) {
      continue;
    }

    const flags = documentsByOrder.get(document.orderId) ?? {
      hasInvoice: false,
      hasContract: false,
      hasUpd: false,
      hasSpecification: false,
      hasAct: false,
    };

    if (document.type === "payment_invoice" || document.type === "invoice") {
      flags.hasInvoice = true;
    }

    if (document.type === "contract") {
      flags.hasContract = true;
    }

    if (document.type === "upd") {
      flags.hasUpd = true;
    }

    if (document.type === "specification") {
      flags.hasSpecification = true;
    }

    if (document.type === "act") {
      flags.hasAct = true;
    }

    documentsByOrder.set(document.orderId, flags);
  }

  return rows.map((order) => ({
    ...order,
    isNew: !viewedOrderIds.has(order.id),
    itemCount: itemCountByOrder.get(order.id) ?? 0,
    hasInvoice:
      Boolean(order.invoiceNumber) ||
      (documentsByOrder.get(order.id)?.hasInvoice ?? false),
    hasContract: documentsByOrder.get(order.id)?.hasContract ?? false,
    hasUpd: documentsByOrder.get(order.id)?.hasUpd ?? false,
    hasSpecification: documentsByOrder.get(order.id)?.hasSpecification ?? false,
    hasAct: documentsByOrder.get(order.id)?.hasAct ?? false,
  }));
}

export async function getCurrentBuyerOrder(orderId: string) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return null;
  }

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalAmount: orders.totalAmount,
      vatAmount: orders.vatAmount,
      comment: orders.comment,
      technicalState: orders.technicalState,
      createdAt: orders.createdAt,
      companyName: buyerCompanies.name,
      companyInn: buyerCompanies.inn,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(orders.buyerCompanyId, buyerCompanies.id))
    .leftJoin(
      invoices,
      and(eq(invoices.orderId, orders.id), eq(invoices.isCurrent, true)),
    )
    .where(
      and(eq(orders.id, orderId), eq(orders.buyerCompanyId, user.buyerCompanyId)),
    )
    .limit(1);

  if (!order || order.companyInn === null) {
    return null;
  }

  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productNameSnapshot,
      sku: orderItems.skuSnapshot,
      unit: orderItems.unitSnapshot,
      quantity: orderItems.quantity,
      priceWithVat: orderItems.priceWithVat,
      vatRate: orderItems.vatRate,
      vatAmount: orderItems.vatAmount,
      lineTotal: orderItems.lineTotal,
      productIsActive: products.isActive,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));

  return {
    ...order,
    items,
  };
}

type AuditMetadata = Record<string, unknown> | null;

type OrderHistoryOrder = {
  id: string;
  status: string;
  createdAt: Date;
};

type OrderHistoryAuditRow = {
  id: string;
  action: string;
  metadata: AuditMetadata;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export type OrderStatusHistoryEntry = {
  id: string;
  title: string;
  statusLabel: string;
  createdAt: Date;
  actorLabel: string | null;
};

function getMetadataString(metadata: AuditMetadata, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getAuditActorLabel(event: OrderHistoryAuditRow, fallback: string) {
  if (getMetadataString(event.metadata, "actor") === "system") {
    return "Система";
  }

  return event.actorName ?? event.actorEmail ?? fallback;
}

function normalizeOrderStatusForV11(status: string) {
  if (status === "new" || status === "awaiting_payment") {
    return "accepted";
  }

  if (status === "closed") {
    return "issued";
  }

  return status;
}

function getInitialStatus(order: OrderHistoryOrder, events: OrderHistoryAuditRow[]) {
  const firstStatusEvent = events.find(
    (event) =>
      event.action === "order.status_update" ||
      event.action === "order.cancel_for_reorder",
  );

  if (firstStatusEvent?.action === "order.status_update") {
    return normalizeOrderStatusForV11(
      getMetadataString(firstStatusEvent.metadata, "from") ?? order.status,
    );
  }

  if (firstStatusEvent?.action === "order.cancel_for_reorder") {
    return normalizeOrderStatusForV11(
      getMetadataString(firstStatusEvent.metadata, "previousStatus") ?? order.status,
    );
  }

  return normalizeOrderStatusForV11(order.status);
}

function buildOrderStatusHistory(
  order: OrderHistoryOrder,
  events: OrderHistoryAuditRow[],
) {
  const entries: OrderStatusHistoryEntry[] = [];
  const creationEvent = events.find((event) => event.action === "order.create");
  const initialStatus = creationEvent
    ? normalizeOrderStatusForV11(
        getMetadataString(creationEvent.metadata, "status") ??
          getInitialStatus(order, events),
      )
    : getInitialStatus(order, events);

  entries.push({
    id: creationEvent?.id ?? `${order.id}-created`,
    title: "Заказ создан",
    statusLabel: getOrderStatusLabel(initialStatus),
    createdAt: creationEvent?.createdAt ?? order.createdAt,
    actorLabel: creationEvent
      ? creationEvent.actorName ?? creationEvent.actorEmail ?? "Покупатель"
      : null,
  });

  for (const event of events) {
    if (event.action === "order.create") {
      continue;
    }

    if (event.action === "order.status_update") {
      const from = getMetadataString(event.metadata, "from");
      const normalizedFrom = from ? normalizeOrderStatusForV11(from) : null;
      const to = normalizeOrderStatusForV11(
        getMetadataString(event.metadata, "to") ?? order.status,
      );

      entries.push({
        id: event.id,
        title: normalizedFrom
          ? `Статус изменен: ${getOrderStatusLabel(normalizedFrom)} -> ${getOrderStatusLabel(to)}`
          : "Статус заказа изменен",
        statusLabel: getOrderStatusLabel(to),
        createdAt: event.createdAt,
        actorLabel: getAuditActorLabel(event, "Администратор"),
      });
    }

    if (event.action === "order.cancel_for_reorder") {
      entries.push({
        id: event.id,
        title: "Заказ отменен для переоформления",
        statusLabel: getOrderStatusLabel("cancelled"),
        createdAt: event.createdAt,
        actorLabel: getAuditActorLabel(event, "Покупатель"),
      });
    }
  }

  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

async function getOrderAuditEvents(orderId: string) {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(eq(auditEvents.entityId, orderId))
    .orderBy(asc(auditEvents.createdAt));

  return rows.filter((row) =>
    ["order.create", "order.status_update", "order.cancel_for_reorder"].includes(
      row.action,
    ),
  );
}

export async function getCurrentBuyerOrderStatusHistory(orderId: string) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return [];
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.buyerCompanyId, user.buyerCompanyId)),
    )
    .limit(1);

  if (!order) {
    return [];
  }

  return buildOrderStatusHistory(order, await getOrderAuditEvents(order.id));
}

export async function getAdminOrderStatusHistory(orderId: string) {
  await requireUser(["admin"]);

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return [];
  }

  return buildOrderStatusHistory(order, await getOrderAuditEvents(order.id));
}
