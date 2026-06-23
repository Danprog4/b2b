import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  categories,
  files,
  productImages,
  products,
  sellerOffers,
  sellers,
  subcategories,
} from "@/db/schema";
import {
  updateProductAction,
  upsertProductOfferAction,
} from "@/lib/admin/product-actions";
import { getAdminBreadcrumbSource } from "@/lib/admin/breadcrumbs";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { isSellerDeletedOffer } from "@/lib/products/offer-status";
import { formatDateTime } from "@/lib/utils";
import { ToastMessages } from "@/components/ui/toast-message";
import { ProductForm } from "../product-form";

type ProductEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const offerStatusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "on_moderation", label: "На модерации" },
  { value: "published", label: "Опубликовано" },
  { value: "rejected", label: "Отклонено" },
  { value: "hidden", label: "Скрыто" },
] as const;

const offerStatusLabels = Object.fromEntries(
  offerStatusOptions.map((status) => [status.value, status.label]),
);

export default async function AdminProductEditPage({
  params,
  searchParams,
}: ProductEditPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const created = search.created === "1";
  const offerSaved = search.offerSaved === "1";
  const offerError = search.offerError;
  const offerWarning = search.offerWarning === "no-published-offers";
  const breadcrumbSource = getAdminBreadcrumbSource(search, "products");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    notFound();
  }

  const [priorityOffer] = product.priorityOfferId
    ? await db
        .select({
          id: sellerOffers.id,
          sellerId: sellerOffers.sellerId,
          priceWithVat: sellerOffers.priceWithVat,
          vatRate: sellerOffers.vatRate,
        })
        .from(sellerOffers)
        .where(eq(sellerOffers.id, product.priorityOfferId))
        .limit(1)
    : [];

  const [mainImage] = product.mainImageFileId
    ? await db
        .select({
          id: files.id,
          storageKey: files.storageKey,
        })
        .from(files)
        .where(and(eq(files.id, product.mainImageFileId), eq(files.isActive, true)))
        .limit(1)
    : [];

  const [categoryOptions, subcategoryOptions, sellerOptions, galleryImages] =
    await Promise.all([
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: subcategories.id,
          name: subcategories.name,
          categoryName: categories.name,
        })
        .from(subcategories)
        .innerJoin(categories, eq(categories.id, subcategories.categoryId))
        .orderBy(
          asc(categories.name),
          asc(subcategories.sortOrder),
          asc(subcategories.name),
        ),
      db
        .select({ id: sellers.id, name: sellers.name })
        .from(sellers)
        .orderBy(asc(sellers.name)),
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
  const offerRows = await db
    .select({
      id: sellerOffers.id,
      sellerId: sellerOffers.sellerId,
      sellerName: sellers.name,
      priceWithVat: sellerOffers.priceWithVat,
      vatRate: sellerOffers.vatRate,
      status: sellerOffers.status,
      moderationComment: sellerOffers.moderationComment,
      updatedAt: sellerOffers.updatedAt,
    })
    .from(sellerOffers)
    .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
    .where(eq(sellerOffers.productId, product.id))
    .orderBy(asc(sellers.name));
  const sellerDeletedOffer = offerRows.find((offer) =>
    isSellerDeletedOffer({
      status: offer.status,
      moderationComment: offer.moderationComment,
    }),
  );
  const isDeletedBySeller = Boolean(sellerDeletedOffer);

  const productWithImages = {
    ...product,
    sellerId: sellerDeletedOffer?.sellerId ?? priorityOffer?.sellerId ?? product.sellerId,
    priceWithVat: priorityOffer?.priceWithVat ?? product.priceWithVat,
    vatRate: priorityOffer?.vatRate ?? product.vatRate,
    mainImageUrl: mainImage ? getPublicFileUrl(mainImage) : null,
    galleryImages: galleryImages.map((image) => ({
      id: image.id,
      fileName: image.fileName,
      url: getPublicFileUrl({
        id: image.fileId,
        storageKey: image.storageKey,
      }),
    })),
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <span>{product.sku}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              className="text-sm font-bold text-[#1157ff]"
              href={breadcrumbSource.href}
            >
              ← {breadcrumbSource.label}
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {product.name}
            </h1>
          </div>
          <Link
            className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-sm font-bold text-[#1157ff] shadow-sm ring-1 ring-slate-200"
            href={`/product/${product.slug}`}
            target="_blank"
          >
            Открыть на сайте
          </Link>
        </div>

        <ToastMessages
          items={[
            ...(saved || created
              ? [{ message: created ? "Товар создан." : "Товар сохранен." }]
              : []),
            ...(offerSaved ? [{ message: "Предложение сохранено." }] : []),
            ...(offerError === "seller-deleted"
              ? [
                  {
                    message:
                      "Товар удален продавцом. Админ не может вернуть его на витрину обычным сохранением.",
                    tone: "error" as const,
                  },
                ]
              : []),
            ...(offerWarning
              ? [
                  {
                    message: "Опубликованных предложений для витрины нет.",
                    tone: "warning" as const,
                  },
                ]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">
              Продавец и статус
            </h2>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
              {offerRows.length}
            </span>
          </div>
          {isDeletedBySeller ? (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900">
              Товар удален продавцом. Админ может редактировать карточку как
              архивную, но сохранение не вернет товар на витрину. Чтобы снова
              продавать товар, продавец должен создать или отправить товар заново.
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Продавец</th>
                  <th className="px-4 py-3">Цена</th>
                  <th className="px-4 py-3">НДС</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offerRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      Предложений пока нет.
                    </td>
                  </tr>
                ) : null}
                {offerRows.map((offer) => {
                  const isOfferDeletedBySeller = isSellerDeletedOffer({
                    status: offer.status,
                    moderationComment: offer.moderationComment,
                  });

                  return (
                    <tr key={offer.id}>
                      <td className="px-4 py-3 font-bold text-slate-950">
                        {offer.sellerName}
                      </td>
                      <td className="px-4 py-3 font-black">
                        {Number(offer.priceWithVat).toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {Number(offer.vatRate).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isOfferDeletedBySeller
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOfferDeletedBySeller
                            ? "Удалено продавцом"
                            : (offerStatusLabels[offer.status] ?? offer.status)}
                        </span>
                        {isOfferDeletedBySeller ? (
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {formatDateTime(offer.updatedAt)}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isDeletedBySeller ? (
            <form
              action={upsertProductOfferAction}
              className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[1fr_160px_130px_180px_auto]"
            >
              <input name="productId" type="hidden" value={product.id} />
              <select
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                name="sellerId"
                required
              >
                <option value="">Продавец</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
              <input
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                min="0"
                name="priceWithVat"
                placeholder="Цена"
                required
                step="1"
                type="number"
              />
              <input
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                defaultValue="22.00"
                min="0"
                name="vatRate"
                step="1"
                type="number"
              />
              <select
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                defaultValue="published"
                name="status"
              >
                {offerStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                className="h-11 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                type="submit"
              >
                Сохранить
              </button>
            </form>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <ProductForm
            action={updateProductAction}
            product={productWithImages}
            categories={categoryOptions}
            catalogActiveLocked={isDeletedBySeller}
            catalogActiveLockMessage={
              isDeletedBySeller
                ? "Товар удален продавцом, поэтому админское сохранение не может вернуть его в каталог."
                : undefined
            }
            sellerLocked={isDeletedBySeller}
            subcategories={subcategoryOptions}
            sellers={sellerOptions}
            submitText="Сохранить товар"
          />
        </section>
      </div>
    </main>
  );
}
