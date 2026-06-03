"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  disabled = false,
  pendingText,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingText?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      disabled={disabled || pending}
      type="submit"
      {...props}
    >
      {pending ? <Loader2 className="animate-spin" size={18} /> : null}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
