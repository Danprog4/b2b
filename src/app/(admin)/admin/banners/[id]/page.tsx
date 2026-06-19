import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BannerForm } from "@/app/(admin)/admin/banners/banner-form";
import { ToastMessages } from "@/components/ui/toast-message";
import { db } from "@/db";
import { banners, files } from "@/db/schema";
import { getBannerLinkSuggestions } from "@/lib/admin/banner-link-suggestions";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";

type EditBannerPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getImageUrl(fileId: string | null) {
  if (!fileId) {
    return null;
  }

  const [file] = await db
    .select({
      id: files.id,
      storageKey: files.storageKey,
      isActive: files.isActive,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return file?.isActive
    ? getPublicFileUrl({ id: file.id, storageKey: file.storageKey })
    : null;
}

export default async function EditBannerPage({
  params,
  searchParams,
}: EditBannerPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : undefined;
  const saved = query.saved === "1";
  const created = query.created === "1";

  const [banner] = await db
    .select()
    .from(banners)
    .where(eq(banners.id, id))
    .limit(1);

  if (!banner) {
    notFound();
  }

  const [desktopImageUrl, mobileImageUrl, occupiedOrders] = await Promise.all([
    getImageUrl(banner.desktopImageFileId),
    getImageUrl(banner.mobileImageFileId),
    db
      .select({
        bannerId: banners.id,
        sortOrder: banners.sortOrder,
        title: banners.title,
      })
      .from(banners)
      .orderBy(asc(banners.sortOrder), asc(banners.createdAt)),
  ]);
  const linkSuggestions = await getBannerLinkSuggestions();

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/banners">
            Баннеры
          </Link>
          <span>/</span>
          <span>{banner.title}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/banners">
          ← Баннеры
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          {banner.title}
        </h1>

        <ToastMessages
          items={[
            ...(error ? [{ message: error, tone: "error" as const }] : []),
            ...(saved || created ? [{ message: "Баннер сохранен." }] : []),
          ]}
        />

        <div className="mt-6">
          <BannerForm
            banner={{
              ...banner,
              desktopImageUrl,
              mobileImageUrl,
            }}
            linkSuggestions={linkSuggestions}
            occupiedOrders={occupiedOrders}
          />
        </div>
      </div>
    </main>
  );
}
