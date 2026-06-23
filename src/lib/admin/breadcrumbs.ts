import {
  getBreadcrumbSource,
  type SearchParams,
  withBreadcrumbSource,
} from "@/lib/navigation/breadcrumbs";

export const adminBreadcrumbSources = {
  admin: { href: "/admin", label: "Админ-панель" },
  banners: { href: "/admin/banners", label: "Баннеры" },
  categories: { href: "/admin/categories", label: "Категории" },
  chats: { href: "/admin/chats", label: "Чаты" },
  commissions: { href: "/admin/commissions", label: "Комиссии" },
  companies: { href: "/admin/companies", label: "Компании" },
  documents: { href: "/admin/documents", label: "Документы" },
  orders: { href: "/admin/orders", label: "Заказы" },
  pages: { href: "/admin/pages", label: "Страницы" },
  products: { href: "/admin/products", label: "Товары" },
  sellers: { href: "/admin/sellers", label: "Продавцы" },
  users: { href: "/admin/users", label: "Пользователи" },
} as const;

export type AdminBreadcrumbSource = keyof typeof adminBreadcrumbSources;

export function getAdminBreadcrumbSource(
  searchParams: SearchParams,
  fallback: AdminBreadcrumbSource,
) {
  return getBreadcrumbSource(searchParams, adminBreadcrumbSources, fallback);
}

export function withAdminBreadcrumbSource(
  href: string,
  source: AdminBreadcrumbSource,
) {
  return withBreadcrumbSource(href, source);
}
