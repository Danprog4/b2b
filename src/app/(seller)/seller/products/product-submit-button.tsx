"use client";

import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

type ProductSubmitButtonProps = {
  children: ReactNode;
  confirmMessage?: string;
};

export function ProductSubmitButton({
  children,
  confirmMessage,
}: ProductSubmitButtonProps) {
  return (
    <SubmitButton
      className="h-12 justify-self-start rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
      pendingText="Отправляем"
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </SubmitButton>
  );
}
