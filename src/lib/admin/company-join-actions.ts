"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditEvents, companyJoinRequests, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

function getRequestId(formData: FormData) {
  const requestId = formData.get("requestId");

  if (typeof requestId !== "string" || !requestId) {
    throw new Error("requestId is required");
  }

  return requestId;
}

export async function approveCompanyJoinRequest(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const requestId = getRequestId(formData);

  const [request] = await db
    .select()
    .from(companyJoinRequests)
    .where(eq(companyJoinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending") {
    revalidatePath("/admin/company-join-requests");
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "active",
        buyerCompanyId: request.buyerCompanyId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, request.userId));

    await tx
      .update(companyJoinRequests)
      .set({
        status: "approved",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companyJoinRequests.id, requestId));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "company_join.approve",
      entityType: "company_join_request",
      entityId: requestId,
      metadata: {
        userId: request.userId,
        buyerCompanyId: request.buyerCompanyId,
      },
    });
  });

  revalidatePath("/admin/company-join-requests");
}

export async function rejectCompanyJoinRequest(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const requestId = getRequestId(formData);

  await db.transaction(async (tx) => {
    await tx
      .update(companyJoinRequests)
      .set({
        status: "rejected",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companyJoinRequests.id, requestId));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "company_join.reject",
      entityType: "company_join_request",
      entityId: requestId,
    });
  });

  revalidatePath("/admin/company-join-requests");
}
