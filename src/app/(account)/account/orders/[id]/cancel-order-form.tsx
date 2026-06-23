"use client";

import { XCircle } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { cancelAcceptedOrderAction } from "@/lib/orders/actions";

type CancelOrderFormProps = {
  orderId: string;
  orderNumber: string;
};

export function CancelOrderForm({ orderId, orderNumber }: CancelOrderFormProps) {
  return (
    <form
      action={cancelAcceptedOrderAction}
      className="mt-3"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Отменить заказ ${orderNumber}? Это действие нельзя отменить. Отмена доступна только до оплаты заказа.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="orderId" type="hidden" value={orderId} />
      <SubmitButton
        className="h-12 w-full rounded-lg bg-red-50 font-bold text-red-700 transition hover:bg-red-100"
        pendingText="Отменяем"
      >
        <XCircle size={18} />
        Отменить заказ
      </SubmitButton>
    </form>
  );
}
