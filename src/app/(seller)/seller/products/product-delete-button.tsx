"use client";

import { Trash2 } from "lucide-react";

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
  return (
    <form
      action={deleteSellerProductAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Удалить товар «${productName}»? Он пропадет из продажи и из вашего списка товаров.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="productId" type="hidden" value={productId} />
      <SubmitButton
        className={cn(
          "h-9 rounded-lg bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100",
          className,
        )}
        pendingText="Удаляем"
      >
        <Trash2 size={15} />
        Удалить
      </SubmitButton>
    </form>
  );
}
