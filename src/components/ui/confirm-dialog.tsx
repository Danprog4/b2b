"use client";

import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId } from "react";

import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  cancelText?: ReactNode;
  children: ReactNode;
  description: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  tone?: "danger" | "warning";
  title: ReactNode;
};

export function ConfirmDialog({
  cancelText = "Отмена",
  children,
  description,
  isOpen,
  onClose,
  tone = "danger",
  title,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      role="dialog"
    >
      <div className="w-full max-w-lg animate-[zoomIn_180ms_ease-out] rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 flex size-10 shrink-0 items-center justify-center rounded-full",
                tone === "danger"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600",
              )}
            >
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2
                className="break-words text-2xl font-black text-slate-950"
                id={titleId}
              >
                {title}
              </h2>
              <p
                className="mt-3 break-words text-sm leading-6 text-slate-600"
                id={descriptionId}
              >
                {description}
              </p>
            </div>
          </div>
          <button
            aria-label="Закрыть"
            className="rounded-lg bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {children}
          <button
            className="h-12 rounded-lg bg-slate-100 px-5 font-bold text-slate-700 transition hover:bg-slate-200"
            type="button"
            onClick={onClose}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
