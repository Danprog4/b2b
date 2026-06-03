import { and, count, eq } from "drizzle-orm";
import {
  ChevronDown,
  ClipboardList,
  Grid3X3,
  LogIn,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentCart } from "@/lib/cart/queries";
import { getActiveCategories } from "@/lib/catalog/queries";
import { APP_NAME } from "@/lib/constants";
import { HeaderCartLink } from "./header-cart-link";

export async function PublicHeader() {
  const [categories, user, cart] = await Promise.all([
    getActiveCategories(),
    getCurrentUser(),
    getCurrentCart(),
  ]);
  const isAuthenticated = user?.status === "active";
  const isAdmin = isAuthenticated && user?.role === "admin";
  const profileHref =
    user?.role === "admin" ? "/admin" : user?.role === "seller" ? "/seller" : "/account";
  const profileLabel = isAdmin ? "Админ-профиль" : isAuthenticated ? "Профиль" : "Войти";
  const [notificationCounter] =
    user && isAuthenticated
      ? await db
          .select({ count: count() })
          .from(notifications)
          .where(
            and(eq(notifications.userId, user.id), eq(notifications.isRead, false)),
          )
      : [{ count: 0 }];
  const unreadNotifications = notificationCounter?.count ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1480px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-5 sm:py-4 lg:flex lg:flex-nowrap">
        <Link
          href="/"
          className="shrink-0 text-xl font-black tracking-tight text-[#1157ff] sm:text-2xl"
        >
          {APP_NAME}
        </Link>

        <Link
          href="/catalog"
          className="row-start-2 flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b49e0] sm:h-12 sm:px-5 sm:text-base lg:row-auto"
        >
          <Grid3X3 size={20} />
          Каталог
        </Link>

        <form
          action="/catalog"
          className="row-start-2 flex h-11 min-w-0 overflow-hidden rounded-lg border-2 border-[#1157ff] bg-white lg:row-auto lg:h-12 lg:flex-1"
        >
          <div className="relative hidden shrink-0 border-r border-slate-200 bg-slate-50 md:block">
            <select
              className="h-full appearance-none bg-transparent pl-4 pr-4 text-sm text-slate-600 outline-none"
              aria-label="Область поиска"
            >
              <option>Везде</option>
              <option>Товары</option>
              <option>Категории</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />
          </div>
          <input
            className="min-w-0 flex-1 px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:px-4"
            name="q"
            placeholder="Искать товары, артикулы, категории"
            type="search"
          />
          <SubmitButton
            className="flex w-12 shrink-0 items-center justify-center bg-[#1157ff] text-white sm:w-16"
            aria-label="Найти"
            pendingText={<span className="sr-only">Ищем</span>}
          >
            <Search size={24} />
          </SubmitButton>
        </form>

        <nav className="ml-auto flex shrink-0 items-center justify-self-end gap-1 sm:gap-5">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#1157ff] sm:h-auto sm:w-auto sm:min-w-12 sm:flex-col sm:gap-1 sm:rounded-none sm:hover:bg-transparent sm:text-sm"
            href={isAuthenticated ? profileHref : "/login"}
            title={profileLabel}
          >
            <span className="relative">
              {isAuthenticated ? <UserRound size={22} /> : <LogIn size={22} />}
              {unreadNotifications > 0 ? (
                <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white ring-2 ring-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </span>
            <span className="sr-only sm:not-sr-only">{profileLabel}</span>
          </Link>
          {!isAdmin ? (
            <>
              <Link
                className="flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#1157ff] sm:h-auto sm:w-auto sm:min-w-12 sm:flex-col sm:gap-1 sm:rounded-none sm:hover:bg-transparent sm:text-sm"
                href="/account/orders"
                title="Заказы"
              >
                <ClipboardList size={22} />
                <span className="sr-only sm:not-sr-only">Заказы</span>
              </Link>
              <HeaderCartLink count={cart.count} />
            </>
          ) : null}
        </nav>
      </div>

      {categories.length > 0 ? (
        <div className="mx-auto hidden max-w-[1480px] items-center gap-6 overflow-hidden px-5 pb-4 text-sm font-medium text-slate-500 md:flex">
          {categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              href={`/catalog/${category.slug}`}
              className="shrink-0 hover:text-[#1157ff]"
            >
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
