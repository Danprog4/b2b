import Link from "next/link";

import { ToastMessage } from "@/components/ui/toast-message";
import { PASSWORD_POLICY_ERROR } from "@/lib/auth/password-policy";
import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  required: "Заполните оба поля пароля.",
  password: PASSWORD_POLICY_ERROR,
  match: "Пароли не совпадают.",
  same: "Новый пароль должен отличаться от старого.",
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

        <ResetPasswordForm token={token} />

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
