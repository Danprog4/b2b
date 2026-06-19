import { Download, FileText, Upload } from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import {
  getCompanyDocumentReadiness,
  requiredCompanyDocumentTypes,
} from "@/lib/account/company-documents";
import { requireUser } from "@/lib/auth/session";
import {
  uploadBuyerCompanyDocumentAction,
  uploadBuyerCompanyDocumentVersionAction,
} from "@/lib/documents/actions";
import { getCurrentBuyerCompanyDocuments } from "@/lib/documents/queries";
import {
  buyerCompanyDocumentTypes,
  formatFileSize,
  getDocumentTargetLabel,
  getDocumentTypeLabel,
} from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";

type AccountDocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountDocumentsPage({
  searchParams,
}: AccountDocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const documentUploaded = params.documentUploaded === "1";
  const documentError =
    !documentUploaded && typeof params.documentError === "string"
      ? params.documentError
      : null;
  const user = await requireUser(["buyer"]);
  const [documents, documentReadiness] = await Promise.all([
    getCurrentBuyerCompanyDocuments(),
    user.buyerCompanyId
      ? getCompanyDocumentReadiness(user.buyerCompanyId)
      : Promise.resolve({
          uploadedTypes: [],
          missingTypes: requiredCompanyDocumentTypes.slice(),
          isReady: false,
        }),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/account">
            Личный кабинет
          </Link>
          <span>/</span>
          <span>Документы</span>
        </div>

        <Link href="/account" className="text-sm font-bold text-[#1157ff]">
          ← В личный кабинет
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <FileText className="text-[#1157ff]" size={28} />
          <h1 className="text-3xl font-black text-slate-950">
            Документы компании
          </h1>
        </div>

        <ToastMessages
          items={[
            ...(documentUploaded ? [{ message: "Документ загружен." }] : []),
            ...(documentError
              ? [{ message: documentError, tone: "error" as const }]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-black text-slate-950">
            Готовность к оформлению заказа
          </h2>
          {documentReadiness.isReady ? (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Обязательные документы компании загружены.
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-black">
                Чтобы убрать предупреждение в компании и checkout, загрузите:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-semibold">
                {documentReadiness.missingTypes.map((document) => (
                  <li key={document.type}>{document.label}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-black text-slate-950">
            Загрузить документ
          </h2>
          <form
            action={uploadBuyerCompanyDocumentAction}
            className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
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
                  defaultValue="company_card"
                >
                  {buyerCompanyDocumentTypes.map(([value, label]) => (
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
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
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
          <h2 className="text-xl font-black text-slate-950">
            Доступные документы
          </h2>
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
                    </div>
                    <Link
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                      href={`/documents/${document.versionId}/download`}
                    >
                      <Download size={16} />
                      Скачать
                    </Link>
                  </div>

                  {document.target === "buyer_company" ? (
                    <form
                      action={uploadBuyerCompanyDocumentVersionAction}
                      className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]"
                    >
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
                        className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
                        pendingText="Сохраняем"
                      >
                        Заменить файл
                      </SubmitButton>
                    </form>
                  ) : document.target === "contract" ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                      <span>
                        Договор управляется в отдельном разделе личного кабинета.
                      </span>
                      <Link className="text-[#1157ff]" href="/account/contract">
                        Открыть договор
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                      Этот документ относится к заказу. Его можно скачать, а
                      замену выполняет администратор.
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
