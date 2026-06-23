import { and, asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  categories,
  files,
  productImages,
  products,
  sellerOffers,
  sellerProductChangeRequests,
  subcategories,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { ToastMessage } from "@/components/ui/toast-message";
import { getPublicFileUrl } from "@/lib/files/urls";
import {
  getSellerBreadcrumbSource,
  getSellerBreadcrumbSourceKey,
  withSellerBreadcrumbSource,
} from "@/lib/seller/breadcrumbs";
import { requestSellerProductUpdateAction } from "@/lib/seller/product-actions";
import { SellerProductForm } from "../../product-form";

type EditSellerProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getPayloadRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function hasPayloadKey(payload: unknown, key: string) {
  return Boolean(getPayloadRecord(payload) && key in getPayloadRecord(payload)!);
}

function getPayloadString(payload: unknown, key: string) {
  const value = getPayloadRecord(payload)?.[key];
  return typeof value === "string" ? value : "";
}

function getPayloadNullableString(payload: unknown, key: string) {
  const value = getPayloadString(payload, key).trim();
  return value || null;
}

export default async function EditSellerProductPage({
  params,
  searchParams,
}: EditSellerProductPageProps) {
  const user = await requireUser(["seller"]);

  if (!user.sellerId) {
    notFound();
  }

  const { id } = await params;
  const search = (await searchParams) ?? {};
  const error = typeof search.error === "string" ? search.error : null;
  const breadcrumbSourceKey = getSellerBreadcrumbSourceKey(search, "products");
  const breadcrumbSource = getSellerBreadcrumbSource(search, "products");

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      subcategoryId: products.subcategoryId,
      description: products.description,
      size: products.size,
      unit: products.unit,
      priceWithVat: sellerOffers.priceWithVat,
      vatRate: sellerOffers.vatRate,
      offerStatus: sellerOffers.status,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(
      sellerOffers,
      and(
        eq(sellerOffers.productId, products.id),
        eq(sellerOffers.sellerId, user.sellerId),
      ),
    )
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(eq(products.id, id), ne(sellerOffers.status, "hidden")))
    .limit(1);

  if (!product) {
    notFound();
  }

  const [
    categoryOptions,
    subcategoryOptions,
    latestChangeRequest,
    currentGalleryImages,
  ] =
    await Promise.all([
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: subcategories.id,
          name: subcategories.name,
          categoryName: categories.name,
        })
        .from(subcategories)
        .innerJoin(categories, eq(categories.id, subcategories.categoryId))
        .where(eq(subcategories.isActive, true))
        .orderBy(
          asc(categories.name),
          asc(subcategories.sortOrder),
          asc(subcategories.name),
        ),
      db
        .select({
          status: sellerProductChangeRequests.status,
          payload: sellerProductChangeRequests.payload,
          moderationComment: sellerProductChangeRequests.moderationComment,
        })
        .from(sellerProductChangeRequests)
        .where(
          and(
            eq(sellerProductChangeRequests.productId, product.id),
            eq(sellerProductChangeRequests.sellerId, user.sellerId),
          ),
        )
        .orderBy(desc(sellerProductChangeRequests.submittedAt))
        .limit(1)
        .then(([row]) => row ?? null),
      db
        .select({
          id: productImages.id,
          fileId: files.id,
          storageKey: files.storageKey,
          fileName: files.originalName,
        })
        .from(productImages)
        .innerJoin(files, eq(files.id, productImages.fileId))
        .where(and(eq(productImages.productId, product.id), eq(files.isActive, true)))
        .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
    ]);
  const rejectedPayload =
    latestChangeRequest?.status === "rejected" ? latestChangeRequest.payload : null;
  const rejectedMainImageFileId = getPayloadString(
    rejectedPayload,
    "mainImageFileId",
  );
  const [rejectedMainImageFile] = rejectedMainImageFileId
    ? await db
        .select({
          id: files.id,
          storageKey: files.storageKey,
          isActive: files.isActive,
        })
        .from(files)
        .where(eq(files.id, rejectedMainImageFileId))
        .limit(1)
    : [];
  const currentMainImageUrl = product.mainImageIsActive
    ? getPublicFileUrl({
        id: product.mainImageFileId,
        storageKey: product.mainImageStorageKey,
      })
    : null;
  const rejectedMainImageUrl = rejectedMainImageFile?.isActive
    ? getPublicFileUrl({
        id: rejectedMainImageFile.id,
        storageKey: rejectedMainImageFile.storageKey,
      })
    : null;
  const formProduct = rejectedPayload
    ? {
        ...product,
        name: getPayloadString(rejectedPayload, "name") || product.name,
        categoryId:
          getPayloadString(rejectedPayload, "categoryId") || product.categoryId,
        subcategoryId: hasPayloadKey(rejectedPayload, "subcategoryId")
          ? getPayloadNullableString(rejectedPayload, "subcategoryId")
          : product.subcategoryId,
        description: hasPayloadKey(rejectedPayload, "description")
          ? getPayloadNullableString(rejectedPayload, "description")
          : product.description,
        priceWithVat:
          getPayloadString(rejectedPayload, "priceWithVat") || product.priceWithVat,
        vatRate: getPayloadString(rejectedPayload, "vatRate") || product.vatRate,
        size: hasPayloadKey(rejectedPayload, "size")
          ? getPayloadNullableString(rejectedPayload, "size")
          : product.size,
        unit: getPayloadString(rejectedPayload, "unit") || product.unit,
      }
    : product;
  const productHref = withSellerBreadcrumbSource(
    `/seller/products/${product.id}`,
    breadcrumbSourceKey,
  );

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href={productHref}>
            {product.name}
          </Link>
          <span>/</span>
          <span>Редактирование</span>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <Link
            className="inline-flex text-sm font-bold text-[#1157ff] transition hover:text-[#0b49e0]"
            href={productHref}
          >
            ← К карточке товара
          </Link>
          <Link
            className="inline-flex text-sm font-bold text-[#1157ff] transition hover:text-[#0b49e0]"
            href={breadcrumbSource.href}
          >
            {breadcrumbSource.label}
          </Link>
        </div>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-3xl font-black text-slate-950">
            Редактирование товара
          </h1>

          {error ? (
            <ToastMessage message={error} tone="error" />
          ) : null}

          <div className="mt-6">
            <SellerProductForm
              action={requestSellerProductUpdateAction}
              categories={categoryOptions}
              product={{
                ...formProduct,
                isPublished: product.offerStatus === "published",
                mainImageUrl: rejectedMainImageUrl ?? currentMainImageUrl,
                galleryImages: currentGalleryImages.map((image) => ({
                  id: image.id,
                  fileId: image.fileId,
                  fileName: image.fileName,
                  url: getPublicFileUrl({
                    id: image.fileId,
                    storageKey: image.storageKey,
                  }),
                })),
              }}
              subcategories={subcategoryOptions}
              submitText="Отправить изменения"
              moderationAlert={
                latestChangeRequest?.status === "rejected"
                  ? {
                      title: "Правки отклонены",
                      body: latestChangeRequest.moderationComment
                        ? `Комментарий администратора: ${latestChangeRequest.moderationComment}. Внесите изменения с учетом замечания и отправьте карточку на модерацию повторно.`
                        : "Администратор отклонил последнюю версию карточки. Проверьте данные, внесите правки и отправьте товар на модерацию повторно.",
                    }
                  : null
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}
