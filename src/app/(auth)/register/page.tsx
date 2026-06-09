import Link from "next/link";
import type { Metadata } from "next";

import { RegisterBuyerForm } from "./register-buyer-form";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Регистрация покупателя — Сити Маркет",
  description:
    "Регистрация юридического лица или ИП для закупок в B2B-маркетплейсе Сити Маркет.",
};

const errorMessages: Record<string, string> = {
  required: "Заполните обязательные поля.",
  password: "Пароль должен быть не короче 8 символов.",
  email: "Пользователь с таким email уже зарегистрирован.",
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : undefined;
  const retry = params.retry === "company";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <Link href="/" className="text-2xl font-black text-[#1157ff]">
          Сити Маркет
        </Link>
        <h1 className="mt-8 text-3xl font-black text-slate-950">
          Регистрация покупателя
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Если ИНН уже есть в системе, создается заявка на присоединение.
        </p>

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessages[error] ?? "Не удалось зарегистрироваться."}
          </div>
        ) : null}

        {retry ? (
          <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Заявка на присоединение была отклонена. Проверьте ИНН и данные
            компании, затем отправьте регистрацию повторно с тем же email.
          </div>
        ) : null}

        <RegisterBuyerForm />

        <p className="mt-6 text-sm text-slate-600">
          Уже есть аккаунт?{" "}
          <Link className="font-bold text-[#1157ff]" href="/login">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
