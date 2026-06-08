import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { files, invoices, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isStorageFileNotFoundError, readStorageFile } from "@/lib/files/storage";

type InvoiceRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: InvoiceRouteProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== "buyer" || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.buyerCompanyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 403 });
  }

  const { id } = await params;
  const [invoice] = await db
    .select({
      number: invoices.number,
      storageKey: files.storageKey,
      originalName: files.originalName,
      mimeType: files.mimeType,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.orderId, orders.id))
    .innerJoin(files, eq(invoices.fileId, files.id))
    .where(
      and(
        eq(orders.id, id),
        eq(orders.buyerCompanyId, user.buyerCompanyId),
        eq(invoices.isCurrent, true),
        eq(files.isActive, true),
      ),
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStorageFile(invoice.storageKey);
  } catch (error) {
    if (isStorageFileNotFoundError(error)) {
      return NextResponse.json({ error: "Invoice file not found" }, { status: 404 });
    }

    throw error;
  }
  const encodedName = encodeURIComponent(invoice.originalName);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": invoice.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
