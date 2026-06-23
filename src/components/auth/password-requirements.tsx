"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { getPasswordRequirementStatuses } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

type PasswordRequirementsProps = {
  className?: string;
  id?: string;
  password: string;
  showInvalid?: boolean;
};

export function PasswordRequirements({
  className,
  id,
  password,
  showInvalid = false,
}: PasswordRequirementsProps) {
  const requirements = getPasswordRequirementStatuses(password);

  return (
    <ul className={cn("grid gap-1.5 text-xs font-bold", className)} id={id}>
      {requirements.map((requirement) => {
        const isInvalid = showInvalid && !requirement.met;
        const Icon = requirement.met ? CheckCircle2 : Circle;

        return (
          <li
            className={cn(
              "flex items-center gap-2",
              requirement.met
                ? "text-emerald-700"
                : isInvalid
                  ? "text-red-700"
                  : "text-slate-500",
            )}
            key={requirement.id}
          >
            <Icon aria-hidden="true" size={14} />
            <span>{requirement.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
