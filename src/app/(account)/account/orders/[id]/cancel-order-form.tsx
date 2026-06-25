"use client";

import { XCircle } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelAcceptedOrderAction } from "@/lib/orders/actions";

type CancelOrderFormProps = {
  orderId: string;
  orderNumber: string;
};

export function CancelOrderForm({ orderId, orderNumber }: CancelOrderFormProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <form action={cancelAcceptedOrderAction} className="mt-3">
      <input name="orderId" type="hidden" value={orderId} />
      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-50 font-bold text-red-700 transition hover:bg-red-100"
        type="button"
        onClick={() => setIsConfirmOpen(true)}
      >
        <XCircle size={18} />
        Отменить заказ
      </button>

      <ConfirmDialog
        description="Это действие нельзя отменить. Отмена доступна только до оплаты заказа."
        isOpen={isConfirmOpen}
        title={`Отменить заказ ${orderNumber}?`}
        onClose={() => setIsConfirmOpen(false)}
      >
        <SubmitButton
          className="h-12 rounded-lg bg-red-600 px-5 font-bold text-white transition hover:bg-red-700"
          pendingText="Отменяем"
        >
          <XCircle size={18} />
          Отменить заказ
        </SubmitButton>
      </ConfirmDialog>
    </form>
  );
}
