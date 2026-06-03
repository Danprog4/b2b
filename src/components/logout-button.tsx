import { LogOut } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton
        className="h-10 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-[#1157ff]"
        pendingText="Выходим"
      >
        <LogOut size={18} />
        Выйти
      </SubmitButton>
    </form>
  );
}
