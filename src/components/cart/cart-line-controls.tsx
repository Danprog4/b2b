"use client";

import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  removeCartItemAction,
  updateCartItemAction,
} from "@/lib/cart/actions";

export function CartLineControls({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentQuantity, setCurrentQuantity] = useState(quantity);
  const [inputValue, setInputValue] = useState(String(quantity));
  const [pendingAction, setPendingAction] = useState<
    "decrement" | "increment" | "remove" | "commit" | null
  >(null);

  function updateQuantity(
    nextQuantity: number,
    action: "decrement" | "increment" | "commit",
  ) {
    const safeQuantity = Math.max(1, Math.min(9999, Math.round(nextQuantity)));
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("quantity", String(safeQuantity));

    setCurrentQuantity(safeQuantity);
    setInputValue(String(safeQuantity));
    setPendingAction(action);

    startTransition(async () => {
      await updateCartItemAction(formData);
      router.refresh();
      setPendingAction(null);
    });
  }

  function commitInputValue(value = inputValue) {
    const parsed = Number.parseInt(value.replace(",", "."), 10);
    updateQuantity(Number.isFinite(parsed) ? parsed : currentQuantity, "commit");
  }

  function removeItem() {
    const formData = new FormData();
    formData.set("itemId", itemId);
    setPendingAction("remove");

    startTransition(async () => {
      await removeCartItemAction(formData);
      router.refresh();
      setPendingAction(null);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded-lg bg-slate-100 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || currentQuantity <= 1}
        onClick={() => updateQuantity(currentQuantity - 1, "decrement")}
        type="button"
        aria-label="Уменьшить количество"
      >
        {pendingAction === "decrement" ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Minus size={18} />
        )}
      </button>
      <input
        className="h-10 w-20 rounded-lg border border-slate-200 text-center font-bold"
        min="1"
        step="1"
        type="number"
        value={inputValue}
        disabled={isPending}
        onBlur={(event) => commitInputValue(event.currentTarget.value)}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitInputValue(event.currentTarget.value);
          }
        }}
        aria-label="Количество"
      />
      <button
        className="rounded-lg bg-slate-100 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={() => updateQuantity(currentQuantity + 1, "increment")}
        type="button"
        aria-label="Увеличить количество"
      >
        {pendingAction === "increment" ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Plus size={18} />
        )}
      </button>
      <button
        className="rounded-lg bg-red-50 p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={removeItem}
        type="button"
        aria-label="Удалить товар"
      >
        {pendingAction === "remove" ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Trash2 size={18} />
        )}
      </button>
    </div>
  );
}
