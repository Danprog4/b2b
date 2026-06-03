import "dotenv/config";

import postgres from "postgres";

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ??
  process.env.LOCAL_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/city_market";
const targetUrl = process.env.TARGET_DATABASE_URL;

const tables = [
  "buyer_companies",
  "sellers",
  "users",
  "auth_sessions",
  "company_join_requests",
  "files",
  "categories",
  "subcategories",
  "products",
  "product_images",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "invoices",
  "documents",
  "document_versions",
  "chats",
  "messages",
  "notifications",
  "email_outbox",
  "banners",
  "content_pages",
  "system_events",
  "audit_events",
  "import_jobs",
  "import_job_rows",
] as const;

function requireEnv() {
  if (!targetUrl) {
    throw new Error(
      "TARGET_DATABASE_URL is required. Use the Railway Postgres public URL when running this locally.",
    );
  }

  if (process.env.CONFIRM_PROD_DATA_IMPORT !== "YES") {
    throw new Error(
      "Refusing to copy data without CONFIRM_PROD_DATA_IMPORT=YES. Target data will be truncated first.",
    );
  }
}

function normalizeDatabaseIdentity(rawUrl: string) {
  const url = new URL(rawUrl);

  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

function redactUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.username = url.username ? "***" : "";
  url.password = url.password ? "***" : "";

  return url.toString();
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function getColumns(
  sql: postgres.Sql,
  table: string,
): Promise<string[]> {
  const rows = await sql<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position
  `;

  if (rows.length === 0) {
    throw new Error(`Table public.${table} does not exist or has no columns.`);
  }

  return rows.map((row) => row.column_name);
}

async function assertMigrated(sql: postgres.Sql) {
  const missingTables: string[] = [];

  for (const table of tables) {
    const [row] = await sql<{ exists: boolean }[]>`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = ${table}
      ) as "exists"
    `;

    if (!row?.exists) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    throw new Error(
      `Target database is not migrated. Missing tables: ${missingTables.join(", ")}`,
    );
  }
}

async function getTableCounts(sql: postgres.Sql) {
  const counts = new Map<string, number>();

  for (const table of tables) {
    const [row] = await sql.unsafe<{ count: string }[]>(
      `select count(*)::text as count from public.${quoteIdentifier(table)}`,
    );
    counts.set(table, Number(row?.count ?? 0));
  }

  return counts;
}

type UnsafeSqlRunner = {
  unsafe<T extends unknown[] = unknown[]>(
    query: string,
    parameters?: unknown[],
  ): Promise<T>;
};

async function resetNumberSequences(sql: UnsafeSqlRunner) {
  await sql.unsafe(`
    select setval(
      '"city_market_order_number_seq"',
      coalesce(
        (select max(substring(number from 5)::bigint) from orders where number ~ '^ORD-[0-9]+$'),
        1
      ),
      exists(select 1 from orders where number ~ '^ORD-[0-9]+$')
    )
  `);
  await sql.unsafe(`
    select setval(
      '"city_market_invoice_number_seq"',
      coalesce(
        (select max(substring(number from 5)::bigint) from invoices where number ~ '^INV-[0-9]+$'),
        1
      ),
      exists(select 1 from invoices where number ~ '^INV-[0-9]+$')
    )
  `);
  await sql.unsafe(`
    select setval(
      '"city_market_product_sku_seq"',
      coalesce(
        (select max(substring(sku from 4)::bigint) from products where sku ~ '^CM-[0-9]+$'),
        1
      ),
      exists(select 1 from products where sku ~ '^CM-[0-9]+$')
    )
  `);
  await sql.unsafe(`
    select setval(
      '"city_market_seller_contract_seq"',
      coalesce(
        (select max(substring(contract_number from 4)::bigint) from sellers where contract_number ~ '^SC-[0-9]+$'),
        1
      ),
      exists(select 1 from sellers where contract_number ~ '^SC-[0-9]+$')
    )
  `);
}

async function main() {
  requireEnv();

  if (!targetUrl) {
    throw new Error("Unreachable: targetUrl was validated above.");
  }

  const sourceIdentity = normalizeDatabaseIdentity(sourceUrl);
  const targetIdentity = normalizeDatabaseIdentity(targetUrl);

  if (
    sourceIdentity === targetIdentity &&
    process.env.ALLOW_SAME_DATABASE_COPY !== "YES"
  ) {
    throw new Error(
      "Source and target database URLs point to the same host/database. Refusing to continue.",
    );
  }

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const target = postgres(targetUrl, { max: 1, prepare: false });

  try {
    console.log(`Source: ${redactUrl(sourceUrl)}`);
    console.log(`Target: ${redactUrl(targetUrl)}`);
    console.log("Checking target schema...");

    await assertMigrated(target);

    const targetCounts = await getTableCounts(target);
    const nonEmptyTargetTables = [...targetCounts.entries()].filter(
      ([, count]) => count > 0,
    );

    if (
      nonEmptyTargetTables.length > 0 &&
      process.env.CONFIRM_TRUNCATE_NON_EMPTY_TARGET !== "YES"
    ) {
      throw new Error(
        [
          "Target database already contains data.",
          `Non-empty tables: ${nonEmptyTargetTables
            .map(([table, count]) => `${table}=${count}`)
            .join(", ")}`,
          "Set CONFIRM_TRUNCATE_NON_EMPTY_TARGET=YES if you really want to replace it.",
        ].join("\n"),
      );
    }

    console.log("Copying data...");

    await target.begin(async (tx) => {
      await tx.unsafe(
        `truncate table ${tables
          .map((table) => `public.${quoteIdentifier(table)}`)
          .join(", ")} restart identity cascade`,
      );

      for (const table of tables) {
        const columns = await getColumns(source, table);
        const rows = await source.unsafe<Record<string, unknown>[]>(
          `select ${columns.map(quoteIdentifier).join(", ")} from public.${quoteIdentifier(
            table,
          )}`,
        );

        if (rows.length === 0) {
          console.log(`${table}: 0 rows`);
          continue;
        }

        const batchSize = 500;
        for (let index = 0; index < rows.length; index += batchSize) {
          const batch = rows.slice(index, index + batchSize);
          const jsonBatch = batch as unknown as Parameters<typeof tx.json>[0];
          const quotedColumns = columns.map(quoteIdentifier).join(", ");
          await tx`
            insert into ${tx.unsafe(`public.${quoteIdentifier(table)}`)}
              (${tx.unsafe(quotedColumns)})
            select ${tx.unsafe(quotedColumns)}
            from jsonb_populate_recordset(
              null::${tx.unsafe(`public.${quoteIdentifier(table)}`)},
              ${tx.json(jsonBatch)}::jsonb
            )
          `;
        }

        console.log(`${table}: ${rows.length} rows`);
      }

      await resetNumberSequences(tx);
    });

    console.log("Data copy complete.");
  } finally {
    await Promise.allSettled([
      source.end({ timeout: 1 }),
      target.end({ timeout: 1 }),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
