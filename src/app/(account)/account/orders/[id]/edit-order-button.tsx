"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { repeatOrderAction } from "@/lib/orders/actions";

export function EditOrderButton({ orderId }: { orderId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="mt-5 h-12 w-full rounded-lg bg-slate-100 font-bold text-slate-700 transition hover:bg-slate-200"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Редактировать заказ
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Переоформить заказ через корзину?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Уже созданный заказ нельзя изменить напрямую. Мы перенесем
                  доступные позиции в корзину, пересчитаем их по актуальным
                  ценам, и вы сможете оформить новый заказ. Если этот заказ
                  больше не нужен, отмените его на странице заказа до оплаты.
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <form action={repeatOrderAction}>
                <input name="orderId" type="hidden" value={orderId} />
                <SubmitButton
                  className="h-12 rounded-lg bg-[#1157ff] px-5 font-bold text-white transition hover:bg-[#0b49e0]"
                  pendingText="Готовим корзину"
                >
                  Добавить позиции в корзину
                </SubmitButton>
              </form>
              <button
                className="h-12 rounded-lg bg-slate-100 px-5 font-bold text-slate-700 transition hover:bg-slate-200"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                Не менять
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
