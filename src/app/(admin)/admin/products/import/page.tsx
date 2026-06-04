import { desc, eq } from "drizzle-orm";
import { FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { files, importJobRows, importJobs, users } from "@/db/schema";
import { ImportColumnsHelp } from "./import-columns-help";
import {
  confirmProductImportAction,
  importProductsAction,
} from "@/lib/admin/product-import-actions";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

type ImportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const exampleColumns = [
  "sku",
  "name",
  "category",
  "subcategory",
  "seller",
  "sellerInn",
  "priceWithVat",
  "vatRate",
  "size",
  "unit",
  "description",
];

const errorMessages: Record<string, string> = {
  file: "Выберите файл импорта.",
  type: "Поддерживаются XLSX, XLS и CSV.",
  size: "Файл импорта должен быть не больше 8 МБ.",
  empty: "В файле нет строк для импорта.",
  rows: "В одном файле должно быть не больше 1000 строк.",
  columns:
    "В файле нет обязательных колонок: name, category, seller или sellerInn, priceWithVat, unit.",
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function getJobStatusLabel(status: string) {
  if (status === "uploaded") {
    return "Загружен";
  }

  if (status === "validated") {
    return "Проверен, ждет подтверждения";
  }

  if (status === "failed") {
    return "Ошибка";
  }

  if (status === "imported") {
    return "Импортирован";
  }

  return status;
}

function getRowStatusLabel(status: string) {
  if (status === "created") {
    return "Создан";
  }

  if (status === "updated") {
    return "Обновлен";
  }

  if (status === "ready_create") {
    return "Будет создан";
  }

  if (status === "ready_update") {
    return "Будет обновлен";
  }

  if (status === "error") {
    return "Ошибка";
  }

  return status;
}

function getRowStatusClassName(status: string) {
  if (status === "error") {
    return "bg-red-50 text-red-700";
  }

  if (status === "created" || status === "ready_create") {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-blue-50 text-[#1157ff]";
}

function getPayloadValue(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function getErrors(errors: string[] | null) {
  return Array.isArray(errors) ? errors : [];
}

export default async function AdminProductImportPage({
  searchParams,
}: ImportPageProps) {
  await requireUser(["admin"]);
  const params = (await searchParams) ?? {};
  const selectedJobId = getParam(params, "job");
  const error = getParam(params, "error");
  const imported = getParam(params, "imported") === "1";

  const [jobs, selectedRows] = await Promise.all([
    db
      .select({
        id: importJobs.id,
        status: importJobs.status,
        totalRows: importJobs.totalRows,
        createdRows: importJobs.createdRows,
        updatedRows: importJobs.updatedRows,
        errorRows: importJobs.errorRows,
        createdAt: importJobs.createdAt,
        updatedAt: importJobs.updatedAt,
        fileName: files.originalName,
        createdByEmail: users.email,
      })
      .from(importJobs)
      .leftJoin(files, eq(files.id, importJobs.fileId))
      .leftJoin(users, eq(users.id, importJobs.createdById))
      .orderBy(desc(importJobs.createdAt))
      .limit(20),
    selectedJobId
      ? db
          .select({
            id: importJobRows.id,
            rowNumber: importJobRows.rowNumber,
            status: importJobRows.status,
            payload: importJobRows.payload,
            errors: importJobRows.errors,
            createdAt: importJobRows.createdAt,
          })
          .from(importJobRows)
          .where(eq(importJobRows.importJobId, selectedJobId))
          .orderBy(importJobRows.rowNumber)
      : Promise.resolve([]),
  ]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/products">
            Товары
          </Link>
          <span>/</span>
          <span>Импорт</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/admin/products">
              ← Товары
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Импорт товаров
            </h1>
            <p className="mt-2 text-slate-600">
              Массовое создание и обновление товаров через Excel без внешних
              интеграций.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-sm font-bold text-[#1157ff] shadow-sm ring-1 ring-slate-200"
            href="/admin/products"
          >
            Открыть товары
          </Link>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessages[error] ?? "Не удалось импортировать файл."}
          </div>
        ) : null}

        {selectedJob && selectedJob.status === "validated" ? (
          <div className="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            Файл проверен: будет создано {selectedJob.createdRows}, обновлено{" "}
            {selectedJob.updatedRows}, ошибок {selectedJob.errorRows}. Проверьте
            строки ниже и подтвердите импорт.
          </div>
        ) : null}

        {selectedJob && selectedJob.status === "imported" ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Импорт завершен: создано {selectedJob.createdRows}, обновлено{" "}
            {selectedJob.updatedRows}, ошибок {selectedJob.errorRows}.
          </div>
        ) : null}

        {imported ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            Каталог обновлен.
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_440px]">
          <form
            action={importProductsAction}
            className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-[#1157ff]" size={28} />
              <h2 className="text-xl font-black text-slate-950">
                Загрузить Excel
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              `sku` можно оставить пустым: система назначит артикул автоматически.
              Если `sku` уже существует, строка обновит offer найденного
              продавца или добавит новый offer к товару.
              Изменения применяются только после подтверждения проверенного файла.
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-950">
                  Поддерживаемые колонки
                </p>
                <ImportColumnsHelp />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {exampleColumns.map((column) => (
                  <span
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                    key={column}
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <FileUploadField
                accept=".xlsx,.xls,.csv"
                buttonText="Выбрать файл"
                name="file"
                required
              />
            </div>

            <SubmitButton
              className="mt-5 h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              pendingText="Проверяем"
            >
              <Upload size={17} />
              Проверить файл
            </SubmitButton>
          </form>

          <aside className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Как работает импорт
            </h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <p>
                Обязательные поля: `name`, `category`, `seller` или `sellerInn`,
                `priceWithVat`, `unit`.
              </p>
              <p>
                Категория ищется по названию. Подкатегория ищется по названию
                внутри найденной категории.
              </p>
              <p>
                Продавец ищется по `sellerInn` или `seller`. Без продавца строка
                не пройдет проверку.
              </p>
              <p>
                Совпадение `sku` + продавец обновляет offer; тот же `sku` с другим
                продавцом добавляет offer к существующему товару.
              </p>
              <p>
                Сначала система показывает предпросмотр и ошибки. Каталог
                меняется только после подтверждения импорта.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Файл</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Строки</th>
                <th className="px-5 py-4">Результат</th>
                <th className="px-5 py-4">Автор</th>
                <th className="px-5 py-4">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {jobs.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    Импортов пока нет.
                  </td>
                </tr>
              ) : null}
              {jobs.map((job) => (
                <tr key={job.id} className="align-top hover:bg-slate-50">
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      <span className="block font-black text-[#1157ff]">
                        {job.fileName ?? "Файл импорта"}
                      </span>
                      <span className="mt-1 block text-slate-500">{job.id}</span>
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-bold"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      {getJobStatusLabel(job.status)}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 font-black"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      {job.totalRows}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      Создано {job.createdRows} · обновлено {job.updatedRows} ·
                      ошибок {job.errorRows}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      {job.createdByEmail ?? "—"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      className="block px-5 py-4 text-slate-600"
                      href={`/admin/products/import?job=${job.id}`}
                    >
                      {formatDateTime(job.createdAt)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {selectedJobId ? (
          <section className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Строки импорта
                </h2>
                {selectedJob ? (
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {getJobStatusLabel(selectedJob.status)}
                  </p>
                ) : null}
              </div>
              {selectedJob?.status === "validated" &&
              selectedRows.some((row) => row.status !== "error") ? (
                <form action={confirmProductImportAction}>
                  <input name="jobId" type="hidden" value={selectedJob.id} />
                  <SubmitButton
                    className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                    pendingText="Импортируем"
                  >
                    Подтвердить импорт
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {selectedRows.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-500">
                  Строки не найдены.
                </div>
              ) : null}
              {selectedRows.map((row) => (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={row.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          Строка {row.rowNumber}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getRowStatusClassName(row.status)}`}
                        >
                          {getRowStatusLabel(row.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-black text-slate-950">
                        {getPayloadValue(row.payload, "name") || "Без названия"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {getPayloadValue(row.payload, "sku") || "Новый артикул"} ·{" "}
                        {getPayloadValue(row.payload, "category") || "Без категории"} ·{" "}
                        {getPayloadValue(row.payload, "priceWithVat") || "Без цены"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-500">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>

                  {getErrors(row.errors).length > 0 ? (
                    <ul className="mt-3 grid gap-1 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">
                      {getErrors(row.errors).map((rowError) => (
                        <li key={rowError}>{rowError}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
