import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { chats, files, messages } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { isStorageFileNotFoundError, readStorageFile } from "@/lib/files/storage";

type ChatFileRouteProps = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, { params }: ChatFileRouteProps) {
  const user = await requireUser(["buyer", "admin"]);
  const { fileId } = await params;
  const [file] = await db
    .select({
      originalName: files.originalName,
      storageKey: files.storageKey,
      mimeType: files.mimeType,
      buyerCompanyId: chats.buyerCompanyId,
    })
    .from(files)
    .innerJoin(messages, eq(messages.attachmentFileId, files.id))
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .where(and(eq(files.id, fileId), eq(files.isActive, true)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role !== "admin" && user.buyerCompanyId !== file.buyerCompanyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStorageFile(file.storageKey);
  } catch (error) {
    if (isStorageFileNotFoundError(error)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    throw error;
  }
  const encodedName = encodeURIComponent(file.originalName);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
