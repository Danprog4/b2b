import postgres from "postgres";

export const dataTransferTables = [
  "buyer_companies",
  "sellers",
  "users",
  "auth_sessions",
  "password_reset_tokens",
  "company_join_requests",
  "files",
  "categories",
  "subcategories",
  "products",
  "seller_offers",
  "seller_product_change_requests",
  "product_images",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "invoices",
  "contracts",
  "payments_to_seller",
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

export type DataTransferTable = (typeof dataTransferTables)[number];
export type DataTransferDump = {
  exportedAt: string;
  tables: Partial<Record<DataTransferTable, Record<string, unknown>[]>>;
};

type UnsafeSqlRunner = {
  unsafe<T extends unknown[] = unknown[]>(
    query: string,
    parameters?: unknown[],
  ): Promise<T>;
};

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function getColumns(sql: postgres.Sql, table: string): Promise<string[]> {
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

export async function assertMigrated(sql: postgres.Sql) {
  const missingTables: string[] = [];

  for (const table of dataTransferTables) {
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
      `Database is not migrated. Missing tables: ${missingTables.join(", ")}`,
    );
  }
}

export async function assertTableListCoversPublicSchema(sql: postgres.Sql) {
  const ignoredTables = new Set(["__drizzle_migrations"]);
  const knownTables = new Set<string>(dataTransferTables);
  const rows = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const missingFromCopyList = rows
    .map((row) => row.table_name)
    .filter((table) => !ignoredTables.has(table) && !knownTables.has(table));

  if (missingFromCopyList.length > 0) {
    throw new Error(
      `Copy table list is stale. Add tables before importing: ${missingFromCopyList.join(", ")}`,
    );
  }
}

export async function getTableCounts(sql: postgres.Sql) {
  const counts = new Map<string, number>();

  for (const table of dataTransferTables) {
    const [row] = await sql.unsafe<{ count: string }[]>(
      `select count(*)::text as count from public.${quoteIdentifier(table)}`,
    );
    counts.set(table, Number(row?.count ?? 0));
  }

  return counts;
}

export async function resetNumberSequences(sql: Pick<UnsafeSqlRunner, "unsafe">) {
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
        (select max(substring(number from 4)::bigint) from invoices where number ~ '^СТ-[0-9]+$'),
        (select max(substring(number from 5)::bigint) from invoices where number ~ '^INV-[0-9]+$'),
        1
      ),
      exists(select 1 from invoices where number ~ '^СТ-[0-9]+$' or number ~ '^INV-[0-9]+$')
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
  await sql.unsafe(`
    select setval(
      '"city_market_contract_number_seq"',
      coalesce(
        (select max(substring(number from 4)::bigint) from contracts where number ~ '^ДГ-[0-9]+$'),
        1
      ),
      exists(select 1 from contracts where number ~ '^ДГ-[0-9]+$')
    )
  `);
}

export async function exportDatabaseDump(sql: postgres.Sql): Promise<DataTransferDump> {
  const tables: DataTransferDump["tables"] = {};

  for (const table of dataTransferTables) {
    const columns = await getColumns(sql, table);
    tables[table] = await sql.unsafe<Record<string, unknown>[]>(
      `select ${columns.map(quoteIdentifier).join(", ")} from public.${quoteIdentifier(
        table,
      )}`,
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function importDatabaseDump(
  sql: postgres.Sql,
  dump: DataTransferDump,
) {
  await assertMigrated(sql);
  await assertTableListCoversPublicSchema(sql);

  await sql.begin(async (tx) => {
    await tx.unsafe(
      `truncate table ${dataTransferTables
        .map((table) => `public.${quoteIdentifier(table)}`)
        .join(", ")} restart identity cascade`,
    );

    for (const table of dataTransferTables) {
      const rows = dump.tables[table] ?? [];

      if (rows.length === 0) {
        continue;
      }

      const columns = await getColumns(sql, table);
      const quotedColumns = columns.map(quoteIdentifier).join(", ");
      const batchSize = 500;

      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        const jsonBatch = batch as unknown as Parameters<typeof tx.json>[0];
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
    }

    await resetNumberSequences(tx);
  });
}
