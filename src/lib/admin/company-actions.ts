"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, buyerCompanies } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { normalizeInn } from "@/lib/company-normalize";
import { generateBuyerCompanyContract } from "@/lib/contracts/generation";

const allowedStatuses = new Set(["active", "blocked"]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableValue<T>(value: T | null) {
  return value ?? sql`null`;
}

function redirectWithCompanyError(companyId: string, error: string) {
  redirect(`/admin/companies/${companyId}?error=${error}`);
}

function getBankDetails(formData: FormData) {
  return {
    bankName: getString(formData, "bankName"),
    bik: getString(formData, "bik"),
    checkingAccount: getString(formData, "checkingAccount"),
    correspondentAccount: getString(formData, "correspondentAccount"),
  };
}

export async function updateBuyerCompanyAdminAction(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const companyId = getString(formData, "companyId");
  const type = getString(formData, "type") === "ip" ? "ip" : "ooo";
  const name = getString(formData, "name");
  const inn = normalizeInn(getString(formData, "inn"));
  const status = getString(formData, "status") || "active";

  if (!companyId || !name || !inn || !allowedStatuses.has(status)) {
    redirectWithCompanyError(companyId || "unknown", "required");
  }

  const [company] = await db
    .select({
      id: buyerCompanies.id,
      inn: buyerCompanies.inn,
      status: buyerCompanies.status,
    })
    .from(buyerCompanies)
    .where(eq(buyerCompanies.id, companyId))
    .limit(1);

  if (!company) {
    redirect("/admin/companies");
  }

  const [sameInnCompany] = await db
    .select({ id: buyerCompanies.id })
    .from(buyerCompanies)
    .where(and(eq(buyerCompanies.inn, inn), ne(buyerCompanies.id, company.id)))
    .limit(1);

  if (sameInnCompany) {
    redirectWithCompanyError(company.id, "inn");
  }

  await db
    .update(buyerCompanies)
    .set({
      type,
      name,
      inn,
      kpp: type === "ooo" ? nullableValue(getString(formData, "kpp") || null) : sql`null`,
      ogrn: nullableValue(getString(formData, "ogrn") || null),
      directorName: nullableValue(getString(formData, "directorName") || null),
      legalAddress: nullableValue(getString(formData, "legalAddress") || null),
      bankDetails: getBankDetails(formData),
      contactEmail: nullableValue(getString(formData, "contactEmail") || null),
      contactPhone: nullableValue(getString(formData, "contactPhone") || null),
      status,
      updatedAt: new Date(),
    })
    .where(eq(buyerCompanies.id, company.id));

  await db.insert(auditEvents).values({
    actorId: admin.id,
    action: "buyer_company.admin_update",
    entityType: "buyer_company",
    entityId: company.id,
    metadata: {
      inn,
      fromInn: company.inn,
      fromStatus: company.status,
      toStatus: status,
    },
  });

  await generateBuyerCompanyContract(company.id, admin.id, {
    source: "admin",
    force: true,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${company.id}`);
  revalidatePath("/admin/documents");
  revalidatePath("/admin/users");
  revalidatePath("/account/documents");
  revalidatePath("/checkout");

  redirect(`/admin/companies/${company.id}?saved=1`);
}
