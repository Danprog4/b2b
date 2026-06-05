"use client";

import { Loader2, Search } from "lucide-react";
import { useState } from "react";

type CompanyAutofillResponse = {
  company?: {
    type: "ooo" | "ip";
    name: string;
    inn: string;
    kpp: string;
    ogrn: string;
    directorName: string;
    legalAddress: string;
  } | null;
  error?: string;
};

type InnAutofillButtonProps = {
  companyNameFieldName: "companyName" | "name";
  typeFieldName: "companyType" | "type";
};

function getField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
    ? field
    : null;
}

function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const field = getField(form, name);

  if (!field) {
    return;
  }

  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function getErrorMessage(error: string | undefined) {
  if (error === "not_configured") {
    return "Сервис ИНН не настроен.";
  }

  if (error === "invalid_inn") {
    return "Введите ИНН из 10 или 12 цифр.";
  }

  return "Не удалось получить данные.";
}

export function InnAutofillButton({
  companyNameFieldName,
  typeFieldName,
}: InnAutofillButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "filled" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    const inn = form ? getField(form, "inn")?.value.replace(/\D/g, "") : "";
    const type = form ? getField(form, typeFieldName)?.value : "";

    if (!form || !inn || ![10, 12].includes(inn.length)) {
      setStatus("error");
      setMessage("Введите ИНН из 10 или 12 цифр.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const params = new URLSearchParams({ inn, type: type ?? "" });
    const response = await fetch(`/api/companies/by-inn?${params.toString()}`);
    const payload = (await response.json()) as CompanyAutofillResponse;

    if (!response.ok || !payload.company) {
      setStatus("error");
      setMessage(
        payload.company === null
          ? "Компания не найдена."
          : getErrorMessage(payload.error),
      );
      return;
    }

    setFieldValue(form, typeFieldName, payload.company.type);
    setFieldValue(form, companyNameFieldName, payload.company.name);
    setFieldValue(form, "inn", payload.company.inn);
    setFieldValue(form, "kpp", payload.company.kpp);
    setFieldValue(form, "ogrn", payload.company.ogrn);
    setFieldValue(form, "directorName", payload.company.directorName);
    setFieldValue(form, "legalAddress", payload.company.legalAddress);

    setStatus("filled");
    setMessage("Данные заполнены.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-[#1157ff] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={status === "loading"}
        type="button"
        onClick={handleClick}
      >
        {status === "loading" ? (
          <Loader2 className="animate-spin" size={17} />
        ) : (
          <Search size={17} />
        )}
        Заполнить по ИНН
      </button>
      {message ? (
        <span
          className={
            status === "error"
              ? "text-sm font-bold text-red-700"
              : "text-sm font-bold text-emerald-700"
          }
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
