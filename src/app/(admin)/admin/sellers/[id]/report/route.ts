import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  buildSellerReportFilename,
  buildSellerReportWorkbook,
  createXlsxResponse,
  getSellerReportSource,
} from "@/lib/sellers/report";

type SellerReportRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: SellerReportRouteProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin" || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const source = await getSellerReportSource(id);

  if (!source) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  return createXlsxResponse(
    buildSellerReportWorkbook(source),
    buildSellerReportFilename(source.seller.inn),
  );
}
