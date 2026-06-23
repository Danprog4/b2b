import {
  getBreadcrumbSource,
  type SearchParams,
  withBreadcrumbSource,
} from "@/lib/navigation/breadcrumbs";

export const accountBreadcrumbSources = {
  account: { href: "/account", label: "Личный кабинет" },
  notifications: { href: "/account/notifications", label: "Уведомления" },
  orders: { href: "/account/orders", label: "Заказы" },
} as const;

export type AccountBreadcrumbSource = keyof typeof accountBreadcrumbSources;

export function getAccountBreadcrumbSource(
  searchParams: SearchParams,
  fallback: AccountBreadcrumbSource,
) {
  return getBreadcrumbSource(searchParams, accountBreadcrumbSources, fallback);
}

export function withAccountBreadcrumbSource(
  href: string,
  source: AccountBreadcrumbSource,
) {
  return withBreadcrumbSource(href, source);
}
