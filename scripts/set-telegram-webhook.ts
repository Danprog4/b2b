import "dotenv/config";

import {
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from "../src/lib/telegram/api";

function getAppUrl() {
  const appUrl = process.env.APP_URL?.trim();

  if (!appUrl) {
    throw new Error("APP_URL is required to set Telegram webhook.");
  }

  return appUrl.replace(/\/+$/, "");
}

const endpoint = `${getAppUrl()}/api/telegram/webhook`;
await setTelegramWebhook(endpoint);
const info = await getTelegramWebhookInfo();

console.log(`Telegram webhook set to ${endpoint}`);
console.log(`Current webhook: ${info.url}`);
console.log(`Pending updates: ${info.pending_update_count}`);
if (info.last_error_message) {
  console.log(`Last error: ${info.last_error_message}`);
}
