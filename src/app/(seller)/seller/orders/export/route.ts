import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  buildSellerReportFilename,
  buildSellerReportWorkbook,
  createXlsxResponse,
  getSellerReportSource,
} from "@/lib/sellers/report";

export async function GET() {
  const user = await getCurrentUser();

  if (
    !user ||
    user.role !== "seller" ||
    user.status !== "active" ||
    !user.sellerId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = await getSellerReportSource(user.sellerId);

  if (!source) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  return createXlsxResponse(
    buildSellerReportWorkbook(source),
    buildSellerReportFilename(source.seller.inn),
  );
}
