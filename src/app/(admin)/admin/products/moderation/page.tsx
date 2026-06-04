import { asc, eq } from "drizzle-orm";
import { Check, Clock3, X } from "lucide-react";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import {
  categories,
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
import { formatCurrency, formatDateTime } from "@/lib/utils";

type ProductModerationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getRequestTypeLabel(type: string) {
  if (type === "create") {
    return "Новый товар";
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

        {moderated ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Заявка обработана.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Заявка не найдена или данные неполные.
          </div>
        ) : null}

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
            const unit = getPayloadString(request.payload, "unit");
            const size = getPayloadString(request.payload, "size");
            const description = getPayloadString(request.payload, "description");
            const isUpdate = request.type === "update";
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
                      {request.categoryName ?? "Будет применена из заявки"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Подкатегория</dt>
                    <dd className="mt-1 font-black text-slate-950">
                      {request.subcategoryName ?? "Без подкатегории"}
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

                {isUpdate ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase text-emerald-700">
                        Сейчас на витрине
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
                      <p className="mt-3 text-xs font-bold text-emerald-700">
                        {currentIsPublished
                          ? "Старая версия продаётся до одобрения изменений."
                          : "Текущая версия не опубликована."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase text-amber-700">
                        Будет после одобрения
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
                        Отклонение заявки не меняет текущую продажную версию.
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
