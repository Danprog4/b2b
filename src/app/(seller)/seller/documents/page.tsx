import { Download, FileText, Paperclip, Upload } from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import {
  uploadSellerDocumentAction,
  uploadSellerDocumentVersionAction,
} from "@/lib/documents/actions";
import { getCurrentSellerDocuments } from "@/lib/documents/queries";
import {
  formatFileSize,
  getDocumentTypeLabel,
  sellerDocumentTypes,
} from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";

type SellerDocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SellerDocumentsPage({
  searchParams,
}: SellerDocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const documentUploaded = params.documentUploaded === "1";
  const documentError =
    !documentUploaded && typeof params.documentError === "string"
      ? params.documentError
      : null;
  const documents = await getCurrentSellerDocuments();

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <span>Документы</span>
        </div>

        <Link href="/seller" className="text-sm font-bold text-[#1157ff]">
          ← В кабинет продавца
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Paperclip className="text-[#1157ff]" size={28} />
              <h1 className="text-3xl font-black text-slate-950">Документы</h1>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Загружайте карточку компании и другие документы продавца. Актуальная
              версия файла показывается первой.
            </p>
          </div>
          <span className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-100">
            {documents.length}
          </span>
        </div>

        <ToastMessages
          items={[
            ...(documentUploaded ? [{ message: "Документ сохранен." }] : []),
            ...(documentError
              ? [{ message: documentError, tone: "error" as const }]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-black text-slate-950">
            Загрузить документ
          </h2>
          <form
            action={uploadSellerDocumentAction}
            className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Название
                <input
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="title"
                  placeholder="Например, карточка компании"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Тип
                <select
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-semibold"
                  name="type"
                  defaultValue="seller_company_card"
                >
                  {sellerDocumentTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <FileUploadField
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              name="file"
              required
            />

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                name="comment"
                placeholder="Комментарий к файлу"
              />
              <SubmitButton
                className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                pendingText="Сохраняем"
              >
                <Upload size={17} />
                Сохранить
              </SubmitButton>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-950">
              Доступные документы
            </h2>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
              {documents.length}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {documents.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                Документы продавца пока не загружены.
              </div>
            ) : (
              documents.map((document) => (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={document.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="text-[#1157ff]" size={18} />
                        <h3 className="font-black text-slate-950">
                          {document.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {getDocumentTypeLabel(document.type)} ·{" "}
                        {formatFileSize(document.sizeBytes)} ·{" "}
                        {formatDateTime(document.uploadedAt)}
                      </p>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                      href={`/documents/${document.versionId}/download`}
                    >
                      <Download size={16} />
                      Скачать
                    </Link>
                  </div>
                  <form
                    action={uploadSellerDocumentVersionAction}
                    className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)_auto]"
                  >
                    <input name="documentId" type="hidden" value={document.id} />
                    <FileUploadField
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      buttonText="Заменить файл"
                      name="file"
                      required
                    />
                    <input
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
                      name="comment"
                      placeholder="Комментарий к файлу"
                    />
                    <SubmitButton
                      className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                      pendingText="Сохраняем"
                    >
                      Сохранить файл
                    </SubmitButton>
                  </form>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
