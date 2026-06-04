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
import { updateProductAction } from "@/lib/admin/product-actions";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { ProductForm } from "../product-form";

type ProductEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductEditPage({
  params,
  searchParams,
}: ProductEditPageProps) {
  await requireUser(["admin"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const saved = search.saved === "1";
  const created = search.created === "1";

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
      .orderBy(asc(categories.name), asc(subcategories.sortOrder), asc(subcategories.name)),
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

  const productWithImages = {
    ...product,
    sellerId: priorityOffer?.sellerId ?? product.sellerId,
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
          <Link className="text-[#1157ff]" href="/admin/products">
            Товары
          </Link>
          <span>/</span>
          <span>{product.sku}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin/products">
              ← Товары
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

        {saved || created ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {created ? "Товар создан." : "Товар сохранен."}
          </div>
        ) : null}

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <ProductForm
            action={updateProductAction}
            product={productWithImages}
            categories={categoryOptions}
            subcategories={subcategoryOptions}
            sellers={sellerOptions}
            submitText="Сохранить товар"
          />
        </section>
      </div>
    </main>
  );
}
