"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, sellers } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

const allowedStatuses = new Set(["active", "inactive"]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

function getSellerValues(formData: FormData) {
  const name = getString(formData, "name");
  const inn = getString(formData, "inn");
  const commissionRate = normalizeCommissionRate(
    getString(formData, "commissionRate") || "5",
  );
  const status = getString(formData, "status") || "active";

  return {
    name,
    inn,
    kpp: getString(formData, "kpp") || null,
    ogrn: getString(formData, "ogrn") || null,
    legalAddress: getString(formData, "legalAddress") || null,
    bankDetails: getBankDetails(getString(formData, "bankDetails")),
    contactName: getString(formData, "contactName") || null,
    email: getString(formData, "email") || null,
    phone: getString(formData, "phone") || null,
    commissionRate,
    status,
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

export async function createSellerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const values = getSellerValues(formData);

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

  const commissionRate = values.commissionRate ?? "5.00";

  const [seller] = await db
    .insert(sellers)
    .values({
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
    })
    .returning({ id: sellers.id });

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "seller.create",
    entityType: "seller",
    entityId: seller.id,
    metadata: {
      inn: values.inn,
      name: values.name,
      status: values.status,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/products");

  redirect(`/admin/sellers/${seller.id}?created=1`);
}

export async function updateSellerAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const sellerId = getString(formData, "sellerId");
  const values = getSellerValues(formData);

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

  const commissionRate = values.commissionRate ?? "5.00";

  await db
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

  await db.insert(auditEvents).values({
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

  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${seller.id}`);
  revalidatePath("/admin/products");
  revalidatePath("/catalog");

  redirect(`/admin/sellers/${seller.id}?saved=1`);
}
