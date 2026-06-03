import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { files } from "@/db/schema";
import { readStorageFile } from "@/lib/files/storage";

type PublicFileRouteProps = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, { params }: PublicFileRouteProps) {
  const { fileId } = await params;
  const [file] = await db
    .select({
      originalName: files.originalName,
      storageKey: files.storageKey,
      mimeType: files.mimeType,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.access, "public"), eq(files.isActive, true)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readStorageFile(file.storageKey);
  const encodedName = encodeURIComponent(file.originalName);

  return new Response(bytes, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
