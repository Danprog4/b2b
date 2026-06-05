import type { getEmailConfig } from "@/lib/email/config";

type EmailConfig = NonNullable<ReturnType<typeof getEmailConfig>>;

type SendEmailInput = {
  idempotenceKey: string;
  toEmail: string;
  subject: string;
  plaintext: string;
  attachments?: Array<{
    name: string;
    type: string;
    content: Buffer;
  }>;
};

type UnisenderGoErrorResponse = {
  code?: string;
  message?: string;
  error?: string;
  detail?: unknown;
};

function getEndpoint(config: EmailConfig) {
  return `${config.unisenderApiBaseUrl.replace(/\/+$/, "")}/email/send.json`;
}

async function getResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function toUnisenderErrorMessage(status: number, body: string) {
  if (!body) {
    return `Unisender Go API failed with HTTP ${status}.`;
  }

  try {
    const payload = JSON.parse(body) as UnisenderGoErrorResponse;
    return (
      payload.message ??
      payload.error ??
      payload.code ??
      `Unisender Go API failed with HTTP ${status}.`
    );
  } catch {
    return body.slice(0, 500);
  }
}

export async function sendUnisenderGoEmail(
  config: EmailConfig,
  input: SendEmailInput,
) {
  const response = await fetch(getEndpoint(config), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": config.unisenderApiKey,
    },
    body: JSON.stringify({
      message: {
        recipients: [
          {
            email: input.toEmail,
            metadata: {
              email_outbox_id: input.idempotenceKey,
            },
          },
        ],
        body: {
          plaintext: input.plaintext,
        },
        subject: input.subject,
        from_email: config.fromEmail,
        ...(config.fromName ? { from_name: config.fromName } : {}),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        track_links: 0,
        track_read: 0,
        idempotence_key: input.idempotenceKey.slice(0, 64),
        tags: ["transactional"],
        attachments: input.attachments?.map((attachment) => ({
          type: attachment.type,
          name: attachment.name,
          content: attachment.content.toString("base64"),
        })),
      },
    }),
  });

  const body = await getResponseText(response);

  if (!response.ok) {
    throw new Error(toUnisenderErrorMessage(response.status, body));
  }

  return body ? JSON.parse(body) : {};
}
