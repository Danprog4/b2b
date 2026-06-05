import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { getAdminChatList } from "@/lib/chat/queries";
import { formatDateTime } from "@/lib/utils";

function getSenderLabel(senderType: string) {
  if (senderType === "buyer") {
    return "Покупатель";
  }

  if (senderType === "admin" || senderType === "operator") {
    return "Оператор";
  }

  return senderType;
}

export default async function AdminChatsPage() {
  const chats = await getAdminChatList();

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
          <span>Чаты</span>
        </div>

        <Link className="text-sm font-bold text-[#1157ff]" href="/admin">
          ← В админ-панель
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black text-slate-950">
              <MessageSquare className="text-[#1157ff]" size={30} />
              Чаты
            </h1>
            <p className="mt-2 text-slate-600">
              Сообщения покупателей, ответы операторов из Telegram и резервные
              ответы из админки.
            </p>
          </div>
          <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
            Всего: {chats.length}
          </span>
        </div>

        {chats.length === 0 ? (
          <section className="mt-8 flex min-h-[360px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div>
              <MessageSquare className="mx-auto text-slate-300" size={56} />
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Чатов пока нет
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Раздел появится в работе после первого сообщения покупателя.
              </p>
            </div>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="divide-y divide-slate-100">
              {chats.map((chat) => (
                <Link
                  className="grid gap-4 p-5 transition hover:bg-blue-50/40 lg:grid-cols-[1fr_260px_auto]"
                  href={`/admin/chats/${chat.id}`}
                  key={chat.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-black text-slate-950">
                        {chat.companyName}
                      </h2>
                      {chat.incomingCount > 0 ? (
                        <span className="rounded-full bg-[#1157ff] px-2 py-1 text-xs font-black text-white">
                          {chat.incomingCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      ИНН {chat.companyInn} · {chat.userName ?? "Контакт"} ·{" "}
                      {chat.userEmail}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {chat.lastMessage?.text ??
                        (chat.lastMessage?.attachmentFileId
                          ? `Вложение: ${chat.lastMessage.attachmentName ?? "файл"}`
                          : "Сообщений пока нет")}
                    </p>
                  </div>
                  <div className="text-sm text-slate-500">
                    <p className="font-bold text-slate-700">
                      {chat.lastMessage
                        ? getSenderLabel(chat.lastMessage.senderType)
                        : "Нет сообщений"}
                    </p>
                    <p className="mt-1">
                      {chat.lastMessage
                        ? formatDateTime(chat.lastMessage.createdAt)
                        : formatDateTime(chat.createdAt)}
                    </p>
                  </div>
                  <span className="self-start rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                    {chat.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
