"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ToastItem = {
  id?: string;
  message: string;
  tone?: "success" | "error" | "warning";
};

function ToastCard({
  message,
  tone = "success",
}: ToastItem) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) {
    return null;
  }

  const Icon =
    tone === "error" ? XCircle : tone === "warning" ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex w-[min(380px,calc(100vw-40px))] items-start gap-3 rounded-xl px-4 py-3 text-sm font-bold shadow-2xl ring-1",
        tone === "error"
          ? "bg-red-600 text-white ring-red-700/20"
          : tone === "warning"
            ? "bg-white text-amber-800 ring-amber-100"
            : "bg-emerald-600 text-white ring-emerald-700/20",
      )}
      role="status"
    >
      <Icon
        className={cn(
          "mt-0.5 shrink-0",
          tone === "error"
            ? "text-white"
            : tone === "warning"
              ? "text-amber-600"
              : "text-white",
        )}
        size={18}
      />
      <p className="leading-6">{message}</p>
    </div>
  );
}

export function ToastMessages({ items }: { items: ToastItem[] }) {
  const visibleItems = items.filter((item) => item.message);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-5 top-5 z-50 grid gap-3">
      {visibleItems.map((item, index) => (
        <ToastCard
          id={item.id}
          key={item.id ?? `${item.tone ?? "success"}-${index}-${item.message}`}
          message={item.message}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

export function ToastMessage(props: ToastItem) {
  return <ToastMessages items={[props]} />;
}
