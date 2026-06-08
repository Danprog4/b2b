"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditEvents, buyerCompanies } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { normalizeInn } from "@/lib/company-normalize";
import { generateBuyerCompanyContract } from "@/lib/contracts/generation";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.startsWith("/login") || value.startsWith("/register")) {
    return null;
  }

  return value;
}

export async function updateBuyerCompanyAction(formData: FormData) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    redirect("/account/company?error=missing");
  }

  const buyerCompanyId = user.buyerCompanyId;
  const type = getString(formData, "type") === "ip" ? "ip" : "ooo";
  const name = getString(formData, "name");
  const inn = normalizeInn(getString(formData, "inn"));
  const kpp = getString(formData, "kpp");
  const ogrn = getString(formData, "ogrn");
  const directorName = getString(formData, "directorName");
  const legalAddress = getString(formData, "legalAddress");
  const contactEmail = getString(formData, "contactEmail");
  const contactPhone = getString(formData, "contactPhone");
  const nextPath = getSafeNextPath(getString(formData, "next"));
  const bankDetails = {
    bankName: getString(formData, "bankName"),
    bik: getString(formData, "bik"),
    checkingAccount: getString(formData, "checkingAccount"),
    correspondentAccount: getString(formData, "correspondentAccount"),
  };

  const missingFields = getCompanyMissingFields({
    type,
    name,
    inn,
    kpp,
    ogrn,
    directorName,
    legalAddress,
    bankDetails,
    contactEmail,
    contactPhone,
  });

  if (missingFields.length > 0) {
    redirect("/account/company?error=required");
  }

  const [sameInnCompany] = await db
    .select({ id: buyerCompanies.id })
    .from(buyerCompanies)
    .where(and(eq(buyerCompanies.inn, inn), ne(buyerCompanies.id, buyerCompanyId)))
    .limit(1);

  if (sameInnCompany) {
    redirect("/account/company?error=inn");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(buyerCompanies)
      .set({
        type,
        name,
        inn,
        kpp: type === "ooo" ? kpp : null,
        ogrn,
        directorName,
        legalAddress,
        bankDetails,
        contactEmail,
        contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(buyerCompanies.id, buyerCompanyId));

    await tx.insert(auditEvents).values({
      actorId: user.id,
      action: "buyer_company.update",
      entityType: "buyer_company",
      entityId: buyerCompanyId,
      metadata: {
        source: "account_company",
      },
    });
  });

  await generateBuyerCompanyContract(buyerCompanyId, user.id, {
    source: "company_update",
    force: true,
  });

  revalidatePath("/account");
  revalidatePath("/account/company");
  revalidatePath("/account/documents");
  revalidatePath("/checkout");

  if (nextPath) {
    redirect(nextPath);
  }

  redirect("/account/company?saved=1");
}
