import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { buyerCompanies } from "@/db/schema";
import { getCompanyDocumentReadiness } from "@/lib/account/company-documents";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { updateBuyerCompanyAction } from "@/lib/account/company-actions";
import { requireUser } from "@/lib/auth/session";

type CompanyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  required: "Заполните обязательные поля.",
  inn: "Компания с таким ИНН уже есть в системе.",
  missing: "К аккаунту не привязана компания.",
};

function getBankValue(
  bankDetails: Record<string, string> | null | undefined,
  key: string,
) {
  return bankDetails?.[key] ?? "";
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AccountCompanyPage({
  searchParams,
}: CompanyPageProps) {
  const user = await requireUser(["buyer"]);

  if (!user.buyerCompanyId) {
    redirect("/account");
  }

  const params = (await searchParams) ?? {};
  const error = getParam(params, "error");
  const saved = getParam(params, "saved") === "1";
  const next = getParam(params, "next") ?? "";
  const [companyRows, documentReadiness] = await Promise.all([
    db
      .select()
      .from(buyerCompanies)
      .where(eq(buyerCompanies.id, user.buyerCompanyId))
      .limit(1),
    getCompanyDocumentReadiness(user.buyerCompanyId),
  ]);
  const [company] = companyRows;

  if (!company) {
    redirect("/account");
  }

  const missingFields = getCompanyMissingFields(company);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/account">
            Личный кабинет
          </Link>
          <span>/</span>
          <span>Компания</span>
        </div>

        <Link
          href="/account"
          className="mt-8 inline-flex text-sm font-bold text-[#1157ff]"
        >
          ← Личный кабинет
        </Link>

        <div className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Данные компании
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Эти реквизиты используются для оформления заказа и автоматического
                счета на оплату.
              </p>
            </div>
            {missingFields.length === 0 ? (
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
                Реквизиты заполнены
              </span>
            ) : (
              <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
                Нужно заполнить
              </span>
            )}
            {documentReadiness.isReady ? (
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
                Документы загружены
              </span>
            ) : (
              <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
                Документы не загружены
              </span>
            )}
          </div>

          {saved ? (
            <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Данные компании сохранены.
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {errorMessages[error] ?? "Не удалось сохранить данные."}
            </div>
          ) : null}

          {missingFields.length > 0 ? (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">Для оформления заказа не хватает:</p>
              <ul className="mt-3 grid gap-1 pl-5 sm:grid-cols-2">
                {missingFields.map((field) => (
                  <li className="list-disc" key={field}>
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!documentReadiness.isReady ? (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">
                Для оформления заказа загрузите обязательные документы:
              </p>
              <ul className="mt-3 grid gap-1 pl-5 sm:grid-cols-2">
                {documentReadiness.missingTypes.map((document) => (
                  <li className="list-disc" key={document.type}>
                    {document.label}
                  </li>
                ))}
              </ul>
              <Link
                className="mt-4 inline-flex rounded-lg bg-[#1157ff] px-4 py-3 font-bold text-white"
                href="/account/documents"
              >
                Загрузить документы
              </Link>
            </div>
          ) : null}

          <form action={updateBuyerCompanyAction} className="mt-6 grid gap-5">
            {next ? <input name="next" type="hidden" value={next} /> : null}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Тип компании
                <select
                  name="type"
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.type}
                >
                  <option value="ooo">ООО</option>
                  <option value="ip">ИП</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                Название организации
                <input
                  name="name"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.name}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                ИНН
                <input
                  name="inn"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.inn}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                КПП
                <input
                  name="kpp"
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.kpp ?? ""}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                ОГРН / ОГРНИП
                <input
                  name="ogrn"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.ogrn ?? ""}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Руководитель
              <input
                name="directorName"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                defaultValue={company.directorName ?? ""}
                placeholder="ФИО руководителя"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Юридический адрес
              <textarea
                name="legalAddress"
                required
                rows={3}
                className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
                defaultValue={company.legalAddress ?? ""}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Email компании
                <input
                  name="contactEmail"
                  required
                  type="email"
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.contactEmail ?? ""}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Телефон компании
                <input
                  name="contactPhone"
                  required
                  className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                  defaultValue={company.contactPhone ?? ""}
                />
              </label>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <h2 className="text-lg font-black text-slate-950">
                Банковские реквизиты
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Банк
                  <input
                    name="bankName"
                    required
                    className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                    defaultValue={getBankValue(company.bankDetails, "bankName")}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  БИК
                  <input
                    name="bik"
                    required
                    className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                    defaultValue={getBankValue(company.bankDetails, "bik")}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Расчетный счет
                  <input
                    name="checkingAccount"
                    required
                    className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                    defaultValue={getBankValue(
                      company.bankDetails,
                      "checkingAccount",
                    )}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Корреспондентский счет
                  <input
                    name="correspondentAccount"
                    required
                    className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                    defaultValue={getBankValue(
                      company.bankDetails,
                      "correspondentAccount",
                    )}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <SubmitButton
                className="h-12 rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
                pendingText="Сохраняем"
              >
                Сохранить
              </SubmitButton>
              {next === "/checkout" ? (
                <Link
                  className="inline-flex h-12 items-center rounded-lg bg-slate-100 px-6 font-bold text-slate-700 transition hover:bg-slate-200"
                  href="/checkout"
                >
                  Вернуться к заказу
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
