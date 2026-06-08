import postgres from "postgres";
import { NextResponse } from "next/server";

import {
  getTableCounts,
  importDatabaseDump,
  type DataTransferDump,
} from "@/lib/db/data-transfer";

export async function POST(request: Request) {
  const secret = process.env.DATA_IMPORT_SECRET;
  const databaseUrl = process.env.DATABASE_URL;

  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.headers.get("x-data-import-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 500 },
    );
  }

  const dump = (await request.json()) as DataTransferDump;

  if (!dump?.tables || typeof dump.tables !== "object") {
    return NextResponse.json({ error: "Invalid dump payload." }, { status: 400 });
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    await importDatabaseDump(sql, dump);
    const counts = Object.fromEntries(await getTableCounts(sql));

    return NextResponse.json({
      ok: true,
      importedAt: new Date().toISOString(),
      counts,
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
