import { NextResponse } from "next/server";

import {
  findCompanyByInn,
  isCompanyAutofillConfigured,
} from "@/lib/company-autofill/dadata";

function normalizeInn(value: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const inn = normalizeInn(url.searchParams.get("inn"));
  const type = url.searchParams.get("type");

  if (!inn || ![10, 12].includes(inn.length)) {
    return NextResponse.json(
      { error: "invalid_inn", configured: isCompanyAutofillConfigured() },
      { status: 400 },
    );
  }

  if (!isCompanyAutofillConfigured()) {
    return NextResponse.json(
      { error: "not_configured", configured: false },
      { status: 503 },
    );
  }

  try {
    const company = await findCompanyByInn(inn, type);

    return NextResponse.json({
      configured: true,
      company,
    });
  } catch (error) {
    console.error("Company INN autofill failed", error);

    return NextResponse.json(
      { error: "provider_failed", configured: true },
      { status: 502 },
    );
  }
}
