"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generateBuyerCompanyContract } from "@/lib/contracts/generation";
import { requireUser } from "@/lib/auth/session";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function regenerateBuyerCompanyContractAdminAction(
  formData: FormData,
) {
  const admin = await requireUser(["admin"]);
  const companyId = getString(formData, "companyId");

  if (!companyId) {
    redirect("/admin/companies");
  }

  const result = await generateBuyerCompanyContract(companyId, admin.id, {
    source: "admin",
    force: true,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/documents");
  revalidatePath("/account");
  revalidatePath("/account/documents");

  if (!result.ok) {
    redirect(`/admin/companies/${companyId}?contractError=1`);
  }

  redirect(`/admin/companies/${companyId}?contractGenerated=1`);
}
