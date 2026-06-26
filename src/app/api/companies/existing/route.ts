import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { buyerCompanies } from "@/db/schema";
import { normalizeInn } from "@/lib/company-normalize";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const inn = normalizeInn(url.searchParams.get("inn") ?? "");

  if (!inn || ![10, 12].includes(inn.length)) {
    return NextResponse.json({ error: "invalid_inn" }, { status: 400 });
  }

  const [company] = await db
    .select({
      id: buyerCompanies.id,
    })
    .from(buyerCompanies)
    .where(eq(buyerCompanies.inn, inn))
    .limit(1);

  if (!company) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({ exists: true });
}
