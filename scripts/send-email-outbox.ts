import "dotenv/config";

import { sendQueuedEmails } from "../src/lib/email/outbox-worker";

try {
  const result = await sendQueuedEmails();

  console.log(
    result.skipped
      ? `Email outbox skipped: ${result.reason}`
      : `Email outbox processed: picked=${result.picked}, sent=${result.sent}, failed=${result.failed}`,
  );
} catch (error) {
  console.error(
    `Email outbox failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exit(1);
}
