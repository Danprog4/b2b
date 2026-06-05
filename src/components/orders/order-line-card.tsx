import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatCurrency } from "@/lib/utils";

type OrderLineCardProps = {
  title: string;
  sku: string;
  unit: string;
  quantity: number;
  priceWithVat: number | string;
  lineTotal: number | string;
  vatRate?: number | string | null;
  vatAmount?: number | string | null;
  imageUrl?: string | null;
  href?: string | null;
  meta?: ReactNode;
  alerts?: ReactNode;
  actions?: ReactNode;
};

export function OrderLineCard({
  title,
  sku,
  unit,
  quantity,
  priceWithVat,
  lineTotal,
  vatRate,
  vatAmount,
  imageUrl,
  href,
  meta,
  alerts,
  actions,
}: OrderLineCardProps) {
  const image = (
    <div className="flex aspect-square size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
      {imageUrl ? (
        <img alt={title} className="h-full w-full object-cover" src={imageUrl} />
      ) : (
        <ShoppingCart className="text-slate-300" size={34} />
      )}
    </div>
  );
  const titleNode = href ? (
    <Link className="hover:text-[#1157ff]" href={href}>
      {title}
    </Link>
  ) : (
    title
  );

  return (
    <article className="grid items-start gap-4 p-5 md:grid-cols-[96px_1fr_auto]">
      {href ? (
        <Link href={href} aria-label={title}>
          {image}
        </Link>
      ) : (
        image
      )}

      <div className="min-w-0">
        <h2 className="text-lg font-black text-slate-950">{titleNode}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {sku} · {unit}
        </p>
        {vatAmount !== undefined && vatAmount !== null ? (
          <p className="mt-2 text-sm text-slate-500">
            НДС {Number(vatRate ?? 22)}%: {formatCurrency(vatAmount)}
          </p>
        ) : null}
        {meta ? <div className="mt-2 text-sm text-slate-600">{meta}</div> : null}
        {alerts ? <div className="mt-3 grid gap-2">{alerts}</div> : null}
      </div>

      <div className="grid gap-3 md:min-w-56 md:justify-items-end md:text-right">
        <div className="text-xl font-black text-slate-950">
          {formatCurrency(lineTotal)}
        </div>
        <div className="text-sm font-semibold text-slate-500">
          {quantity} × {formatCurrency(priceWithVat)}
        </div>
        {actions}
      </div>
    </article>
  );
}
