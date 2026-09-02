import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  getPostgresConnectionOptions,
  normalizePostgresConnectionString,
} from "./connection-string";
import * as schema from "./schema";

const rawConnectionString = process.env.DATABASE_URL;
const connectionOptions = getPostgresConnectionOptions();

if (!connectionOptions && !rawConnectionString) {
  throw new Error("DATABASE_URL is required to initialize the database client.");
}

type PostgresClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  cityMarketPostgresClient?: PostgresClient;
};

const queryClient =
  globalForDb.cityMarketPostgresClient ??
  (connectionOptions
    ? postgres({
        ...connectionOptions,
        max: process.env.NODE_ENV === "production" ? 10 : 1,
        idle_timeout: 10,
        max_lifetime: 60 * 5,
        prepare: false,
      })
    : postgres(normalizePostgresConnectionString(rawConnectionString!), {
        max: process.env.NODE_ENV === "production" ? 10 : 1,
        idle_timeout: 10,
        max_lifetime: 60 * 5,
        prepare: false,
      }));

if (process.env.NODE_ENV !== "production") {
  globalForDb.cityMarketPostgresClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
