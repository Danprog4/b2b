import Link from "next/link";
import { eq } from "drizzle-orm";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  changeBuyerPasswordAction,
  updateBuyerProfileAction,
} from "@/lib/account/profile-actions";
import { requireUser } from "@/lib/auth/session";

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  required: "Заполните email и телефон.",
  email: "Пользователь с таким email уже зарегистрирован.",
};

const passwordErrorMessages: Record<string, string> = {
  required: "Заполните текущий пароль, новый пароль и подтверждение.",
  current: "Текущий пароль указан неверно.",
  length: "Новый пароль должен быть не короче 8 символов.",
  match: "Новый пароль и подтверждение не совпадают.",
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AccountProfilePage({
  searchParams,
}: ProfilePageProps) {
  const currentUser = await requireUser(["buyer"]);
  const params = (await searchParams) ?? {};
  const error = getParam(params, "error");
  const passwordError = getParam(params, "passwordError");
  const saved = getParam(params, "saved") === "1";
  const passwordChanged = getParam(params, "passwordChanged") === "1";
  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/account">
            Личный кабинет
          </Link>
          <span>/</span>
          <span>Профиль</span>
        </div>

        <Link
          href="/account"
          className="mt-8 inline-flex text-sm font-bold text-[#1157ff]"
        >
          ← Личный кабинет
        </Link>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-3xl font-black text-slate-950">Профиль</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Эти данные используются для входа, уведомлений и отображения
            контактного лица в заявках и заказах.
          </p>

          {saved ? (
            <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Профиль сохранен.
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {errorMessages[error] ?? "Не удалось сохранить профиль."}
            </div>
          ) : null}

          <form action={updateBuyerProfileAction} className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Контактное лицо
              <input
                name="name"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                defaultValue={user?.name ?? ""}
                placeholder="Иван Иванов"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={user?.email ?? ""}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Телефон
                <input
                  name="phone"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={user?.phone ?? ""}
                  placeholder="+7 900 000-00-00"
                />
              </label>
            </div>

            <SubmitButton
              className="h-12 justify-self-start rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
              pendingText="Сохраняем"
            >
              Сохранить
            </SubmitButton>
          </form>
        </section>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-2xl font-black text-slate-950">Смена пароля</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Для безопасности укажите текущий пароль и новый пароль не короче 8
            символов.
          </p>

          {passwordChanged ? (
            <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Пароль изменен.
            </div>
          ) : null}

          {passwordError ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {passwordErrorMessages[passwordError] ??
                "Не удалось изменить пароль."}
            </div>
          ) : null}

          <form action={changeBuyerPasswordAction} className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Текущий пароль
              <input
                name="currentPassword"
                type="password"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Новый пароль
                <input
                  name="newPassword"
                  type="password"
                  minLength={8}
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Повторите пароль
                <input
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                />
              </label>
            </div>

            <SubmitButton
              className="h-12 justify-self-start rounded-lg bg-slate-900 px-6 font-bold text-white transition hover:bg-slate-800"
              pendingText="Меняем пароль"
            >
              Изменить пароль
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
