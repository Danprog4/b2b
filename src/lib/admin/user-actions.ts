"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

const allowedStatuses = new Set(["active", "blocked", "pending_join"]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithUserError(userId: string, error: string) {
  redirect(`/admin/users/${userId}?error=${error}`);
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const userId = getString(formData, "userId");
  const name = getString(formData, "name") || null;
  const phone = getString(formData, "phone") || null;
  const status = getString(formData, "status");

  if (!userId || !allowedStatuses.has(status)) {
    redirectWithUserError(userId || "unknown", "required");
  }

  const [targetUser] = await db
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!targetUser) {
    redirect("/admin/users");
  }

  if (targetUser.id === admin.id && status === "blocked") {
    redirectWithUserError(targetUser.id, "self-block");
  }

  await db
    .update(users)
    .set({
      name,
      phone,
      status: status as "active" | "blocked" | "pending_join",
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUser.id));

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "user.update",
    entityType: "user",
    entityId: targetUser.id,
    metadata: {
      email: targetUser.email,
      fromStatus: targetUser.status,
      toStatus: status,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUser.id}`);

  redirect(`/admin/users/${targetUser.id}?saved=1`);
}
