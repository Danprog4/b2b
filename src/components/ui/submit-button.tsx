"use client";

import { Loader2 } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  disabled = false,
  onClick,
  pendingMode = "form",
  pendingText,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingMode?: "form" | "clicked";
  pendingText?: ReactNode;
}) {
  const { pending } = useFormStatus();
  const [wasClicked, setWasClicked] = useState(false);
  const showPending = pending && (pendingMode === "form" || wasClicked);

  useEffect(() => {
    if (!pending) {
      setWasClicked(false);
    }
  }, [pending]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const form = event.currentTarget.form;
    if (event.currentTarget.formNoValidate || !form || form.checkValidity()) {
      setWasClicked(true);
    }
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      disabled={disabled || pending}
      onClick={handleClick}
      type="submit"
      {...props}
    >
      {showPending ? <Loader2 className="animate-spin" size={18} /> : null}
      {showPending ? (pendingText ?? children) : children}
    </button>
  );
}
