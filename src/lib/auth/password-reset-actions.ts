"use server";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { emailOutbox, passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function getResetUrl(token: string) {
  return `${getAppUrl()}/reset-password/${encodeURIComponent(token)}`;
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=required");
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user?.status === "active") {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    const resetUrl = getResetUrl(token);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt,
      });

      await tx.insert(emailOutbox).values({
        toEmail: user.email,
        subject: "Восстановление пароля Сити Маркет",
        body: [
          "Для восстановления пароля перейдите по ссылке:",
          resetUrl,
          "",
          "Ссылка действует 1 час. Если вы не запрашивали восстановление, проигнорируйте письмо.",
        ].join("\n"),
      });
    });

    revalidatePath("/admin/email-outbox");
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData) {
  const token = getString(formData, "token");
  const password = getString(formData, "password");
  const passwordConfirm = getString(formData, "passwordConfirm");

  if (!token) {
    redirect("/forgot-password?error=invalid");
  }

  const errorPath = `/reset-password/${encodeURIComponent(token)}`;

  if (!password || !passwordConfirm) {
    redirect(`${errorPath}?error=required`);
  }

  if (password.length < 8) {
    redirect(`${errorPath}?error=password`);
  }

  if (password !== passwordConfirm) {
    redirect(`${errorPath}?error=match`);
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();
  const passwordHash = hashPassword(password);

  const resetApplied = await db.transaction(async (tx) => {
    const [resetToken] = await tx
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!resetToken) {
      return false;
    }

    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, resetToken.userId));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return true;
  });

  if (!resetApplied) {
    redirect(`${errorPath}?error=invalid`);
  }

  redirect("/login?reset=1");
}
