import "dotenv/config";

import { spawn } from "node:child_process";

import postgres from "postgres";

const defaultDatabaseUrl = "postgres://postgres:postgres@localhost:5432/city_market";

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.DATABASE_PRIVATE_URL ??
    defaultDatabaseUrl
  );
}

async function repairDrizzleMigrationSequence() {
  const sql = postgres(getDatabaseUrl(), { max: 1 });

  try {
    const [migrationTable] = await sql<{ exists: string | null }[]>`
      select to_regclass('drizzle.__drizzle_migrations')::text as "exists"
    `;

    if (!migrationTable?.exists) {
      return;
    }

    const [sequence] = await sql<{ sequenceName: string | null }[]>`
      select pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id') as "sequenceName"
    `;

    if (!sequence?.sequenceName) {
      return;
    }

    const [migrationState] = await sql<{ maxId: string; count: number }[]>`
      select coalesce(max(id), 0)::text as "maxId", count(*)::int as "count"
      from drizzle.__drizzle_migrations
    `;
    const maxId = Number(migrationState?.maxId ?? 0);

    if (maxId > 0) {
      await sql`select setval(${sequence.sequenceName}, ${maxId}, true)`;
    } else {
      await sql`select setval(${sequence.sequenceName}, 1, false)`;
    }

    console.log(
      `Drizzle migration sequence is aligned: ${sequence.sequenceName}, max id ${maxId}.`,
    );
  } finally {
    await sql.end();
  }
}

function runDrizzleMigrate() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["run", "db:migrate:drizzle"], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`drizzle-kit migrate exited with code ${code ?? "unknown"}.`));
    });
  });
}

await repairDrizzleMigrationSequence();
await runDrizzleMigrate();
