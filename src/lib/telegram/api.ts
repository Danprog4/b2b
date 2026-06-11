type TelegramApiResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      ok: false;
      error_code?: number;
      description?: string;
    };

export type TelegramForumTopic = {
  message_thread_id: number;
  name: string;
};

export type TelegramMessage = {
  message_id: number;
  message_thread_id?: number;
};

export type TelegramFile = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};

export type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
};

export type TelegramConfig = {
  token: string;
  operatorChatId: string;
  webhookSecret: string | null;
};

function getEnvValue(key: string) {
  const value = process.env[key]?.trim();
  return value || null;
}

export function getTelegramConfig(): TelegramConfig | null {
  const token = getEnvValue("TELEGRAM_BOT_TOKEN");
  const operatorChatId = getEnvValue("TELEGRAM_OPERATOR_CHAT_ID");

  if (!token || !operatorChatId) {
    return null;
  }

  return {
    token,
    operatorChatId,
    webhookSecret: getEnvValue("TELEGRAM_WEBHOOK_SECRET"),
  };
}

export function isTelegramConfigured() {
  return getTelegramConfig() !== null;
}

function getTelegramApiUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function parseTelegramResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!payload.ok) {
    throw new Error(
      payload.description ??
        `Telegram API request failed with status ${response.status}`,
    );
  }

  return payload.result;
}

export async function telegramJsonRequest<T>(
  method: string,
  body: Record<string, unknown>,
  token = getTelegramConfig()?.token,
) {
  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }

  const response = await fetch(getTelegramApiUrl(token, method), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseTelegramResponse<T>(response);
}

async function telegramMultipartRequest<T>(
  method: string,
  body: FormData,
  token = getTelegramConfig()?.token,
) {
  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }

  const response = await fetch(getTelegramApiUrl(token, method), {
    method: "POST",
    cache: "no-store",
    body,
  });

  return parseTelegramResponse<T>(response);
}

export async function createTelegramForumTopic(name: string) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  return telegramJsonRequest<TelegramForumTopic>("createForumTopic", {
    chat_id: config.operatorChatId,
    name,
  });
}

export async function sendTelegramTopicMessage(input: {
  messageThreadId: number;
  text: string;
}) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  return telegramJsonRequest<TelegramMessage>("sendMessage", {
    chat_id: config.operatorChatId,
    message_thread_id: input.messageThreadId,
    text: input.text,
    disable_web_page_preview: true,
  });
}

export async function sendTelegramOperatorMessage(text: string) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  return telegramJsonRequest<TelegramMessage>(
    "sendMessage",
    {
      chat_id: config.operatorChatId,
      text,
      disable_web_page_preview: true,
    },
    config.token,
  );
}

export async function sendTelegramTopicDocument(input: {
  messageThreadId: number;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  caption?: string | null;
}) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  const body = new FormData();
  body.set("chat_id", config.operatorChatId);
  body.set("message_thread_id", String(input.messageThreadId));
  if (input.caption) {
    body.set("caption", input.caption);
  }
  body.set(
    "document",
    new Blob([Buffer.from(input.bytes)], {
      type: input.mimeType || "application/octet-stream",
    }),
    input.fileName,
  );

  return telegramMultipartRequest<TelegramMessage>("sendDocument", body);
}

export async function getTelegramFile(fileId: string) {
  return telegramJsonRequest<TelegramFile>("getFile", {
    file_id: fileId,
  });
}

export async function downloadTelegramFile(filePath: string) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  const response = await fetch(
    `https://api.telegram.org/file/bot${config.token}/${filePath}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram file download failed: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function setTelegramWebhook(url: string) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("Telegram is not configured.");
  }

  return telegramJsonRequest<boolean>("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: false,
    secret_token: config.webhookSecret ?? undefined,
  });
}

export async function getTelegramWebhookInfo() {
  return telegramJsonRequest<TelegramWebhookInfo>("getWebhookInfo", {});
}
