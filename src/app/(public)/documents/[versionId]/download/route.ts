import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { documentVersions, documents, files, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { readStorageFile } from "@/lib/files/storage";

type DocumentDownloadRouteProps = {
  params: Promise<{ versionId: string }>;
};

export async function GET(_request: Request, { params }: DocumentDownloadRouteProps) {
  const user = await getCurrentUser();

  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { versionId } = await params;
  const [document] = await db
    .select({
      documentId: documents.id,
      isVisibleToBuyer: documents.isVisibleToBuyer,
      isVisibleToSeller: documents.isVisibleToSeller,
      buyerCompanyId: documents.buyerCompanyId,
      sellerId: documents.sellerId,
      orderUserId: orders.userId,
      fileName: files.originalName,
      storageKey: files.storageKey,
      mimeType: files.mimeType,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .leftJoin(orders, eq(orders.id, documents.orderId))
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documents.isActive, true),
        eq(files.isActive, true),
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  const isBuyerOwner =
    user.role === "buyer" &&
    document.isVisibleToBuyer &&
    (document.orderUserId === user.id ||
      document.buyerCompanyId === user.buyerCompanyId);
  const isSellerOwner =
    user.role === "seller" &&
    document.isVisibleToSeller &&
    document.sellerId === user.sellerId;

  if (!isAdmin && !isBuyerOwner && !isSellerOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readStorageFile(document.storageKey);
  const encodedFileName = encodeURIComponent(document.fileName);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
