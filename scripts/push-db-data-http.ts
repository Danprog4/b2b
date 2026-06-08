import "dotenv/config";

import postgres from "postgres";

import {
  assertMigrated,
  assertTableListCoversPublicSchema,
  dataTransferTables,
  exportDatabaseDump,
  getTableCounts,
} from "../src/lib/db/data-transfer";

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ??
  process.env.LOCAL_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/city_market";
const targetUrl = process.env.TARGET_DATA_IMPORT_URL;
const importSecret = process.env.DATA_IMPORT_SECRET;
const dryRun = process.env.DRY_RUN === "YES";

function requireEnv() {
  if (!dryRun && !targetUrl) {
    throw new Error("TARGET_DATA_IMPORT_URL is required.");
  }

  if (!dryRun && !importSecret) {
    throw new Error("DATA_IMPORT_SECRET is required.");
  }

  if (!dryRun && process.env.CONFIRM_PROD_DATA_IMPORT !== "YES") {
    throw new Error("Refusing to import without CONFIRM_PROD_DATA_IMPORT=YES.");
  }
}

function redactUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.username = url.username ? "***" : "";
  url.password = url.password ? "***" : "";

  return url.toString();
}

async function main() {
  requireEnv();

  const source = postgres(sourceUrl, { max: 1, prepare: false });

  try {
    console.log(`Source: ${redactUrl(sourceUrl)}`);
    await assertMigrated(source);
    await assertTableListCoversPublicSchema(source);

    const counts = await getTableCounts(source);

    if (dryRun) {
      console.log("DRY_RUN=YES: no data will be sent.");
      for (const table of dataTransferTables) {
        console.log(`${table}: ${counts.get(table) ?? 0} rows`);
      }
      return;
    }

    console.log("Exporting source data...");
    const dump = await exportDatabaseDump(source);
    const rowCount = Object.values(dump.tables).reduce(
      (sum, rows) => sum + (rows?.length ?? 0),
      0,
    );

    console.log(`Sending ${rowCount} rows to ${targetUrl}...`);
    const response = await fetch(targetUrl!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-data-import-secret": importSecret!,
      },
      body: JSON.stringify(dump),
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Import failed with HTTP ${response.status}: ${body}`);
    }

    console.log(body);
    console.log("HTTP data import complete.");
  } finally {
    await source.end({ timeout: 1 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
