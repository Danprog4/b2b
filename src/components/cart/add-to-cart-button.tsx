"use client";

import { Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { addToCartAction, updateCartItemAction } from "@/lib/cart/actions";
import { cn } from "@/lib/utils";

type CartLineState = {
  itemId: string;
  quantity: number;
};

export function AddToCartButton({
  productId,
  className,
  quantity = 1,
  disabled = false,
  showQuantityInput = false,
}: {
  productId: string;
  className?: string;
  quantity?: number;
  disabled?: boolean;
  showQuantityInput?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [cartLine, setCartLine] = useState<CartLineState | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [pendingAction, setPendingAction] = useState<
    "add" | "decrement" | "increment" | null
  >(null);
  const search = searchParams.toString();
  const currentPath = `${pathname}${search ? `?${search}` : ""}`;
  const cartHref = `/cart?from=${encodeURIComponent(currentPath)}`;

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [isToastVisible]);

  function add(quantityToAdd: number) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("quantity", String(quantityToAdd));
    setPendingAction("add");

    startTransition(async () => {
      const result = await addToCartAction(formData);

      if (result.ok && result.itemId) {
        setCartLine({
          itemId: result.itemId,
          quantity: result.quantity,
        });
        setIsToastVisible(true);
      }

      setPendingAction(null);
    });
  }

  function setCartQuantity(
    nextQuantity: number,
    action: "decrement" | "increment",
  ) {
    if (!cartLine) {
      return;
    }

    const safeQuantity = Math.max(1, nextQuantity);
    const formData = new FormData();
    formData.set("itemId", cartLine.itemId);
    formData.set("quantity", String(safeQuantity));

    setCartLine({ ...cartLine, quantity: safeQuantity });
    setPendingAction(action);

    startTransition(async () => {
      await updateCartItemAction(formData);
      setPendingAction(null);
    });
  }

  return (
    <>
      {cartLine ? (
        <div
          className={cn(
            "inline-flex items-center rounded-lg bg-[#1157ff] text-white",
            showQuantityInput ? "h-12" : "h-10",
            className,
          )}
        >
          <button
            className={cn(
              "flex items-center justify-center rounded-l-lg transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:opacity-60",
              showQuantityInput ? "h-12 w-12" : "h-10 w-9",
            )}
            disabled={disabled || isPending || cartLine.quantity <= 1}
            onClick={() => setCartQuantity(cartLine.quantity - 1, "decrement")}
            type="button"
            aria-label="Уменьшить количество"
          >
            {pendingAction === "decrement" ? (
              <Loader2 className="animate-spin" size={showQuantityInput ? 19 : 17} />
            ) : (
              <Minus size={showQuantityInput ? 19 : 17} />
            )}
          </button>
          <span
            className={cn(
              "select-none text-center font-black tabular-nums",
              showQuantityInput ? "min-w-12 text-base" : "min-w-8 text-sm",
            )}
          >
            {cartLine.quantity}
          </span>
          <button
            className={cn(
              "flex items-center justify-center rounded-r-lg transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:opacity-60",
              showQuantityInput ? "h-12 w-12" : "h-10 w-9",
            )}
            disabled={disabled || isPending}
            onClick={() => setCartQuantity(cartLine.quantity + 1, "increment")}
            type="button"
            aria-label="Увеличить количество"
          >
            {pendingAction === "increment" ? (
              <Loader2 className="animate-spin" size={showQuantityInput ? 19 : 17} />
            ) : (
              <Plus size={showQuantityInput ? 19 : 17} />
            )}
          </button>
        </div>
      ) : (
        <div className={showQuantityInput ? "flex gap-3" : undefined}>
          {showQuantityInput ? (
            <input
              className="h-12 w-24 rounded-lg border border-slate-200 px-3 text-center font-bold"
              min="1"
              step="1"
              type="number"
              value={selectedQuantity}
              disabled={disabled}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setSelectedQuantity(Number.isFinite(nextValue) ? nextValue : 1);
              }}
            />
          ) : null}
          <button
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:bg-slate-300",
              showQuantityInput ? "h-12 px-6" : "h-10 w-10",
              className,
            )}
            disabled={disabled || isPending}
            onClick={() => add(showQuantityInput ? selectedQuantity : 1)}
            type="button"
          >
            {pendingAction === "add" ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <ShoppingCart size={20} />
            )}
            {showQuantityInput
              ? pendingAction === "add"
                ? "Добавляем"
                : "В корзину"
              : null}
          </button>
        </div>
      )}

      {isToastVisible ? (
        <div className="fixed right-5 top-5 z-50 flex w-[min(360px,calc(100vw-40px))] items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-2xl ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-950">
            Товар добавлен в корзину
          </p>
          <Link
            className="shrink-0 rounded-lg bg-[#1157ff] px-3 py-2 text-sm font-bold text-white"
            href={cartHref}
          >
            В корзину
          </Link>
        </div>
      ) : null}
    </>
  );
}
