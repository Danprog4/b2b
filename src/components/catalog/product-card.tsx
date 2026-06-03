import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import type { ProductListItem } from "@/lib/catalog/queries";
import { formatCurrency } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <article className="flex h-[430px] flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <Link
        href={`/product/${product.slug}`}
        className="mb-4 flex h-48 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 transition hover:bg-slate-200"
      >
        {product.mainImageUrl ? (
          <img
            alt={product.name}
            className="h-full w-full object-cover"
            src={product.mainImageUrl}
          />
        ) : (
          <ShoppingCart className="text-slate-300" size={44} />
        )}
      </Link>
      <div className="min-h-9 text-xs font-semibold leading-5">
        <Link
          href={`/catalog/${product.categorySlug}`}
          className="text-slate-500 hover:text-[#1157ff]"
        >
          {product.categoryName}
        </Link>
        {product.subcategoryName && product.subcategorySlug ? (
          <Link
            href={`/catalog/${product.categorySlug}/${product.subcategorySlug}`}
            className="ml-2 text-slate-400 hover:text-[#1157ff]"
          >
            / {product.subcategoryName}
          </Link>
        ) : null}
      </div>
      <Link href={`/product/${product.slug}`}>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-bold leading-6 hover:text-[#1157ff]">
          {product.name}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500">
        {product.sku}
        {product.size ? ` · ${product.size}` : ""} · {product.unit}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-xl font-black leading-none">
          {formatCurrency(product.priceWithVat)}
        </span>
        <AddToCartButton productId={product.id} />
      </div>
    </article>
  );
}
