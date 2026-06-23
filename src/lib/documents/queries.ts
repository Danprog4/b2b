import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  buyerCompanies,
  documentVersions,
  documents,
  files,
  orders,
  sellers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

type BuyerCompanyDocumentRow = {
  buyerCompanyId: string | null;
  target: string;
  type: string;
};

export function filterCurrentBuyerCompanyDocuments<
  DocumentRow extends BuyerCompanyDocumentRow,
>(rows: DocumentRow[]) {
  const seenCompanyDocumentTypes = new Set<string>();

  return rows.filter((document) => {
    if (document.target !== "buyer_company" || !document.buyerCompanyId) {
      return true;
    }

    const key = `${document.buyerCompanyId}:${document.type}`;

    if (seenCompanyDocumentTypes.has(key)) {
      return false;
    }

    seenCompanyDocumentTypes.add(key);
    return true;
  });
}

export async function getAdminOrderDocuments(orderId: string) {
  await requireUser(["admin"]);

  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      currentVersion: documents.currentVersion,
      isVisibleToBuyer: documents.isVisibleToBuyer,
      isActive: documents.isActive,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
      comment: documentVersions.comment,
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
    .where(and(eq(documents.orderId, orderId), eq(documents.isActive, true)))
    .orderBy(desc(documents.createdAt));

  const documentIds = rows.map((document) => document.id);

  if (documentIds.length === 0) {
    return [];
  }

  const versions = await db
    .select({
      documentId: documentVersions.documentId,
      versionId: documentVersions.id,
      version: documentVersions.version,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      comment: documentVersions.comment,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .where(inArray(documentVersions.documentId, documentIds))
    .orderBy(desc(documentVersions.createdAt));

  const versionsByDocument = new Map<string, typeof versions>();

  for (const version of versions) {
    const list = versionsByDocument.get(version.documentId) ?? [];
    list.push(version);
    versionsByDocument.set(version.documentId, list);
  }

  return rows.map((document) => ({
    ...document,
    versions: versionsByDocument.get(document.id) ?? [],
  }));
}

export async function getCurrentBuyerOrderDocuments(orderId: string) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return [];
  }

  return db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      currentVersion: documents.currentVersion,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documents)
    .innerJoin(orders, eq(orders.id, documents.orderId))
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
        eq(documents.orderId, orderId),
        eq(orders.buyerCompanyId, user.buyerCompanyId),
        eq(documents.isActive, true),
        eq(documents.isVisibleToBuyer, true),
      ),
    )
    .orderBy(desc(documents.createdAt));
}

export async function getCurrentBuyerOrderCompanyContract(orderId: string) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return null;
  }

  const [contract] = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      currentVersion: documents.currentVersion,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documents)
    .innerJoin(orders, eq(orders.buyerCompanyId, documents.buyerCompanyId))
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
        eq(orders.id, orderId),
        eq(orders.buyerCompanyId, user.buyerCompanyId),
        eq(documents.type, "contract"),
        eq(documents.isActive, true),
        eq(documents.isVisibleToBuyer, true),
      ),
    )
    .orderBy(desc(documentVersions.createdAt), desc(documents.createdAt))
    .limit(1);

  return contract ?? null;
}

export async function getCurrentBuyerCompanyDocuments() {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    return [];
  }

  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      target: documents.target,
      buyerCompanyId: documents.buyerCompanyId,
      currentVersion: documents.currentVersion,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
      createdAt: documents.createdAt,
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
        eq(documents.buyerCompanyId, user.buyerCompanyId),
        eq(documents.isActive, true),
        eq(documents.isVisibleToBuyer, true),
      ),
    )
    .orderBy(desc(documentVersions.createdAt), desc(documents.createdAt));

  return filterCurrentBuyerCompanyDocuments(rows);
}

export async function getCurrentSellerDocuments() {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    return [];
  }

  return db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      target: documents.target,
      currentVersion: documents.currentVersion,
      versionId: documentVersions.id,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      uploadedAt: documentVersions.createdAt,
      createdAt: documents.createdAt,
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
        eq(documents.sellerId, user.sellerId),
        eq(documents.target, "seller"),
        eq(documents.isActive, true),
        eq(documents.isVisibleToSeller, true),
      ),
    )
    .orderBy(desc(documents.createdAt));
}

export async function getAdminDocuments() {
  await requireUser(["admin"]);

  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      title: documents.title,
      target: documents.target,
      currentVersion: documents.currentVersion,
      isVisibleToBuyer: documents.isVisibleToBuyer,
      isVisibleToSeller: documents.isVisibleToSeller,
      isActive: documents.isActive,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      buyerCompanyId: documents.buyerCompanyId,
      orderNumber: orders.number,
      buyerCompanyName: buyerCompanies.name,
      sellerName: sellers.name,
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
    .leftJoin(orders, eq(orders.id, documents.orderId))
    .leftJoin(buyerCompanies, eq(buyerCompanies.id, documents.buyerCompanyId))
    .leftJoin(sellers, eq(sellers.id, documents.sellerId))
    .where(eq(documents.isActive, true))
    .orderBy(desc(documentVersions.createdAt), desc(documents.createdAt));

  const currentRows = filterCurrentBuyerCompanyDocuments(rows);
  const documentIds = currentRows.map((document) => document.id);

  if (documentIds.length === 0) {
    return [];
  }

  const versions = await db
    .select({
      documentId: documentVersions.documentId,
      versionId: documentVersions.id,
      version: documentVersions.version,
      fileName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      comment: documentVersions.comment,
      uploadedAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .where(inArray(documentVersions.documentId, documentIds))
    .orderBy(desc(documentVersions.createdAt));

  const versionsByDocument = new Map<string, typeof versions>();

  for (const version of versions) {
    const list = versionsByDocument.get(version.documentId) ?? [];
    list.push(version);
    versionsByDocument.set(version.documentId, list);
  }

  return currentRows.map((document) => ({
    ...document,
    versions: versionsByDocument.get(document.id) ?? [],
  }));
}

export async function getAdminDocumentOptions() {
  await requireUser(["admin"]);

  const [orderRows, companyRows, sellerRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        companyName: buyerCompanies.name,
      })
      .from(orders)
      .innerJoin(buyerCompanies, eq(buyerCompanies.id, orders.buyerCompanyId))
      .orderBy(desc(orders.createdAt))
      .limit(80),
    db
      .select({
        id: buyerCompanies.id,
        name: buyerCompanies.name,
        inn: buyerCompanies.inn,
      })
      .from(buyerCompanies)
      .orderBy(asc(buyerCompanies.name)),
    db
      .select({
        id: sellers.id,
        name: sellers.name,
        inn: sellers.inn,
      })
      .from(sellers)
      .orderBy(asc(sellers.name)),
  ]);

  return {
    orders: orderRows,
    companies: companyRows,
    sellers: sellerRows,
  };
}
