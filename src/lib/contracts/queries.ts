import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  buyerCompanies,
  contracts,
  documentVersions,
  documents,
  files,
} from "@/db/schema";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { requireUser } from "@/lib/auth/session";
import { generateBuyerCompanyContract } from "@/lib/contracts/generation";

async function getContractDocument(companyId: string) {
  const [document] = await db
    .select({
      id: documents.id,
      title: documents.title,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      and(
        eq(documentVersions.documentId, documents.id),
        eq(documentVersions.version, documents.currentVersion),
      ),
    )
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .where(
      and(
        eq(documents.buyerCompanyId, companyId),
        eq(documents.type, "contract"),
        eq(documents.target, "contract"),
        eq(documents.isActive, true),
        eq(documents.isVisibleToBuyer, true),
      ),
    )
    .orderBy(desc(documentVersions.createdAt), desc(documents.createdAt))
    .limit(1);

  return document ?? null;
}

async function getContract(companyId: string) {
  const [contract] = await db
    .select({
      id: contracts.id,
      number: contracts.number,
      status: contracts.status,
      errorMessage: contracts.errorMessage,
      generatedAt: contracts.generatedAt,
      updatedAt: contracts.updatedAt,
    })
    .from(contracts)
    .where(and(eq(contracts.buyerCompanyId, companyId), eq(contracts.isCurrent, true)))
    .orderBy(desc(contracts.createdAt))
    .limit(1);

  return contract ?? null;
}

export async function getCurrentBuyerCompanyContractState() {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return null;
  }

  const [company] = await db
    .select({
      id: buyerCompanies.id,
      type: buyerCompanies.type,
      name: buyerCompanies.name,
      inn: buyerCompanies.inn,
      kpp: buyerCompanies.kpp,
      ogrn: buyerCompanies.ogrn,
      directorName: buyerCompanies.directorName,
      legalAddress: buyerCompanies.legalAddress,
      bankDetails: buyerCompanies.bankDetails,
      contactEmail: buyerCompanies.contactEmail,
      contactPhone: buyerCompanies.contactPhone,
    })
    .from(buyerCompanies)
    .where(eq(buyerCompanies.id, user.buyerCompanyId))
    .limit(1);

  if (!company) {
    return null;
  }

  const missingFields = getCompanyMissingFields(company);
  let contract = await getContract(company.id);
  let document = await getContractDocument(company.id);

  let generationError: string | null = null;

  if (
    missingFields.length === 0 &&
    (!contract || contract.status === "requires_update")
  ) {
    const result = await generateBuyerCompanyContract(company.id, user.id, {
      source: "company_update",
      force: contract?.status === "requires_update",
    });

    contract = await getContract(company.id);
    document = await getContractDocument(company.id);
    generationError = result.ok ? null : result.error;
  }

  return {
    company,
    contract,
    document,
    missingFields,
    generationError,
  };
}
