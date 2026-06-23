"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { type ChangeEvent, type MouseEvent, useState } from "react";

import {
  type AutofilledCompany,
  InnAutofillButton,
} from "@/components/company/inn-autofill-button";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerBuyerAction } from "@/lib/auth/actions";
import { isPasswordPolicyValid } from "@/lib/auth/password-policy";

type Step = "account" | "company";

type FormValues = {
  name: string;
  phone: string;
  email: string;
  password: string;
  companyType: "ooo" | "ip";
  inn: string;
  companyName: string;
  kpp: string;
  ogrn: string;
  directorName: string;
  legalAddress: string;
  contactEmail: string;
  contactPhone: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  correspondentAccount: string;
};

const initialValues: FormValues = {
  name: "",
  phone: "",
  email: "",
  password: "",
  companyType: "ooo",
  inn: "",
  companyName: "",
  kpp: "",
  ogrn: "",
  directorName: "",
  legalAddress: "",
  contactEmail: "",
  contactPhone: "",
  bankName: "",
  bik: "",
  checkingAccount: "",
  correspondentAccount: "",
};

function getInputValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  return event.target.value;
}

function HiddenRegistrationFields({ values }: { values: FormValues }) {
  return (
    <>
      <input name="name" type="hidden" value={values.name} />
      <input name="phone" type="hidden" value={values.phone} />
      <input name="email" type="hidden" value={values.email} />
      <input name="password" type="hidden" value={values.password} />
    </>
  );
}

export function RegisterBuyerForm() {
  const [step, setStep] = useState<Step>("account");
  const [values, setValues] = useState<FormValues>(initialValues);
  const [submittedWithInvalidPassword, setSubmittedWithInvalidPassword] =
    useState(false);
  const showPasswordInvalid =
    submittedWithInvalidPassword && !isPasswordPolicyValid(values.password);

  function updateField<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleAccountNext(event: MouseEvent<HTMLButtonElement>) {
    if (!event.currentTarget.form?.reportValidity()) {
      return;
    }

    if (!isPasswordPolicyValid(values.password)) {
      setSubmittedWithInvalidPassword(true);
      return;
    }

    setValues((current) => ({
      ...current,
      contactEmail: current.contactEmail || current.email,
      contactPhone: current.contactPhone || current.phone,
    }));
    setStep("company");
  }

  function handleCompanyFilled(company: AutofilledCompany) {
    setValues((current) => ({
      ...current,
      companyType: company.type,
      inn: company.inn,
      companyName: company.name,
      kpp: company.kpp,
      ogrn: company.ogrn,
      directorName: company.directorName,
      legalAddress: company.legalAddress,
    }));
  }

  return (
    <form action={registerBuyerAction} className="mt-6 grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={
            step === "account"
              ? "rounded-xl bg-[#1157ff] p-4 text-white"
              : "rounded-xl bg-slate-100 p-4 text-slate-500"
          }
        >
          <p className="text-xs font-black uppercase">Шаг 1</p>
          <p className="mt-1 text-sm font-bold">Аккаунт и контакты</p>
        </div>
        <div
          className={
            step === "company"
              ? "rounded-xl bg-[#1157ff] p-4 text-white"
              : "rounded-xl bg-slate-100 p-4 text-slate-500"
          }
        >
          <p className="text-xs font-black uppercase">Шаг 2</p>
          <p className="mt-1 text-sm font-bold">Компания и реквизиты</p>
        </div>
      </div>

      {step === "account" ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Контактное лицо
              <input
                name="name"
                autoComplete="name"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => updateField("name", getInputValue(event))}
                placeholder="Иван Иванов"
                value={values.name}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Телефон
              <input
                name="phone"
                autoComplete="tel"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => updateField("phone", getInputValue(event))}
                placeholder="+7 900 000-00-00"
                value={values.phone}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Email
              <input
                name="email"
                autoComplete="email"
                type="email"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => updateField("email", getInputValue(event))}
                placeholder="user@example.com"
                value={values.email}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Пароль
              <input
                name="password"
                aria-describedby="register-password-requirements"
                aria-invalid={showPasswordInvalid}
                autoComplete="new-password"
                minLength={8}
                type="password"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => {
                  updateField("password", getInputValue(event));
                  setSubmittedWithInvalidPassword(false);
                }}
                placeholder="Минимум 8 символов"
                value={values.password}
              />
              <PasswordRequirements
                id="register-password-requirements"
                password={values.password}
                showInvalid={submittedWithInvalidPassword}
              />
            </label>
          </div>

          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
            onClick={handleAccountNext}
            type="button"
          >
            Далее
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div className="grid gap-5">
          <HiddenRegistrationFields values={values} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Тип компании
              <select
                name="companyType"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) =>
                  updateField(
                    "companyType",
                    event.target.value === "ip" ? "ip" : "ooo",
                  )
                }
                value={values.companyType}
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
                onChange={(event) => updateField("inn", getInputValue(event))}
                placeholder="7703000001"
                value={values.inn}
              />
            </label>
          </div>

          <InnAutofillButton
            companyNameFieldName="companyName"
            onCompanyFilled={handleCompanyFilled}
            typeFieldName="companyType"
          />

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Название компании
            <input
              name="companyName"
              required
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              onChange={(event) =>
                updateField("companyName", getInputValue(event))
              }
              placeholder="ООО Компания"
              value={values.companyName}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              КПП
              <input
                name="kpp"
                required={values.companyType === "ooo"}
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => updateField("kpp", getInputValue(event))}
                placeholder="770301001"
                value={values.kpp}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              ОГРН / ОГРНИП
              <input
                name="ogrn"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) => updateField("ogrn", getInputValue(event))}
                placeholder="1027703000001"
                value={values.ogrn}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Руководитель
            <input
              name="directorName"
              required={values.companyType === "ooo"}
              className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
              onChange={(event) =>
                updateField("directorName", getInputValue(event))
              }
              placeholder="ФИО руководителя"
              value={values.directorName}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Юридический адрес
            <textarea
              name="legalAddress"
              required
              rows={3}
              className="rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
              onChange={(event) =>
                updateField("legalAddress", getInputValue(event))
              }
              placeholder="г. Москва, ул. Примерная, д. 1"
              value={values.legalAddress}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Email компании
              <input
                name="contactEmail"
                autoComplete="email"
                required
                type="email"
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) =>
                  updateField("contactEmail", getInputValue(event))
                }
                value={values.contactEmail}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Телефон компании
              <input
                name="contactPhone"
                autoComplete="tel"
                required
                className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
                onChange={(event) =>
                  updateField("contactPhone", getInputValue(event))
                }
                value={values.contactPhone}
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
                  className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
                  onChange={(event) =>
                    updateField("bankName", getInputValue(event))
                  }
                  value={values.bankName}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                БИК
                <input
                  name="bik"
                  required
                  className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
                  onChange={(event) => updateField("bik", getInputValue(event))}
                  value={values.bik}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Расчетный счет
                <input
                  name="checkingAccount"
                  required
                  className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
                  onChange={(event) =>
                    updateField("checkingAccount", getInputValue(event))
                  }
                  value={values.checkingAccount}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Корреспондентский счет
                <input
                  name="correspondentAccount"
                  required
                  className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
                  onChange={(event) =>
                    updateField("correspondentAccount", getInputValue(event))
                  }
                  value={values.correspondentAccount}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-100 px-6 font-bold text-slate-700 transition hover:bg-slate-200"
              onClick={() => setStep("account")}
              type="button"
            >
              <ArrowLeft size={18} />
              Назад
            </button>
            <SubmitButton
              className="h-12 rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
              pendingText="Регистрируем"
            >
              <CheckCircle2 size={18} />
              Зарегистрироваться
            </SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}
