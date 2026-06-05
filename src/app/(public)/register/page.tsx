import Link from "next/link";
import type { Metadata } from "next";

import { InnAutofillButton } from "@/components/company/inn-autofill-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerBuyerAction } from "@/lib/auth/actions";

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
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
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

        <form action={registerBuyerAction} className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Тип компании
              <select
                name="companyType"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                defaultValue="ooo"
              >
                <option value="ooo">ООО</option>
                <option value="ip">ИП</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              ИНН
              <input
                name="inn"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="7703000001"
              />
            </label>
          </div>

          <InnAutofillButton
            companyNameFieldName="companyName"
            typeFieldName="companyType"
          />

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Название компании
            <input
              name="companyName"
              required
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="ООО Компания"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              КПП
              <input
                name="kpp"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="770301001"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              ОГРН / ОГРНИП
              <input
                name="ogrn"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="1027703000001"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Руководитель
            <input
              name="directorName"
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              placeholder="ФИО руководителя"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Юридический адрес
            <textarea
              name="legalAddress"
              rows={3}
              className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
              placeholder="г. Москва, ул. Примерная, д. 1"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Контактное лицо
              <input
                name="name"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="Иван Иванов"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Телефон
              <input
                name="phone"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="+7 900 000-00-00"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Email
              <input
                name="email"
                type="email"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="user@example.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Пароль
              <input
                name="password"
                type="password"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                placeholder="Минимум 8 символов"
              />
            </label>
          </div>

          <SubmitButton
            className="h-12 rounded-lg bg-[#1157ff] font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Регистрируем"
          >
            Зарегистрироваться
          </SubmitButton>
        </form>

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
