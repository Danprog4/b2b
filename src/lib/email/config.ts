type EmailConfig = {
  provider: "unisender_go";
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  unisenderApiKey: string;
  unisenderApiBaseUrl: string;
  batchSize: number;
  maxAttempts: number;
};

const defaultUnisenderApiBaseUrl =
  "https://goapi.unisender.ru/ru/transactional/api/v1";

function getEnvValue(key: string) {
  const value = process.env[key]?.trim();
  return value || null;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseEmailAddress(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*?)\s*<([^<>@\s]+@[^<>@\s]+)>$/);

  if (match) {
    return {
      name: match[1]?.trim().replace(/^"|"$/g, "") || null,
      email: match[2]?.trim() ?? null,
    };
  }

  return {
    name: null,
    email: value,
  };
}

export function getEmailConfig(): EmailConfig | null {
  const provider = getEnvValue("EMAIL_PROVIDER") ?? "unisender_go";

  if (provider !== "unisender_go") {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  }

  const from = parseEmailAddress(getEnvValue("EMAIL_FROM") ?? getEnvValue("SMTP_FROM"));
  const unisenderApiKey = getEnvValue("UNISENDER_GO_API_KEY");

  if (!from?.email || !unisenderApiKey) {
    return null;
  }

  return {
    provider,
    fromEmail: from.email,
    fromName: from.name,
    replyTo: getEnvValue("EMAIL_REPLY_TO"),
    unisenderApiKey,
    unisenderApiBaseUrl:
      getEnvValue("UNISENDER_GO_API_BASE_URL") ?? defaultUnisenderApiBaseUrl,
    batchSize: parsePositiveInteger(getEnvValue("EMAIL_BATCH_SIZE"), 20),
    maxAttempts: parsePositiveInteger(getEnvValue("EMAIL_MAX_ATTEMPTS"), 5),
  };
}

export function requireEmailConfig() {
  const config = getEmailConfig();

  if (!config) {
    throw new Error(
      "Email is not configured. Set EMAIL_FROM and UNISENDER_GO_API_KEY.",
    );
  }

  return config;
}
