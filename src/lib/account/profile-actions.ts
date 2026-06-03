"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateBuyerProfileAction(formData: FormData) {
  const user = await requireUser(["buyer"]);
  const name = getString(formData, "name");
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");

  if (!email || !phone) {
    redirect("/account/profile?error=required");
  }

  const [sameEmailUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, user.id)))
    .limit(1);

  if (sameEmailUser) {
    redirect("/account/profile?error=email");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        name: name || null,
        email,
        phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "buyer_profile.update",
      entityType: "user",
      entityId: user.id,
      metadata: {
        source: "account_profile",
      },
    });
  });

  revalidatePath("/account");
  revalidatePath("/account/profile");

  redirect("/account/profile?saved=1");
}
