import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import {
  getProductBySlug,
  getProductGalleryImages,
} from "@/lib/catalog/queries";
import { formatCurrency } from "@/lib/utils";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Товар не найден | Сити Маркет",
    };
  }

  return {
    title: `${product.name} | Сити Маркет`,
    description:
      product.description ||
      `${product.name}, артикул ${product.sku}, цена с НДС для юридических лиц и ИП.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const galleryImages = await getProductGalleryImages(product.id);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/catalog">
            Каталог
          </Link>
          <span>/</span>
          <Link
            className="text-[#1157ff]"
            href={`/catalog/${product.categorySlug}`}
          >
            {product.categoryName}
          </Link>
          {product.subcategoryName && product.subcategorySlug ? (
            <>
              <span>/</span>
              <Link
                className="text-[#1157ff]"
                href={`/catalog/${product.categorySlug}/${product.subcategorySlug}`}
              >
                {product.subcategoryName}
              </Link>
            </>
          ) : null}
          <span>/</span>
          <span className="text-slate-500">{product.name}</span>
        </div>

        <Link
          href="/catalog"
          className="mb-5 mt-8 inline-flex text-sm font-bold text-[#1157ff]"
        >
          ← Назад в каталог
        </Link>

        <section className="grid gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 lg:grid-cols-[520px_1fr]">
          <div className="grid content-start gap-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {product.mainImageUrl ? (
                <img
                  alt={product.name}
                  className="h-full w-full object-cover"
                  src={product.mainImageUrl}
                />
              ) : (
                <ShoppingCart className="text-slate-300" size={72} />
              )}
            </div>
            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {galleryImages.map((image) => (
                  <a
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition hover:ring-[#1157ff]"
                    href={image.url ?? "#"}
                    key={image.id}
                    target="_blank"
                  >
                    {image.url ? (
                      <img
                        alt={image.fileName}
                        className="h-full w-full object-cover"
                        src={image.url}
                      />
                    ) : (
                      <ShoppingCart className="text-slate-300" size={26} />
                    )}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            {!product.isActive ? (
              <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                Товар недоступен
              </div>
            ) : null}
            <p className="text-sm font-bold text-slate-500">{product.sku}</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 lg:text-5xl">
              {product.name}
            </h1>
            <div className="mt-6 text-4xl font-black text-slate-950">
              {formatCurrency(product.priceWithVat)}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Цена указана с НДС {product.vatRate ?? "22.00"}%
            </p>

            <div className="mt-8 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Категория</span>
                <span className="font-bold">{product.categoryName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Подкатегория</span>
                <span className="font-bold">
                  {product.subcategoryName ?? "Не указана"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Размер</span>
                <span className="font-bold">{product.size ?? "Не указан"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Единица измерения</span>
                <span className="font-bold">{product.unit}</span>
              </div>
            </div>

            <p className="mt-6 max-w-3xl leading-7 text-slate-600">
              {product.description || "Описание товара будет добавлено позже."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <AddToCartButton
                productId={product.id}
                sellerOfferId={product.sellerOfferId}
                disabled={!product.isActive}
                showQuantityInput
              />
              <Link
                href="/catalog"
                className="inline-flex h-12 items-center rounded-lg bg-slate-100 px-6 font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Назад в каталог
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
