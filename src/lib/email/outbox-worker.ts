import { and, asc, eq, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { emailOutbox, files, systemEvents } from "@/db/schema";
import { requireEmailConfig } from "@/lib/email/config";
import { sendUnisenderGoEmail } from "@/lib/email/unisender-go";
import { readStorageFile } from "@/lib/files/storage";

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email delivery error.";
}

async function loadAttachment(fileId: string | null) {
  if (!fileId) {
    return null;
  }

  const [file] = await db
    .select({
      originalName: files.originalName,
      storageKey: files.storageKey,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("Email attachment file not found.");
  }

  return {
    name: file.originalName,
    type: file.mimeType,
    content: await readStorageFile(file.storageKey),
    sizeBytes: file.sizeBytes,
  };
}

export async function sendQueuedEmails() {
  const config = requireEmailConfig();
  const rows = await db
    .select({
      id: emailOutbox.id,
      toEmail: emailOutbox.toEmail,
      subject: emailOutbox.subject,
      body: emailOutbox.body,
      attachmentFileId: emailOutbox.attachmentFileId,
      attempts: emailOutbox.attempts,
      status: emailOutbox.status,
    })
    .from(emailOutbox)
    .where(
      or(
        eq(emailOutbox.status, "queued"),
        and(eq(emailOutbox.status, "failed"), lt(emailOutbox.attempts, config.maxAttempts)),
      ),
    )
    .orderBy(asc(emailOutbox.createdAt))
    .limit(config.batchSize);

  const result = {
    picked: rows.length,
    sent: 0,
    failed: 0,
  };

  for (const email of rows) {
    try {
      await db
        .update(emailOutbox)
        .set({
          attempts: email.attempts + 1,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, email.id));

      const attachment = await loadAttachment(email.attachmentFileId);

      await sendUnisenderGoEmail(config, {
        idempotenceKey: email.id,
        toEmail: email.toEmail,
        subject: email.subject,
        plaintext: email.body,
        attachments: attachment
          ? [
              {
                name: attachment.name,
                type: attachment.type,
                content: attachment.content,
              },
            ]
          : undefined,
      });

      await db
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, email.id));
      result.sent += 1;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await db
        .update(emailOutbox)
        .set({
          status: "failed",
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, email.id));
      await db.insert(systemEvents).values({
        type: "email",
        severity: "error",
        message: "Не удалось отправить письмо из email_outbox.",
        metadata: {
          emailOutboxId: email.id,
          toEmail: email.toEmail,
          subject: email.subject,
          error: errorMessage,
        },
      });
      result.failed += 1;
    }
  }

  return result;
}
