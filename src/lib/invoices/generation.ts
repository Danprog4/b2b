import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  documents,
  documentVersions,
  emailOutbox,
  files,
  invoices,
  orderItems,
  orders,
  systemEvents,
  users,
} from "@/db/schema";
import { writeStorageFile } from "@/lib/files/storage";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { getNextInvoiceNumber } from "@/lib/numbering/sequences";
import { insertBuyerCompanyNotifications } from "@/lib/notifications/helpers";

type GenerateOrderInvoiceOptions = {
  source: "checkout" | "admin";
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

async function ensureInvoice(orderId: string, replaceCurrent: boolean) {
  const [existingInvoice] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      fileId: invoices.fileId,
    })
    .from(invoices)
    .where(and(eq(invoices.orderId, orderId), eq(invoices.isCurrent, true)))
    .limit(1);

  if (existingInvoice && !replaceCurrent) {
    return existingInvoice;
  }

  const number = await getNextInvoiceNumber();
  const [invoice] = await db.transaction(async (tx) => {
    const [createdInvoice] = await tx
      .insert(invoices)
      .values({
        number,
        orderId,
        status: "pending",
        isCurrent: true,
      })
      .returning({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        fileId: invoices.fileId,
      });

    if (existingInvoice) {
      await tx
        .update(invoices)
        .set({
          isCurrent: false,
          replacedById: createdInvoice.id,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, existingInvoice.id));
    }

    return [createdInvoice];
  });

  return invoice;
}

export async function generateOrderInvoice(
  orderId: string,
  actorId: string | null,
  options: GenerateOrderInvoiceOptions,
) {
  const isReplacement = options.source === "admin";
  const invoice = await ensureInvoice(orderId, isReplacement);
  const now = new Date();

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      buyerCompanyId: orders.buyerCompanyId,
      totalAmount: orders.totalAmount,
      vatAmount: orders.vatAmount,
      createdAt: orders.createdAt,
      buyerName: buyerCompanies.name,
      buyerInn: buyerCompanies.inn,
      buyerKpp: buyerCompanies.kpp,
      buyerOgrn: buyerCompanies.ogrn,
      buyerAddress: buyerCompanies.legalAddress,
      buyerEmail: users.email,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(orders.buyerCompanyId, buyerCompanies.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false as const, error: "Заказ не найден." };
  }

  const items = await db
    .select({
      productNameSnapshot: orderItems.productNameSnapshot,
      skuSnapshot: orderItems.skuSnapshot,
      unitSnapshot: orderItems.unitSnapshot,
      quantity: orderItems.quantity,
      priceWithVat: orderItems.priceWithVat,
      vatRate: orderItems.vatRate,
      vatAmount: orderItems.vatAmount,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        status: "pending",
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id));
  });

  try {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoice.number,
      orderNumber: order.number,
      createdAt: now,
      buyerName: order.buyerName,
      buyerInn: order.buyerInn,
      buyerKpp: order.buyerKpp,
      buyerOgrn: order.buyerOgrn,
      buyerAddress: order.buyerAddress,
      totalAmount: order.totalAmount,
      vatAmount: order.vatAmount,
      items,
    });
    const storageKey = `invoices/${invoice.number}.pdf`;
    const storedFile = await writeStorageFile(storageKey, pdfBytes, {
      contentType: "application/pdf",
    });

    await db.transaction(async (tx) => {
      const [file] = await tx
        .insert(files)
        .values({
          originalName: `Счет ${invoice.number}.pdf`,
          storageKey,
          mimeType: "application/pdf",
          sizeBytes: storedFile.sizeBytes,
          access: "private",
          uploadedById: actorId,
        })
        .returning({ id: files.id });

      await tx
        .update(invoices)
        .set({
          fileId: file.id,
          status: "generated",
          errorMessage: null,
          generatedAt: now,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id));

      const [existingDocument] = await tx
        .select({
          id: documents.id,
          currentVersion: documents.currentVersion,
        })
        .from(documents)
        .where(
          and(
            eq(documents.orderId, order.id),
            inArray(documents.type, ["payment_invoice", "invoice"]),
          ),
        )
        .limit(1);

      const documentId = existingDocument
        ? existingDocument.id
        : (
            await tx
              .insert(documents)
              .values({
                type: "payment_invoice",
                title: `Счет на оплату ${invoice.number}`,
                target: "order",
                buyerCompanyId: order.buyerCompanyId,
                orderId: order.id,
                currentVersion: 1,
                isVisibleToBuyer: true,
                uploadedById: actorId,
              })
              .returning({ id: documents.id })
          )[0].id;
      const nextVersion = existingDocument
        ? existingDocument.currentVersion + 1
        : 1;

      if (existingDocument) {
        await tx
          .update(documents)
          .set({
            title: `Счет на оплату ${invoice.number}`,
            currentVersion: nextVersion,
            isVisibleToBuyer: true,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(documents.id, existingDocument.id));
      }

      await tx.insert(documentVersions).values({
        documentId,
        fileId: file.id,
        version: nextVersion,
        comment:
          options.source === "admin"
            ? "Повторно сформированный счет на оплату"
            : "Автоматически сформированный счет на оплату",
        uploadedById: actorId,
      });

      await tx
        .update(orders)
        .set({
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));

      await tx.insert(auditEvents).values({
        actorId,
        action:
          isReplacement
            ? "invoice.regenerate"
            : "invoice.generate",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: {
          orderId: order.id,
          invoiceNumber: invoice.number,
          source: options.source,
          isReplacement,
        },
      });

      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: order.buyerCompanyId,
        type: "invoice_generated",
        title: isReplacement
          ? `Новый счет ${invoice.number} сформирован`
          : `Счет ${invoice.number} сформирован`,
        body: isReplacement
          ? `По заказу ${order.number} сформирован новый актуальный счет.`
          : `Счет по заказу ${order.number} доступен в личном кабинете.`,
      });

      await tx.insert(emailOutbox).values({
        toEmail: order.buyerEmail,
        subject: isReplacement
          ? `Новый счет на оплату ${invoice.number} по заказу ${order.number}`
          : `Счет на оплату ${invoice.number} по заказу ${order.number}`,
        body: isReplacement
          ? `Здравствуйте. По заказу ${order.number} сформирован новый счет ${invoice.number}. Он доступен в личном кабинете Сити Маркет.`
          : `Здравствуйте. Счет ${invoice.number} по заказу ${order.number} сформирован и доступен в личном кабинете Сити Маркет.`,
        status: "queued",
        orderId: order.id,
        invoiceId: invoice.id,
        attachmentFileId: file.id,
      });
    });

    return { ok: true as const, invoiceId: invoice.id };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const failedAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({
          status: "failed",
          errorMessage,
          updatedAt: failedAt,
        })
        .where(eq(invoices.id, invoice.id));

      await tx.insert(auditEvents).values({
        actorId,
        action: "invoice.generate_failed",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: {
          orderId: order.id,
          invoiceNumber: invoice.number,
          source: options.source,
          error: errorMessage,
        },
      });

      await tx.insert(systemEvents).values({
        type: "invoice_generation",
        severity: "error",
        message: `Ошибка формирования счета ${invoice.number} по заказу ${order.number}.`,
        metadata: {
          orderId: order.id,
          invoiceId: invoice.id,
          error: errorMessage,
        },
      });
    });

    return { ok: false as const, error: errorMessage };
  }
}
