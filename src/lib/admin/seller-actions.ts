"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, paymentsToSeller, sellers, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { isPasswordPolicyValid } from "@/lib/auth/password-policy";
import { requireUser } from "@/lib/auth/session";
import { normalizeInn } from "@/lib/company-normalize";
import { parseMoscowDateInput } from "@/lib/datetime";
import { getNextSellerContractNumber } from "@/lib/numbering/sequences";
import { insertSellerNotifications } from "@/lib/notifications/helpers";

const allowedStatuses = new Set(["active", "inactive"]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value: string) {
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed.toFixed(2);
}

function normalizeCommissionRate(value: string) {
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed.toFixed(2);
}

function getBankDetails(value: string) {
  return value ? { raw: value } : null;
}

function nullableValue<T>(value: T | null) {
  return value ?? sql`null`;
}

function parseDateInput(value: string) {
  return parseMoscowDateInput(value);
}

function getSellerValues(formData: FormData) {
  const name = getString(formData, "name");
  const inn = normalizeInn(getString(formData, "inn"));
  const commissionRate = normalizeCommissionRate(
    getString(formData, "commissionRate") || "5",
  );
  const status = getString(formData, "status") || "active";
  const email = getString(formData, "email") || getString(formData, "sellerUserEmail");

  return {
    name,
    inn,
    kpp: getString(formData, "kpp") || null,
    ogrn: getString(formData, "ogrn") || null,
    legalAddress: getString(formData, "legalAddress") || null,
    bankDetails: getBankDetails(getString(formData, "bankDetails")),
    contactName: getString(formData, "contactName") || null,
    email: email || null,
    phone: getString(formData, "phone") || null,
    commissionRate,
    status,
  };
}

function getSellerAccountValues(formData: FormData) {
  return {
    email: getString(formData, "sellerUserEmail").toLowerCase(),
    password: getString(formData, "sellerPassword"),
  };
}

function redirectWithSellerError(sellerId: string | null, error: string) {
  if (sellerId) {
    redirect(`/admin/sellers/${sellerId}?error=${error}`);
  }

  redirect(`/admin/sellers/new?error=${error}`);
}

async function assertUniqueInn(inn: string, sellerId: string | null) {
  const filters = sellerId
    ? and(eq(sellers.inn, inn), ne(sellers.id, sellerId))
    : eq(sellers.inn, inn);
  const [existing] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(filters)
    .limit(1);

  return !existing;
}

async function assertUniqueUserEmail(email: string, userId: string | null) {
  const filters = userId
    ? and(eq(users.email, email), ne(users.id, userId))
    : eq(users.email, email);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(filters)
    .limit(1);

  return !existing;
}

function validateSellerAccountValues(
  sellerId: string | null,
  account: ReturnType<typeof getSellerAccountValues>,
) {
  if (!account.email && !account.password) {
    return false;
  }

  if (!account.email || !account.password) {
    redirectWithSellerError(sellerId, "account-required");
  }

  if (!isPasswordPolicyValid(account.password)) {
    redirectWithSellerError(sellerId, "account-password");
  }

  return true;
}

export async function createSellerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const values = getSellerValues(formData);
  const account = getSellerAccountValues(formData);
  const shouldCreateAccount = validateSellerAccountValues(null, account);

  if (
    !values.name ||
    !values.inn ||
    !values.commissionRate ||
    !allowedStatuses.has(values.status)
  ) {
    redirectWithSellerError(null, "required");
  }

  if (!(await assertUniqueInn(values.inn, null))) {
    redirectWithSellerError(null, "inn");
  }

  if (shouldCreateAccount && !(await assertUniqueUserEmail(account.email, null))) {
    redirectWithSellerError(null, "account-email");
  }

  const commissionRate = values.commissionRate ?? "5.00";
  const contractNumber = await getNextSellerContractNumber();

  const [seller] = await db.transaction(async (tx) => {
    const [createdSeller] = await tx
      .insert(sellers)
      .values({
        name: values.name,
        inn: values.inn,
        contractNumber,
        kpp: nullableValue(values.kpp),
        ogrn: nullableValue(values.ogrn),
        legalAddress: nullableValue(values.legalAddress),
        bankDetails: nullableValue(values.bankDetails),
        contactName: nullableValue(values.contactName),
        email: nullableValue(values.email),
        phone: nullableValue(values.phone),
        commissionRate,
        status: values.status as "active" | "inactive",
      })
      .returning({ id: sellers.id });

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller.create",
      entityType: "seller",
      entityId: createdSeller.id,
      metadata: {
        inn: values.inn,
        name: values.name,
        status: values.status,
        contractNumber,
        accountCreated: shouldCreateAccount,
      },
    });

    if (shouldCreateAccount) {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: values.contactName ?? values.name,
          email: account.email,
          phone: nullableValue(values.phone),
          passwordHash: hashPassword(account.password),
          role: "seller",
          status: "active",
          sellerId: createdSeller.id,
        })
        .returning({ id: users.id });

      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: "seller_user.create",
        entityType: "user",
        entityId: createdUser.id,
        metadata: {
          sellerId: createdSeller.id,
          email: account.email,
        },
      });
    }

    return [createdSeller];
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/products");

  redirect(
    `/admin/sellers/${seller.id}?created=1${shouldCreateAccount ? "&accountCreated=1" : ""}`,
  );
}

export async function updateSellerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const sellerId = getString(formData, "sellerId");
  const values = getSellerValues(formData);
  const account = getSellerAccountValues(formData);

  if (
    !sellerId ||
    !values.name ||
    !values.inn ||
    !values.commissionRate ||
    !allowedStatuses.has(values.status)
  ) {
    redirectWithSellerError(sellerId || null, "required");
  }

  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.id, sellerId))
    .limit(1);

  if (!seller) {
    redirect("/admin/sellers");
  }

  if (!(await assertUniqueInn(values.inn, seller.id))) {
    redirectWithSellerError(seller.id, "inn");
  }

  const [sellerUser] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.sellerId, seller.id), eq(users.role, "seller")))
    .limit(1);

  const shouldSaveAccount = Boolean(
    account.password ||
      (sellerUser && account.email && account.email !== sellerUser.email),
  );

  if (shouldSaveAccount) {
    if (!account.email) {
      redirectWithSellerError(seller.id, "account-required");
    }

    if (!sellerUser && !account.password) {
      redirectWithSellerError(seller.id, "account-required");
    }

    if (account.password && !isPasswordPolicyValid(account.password)) {
      redirectWithSellerError(seller.id, "account-password");
    }

    if (!(await assertUniqueUserEmail(account.email, sellerUser?.id ?? null))) {
      redirectWithSellerError(seller.id, "account-email");
    }
  }

  const commissionRate = values.commissionRate ?? "5.00";

  await db.transaction(async (tx) => {
    await tx
      .update(sellers)
      .set({
        name: values.name,
        inn: values.inn,
        kpp: nullableValue(values.kpp),
        ogrn: nullableValue(values.ogrn),
        legalAddress: nullableValue(values.legalAddress),
        bankDetails: nullableValue(values.bankDetails),
        contactName: nullableValue(values.contactName),
        email: nullableValue(values.email),
        phone: nullableValue(values.phone),
        commissionRate,
        status: values.status as "active" | "inactive",
        updatedAt: new Date(),
      })
      .where(eq(sellers.id, seller.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller.update",
      entityType: "seller",
      entityId: seller.id,
      metadata: {
        inn: values.inn,
        name: values.name,
        status: values.status,
      },
    });

    if (shouldSaveAccount && sellerUser) {
      await tx
        .update(users)
        .set({
          name: values.contactName ?? values.name,
          email: account.email,
          phone: nullableValue(values.phone),
          ...(account.password
            ? { passwordHash: hashPassword(account.password) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, sellerUser.id));

      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: account.password
          ? "seller_user.password_update"
          : "seller_user.update",
        entityType: "user",
        entityId: sellerUser.id,
        metadata: {
          sellerId: seller.id,
          email: account.email,
          emailChanged: sellerUser.email !== account.email,
        },
      });
    }

    if (shouldSaveAccount && !sellerUser) {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: values.contactName ?? values.name,
          email: account.email,
          phone: nullableValue(values.phone),
          passwordHash: hashPassword(account.password),
          role: "seller",
          status: "active",
          sellerId: seller.id,
        })
        .returning({ id: users.id });

      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: "seller_user.create",
        entityType: "user",
        entityId: createdUser.id,
        metadata: {
          sellerId: seller.id,
          email: account.email,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${seller.id}`);
  revalidatePath("/admin/products");
  revalidatePath("/catalog");

  redirect(
    `/admin/sellers/${seller.id}?saved=1${shouldSaveAccount ? "&accountSaved=1" : ""}`,
  );
}

function getPaymentValues(formData: FormData) {
  return {
    sellerId: getString(formData, "sellerId"),
    periodFrom: parseDateInput(getString(formData, "periodFrom")),
    periodTo: parseDateInput(getString(formData, "periodTo")),
    salesAmount: normalizeMoney(getString(formData, "salesAmount")),
    commissionAmount: normalizeMoney(getString(formData, "commissionAmount")),
    payoutAmount: normalizeMoney(getString(formData, "payoutAmount")),
    paidAt: parseDateInput(getString(formData, "paidAt")),
    comment: getString(formData, "comment") || null,
  };
}

function validatePaymentValues(values: ReturnType<typeof getPaymentValues>) {
  return Boolean(
    values.sellerId &&
      values.periodFrom &&
      values.periodTo &&
      values.periodFrom <= values.periodTo &&
      values.salesAmount &&
      values.commissionAmount &&
      values.payoutAmount,
  );
}

export async function createSellerPaymentAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const values = getPaymentValues(formData);

  if (!validatePaymentValues(values)) {
    redirect(values.sellerId ? `/admin/sellers/${values.sellerId}?paymentError=1` : "/admin/sellers");
  }

  const [seller] = await db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .where(eq(sellers.id, values.sellerId))
    .limit(1);

  if (!seller) {
    redirect("/admin/sellers");
  }

  const [payment] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(paymentsToSeller)
      .values({
        sellerId: seller.id,
        periodFrom: values.periodFrom ?? new Date(),
        periodTo: values.periodTo ?? new Date(),
        salesAmount: values.salesAmount ?? "0.00",
        commissionAmount: values.commissionAmount ?? "0.00",
        payoutAmount: values.payoutAmount ?? "0.00",
        paidAt: nullableValue(values.paidAt),
        comment: nullableValue(values.comment),
        createdById: admin.id,
      })
      .returning({ id: paymentsToSeller.id });

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller_payment.create",
      entityType: "payment_to_seller",
      entityId: created.id,
      metadata: {
        sellerId: seller.id,
        payoutAmount: values.payoutAmount,
        periodFrom: values.periodFrom?.toISOString(),
        periodTo: values.periodTo?.toISOString(),
      },
    });

    await insertSellerNotifications(tx, {
      sellerId: seller.id,
      type: "seller_payment_created",
      title: "Добавлена выплата",
      body: `Зафиксирована выплата ${values.payoutAmount} за выбранный период.`,
    });

    return [created];
  });

  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${seller.id}`);
  revalidatePath("/seller");

  redirect(`/admin/sellers/${seller.id}?paymentSaved=1#payments-${payment.id}`);
}

export async function updateSellerPaymentAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const paymentId = getString(formData, "paymentId");
  const values = getPaymentValues(formData);

  if (!paymentId || !validatePaymentValues(values)) {
    redirect(values.sellerId ? `/admin/sellers/${values.sellerId}?paymentError=1` : "/admin/sellers");
  }

  const [payment] = await db
    .select({
      id: paymentsToSeller.id,
      sellerId: paymentsToSeller.sellerId,
    })
    .from(paymentsToSeller)
    .where(eq(paymentsToSeller.id, paymentId))
    .limit(1);

  if (!payment || payment.sellerId !== values.sellerId) {
    redirect(values.sellerId ? `/admin/sellers/${values.sellerId}?paymentError=1` : "/admin/sellers");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(paymentsToSeller)
      .set({
        periodFrom: values.periodFrom ?? new Date(),
        periodTo: values.periodTo ?? new Date(),
        salesAmount: values.salesAmount ?? "0.00",
        commissionAmount: values.commissionAmount ?? "0.00",
        payoutAmount: values.payoutAmount ?? "0.00",
        paidAt: nullableValue(values.paidAt),
        comment: nullableValue(values.comment),
        updatedAt: new Date(),
      })
      .where(eq(paymentsToSeller.id, payment.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller_payment.update",
      entityType: "payment_to_seller",
      entityId: payment.id,
      metadata: {
        sellerId: payment.sellerId,
        payoutAmount: values.payoutAmount,
      },
    });
  });

  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${payment.sellerId}`);
  revalidatePath("/seller");

  redirect(`/admin/sellers/${payment.sellerId}?paymentSaved=1#payments-${payment.id}`);
}

export async function deleteSellerPaymentAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const sellerId = getString(formData, "sellerId");
  const paymentId = getString(formData, "paymentId");

  if (!sellerId || !paymentId) {
    redirect("/admin/sellers");
  }

  const [payment] = await db
    .select({ id: paymentsToSeller.id, sellerId: paymentsToSeller.sellerId })
    .from(paymentsToSeller)
    .where(eq(paymentsToSeller.id, paymentId))
    .limit(1);

  if (!payment || payment.sellerId !== sellerId) {
    redirect(`/admin/sellers/${sellerId}?paymentError=1`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(paymentsToSeller).where(eq(paymentsToSeller.id, payment.id));

    await tx.insert(auditEvents).values({
      actorId: admin.id,
      action: "seller_payment.delete",
      entityType: "payment_to_seller",
      entityId: payment.id,
      metadata: {
        sellerId,
      },
    });
  });

  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${sellerId}`);
  revalidatePath("/seller");

  redirect(`/admin/sellers/${sellerId}?paymentDeleted=1`);
}
