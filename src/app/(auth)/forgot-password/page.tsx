import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { requestPasswordResetAction } from "@/lib/auth/password-reset-actions";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  required: "Укажите email аккаунта.",
  invalid: "Ссылка восстановления недействительна или устарела.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const sent = params.sent === "1";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <Link href="/" className="text-2xl font-black text-[#1157ff]">
          Сити Маркет
        </Link>
        <h1 className="mt-8 text-3xl font-black text-slate-950">
          Восстановление пароля
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Введите email аккаунта. Если пользователь найден, мы отправим ссылку
          для смены пароля.
        </p>

        <ToastMessages
          items={[
            ...(sent
              ? [
                  {
                    message:
                      "Если аккаунт с таким email существует, ссылка для восстановления поставлена в очередь отправки.",
                  },
                ]
              : []),
            ...(error
              ? [
                  {
                    message:
                      errorMessages[error] ?? "Не удалось начать восстановление.",
                    tone: "error" as const,
                  },
                ]
              : []),
          ]}
        />

        <form action={requestPasswordResetAction} className="mt-6 grid gap-4">
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
          <SubmitButton
            className="mt-2 h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Отправляем"
          >
            Получить ссылку
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Вспомнили пароль?{" "}
          <Link className="font-bold text-[#1157ff]" href="/login">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
