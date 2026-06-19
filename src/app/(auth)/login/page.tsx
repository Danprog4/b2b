import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { loginAction } from "@/lib/auth/actions";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  invalid: "Неверный email или пароль.",
  inactive: "Аккаунт еще не активен или заблокирован.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const pending = typeof params.pending === "string" ? params.pending : undefined;
  const resubmitted = params.resubmitted === "1";
  const reset = params.reset === "1";
  const next = typeof params.next === "string" ? params.next : "";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <Link href="/" className="text-2xl font-black text-[#1157ff]">
          Сити Маркет
        </Link>
        <h1 className="mt-8 text-3xl font-black text-slate-950">Вход</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Войдите как покупатель, продавец или администратор.
        </p>

        <ToastMessages
          items={[
            ...(error
              ? [
                  {
                    message: errorMessages[error] ?? "Не удалось выполнить вход.",
                    tone: "error" as const,
                  },
                ]
              : []),
            ...(pending === "company"
              ? [
                  {
                    message: resubmitted
                      ? "Повторная заявка на присоединение к компании создана. Доступ появится после подтверждения администратором."
                      : "Заявка на присоединение к компании создана. Доступ появится после подтверждения администратором.",
                    tone: "warning" as const,
                  },
                ]
              : []),
            ...(reset
              ? [
                  {
                    message: "Пароль изменен. Теперь можно войти с новым паролем.",
                  },
                ]
              : []),
          ]}
        />

        <form action={loginAction} className="mt-6 grid gap-4">
          <input name="next" type="hidden" value={next} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Email
            <input
              name="email"
              type="email"
              required
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="buyer@city-market.local"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Пароль
            <input
              name="password"
              type="password"
              required
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="password123"
            />
          </label>
          <SubmitButton
            className="mt-2 h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Входим"
          >
            Войти
          </SubmitButton>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          <Link className="font-bold text-[#1157ff]" href="/forgot-password">
            Забыли пароль?
          </Link>
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p className="font-bold text-slate-800">Демо-доступы</p>
          <p>buyer@city-market.local / password123</p>
          <p>seller@city-market.local / password123</p>
          <p>admin@city-market.local / password123</p>
        </div>

        <p className="mt-6 text-sm text-slate-600">
          Нет аккаунта?{" "}
          <Link className="font-bold text-[#1157ff]" href="/register">
            Зарегистрировать компанию
          </Link>
        </p>
      </div>
    </main>
  );
}
