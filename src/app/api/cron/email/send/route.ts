import { NextResponse } from "next/server";

import { sendQueuedEmails } from "@/lib/email/outbox-worker";

export const dynamic = "force-dynamic";

function getWorkerSecret() {
  return process.env.EMAIL_WORKER_SECRET?.trim() || null;
}

export async function POST(request: Request) {
  const secret = getWorkerSecret();

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_WORKER_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("x-email-worker-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await sendQueuedEmails();

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown email error.",
      },
      { status: 500 },
    );
  }
}
