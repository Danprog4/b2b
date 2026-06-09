import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";

const envFile = resolve(process.env.PROD_SEED_ENV_FILE ?? ".env.prod-seed");

function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

function hasStorageConfig() {
  return Boolean(
    getEnvValue("S3_ENDPOINT", "R2_ENDPOINT") &&
      getEnvValue("S3_BUCKET", "R2_BUCKET_NAME") &&
      getEnvValue("S3_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID") &&
      getEnvValue("S3_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY") &&
      getEnvValue("S3_PUBLIC_URL", "R2_PUBLIC_URL"),
  );
}

function requireEnv() {
  if (!existsSync(envFile)) {
    throw new Error(
      `Missing ${envFile}. Copy .env.prod-seed.example to .env.prod-seed and fill production values.`,
    );
  }

  dotenv.config({ path: envFile, override: true });

  if (!getEnvValue("DATABASE_URL")) {
    throw new Error("DATABASE_URL is required in .env.prod-seed.");
  }

  if (process.env.CONFIRM_PROD_DEMO_SEED !== "YES") {
    throw new Error("Set CONFIRM_PROD_DEMO_SEED=YES in .env.prod-seed.");
  }

  if (!hasStorageConfig()) {
    throw new Error(
      "S3/R2 storage variables are required in .env.prod-seed for demo images.",
    );
  }

  process.env.REPLACE_SEED_IMAGES ??= "YES";
}

function runStep(label: string, args: string[]) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with code ${result.status ?? "unknown"}.`);
  }
}

function main() {
  requireEnv();

  runStep("Apply database migrations", ["run", "db:migrate"]);
  runStep("Seed demo catalog data", ["run", "db:seed"]);
  runStep("Seed demo images and banners", ["run", "assets:seed"]);

  console.log("\nProduction demo content is ready.");
}

main();
