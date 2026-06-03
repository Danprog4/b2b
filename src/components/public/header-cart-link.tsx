"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type HeaderCartLinkProps = {
  count: number;
};

export function HeaderCartLink({ count }: HeaderCartLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;
  const href = `/cart?from=${encodeURIComponent(currentPath)}`;

  return (
    <Link
      className="flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#1157ff] sm:h-auto sm:w-auto sm:min-w-14 sm:flex-col sm:gap-1 sm:rounded-none sm:hover:bg-transparent sm:text-sm"
      href={href}
      title="Корзина"
    >
      <span className="relative">
        <ShoppingCart size={22} />
        {count > 0 ? (
          <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span className="sr-only sm:not-sr-only">Корзина</span>
    </Link>
  );
}
