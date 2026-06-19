import Link from "next/link";

import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessage } from "@/components/ui/toast-message";
import { resetPasswordAction } from "@/lib/auth/password-reset-actions";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  required: "Заполните оба поля пароля.",
  password: "Пароль должен быть не короче 8 символов.",
  match: "Пароли не совпадают.",
  invalid: "Ссылка восстановления недействительна или устарела.",
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <Link href="/" className="text-2xl font-black text-[#1157ff]">
          Сити Маркет
        </Link>
        <h1 className="mt-8 text-3xl font-black text-slate-950">
          Новый пароль
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Задайте новый пароль для аккаунта. После сохранения можно войти с ним
          на сайт.
        </p>

        {error ? (
          <ToastMessage
            message={errorMessages[error] ?? "Не удалось сменить пароль."}
            tone="error"
          />
        ) : null}

        <form action={resetPasswordAction} className="mt-6 grid gap-4">
          <input name="token" type="hidden" value={token} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Новый пароль
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="Не менее 8 символов"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Повторите пароль
            <input
              name="passwordConfirm"
              type="password"
              required
              minLength={8}
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="Повторите новый пароль"
            />
          </label>
          <SubmitButton
            className="mt-2 h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Сохраняем"
          >
            Сменить пароль
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Нужна новая ссылка?{" "}
          <Link className="font-bold text-[#1157ff]" href="/forgot-password">
            Запросить повторно
          </Link>
        </p>
      </div>
    </main>
  );
}
