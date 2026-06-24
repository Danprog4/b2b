import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { Clock3, Package, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  categories,
  files,
  products,
  sellerOffers,
  sellerProductChangeRequests,
  subcategories,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import {
  getSellerBreadcrumbSource,
  getSellerBreadcrumbSourceKey,
  withSellerBreadcrumbSource,
} from "@/lib/seller/breadcrumbs";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { SellerProductDeleteButton } from "../product-delete-button";

type SellerProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getPayloadRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function hasPayloadKey(payload: unknown, key: string) {
  return Boolean(getPayloadRecord(payload) && key in getPayloadRecord(payload)!);
}

function getPayloadNullableString(payload: unknown, key: string) {
  const value = getPayloadString(payload, key).trim();
  return value || null;
}

function getRequestTypeLabel(type: string) {
  if (type === "create") {
    return "Создание товара";
  }

  if (type === "offer_create") {
    return "Предложение к товару";
  }

  if (type === "update") {
    return "Изменение товара";
  }

  return type;
}

function getRequestStatusLabel(status: string) {
  if (status === "on_moderation") {
    return "На модерации";
  }

  if (status === "published") {
    return "Одобрено";
  }

  if (status === "rejected") {
    return "Отклонено";
  }

  return status;
}

function getRequestStatusClassName(status: string) {
  if (status === "on_moderation") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "published") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-500";
}

function getOfferStatusLabel(status: string) {
  if (status === "published") {
    return "Продается";
  }

  if (status === "on_moderation") {
    return "Не продается, предложение на модерации";
  }

  if (status === "rejected") {
    return "Отклонен";
  }

  if (status === "hidden") {
    return "Скрыт";
  }

  return "Не продается";
}

export default async function SellerProductPage({
  params,
  searchParams,
}: SellerProductPageProps) {
  const user = await requireUser(["seller"]);
  const search = (await searchParams) ?? {};
  const breadcrumbSourceKey = getSellerBreadcrumbSourceKey(search, "products");
  const breadcrumbSource = getSellerBreadcrumbSource(search, "products");

  if (!user.sellerId) {
    notFound();
  }

  const { id } = await params;

  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      priorityOfferId: products.priorityOfferId,
      description: products.description,
      size: products.size,
      unit: products.unit,
      categoryId: products.categoryId,
      subcategoryId: products.subcategoryId,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      priceWithVat: sellerOffers.priceWithVat,
      vatRate: sellerOffers.vatRate,
      offerId: sellerOffers.id,
      offerStatus: sellerOffers.status,
      imageFileId: files.id,
      imageStorageKey: files.storageKey,
      imageIsActive: files.isActive,
    })
    .from(products)
    .innerJoin(
      sellerOffers,
      and(
        eq(sellerOffers.productId, products.id),
        eq(sellerOffers.sellerId, user.sellerId),
      ),
    )
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, products.subcategoryId))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(and(eq(products.id, id), ne(sellerOffers.status, "hidden")))
    .limit(1);

  if (!product) {
    notFound();
  }

  const requests = await db
    .select({
      id: sellerProductChangeRequests.id,
      type: sellerProductChangeRequests.type,
      status: sellerProductChangeRequests.status,
      payload: sellerProductChangeRequests.payload,
      moderationComment: sellerProductChangeRequests.moderationComment,
      submittedAt: sellerProductChangeRequests.submittedAt,
      moderatedAt: sellerProductChangeRequests.moderatedAt,
    })
    .from(sellerProductChangeRequests)
    .where(
      and(
        eq(sellerProductChangeRequests.productId, id),
        eq(sellerProductChangeRequests.sellerId, user.sellerId),
      ),
    )
    .orderBy(desc(sellerProductChangeRequests.submittedAt));

  const pendingRequest = requests.find(
    (request) => request.status === "on_moderation",
  );
  const latestRequest = requests[0];
  const latestPayload = latestRequest?.payload ?? null;
  const displayCategoryId =
    getPayloadString(latestPayload, "categoryId") || product.categoryId;
  const displaySubcategoryId = hasPayloadKey(latestPayload, "subcategoryId")
    ? getPayloadNullableString(latestPayload, "subcategoryId")
    : product.subcategoryId;
  const displayCategoryRows =
    displayCategoryId !== product.categoryId || displaySubcategoryId !== product.subcategoryId
      ? await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, [displayCategoryId]))
      : [];
  const displaySubcategoryRows = displaySubcategoryId
    ? await db
        .select({ id: subcategories.id, name: subcategories.name })
        .from(subcategories)
        .where(inArray(subcategories.id, [displaySubcategoryId]))
    : [];
  const displayCategoryName =
    displayCategoryRows.find((category) => category.id === displayCategoryId)?.name ??
    product.categoryName;
  const displaySubcategoryName = displaySubcategoryId
    ? displaySubcategoryRows.find((subcategory) => subcategory.id === displaySubcategoryId)
        ?.name ?? product.subcategoryName
    : null;
  const latestMainImageFileId = hasPayloadKey(latestPayload, "mainImageFileId")
    ? getPayloadNullableString(latestPayload, "mainImageFileId")
    : product.imageFileId;
  const [latestMainImageFile] =
    latestMainImageFileId && latestMainImageFileId !== product.imageFileId
      ? await db
          .select({
            id: files.id,
            storageKey: files.storageKey,
            isActive: files.isActive,
          })
          .from(files)
          .where(eq(files.id, latestMainImageFileId))
          .limit(1)
      : [];
  const displayImageUrl =
    latestMainImageFile?.isActive
      ? getPublicFileUrl({
          id: latestMainImageFile.id,
          storageKey: latestMainImageFile.storageKey,
        })
      : product.imageIsActive && latestMainImageFileId
        ? getPublicFileUrl({
            id: product.imageFileId,
            storageKey: product.imageStorageKey,
          })
        : null;
  const displayProduct = {
    ...product,
    name: getPayloadString(latestPayload, "name") || product.name,
    description: hasPayloadKey(latestPayload, "description")
      ? getPayloadNullableString(latestPayload, "description")
      : product.description,
    size: hasPayloadKey(latestPayload, "size")
      ? getPayloadNullableString(latestPayload, "size")
      : product.size,
    unit: getPayloadString(latestPayload, "unit") || product.unit,
    priceWithVat:
      getPayloadString(latestPayload, "priceWithVat") || product.priceWithVat,
    vatRate: getPayloadString(latestPayload, "vatRate") || product.vatRate,
    categoryName: displayCategoryName,
    subcategoryName: displaySubcategoryName,
  };
  const latestRejectedRequest =
    latestRequest?.status === "rejected" ? latestRequest : null;
  const editHref = withSellerBreadcrumbSource(
    `/seller/products/${product.id}/edit`,
    breadcrumbSourceKey,
  );

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <span>{displayProduct.name}</span>
        </div>

        <Link
          className="inline-flex text-sm font-bold text-[#1157ff] transition hover:text-[#0b49e0]"
          href={breadcrumbSource.href}
        >
          ← {breadcrumbSource.label}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              {displayProduct.name}
            </h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {product.sku} · {displayProduct.categoryName}
              {displayProduct.subcategoryName
                ? ` · ${displayProduct.subcategoryName}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              href={editHref}
            >
              <Pencil size={17} />
              Изменить
            </Link>
            <SellerProductDeleteButton
              className="h-11 px-4"
              productId={product.id}
              productName={displayProduct.name}
            />
          </div>
        </div>

        {latestRejectedRequest ? (
          <section className="mt-5 rounded-xl border border-red-100 bg-red-50 p-5 text-red-900">
            <h2 className="text-lg font-black">
              {product.offerStatus === "published"
                ? "Последние правки отклонены"
                : "Модерация товара не пройдена"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              {latestRejectedRequest.moderationComment
                ? `Комментарий администратора: ${latestRejectedRequest.moderationComment}`
                : "Проверьте карточку товара и отправьте исправленную версию повторно."}
            </p>
            <Link
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
              href={editHref}
            >
              <Pencil size={16} />
              Исправить карточку
            </Link>
          </section>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="self-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            {displayImageUrl ? (
              <img
                alt={displayProduct.name}
                className="h-72 w-full object-cover"
                src={displayImageUrl}
              />
            ) : (
              <div className="flex h-72 items-center justify-center bg-slate-100 text-slate-300">
                <Package size={44} />
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  pendingRequest
                    ? "bg-amber-50 text-amber-700"
                    : product.offerStatus === "published"
                    ? "bg-emerald-50 text-emerald-700"
                    : product.offerStatus === "rejected"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {pendingRequest
                  ? "На модерации"
                  : getOfferStatusLabel(product.offerStatus)}
              </span>
            </div>

            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold text-slate-500">Цена сейчас</dt>
                <dd className="mt-1 text-xl font-black text-slate-950">
                  {formatCurrency(displayProduct.priceWithVat)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold text-slate-500">НДС</dt>
                <dd className="mt-1 text-xl font-black text-slate-950">
                  {Number(displayProduct.vatRate ?? 22).toFixed(0)}%
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold text-slate-500">Единица</dt>
                <dd className="mt-1 font-black text-slate-950">
                  {displayProduct.unit}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold text-slate-500">Размер</dt>
                <dd className="mt-1 font-black text-slate-950">
                  {displayProduct.size ?? "Не указан"}
                </dd>
              </div>
            </dl>

            {displayProduct.description ? (
              <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {displayProduct.description}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <Clock3 className="text-[#1157ff]" size={22} />
            <h2 className="text-2xl font-black text-slate-950">
              История модерации
            </h2>
          </div>

          <div className="mt-5 grid gap-3">
            {requests.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                Истории изменений пока нет.
              </div>
            ) : null}

            {requests.map((request) => {
              const name = getPayloadString(request.payload, "name");
              const priceWithVat = getPayloadString(request.payload, "priceWithVat");
              const vatRate = getPayloadString(request.payload, "vatRate") || "22.00";
              const unit = getPayloadString(request.payload, "unit");
              const size = getPayloadString(request.payload, "size");

              return (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {getRequestTypeLabel(request.type)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getRequestStatusClassName(
                            request.status,
                          )}`}
                        >
                          {getRequestStatusLabel(request.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-black text-slate-950">
                        {name || displayProduct.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        Отправлено {formatDateTime(request.submittedAt)}
                        {request.moderatedAt
                          ? ` · обработано ${formatDateTime(request.moderatedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm font-bold text-slate-700">
                      <p>{formatCurrency(priceWithVat || "0")}</p>
                      <p className="mt-1 text-slate-500">
                        НДС {Number(vatRate).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <p className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                      Единица: {unit || "Не указана"}
                    </p>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                      Размер: {size || "Не указан"}
                    </p>
                  </div>
                  {request.moderationComment ? (
                    <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold leading-6 text-blue-900">
                      Комментарий администратора: {request.moderationComment}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
