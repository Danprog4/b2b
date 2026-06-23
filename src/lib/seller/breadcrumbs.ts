import {
  type SearchParams,
  withBreadcrumbSource,
} from "@/lib/navigation/breadcrumbs";

export const sellerBreadcrumbSources = {
  seller: { href: "/seller", label: "Кабинет продавца" },
  notifications: { href: "/seller/notifications", label: "Уведомления" },
  orders: { href: "/seller/orders", label: "Заказы" },
  products: { href: "/seller#products", label: "Товары" },
} as const;

export type SellerBreadcrumbSource = keyof typeof sellerBreadcrumbSources;

function getStringParam(
  searchParams: SearchParams,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

export function getSellerBreadcrumbSourceKey(
  searchParams: SearchParams,
  fallback: SellerBreadcrumbSource,
) {
  const source = getStringParam(searchParams, "from");

  if (source && source in sellerBreadcrumbSources) {
    return source as SellerBreadcrumbSource;
  }

  return fallback;
}

export function getSellerBreadcrumbSource(
  searchParams: SearchParams,
  fallback: SellerBreadcrumbSource,
) {
  return sellerBreadcrumbSources[getSellerBreadcrumbSourceKey(searchParams, fallback)];
}

export function withSellerBreadcrumbSource(
  href: string,
  source: SellerBreadcrumbSource,
) {
  return withBreadcrumbSource(href, source);
}
