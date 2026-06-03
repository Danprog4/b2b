import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/schema";

export const requiredCompanyDocumentTypes = [
  { type: "company_card", label: "Карточка компании" },
  { type: "charter", label: "Уставные документы" },
] as const;

export type CompanyDocumentReadiness = {
  uploadedTypes: string[];
  missingTypes: Array<(typeof requiredCompanyDocumentTypes)[number]>;
  isReady: boolean;
};

export async function getCompanyDocumentReadiness(
  buyerCompanyId: string,
): Promise<CompanyDocumentReadiness> {
  const requiredTypes = requiredCompanyDocumentTypes.map(({ type }) => type);
  const rows = await db
    .select({ type: documents.type })
    .from(documents)
    .where(
      and(
        eq(documents.buyerCompanyId, buyerCompanyId),
        eq(documents.target, "buyer_company"),
        eq(documents.isActive, true),
        inArray(documents.type, requiredTypes),
      ),
    );

  const uploadedTypes = Array.from(new Set(rows.map((row) => row.type)));
  const missingTypes = requiredCompanyDocumentTypes.filter(
    ({ type }) => !uploadedTypes.includes(type),
  );

  return {
    uploadedTypes,
    missingTypes,
    isReady: missingTypes.length === 0,
  };
}
