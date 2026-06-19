import { Download, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/ui/submit-button";
import { ToastMessages } from "@/components/ui/toast-message";
import { sendAdminChatMessageAction } from "@/lib/chat/actions";
import {
  getAdminChat,
  markAdminChatNotificationsRead,
} from "@/lib/chat/queries";
import { formatFileSize } from "@/lib/documents/types";
import { formatDateTime } from "@/lib/utils";

type AdminChatPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  empty: "Введите текст ответа.",
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
    return senderName ?? "Покупатель";
  }

  if (senderType === "admin" || senderType === "operator") {
    return senderName ?? "Оператор";
  }

  return senderType;
}

export default async function AdminChatPage({
  params,
  searchParams,
}: AdminChatPageProps) {
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const sent = getParam(search, "sent") === "1";
  const error = getParam(search, "error");
  const chat = await getAdminChat(id);

  if (!chat) {
    notFound();
  }

  await markAdminChatNotificationsRead(chat.companyId);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin">
            Админ-панель
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/admin/chats">
            Чаты
          </Link>
          <span>/</span>
          <span>{chat.companyName}</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin/chats">
          ← К списку чатов
        </Link>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black text-slate-950">
                <MessageSquare className="text-[#1157ff]" size={30} />
                {chat.companyName}
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                ИНН {chat.companyInn} · {chat.userName ?? "Контакт"} ·{" "}
                {chat.userEmail}
                {chat.userPhone ? ` · ${chat.userPhone}` : ""}
              </p>
            </div>
            <Link
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:text-[#1157ff]"
              href={`/admin/companies/${chat.companyId}`}
            >
              Компания
            </Link>
          </div>

          <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-800">
            Основной операторский канал работает через Telegram-топик этого чата.
            Ответ из админки также отображается покупателю в ЛК и зеркалится в
            Telegram.
          </p>
        </section>

        <ToastMessages
          items={[
            ...(sent ? [{ message: "Ответ отправлен покупателю." }] : []),
            ...(error
              ? [
                  {
                    message:
                      errorMessages[error] ?? "Не удалось отправить ответ.",
                    tone: "error" as const,
                  },
                ]
              : []),
          ]}
        />

        <section className="mt-5 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="max-h-[620px] overflow-y-auto p-5">
            {chat.messages.length === 0 ? (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm font-bold text-slate-500">
                Сообщений пока нет.
              </div>
            ) : (
              <div className="grid gap-3">
                {chat.messages.map((message) => {
                  const isOperator =
                    message.senderType === "admin" ||
                    message.senderType === "operator";

                  return (
                    <article
                      className={`max-w-[760px] rounded-xl px-4 py-3 ${
                        isOperator
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
                            isOperator
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
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <form
            action={sendAdminChatMessageAction}
            className="grid gap-4 border-t border-slate-100 p-5"
          >
            <input name="chatId" type="hidden" value={chat.id} />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Ответ
              <textarea
                className="min-h-28 rounded-lg border border-slate-200 px-3 py-3 font-semibold outline-none transition focus:border-[#1157ff]"
                name="text"
                placeholder="Напишите ответ покупателю"
              />
            </label>
            <SubmitButton
              className="h-11 w-fit rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
              pendingText="Отправляем"
            >
              <Send size={17} />
              Отправить
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
