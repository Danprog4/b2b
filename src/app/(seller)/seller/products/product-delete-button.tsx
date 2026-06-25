"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteSellerProductAction } from "@/lib/seller/product-actions";
import { cn } from "@/lib/utils";

type SellerProductDeleteButtonProps = {
  className?: string;
  productId: string;
  productName: string;
};

export function SellerProductDeleteButton({
  className,
  productId,
  productName,
}: SellerProductDeleteButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <form action={deleteSellerProductAction}>
      <input name="productId" type="hidden" value={productId} />
      <button
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100",
          className,
        )}
        type="button"
        onClick={() => setIsConfirmOpen(true)}
      >
        <Trash2 size={15} />
        Удалить
      </button>

      <ConfirmDialog
        description={`Товар «${productName}» пропадет из продажи и из вашего списка товаров.`}
        isOpen={isConfirmOpen}
        title="Удалить товар?"
        onClose={() => setIsConfirmOpen(false)}
      >
        <SubmitButton
          className="h-12 rounded-lg bg-red-600 px-5 font-bold text-white transition hover:bg-red-700"
          pendingText="Удаляем"
        >
          <Trash2 size={18} />
          Удалить
        </SubmitButton>
      </ConfirmDialog>
    </form>
  );
}
