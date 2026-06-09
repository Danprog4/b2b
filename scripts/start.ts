import { spawnSync } from "node:child_process";

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

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

function runStep(label: string, args: string[]) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runDemoSeedIfRequested() {
  if (!isEnabled(process.env.SEED_DEMO)) {
    return;
  }

  if (!getEnvValue("DATABASE_URL")) {
    throw new Error("SEED_DEMO=1 requires DATABASE_URL.");
  }

  if (!hasStorageConfig()) {
    throw new Error(
      "SEED_DEMO=1 requires S3_* or R2_* storage variables, including public URL.",
    );
  }

  process.env.REPLACE_SEED_IMAGES ??= "YES";

  runStep("Apply database migrations", ["run", "db:migrate"]);
  runStep("Seed demo catalog data", ["run", "db:seed"]);
  runStep("Seed demo images and banners", ["run", "assets:seed"]);
}

runDemoSeedIfRequested();
runStep("Start Next.js", ["x", "next", "start"]);
