import { Download, FileText } from "lucide-react";
import Link from "next/link";

import { getCurrentBuyerCompanyContractState } from "@/lib/contracts/queries";
import { formatFileSize } from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";

function getContractStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "Не сформирован";
  }

  if (status === "pending") {
    return "Формируется";
  }

  if (status === "generated") {
    return "Сформирован";
  }

  if (status === "requires_update") {
    return "Нужны реквизиты";
  }

  if (status === "failed") {
    return "Ошибка генерации";
  }

  return status;
}

function getContractStatusClassName(status: string | null | undefined) {
  if (status === "generated") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "requires_update") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-slate-100 text-slate-600";
}

export default async function AccountContractPage() {
  const state = await getCurrentBuyerCompanyContractState();

  if (!state) {
    return (
      <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link href="/account" className="text-sm font-bold text-[#1157ff]">
            ← В личный кабинет
          </Link>
          <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h1 className="text-3xl font-black text-slate-950">Договор</h1>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Компания не найдена.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { company, contract, document, missingFields, generationError } = state;
  const canDownload = contract?.status === "generated" && document;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/account">
            Личный кабинет
          </Link>
          <span>/</span>
          <span>Договор</span>
        </div>

        <Link href="/account" className="text-sm font-bold text-[#1157ff]">
          ← В личный кабинет
        </Link>

        <section className="mt-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 text-[#1157ff]" size={30} />
              <div>
                <h1 className="text-3xl font-black text-slate-950">Договор</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Договор привязан к компании {company.name}, ИНН {company.inn}.
                </p>
              </div>
            </div>
            <span
              className={`rounded-lg px-3 py-2 text-sm font-black ${getContractStatusClassName(
                contract?.status,
              )}`}
            >
              {getContractStatusLabel(contract?.status)}
            </span>
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-bold text-slate-500">Номер</p>
              <p className="mt-1 font-black text-slate-950">
                {contract?.number ?? "Будет присвоен автоматически"}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-500">Дата формирования</p>
              <p className="mt-1 font-black text-slate-950">
                {contract?.generatedAt
                  ? formatDateTime(contract.generatedAt)
                  : "Еще не сформирован"}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-500">Файл</p>
              <p className="mt-1 font-black text-slate-950">
                {document ? formatFileSize(document.sizeBytes) : "Недоступен"}
              </p>
            </div>
          </div>

          {generationError && !contract ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
              Договор не удалось сформировать: {generationError}
            </div>
          ) : null}

          {contract?.errorMessage ? (
            <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
              {contract.errorMessage}
            </div>
          ) : null}

          {missingFields.length > 0 ? (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">Для формирования договора заполните:</p>
              <ul className="mt-3 grid gap-1 pl-5 sm:grid-cols-2">
                {missingFields.map((field) => (
                  <li className="list-disc" key={field}>
                    {field}
                  </li>
                ))}
              </ul>
              <Link
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                href="/account/company?next=/account/contract"
              >
                Заполнить реквизиты
              </Link>
            </div>
          ) : null}

          {canDownload ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                href={`/documents/${document.versionId}/download`}
              >
                <Download size={16} />
                Скачать договор
              </Link>
              <span className="text-sm font-semibold text-slate-500">
                {document.fileName} · {formatDateTime(document.uploadedAt)}
              </span>
            </div>
          ) : missingFields.length === 0 ? (
            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              Договор будет доступен после автоматического формирования или
              повторного запуска администратором.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
