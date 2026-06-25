import { Download, FileText } from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import {
  updateDocumentVisibilityAction,
  uploadAdminDocumentAction,
  uploadAdminDocumentVersionAction,
} from "@/lib/documents/actions";
import {
  getAdminDocumentOptions,
  getAdminDocuments,
} from "@/lib/documents/queries";
import {
  documentTypes,
  formatFileSize,
  getDocumentTargetLabel,
  getDocumentTypeLabel,
} from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";

type AdminDocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export default async function AdminDocumentsPage({
  searchParams,
}: AdminDocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const sellerId = getStringParam(params, "sellerId");
  const documentUploaded = params.documentUploaded === "1";
  const documentUpdated = params.documentUpdated === "1";
  const documentError =
    !documentUploaded && !documentUpdated && typeof params.documentError === "string"
      ? params.documentError
      : null;
  const [documents, options] = await Promise.all([
    getAdminDocuments({ sellerId }),
    getAdminDocumentOptions(),
  ]);
  const selectedSeller = sellerId
    ? options.sellers.find((seller) => seller.id === sellerId)
    : null;
  const selectedTargetObject = selectedSeller ? `seller:${selectedSeller.id}` : "";
  const currentPath = sellerId
    ? `/admin/documents?sellerId=${encodeURIComponent(sellerId)}`
    : "/admin/documents";

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
          <span>Документы</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
          ← В админ-панель
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <FileText className="text-[#1157ff]" size={28} />
          <h1 className="text-3xl font-black text-slate-950">
            Управление документами
          </h1>
        </div>

        <ToastMessages
          items={[
            ...(documentUploaded ? [{ message: "Документ сохранен." }] : []),
            ...(documentUpdated ? [{ message: "Документ обновлен." }] : []),
            ...(documentError
              ? [{ message: documentError, tone: "error" as const }]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-950">
            Загрузить документ
          </h2>
          <form
            action={uploadAdminDocumentAction}
            className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4"
          >
            <input name="returnPath" type="hidden" value={currentPath} />
            <div className="grid gap-3 xl:grid-cols-[1fr_260px_1fr]">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Название
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="title"
                  placeholder="Например, закрывающий документ"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Тип
                <select
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="type"
                  defaultValue="other"
                >
                  {documentTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Привязка
                <select
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="targetObject"
                  defaultValue={selectedTargetObject}
                  required
                >
                  <option value="">Выберите объект</option>
                  <optgroup label="Заказы">
                    {options.orders.map((order) => (
                      <option key={order.id} value={`order:${order.id}`}>
                        {order.number} · {order.companyName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Компании покупателей">
                    {options.companies.map((company) => (
                      <option
                        key={company.id}
                        value={`buyer_company:${company.id}`}
                      >
                        {company.name} · ИНН {company.inn}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Продавцы">
                    {options.sellers.map((seller) => (
                      <option key={seller.id} value={`seller:${seller.id}`}>
                        {seller.name} · ИНН {seller.inn}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>

            <FileUploadField
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              name="file"
              required
            />

            <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto]">
              <input
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                name="comment"
                placeholder="Комментарий к файлу"
              />
              <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700">
                <input className="size-4" name="isVisibleToBuyer" type="checkbox" />
                Видно покупателю
              </label>
              <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700">
                <input className="size-4" name="isVisibleToSeller" type="checkbox" />
                Видно продавцу
              </label>
              <SubmitButton
                className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                pendingText="Сохраняем"
              >
                Сохранить
              </SubmitButton>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Все документы
              </h2>
              {selectedSeller ? (
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Показаны документы продавца: {selectedSeller.name}
                </p>
              ) : null}
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
              {documents.length}
            </span>
          </div>

          <form className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <select
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
              defaultValue={sellerId}
              name="sellerId"
            >
              <option value="">Все продавцы</option>
              {options.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name} · ИНН {seller.inn}
                </option>
              ))}
            </select>
            <button
              className="h-11 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              type="submit"
            >
              Показать
            </button>
            <Link
              className={`inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-bold transition ${
                sellerId
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "pointer-events-none bg-slate-50 text-slate-300"
              }`}
              href="/admin/documents"
              aria-disabled={!sellerId}
            >
              Сбросить
            </Link>
          </form>

          <div className="mt-4 grid gap-3">
            {documents.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">
                Документов пока нет.
              </div>
            ) : (
              documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-950">
                        {document.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {getDocumentTargetLabel(document.target)} ·{" "}
                        {getDocumentTypeLabel(document.type)} ·{" "}
                        {formatFileSize(document.sizeBytes)} ·{" "}
                        {formatDateTime(document.uploadedAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {document.orderNumber
                          ? `Заказ ${document.orderNumber}`
                          : null}
                        {document.buyerCompanyName
                          ? ` · ${document.buyerCompanyName}`
                          : null}
                        {document.sellerName ? ` · ${document.sellerName}` : null}
                      </p>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                      href={`/documents/${document.versionId}/download`}
                    >
                      <Download size={16} />
                      Скачать
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <form
                      action={uploadAdminDocumentVersionAction}
                      className="grid w-full gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200 xl:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        name="returnPath"
                        type="hidden"
                        value={currentPath}
                      />
                      <input name="documentId" type="hidden" value={document.id} />
                      <FileUploadField
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                        name="file"
                        required
                      />
                      <input
                        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                        name="comment"
                        placeholder="Комментарий к файлу"
                      />
                      <SubmitButton
                        className="h-11 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                        pendingText="Сохраняем"
                      >
                        Заменить файл
                      </SubmitButton>
                    </form>

                    <form
                      action={updateDocumentVisibilityAction}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <input
                        name="returnPath"
                        type="hidden"
                        value={currentPath}
                      />
                      <input name="documentId" type="hidden" value={document.id} />
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input
                          className="size-4"
                          name="isVisibleToBuyer"
                          type="checkbox"
                          defaultChecked={document.isVisibleToBuyer}
                        />
                        Покупатель
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input
                          className="size-4"
                          name="isVisibleToSeller"
                          type="checkbox"
                          defaultChecked={document.isVisibleToSeller}
                        />
                        Продавец
                      </label>
                      <SubmitButton
                        className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                        pendingText="Сохраняем"
                      >
                        Сохранить видимость
                      </SubmitButton>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
