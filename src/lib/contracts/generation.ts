import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  contracts,
  documents,
  documentVersions,
  files,
  systemEvents,
} from "@/db/schema";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import {
  buyerContractDocxMimeType,
  generateBuyerContractDocx,
} from "@/lib/contracts/docx";
import { getAppPath, queueBuyerCompanyEmails } from "@/lib/email/queue";
import { writeStorageFile } from "@/lib/files/storage";
import { getNextBuyerContractNumber } from "@/lib/numbering/sequences";
import { insertBuyerCompanyNotifications } from "@/lib/notifications/helpers";

type GenerateBuyerCompanyContractOptions = {
  source: "registration" | "company_update" | "admin";
  force?: boolean;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function getVersionComment(source: GenerateBuyerCompanyContractOptions["source"]) {
  if (source === "registration") {
    return "Договор сформирован при регистрации компании.";
  }

  if (source === "company_update") {
    return "Договор переформирован после обновления реквизитов компании.";
  }

  return "Договор переформирован администратором.";
}

async function ensureBuyerCompanyContract(companyId: string) {
  const [existingContract] = await db
    .select({
      id: contracts.id,
      number: contracts.number,
      status: contracts.status,
      fileId: contracts.fileId,
    })
    .from(contracts)
    .where(and(eq(contracts.buyerCompanyId, companyId), eq(contracts.isCurrent, true)))
    .limit(1);

  if (existingContract) {
    return existingContract;
  }

  const number = await getNextBuyerContractNumber();
  const [contract] = await db
    .insert(contracts)
    .values({
      number,
      buyerCompanyId: companyId,
      status: "pending",
      isCurrent: true,
    })
    .returning({
      id: contracts.id,
      number: contracts.number,
      status: contracts.status,
      fileId: contracts.fileId,
    });

  return contract;
}

export async function generateBuyerCompanyContract(
  companyId: string,
  actorId: string | null,
  options: GenerateBuyerCompanyContractOptions,
) {
  let contract: Awaited<ReturnType<typeof ensureBuyerCompanyContract>>;

  try {
    contract = await ensureBuyerCompanyContract(companyId);
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    await db.insert(systemEvents).values({
      type: "contract_generation",
      severity: "error",
      message: `Contract generation bootstrap failed: ${errorMessage}`,
      metadata: {
        buyerCompanyId: companyId,
        source: options.source,
      },
    });

    return { ok: false as const, error: errorMessage };
  }

  if (contract.status === "generated" && contract.fileId && !options.force) {
    return { ok: true as const, contractId: contract.id };
  }

  const now = new Date();
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
    .where(eq(buyerCompanies.id, companyId))
    .limit(1);

  if (!company) {
    return { ok: false as const, error: "Компания не найдена." };
  }

  const missingFields = getCompanyMissingFields(company);

  if (missingFields.length > 0) {
    const errorMessage = `Заполните реквизиты для договора: ${missingFields.join(
      ", ",
    )}.`;

    await db.transaction(async (tx) => {
      await tx
        .update(contracts)
        .set({
          status: "requires_update",
          errorMessage,
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      await tx
        .update(documents)
        .set({
          isVisibleToBuyer: false,
          updatedAt: now,
        })
        .where(
          and(
            eq(documents.buyerCompanyId, company.id),
            eq(documents.type, "contract"),
            eq(documents.target, "contract"),
            eq(documents.isActive, true),
          ),
        );

      await tx.insert(auditEvents).values({
        actorId,
        action: "contract.requires_update",
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          buyerCompanyId: company.id,
          contractNumber: contract.number,
          source: options.source,
          missingFields,
        },
      });

      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: company.id,
        type: "contract_requires_update",
        title: "Договор не сформирован",
        body: errorMessage,
      });

      await queueBuyerCompanyEmails(tx, company.id, {
        subject: "Договор Сити Маркет требует обновления реквизитов",
        body: [
          "Здравствуйте.",
          "Договор компании не удалось сформировать, потому что в реквизитах не хватает данных.",
          errorMessage,
          "",
          `Обновить реквизиты можно в личном кабинете: ${getAppPath("/account/company")}`,
        ].join("\n"),
      });
    });

    return { ok: false as const, error: errorMessage };
  }

  await db
    .update(contracts)
    .set({
      status: "pending",
      errorMessage: null,
      updatedAt: now,
    })
    .where(eq(contracts.id, contract.id));

  try {
    const contractBytes = await generateBuyerContractDocx({
      contractNumber: contract.number,
      generatedAt: now,
      buyerType: company.type,
      buyerName: company.name,
      buyerInn: company.inn,
      buyerKpp: company.kpp,
      buyerOgrn: company.ogrn,
      buyerDirectorName: company.directorName,
      buyerAddress: company.legalAddress,
      buyerContactEmail: company.contactEmail,
      buyerContactPhone: company.contactPhone,
      buyerBankDetails: company.bankDetails,
    });
    const storageKey = `contracts/${contract.number}.docx`;
    const storedFile = await writeStorageFile(storageKey, contractBytes, {
      contentType: buyerContractDocxMimeType,
    });

    await db.transaction(async (tx) => {
      const [file] = await tx
        .insert(files)
        .values({
          originalName: `Договор ${contract.number}.docx`,
          storageKey,
          mimeType: buyerContractDocxMimeType,
          sizeBytes: storedFile.sizeBytes,
          access: "private",
          uploadedById: actorId,
        })
        .returning({ id: files.id });

      await tx
        .update(contracts)
        .set({
          fileId: file.id,
          status: "generated",
          errorMessage: null,
          generatedAt: now,
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      const [existingDocument] = await tx
        .select({
          id: documents.id,
          currentVersion: documents.currentVersion,
        })
        .from(documents)
        .where(
          and(
            eq(documents.buyerCompanyId, company.id),
            eq(documents.type, "contract"),
            eq(documents.target, "contract"),
            eq(documents.isActive, true),
          ),
        )
        .limit(1);

      const nextVersion = existingDocument
        ? existingDocument.currentVersion + 1
        : 1;
      const documentId = existingDocument
        ? existingDocument.id
        : (
            await tx
              .insert(documents)
              .values({
                type: "contract",
                title: `Договор ${contract.number}`,
                target: "contract",
                buyerCompanyId: company.id,
                currentVersion: 1,
                isVisibleToBuyer: true,
                uploadedById: actorId,
              })
              .returning({ id: documents.id })
          )[0].id;

      if (existingDocument) {
        await tx
          .update(documents)
          .set({
            title: `Договор ${contract.number}`,
            currentVersion: nextVersion,
            isVisibleToBuyer: true,
            isActive: true,
            uploadedById: actorId,
            updatedAt: now,
          })
          .where(eq(documents.id, existingDocument.id));
      }

      await tx.insert(documentVersions).values({
        documentId,
        fileId: file.id,
        version: nextVersion,
        comment: getVersionComment(options.source),
        uploadedById: actorId,
      });

      await tx.insert(auditEvents).values({
        actorId,
        action:
          options.force || contract.fileId
            ? "contract.regenerate"
            : "contract.generate",
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          buyerCompanyId: company.id,
          contractNumber: contract.number,
          source: options.source,
        },
      });

      await insertBuyerCompanyNotifications(tx, {
        buyerCompanyId: company.id,
        type: "contract_generated",
        title: `Договор ${contract.number} сформирован`,
        body: "Договор компании доступен в личном кабинете.",
      });

      await queueBuyerCompanyEmails(tx, company.id, {
        subject: `Договор ${contract.number} сформирован`,
        body: [
          "Здравствуйте.",
          `Договор ${contract.number} сформирован и доступен в личном кабинете Сити Маркет.`,
          "",
          `Открыть договор: ${getAppPath("/account/contract")}`,
        ].join("\n"),
        attachmentFileId: file.id,
      });
    });

    return { ok: true as const, contractId: contract.id };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const failedAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(contracts)
        .set({
          status: "failed",
          errorMessage,
          updatedAt: failedAt,
        })
        .where(eq(contracts.id, contract.id));

      await tx.insert(auditEvents).values({
        actorId,
        action: "contract.generate_failed",
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          buyerCompanyId: company.id,
          contractNumber: contract.number,
          source: options.source,
          error: errorMessage,
        },
      });

      await tx.insert(systemEvents).values({
        type: "contract_generation",
        severity: "error",
        message: `Contract ${contract.number} generation failed: ${errorMessage}`,
        metadata: {
          buyerCompanyId: company.id,
          contractId: contract.id,
          source: options.source,
        },
      });
    });

    return { ok: false as const, error: errorMessage };
  }
}
