import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { emailOutbox, users } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type QueueEmailInput = {
  toEmail: string;
  subject: string;
  body: string;
  orderId?: string | null;
  invoiceId?: string | null;
  attachmentFileId?: string | null;
};

type QueueAudienceEmailInput = Omit<QueueEmailInput, "toEmail">;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeSubject(subject: string) {
  return subject.trim().slice(0, 255);
}

function uniqueEmails(rows: Array<{ email: string }>) {
  return Array.from(new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean)));
}

export function getAppUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getAppPath(path: string) {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function queueEmail(tx: Transaction, input: QueueEmailInput) {
  const toEmail = normalizeEmail(input.toEmail);

  if (!toEmail) {
    return;
  }

  await tx.insert(emailOutbox).values({
    toEmail,
    subject: normalizeSubject(input.subject),
    body: input.body,
    status: "queued",
    orderId: input.orderId ?? null,
    invoiceId: input.invoiceId ?? null,
    attachmentFileId: input.attachmentFileId ?? null,
  });
}

export async function queueBuyerCompanyEmails(
  tx: Transaction,
  buyerCompanyId: string | null,
  input: QueueAudienceEmailInput,
) {
  if (!buyerCompanyId) {
    return;
  }

  const buyerUsers = await tx
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.role, "buyer"),
        eq(users.status, "active"),
        eq(users.buyerCompanyId, buyerCompanyId),
      ),
    );

  const emails = uniqueEmails(buyerUsers);

  if (emails.length === 0) {
    return;
  }

  await tx.insert(emailOutbox).values(
    emails.map((toEmail) => ({
      toEmail,
      subject: normalizeSubject(input.subject),
      body: input.body,
      status: "queued" as const,
      orderId: input.orderId ?? null,
      invoiceId: input.invoiceId ?? null,
      attachmentFileId: input.attachmentFileId ?? null,
    })),
  );
}

export async function queueSellerEmails(
  tx: Transaction,
  sellerId: string | null,
  input: QueueAudienceEmailInput,
) {
  if (!sellerId) {
    return;
  }

  const sellerUsers = await tx
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.role, "seller"),
        eq(users.status, "active"),
        eq(users.sellerId, sellerId),
      ),
    );

  const emails = uniqueEmails(sellerUsers);

  if (emails.length === 0) {
    return;
  }

  await tx.insert(emailOutbox).values(
    emails.map((toEmail) => ({
      toEmail,
      subject: normalizeSubject(input.subject),
      body: input.body,
      status: "queued" as const,
      orderId: input.orderId ?? null,
      invoiceId: input.invoiceId ?? null,
      attachmentFileId: input.attachmentFileId ?? null,
    })),
  );
}
