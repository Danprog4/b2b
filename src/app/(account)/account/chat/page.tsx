import { Download, MessageSquare, Paperclip, Send } from "lucide-react";
import Link from "next/link";

import { FileUploadField } from "@/components/ui/file-upload-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { sendBuyerChatMessageAction } from "@/lib/chat/actions";
import { getCurrentBuyerChatMessages } from "@/lib/chat/queries";
import { formatFileSize } from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";
import { BuyerChatReadMarker } from "./chat-read-marker";

type ChatPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  empty: "Введите сообщение или прикрепите файл.",
  size: "Вложение должно быть не больше 50 МБ.",
  type: "Поддерживаются PDF, DOC, DOCX, JPG, PNG, XLS и XLSX.",
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function getSenderLabel(senderType: string, senderName: string | null) {
  if (senderType === "buyer") {
    return "Вы";
  }

  if (senderType === "admin" || senderType === "operator") {
    return senderName ?? "Оператор";
  }

  return senderType;
}

function getDeliveryStatusLabel(status: string) {
  if (status === "sent") {
    return "Отправлено";
  }

  if (status === "failed") {
    return "Ошибка доставки";
  }

  return "В обработке";
}

export default async function AccountChatPage({ searchParams }: ChatPageProps) {
  const params = (await searchParams) ?? {};
  const sent = getParam(params, "sent") === "1";
  const error = getParam(params, "error");
  const chat = await getCurrentBuyerChatMessages();

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <BuyerChatReadMarker />
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
          <span>Чат</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-bold text-[#1157ff]" href="/account">
              ← Личный кабинет
            </Link>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-950">
              <MessageSquare className="text-[#1157ff]" size={30} />
              Чат с оператором
            </h1>
            <p className="mt-2 text-slate-600">
              Сообщения сохраняются в системе. Вложения ограничены 50 МБ.
            </p>
          </div>
        </div>

        <ToastMessages
          items={[
            ...(sent ? [{ message: "Сообщение отправлено оператору." }] : []),
            ...(error
              ? [
                  {
                    message:
                      errorMessages[error] ?? "Не удалось отправить сообщение.",
                    tone: "error" as const,
                  },
                ]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="max-h-[620px] overflow-y-auto p-5">
            {chat.messages.length === 0 ? (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                Сообщений пока нет.
              </div>
            ) : (
              <div className="grid gap-3">
                {chat.messages.map((message) => {
                  const isBuyer = message.senderType === "buyer";

                  return (
                    <article
                      className={`max-w-[760px] rounded-xl px-4 py-3 ${
                        isBuyer
                          ? "ml-auto bg-[#1157ff] text-white"
                          : "mr-auto bg-slate-100 text-slate-800"
                      }`}
                      key={message.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold opacity-80">
                        <span>
                          {getSenderLabel(message.senderType, message.senderName)}
                        </span>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      {message.text ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {message.text}
                        </p>
                      ) : null}
                      {message.attachmentFileId ? (
                        <Link
                          className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                            isBuyer
                              ? "bg-white/15 text-white"
                              : "bg-white text-[#1157ff]"
                          }`}
                          href={`/account/chat/files/${message.attachmentFileId}`}
                        >
                          <Download size={16} />
                          {message.attachmentName ?? "Вложение"}
                          {message.attachmentSize
                            ? ` · ${formatFileSize(message.attachmentSize)}`
                            : ""}
                        </Link>
                      ) : null}
                      <p className="mt-2 text-xs font-semibold opacity-70">
                        {getDeliveryStatusLabel(message.deliveryStatus)}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <form
            action={sendBuyerChatMessageAction}
            className="grid gap-4 border-t border-slate-100 p-5"
          >
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Сообщение
              <textarea
                className="min-h-28 rounded-lg border border-slate-200 px-3 py-3 font-semibold outline-none transition focus:border-[#1157ff]"
                name="text"
                placeholder="Напишите сообщение оператору"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <FileUploadField
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                buttonText="Прикрепить файл"
                name="attachment"
              />
              <div className="flex items-end">
                <SubmitButton
                  className="h-11 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
                  pendingText="Отправляем"
                >
                  <Send size={17} />
                  Отправить
                </SubmitButton>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Paperclip size={14} />
              PDF, DOC, DOCX, JPG, PNG, XLS, XLSX до 50 МБ.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
