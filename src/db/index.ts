import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { normalizePostgresConnectionString } from "./connection-string";
import * as schema from "./schema";

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is required to initialize the database client.");
}

const connectionString = normalizePostgresConnectionString(rawConnectionString);

type PostgresClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  cityMarketPostgresClient?: PostgresClient;
};

const queryClient =
  globalForDb.cityMarketPostgresClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.cityMarketPostgresClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
