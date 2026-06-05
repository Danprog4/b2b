import { AlertTriangle, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CartLineControls } from "@/components/cart/cart-line-controls";
import { OrderLineCard } from "@/components/orders/order-line-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentCart } from "@/lib/cart/queries";
import { formatCurrency } from "@/lib/utils";

type CartPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Корзина — Сити Маркет",
  description:
    "Корзина B2B-маркетплейса Сити Маркет: проверьте товары и перейдите к оформлению заказа.",
};

const errorMessages: Record<string, string> = {
  product_unavailable: "Товар больше недоступен и не был добавлен в корзину.",
};

function getPositiveNumber(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getSafeReturnPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/catalog";
  }

  if (
    value.startsWith("/cart") ||
    value.startsWith("/checkout") ||
    value.startsWith("/login") ||
    value.startsWith("/register")
  ) {
    return "/catalog";
  }

  return value;
}

export default async function CartPage({ searchParams }: CartPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const from = typeof params.from === "string" ? params.from : undefined;
  const reorderFrom =
    typeof params.reorderFrom === "string" ? params.reorderFrom : undefined;
  const repeatedCount = getPositiveNumber(params.repeated);
  const skippedCount = getPositiveNumber(params.skipped);
  const returnHref = getSafeReturnPath(from);
  const [cart, user] = await Promise.all([getCurrentCart(), getCurrentUser()]);
  const canCheckout = user?.role === "buyer" && cart.lines.length > 0;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <span>Корзина</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={returnHref} className="text-sm font-bold text-[#1157ff]">
              ← Назад
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Корзина</h1>
            <p className="mt-2 text-slate-600">
              Гость может добавлять товары в корзину, но оформление заказа
              доступно только покупателю после входа.
            </p>
          </div>
          <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Позиций: {cart.lines.length}
          </span>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {errorMessages[error] ?? "Не удалось выполнить действие."}
          </div>
        ) : null}

        {repeatedCount > 0 ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {reorderFrom
              ? `Заказ ${reorderFrom} отменен. В корзину добавлено позиций: ${repeatedCount}`
              : `В корзину добавлено позиций из заказа: ${repeatedCount}`}
            {skippedCount > 0
              ? `. Пропущено недоступных позиций: ${skippedCount}.`
              : "."}
          </div>
        ) : null}

        {cart.lines.length === 0 ? (
          <section className="mt-8 flex min-h-[460px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
            <div>
              <ShoppingCart className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Корзина пуста
              </h2>
              <p className="mt-2 text-slate-600">
                Добавьте товары из каталога, чтобы оформить заказ.
              </p>
              <Link
                className="mt-6 inline-flex rounded-lg bg-[#1157ff] px-5 py-3 font-bold text-white"
                href="/catalog"
              >
                Перейти в каталог
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="self-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
              <div className="divide-y divide-slate-100">
                {cart.lines.map((line) => (
                  <OrderLineCard
                    key={line.id}
                    title={line.name}
                    sku={line.sku}
                    unit={`${line.categoryName} · ${line.unit}`}
                    quantity={Number(line.quantity)}
                    priceWithVat={line.priceWithVat}
                    lineTotal={line.lineTotal}
                    vatRate={line.vatRate}
                    vatAmount={line.vatAmount}
                    imageUrl={line.mainImageUrl}
                    href={`/product/${line.slug}`}
                    alerts={
                      <>
                        {!line.isActive ? (
                          <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                            <AlertTriangle size={16} />
                            Товар больше недоступен
                          </p>
                        ) : null}
                        {line.priceChanged ? (
                          <p className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
                            <AlertTriangle size={16} />
                            Цена изменилась, перед заказом будет использована
                            актуальная цена
                          </p>
                        ) : null}
                      </>
                    }
                    actions={
                      <CartLineControls
                        itemId={line.id}
                        quantity={Number(line.quantity)}
                      />
                    }
                  />
                ))}
              </div>
            </section>

            <aside className="self-start rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="text-xl font-black text-slate-950">Итого</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Количество</span>
                  <span className="font-bold">{cart.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Сумма с НДС</span>
                  <span className="font-black">{formatCurrency(cart.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Итоговая сумма НДС</span>
                  <span className="font-bold">{formatCurrency(cart.vatTotal)}</span>
                </div>
              </div>
              {canCheckout ? (
                <Link
                  href="/checkout"
                  className="mt-6 flex h-12 items-center justify-center rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
                >
                  Оформить заказ
                </Link>
              ) : (
                <Link
                  href="/login?next=/cart"
                  className="mt-6 flex h-12 items-center justify-center rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
                >
                  Войти для оформления
                </Link>
              )}
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Доставка не рассчитывается на сайте и согласуется с менеджером.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
