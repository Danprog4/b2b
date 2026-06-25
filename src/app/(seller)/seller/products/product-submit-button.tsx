"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";

type ProductSubmitButtonProps = {
  children: ReactNode;
  confirmMessage?: string;
  disabled?: boolean;
};

export function ProductSubmitButton({
  children,
  confirmMessage,
  disabled = false,
}: ProductSubmitButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (confirmMessage) {
    return (
      <>
        <button
          className="inline-flex h-12 items-center justify-center gap-2 justify-self-start rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={disabled}
          type="button"
          onClick={() => setIsConfirmOpen(true)}
        >
          {children}
        </button>

        <ConfirmDialog
          description={confirmMessage}
          isOpen={isConfirmOpen}
          title="Отправить изменения?"
          tone="warning"
          onClose={() => setIsConfirmOpen(false)}
        >
          <SubmitButton
            className="h-12 rounded-lg bg-[#1157ff] px-5 font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Отправляем"
          >
            {children}
          </SubmitButton>
        </ConfirmDialog>
      </>
    );
  }

  return (
    <SubmitButton
      className="h-12 justify-self-start rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
      disabled={disabled}
      pendingText="Отправляем"
    >
      {children}
    </SubmitButton>
  );
}
