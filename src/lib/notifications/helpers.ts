import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function insertBuyerCompanyNotifications(
  tx: Transaction,
  values: {
    buyerCompanyId: string | null;
    type: string;
    title: string;
    body?: string | null;
  },
) {
  if (!values.buyerCompanyId) {
    return;
  }

  const buyerUsers = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "buyer"),
        eq(users.status, "active"),
        eq(users.buyerCompanyId, values.buyerCompanyId),
      ),
    );

  if (buyerUsers.length === 0) {
    return;
  }

  await tx.insert(notifications).values(
    buyerUsers.map((buyerUser) => ({
      userId: buyerUser.id,
      buyerCompanyId: values.buyerCompanyId,
      type: values.type,
      title: values.title,
      body: values.body ?? null,
    })),
  );
}
