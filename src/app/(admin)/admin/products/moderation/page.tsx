import { asc, eq, inArray } from "drizzle-orm";
import { Check, Clock3, ImageIcon, X } from "lucide-react";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { db } from "@/db";
import {
  categories,
  files,
  products,
  sellerOffers,
  sellerProductChangeRequests,
  sellers,
  subcategories,
} from "@/db/schema";
import {
  approveProductModerationRequestAction,
  rejectProductModerationRequestAction,
} from "@/lib/admin/product-moderation-actions";
import { getPublicFileUrl } from "@/lib/files/urls";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type ProductModerationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getPayloadStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item))
    : [];
}

function getRequestTypeLabel(type: string) {
  if (type === "create") {
    return "Новый товар";
  }

  if (type === "offer_create") {
    return "Новое предложение";
  }

  if (type === "update") {
    return "Изменение";
  }

  return type;
}

export default async function ProductModerationPage({
  searchParams,
}: ProductModerationPageProps) {
  const search = (await searchParams) ?? {};
  const moderated = search.moderated === "1";
  const error = typeof search.error === "string" ? search.error : null;

  const requests = await db
    .select({
      id: sellerProductChangeRequests.id,
      type: sellerProductChangeRequests.type,
      payload: sellerProductChangeRequests.payload,
      submittedAt: sellerProductChangeRequests.submittedAt,
      productId: sellerProductChangeRequests.productId,
      productSku: products.sku,
      productName: products.name,
      currentPriceWithVat: sellerOffers.priceWithVat,
      currentVatRate: sellerOffers.vatRate,
      currentOfferStatus: sellerOffers.status,
      currentUnit: products.unit,
      currentSize: products.size,
      sellerName: sellers.name,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
    })
    .from(sellerProductChangeRequests)
    .innerJoin(sellers, eq(sellers.id, sellerProductChangeRequests.sellerId))
    .leftJoin(products, eq(products.id, sellerProductChangeRequests.productId))
    .leftJoin(
      sellerOffers,
      eq(sellerOffers.id, sellerProductChangeRequests.sellerOfferId),
    )
    .leftJoin(
      categories,
      eq(categories.id, products.categoryId),
    )
    .leftJoin(subcategories, eq(subcategories.id, products.subcategoryId))
    .where(eq(sellerProductChangeRequests.status, "on_moderation"))
    .orderBy(asc(sellerProductChangeRequests.submittedAt));
  const moderationFileIds = Array.from(
    new Set(
      requests.flatMap((request) => [
        getPayloadString(request.payload, "mainImageFileId"),
        ...getPayloadStringArray(request.payload, "galleryImageFileIds"),
      ]).filter(Boolean),
    ),
  );
  const moderationCategoryIds = Array.from(
    new Set(
      requests
        .map((request) => getPayloadString(request.payload, "categoryId"))
        .filter(Boolean),
    ),
  );
  const moderationSubcategoryIds = Array.from(
    new Set(
      requests
        .map((request) => getPayloadString(request.payload, "subcategoryId"))
        .filter(Boolean),
    ),
  );
  const [moderationFiles, moderationCategories, moderationSubcategories] =
    await Promise.all([
      moderationFileIds.length > 0
        ? db
            .select({
              id: files.id,
              storageKey: files.storageKey,
              originalName: files.originalName,
            })
            .from(files)
            .where(inArray(files.id, moderationFileIds))
        : [],
      moderationCategoryIds.length > 0
        ? db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(inArray(categories.id, moderationCategoryIds))
        : [],
      moderationSubcategoryIds.length > 0
        ? db
            .select({ id: subcategories.id, name: subcategories.name })
            .from(subcategories)
            .where(inArray(subcategories.id, moderationSubcategoryIds))
        : [],
    ]);
  const fileById = new Map(moderationFiles.map((file) => [file.id, file]));
  const categoryById = new Map(
    moderationCategories.map((category) => [category.id, category.name]),
  );
  const subcategoryById = new Map(
    moderationSubcategories.map((subcategory) => [
      subcategory.id,
      subcategory.name,
    ]),
  );

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/products">
            Товары
          </Link>
          <span>/</span>
          <span>Модерация</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Модерация товаров
            </h1>
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
            <Clock3 size={18} />
            {requests.length}
          </span>
        </div>

        <ToastMessages
          items={[
            ...(moderated ? [{ message: "Заявка обработана." }] : []),
            ...(error
              ? [
                  {
                    message: "Заявка не найдена или данные неполные.",
                    tone: "error" as const,
                  },
                ]
              : []),
          ]}
        />

        <section className="mt-6 grid gap-4">
          {requests.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-500">
              Заявок на модерацию нет.
            </div>
          ) : null}

          {requests.map((request) => {
            const name = getPayloadString(request.payload, "name");
            const priceWithVat = getPayloadString(request.payload, "priceWithVat");
            const vatRate = getPayloadString(request.payload, "vatRate") || "22.00";
            const categoryId = getPayloadString(request.payload, "categoryId");
            const subcategoryId = getPayloadString(request.payload, "subcategoryId");
            const unit = getPayloadString(request.payload, "unit");
            const size = getPayloadString(request.payload, "size");
            const description = getPayloadString(request.payload, "description");
            const categoryName = categoryId
              ? categoryById.get(categoryId) ?? request.categoryName
              : request.categoryName;
            const subcategoryName = subcategoryId
              ? subcategoryById.get(subcategoryId) ?? request.subcategoryName
              : null;
            const mainImageFileId = getPayloadString(
              request.payload,
              "mainImageFileId",
            );
            const galleryImageFileIds = getPayloadStringArray(
              request.payload,
              "galleryImageFileIds",
            );
            const requestImages = [mainImageFileId, ...galleryImageFileIds]
              .map((fileId) => (fileId ? fileById.get(fileId) : null))
              .filter(
                (file): file is (typeof moderationFiles)[number] => Boolean(file),
              )
              .map((file) => {
                const url = getPublicFileUrl({
                  id: file.id,
                  storageKey: file.storageKey,
                });

                return url
                  ? {
                      id: file.id,
                      fileName: file.originalName,
                      url,
                    }
                  : null;
              })
              .filter((image): image is NonNullable<typeof image> =>
                Boolean(image),
              );
            const isUpdate = request.type === "update";
            const isOfferCreate = request.type === "offer_create";
            const currentIsPublished = request.currentOfferStatus === "published";

            return (
              <article
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                key={request.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        {getRequestTypeLabel(request.type)}
                      </span>
                      <span className="text-sm font-bold text-slate-500">
                        {formatDateTime(request.submittedAt)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-black text-slate-950">
                      {name || request.productName || "Без названия"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {request.sellerName}
                      {request.productSku ? ` · ${request.productSku}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-950">
                      {formatCurrency(priceWithVat || "0")}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      НДС {Number(vatRate).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Категория</dt>
                    <dd className="mt-1 font-black text-slate-950">
                      {categoryName ?? "Будет применена из заявки"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Подкатегория</dt>
                    <dd className="mt-1 font-black text-slate-950">
                      {subcategoryName ?? "Без подкатегории"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Единица</dt>
                    <dd className="mt-1 font-black text-slate-950">{unit}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Размер</dt>
                    <dd className="mt-1 font-black text-slate-950">
                      {size || "Не указан"}
                    </dd>
                  </div>
                </dl>

                {description ? (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3">
                  <p className="text-sm font-black text-slate-950">Фото товара</p>
                  {requestImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {requestImages.map((image, index) => (
                        <a
                          className="group overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
                          href={image.url}
                          key={`${image.id}-${index}`}
                          target="_blank"
                        >
                          <img
                            alt={image.fileName}
                            className="aspect-square w-full object-cover transition group-hover:scale-[1.03]"
                            src={image.url}
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>

                {isUpdate || isOfferCreate ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <div
                      className={`rounded-lg border p-4 ${
                        currentIsPublished || isOfferCreate
                          ? "border-emerald-100 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p
                        className={`text-xs font-black uppercase ${
                          currentIsPublished || isOfferCreate
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {isOfferCreate
                          ? "Текущий товар"
                          : currentIsPublished
                            ? "Сейчас на витрине"
                            : "Текущая версия"}
                      </p>
                      <h3 className="mt-2 font-black text-slate-950">
                        {request.productName ?? "Без названия"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {formatCurrency(request.currentPriceWithVat ?? "0")} · НДС{" "}
                        {Number(request.currentVatRate ?? 22).toFixed(0)}% ·{" "}
                        {request.currentUnit}
                        {request.currentSize ? ` · ${request.currentSize}` : ""}
                      </p>
                      <p
                        className={`mt-3 text-xs font-bold ${
                          currentIsPublished || isOfferCreate
                            ? "text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {isOfferCreate
                          ? "Будет добавлено новое предложение продавца к этой карточке."
                          : currentIsPublished
                            ? "Старая версия продаётся до одобрения изменений."
                            : "Товар еще не опубликован, поэтому новая версия не заменяет витринную карточку."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase text-amber-700">
                        {isOfferCreate
                          ? "Предложение продавца"
                          : "Будет после одобрения"}
                      </p>
                      <h3 className="mt-2 font-black text-slate-950">
                        {name || "Без названия"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {formatCurrency(priceWithVat || "0")} · НДС{" "}
                        {Number(vatRate).toFixed(0)}% · {unit}
                        {size ? ` · ${size}` : ""}
                      </p>
                      <p className="mt-3 text-xs font-bold text-amber-700">
                        {isUpdate && !currentIsPublished
                          ? "Отклонение вернет товар в статус отклонен без публикации."
                          : "Отклонение заявки не меняет текущую продажную версию."}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <form
                    action={approveProductModerationRequestAction}
                    className="grid gap-3 rounded-lg bg-emerald-50 p-3"
                  >
                    <input name="requestId" type="hidden" value={request.id} />
                    <input
                      className="h-10 rounded-lg border border-emerald-100 bg-white px-3 text-sm font-semibold"
                      name="comment"
                      placeholder="Комментарий продавцу"
                    />
                    <SubmitButton
                      className="h-10 rounded-lg bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700"
                      pendingText="Публикуем"
                    >
                      <Check size={16} />
                      Опубликовать
                    </SubmitButton>
                  </form>

                  <form
                    action={rejectProductModerationRequestAction}
                    className="grid gap-3 rounded-lg bg-red-50 p-3"
                  >
                    <input name="requestId" type="hidden" value={request.id} />
                    <input
                      className="h-10 rounded-lg border border-red-100 bg-white px-3 text-sm font-semibold"
                      name="comment"
                      placeholder="Причина отклонения"
                    />
                    <SubmitButton
                      className="h-10 rounded-lg bg-red-600 text-sm font-bold text-white transition hover:bg-red-700"
                      pendingText="Отклоняем"
                    >
                      <X size={16} />
                      Отклонить
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
