import "dotenv/config";

import { defineConfig } from "drizzle-kit";

import {
  getPostgresConnectionOptions,
  normalizePostgresConnectionString,
} from "./src/db/connection-string";

const databaseUrl = normalizePostgresConnectionString(
  process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/city_market",
);
const connectionOptions = getPostgresConnectionOptions();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: connectionOptions ?? { url: databaseUrl },
  strict: true,
  verbose: true,
});
