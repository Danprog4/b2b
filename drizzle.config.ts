import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      process.env.DATABASE_PRIVATE_URL ??
      "postgres://postgres:postgres@localhost:5432/city_market",
  },
  strict: true,
  verbose: true,
});
