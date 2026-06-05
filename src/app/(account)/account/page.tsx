import {
  Bell,
  FileText,
  MessageSquare,
  Repeat2,
  type LucideIcon,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { and, count, eq } from "drizzle-orm";

import { LogoutButton } from "@/components/logout-button";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getBuyerPendingChatCount } from "@/lib/chat/queries";

type AccountSection = [string, string, string, LucideIcon];

const accountSections: AccountSection[] = [
  ["Профиль", "Персональные данные и пароль", "/account/profile", UserRound],
  ["Компания", "Реквизиты, ИНН, юридический адрес", "/account/company", FileText],
  ["Документы", "Документы компании и загруженные файлы", "/account/documents", FileText],
  ["Заказы", "История, счета, документы, повтор заказа", "/account/orders", Repeat2],
  ["Чат", "Переписка с оператором", "/account/chat", MessageSquare],
  [
    "Уведомления",
    "Статусы заказов и новые документы",
    "/account/notifications",
    Bell,
  ],
];

export default async function AccountPage() {
  const user = await requireUser(["buyer"]);
  const [notificationCounter, pendingChatCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .then(([row]) => row),
    getBuyerPendingChatCount(),
  ]);
  const unreadNotifications = notificationCounter?.count ?? 0;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <span>Личный кабинет</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold text-[#1157ff]">
              ← На главную
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Личный кабинет покупателя
            </h1>
            <p className="mt-2 text-slate-600">
              Вы вошли как {user.email}. Каркас разделов для заказов,
              документов, компании и чата.
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accountSections.map(([title, description, href, Icon]) => (
            <Link
              key={title}
              className="relative rounded-xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              href={href}
            >
              {title === "Уведомления" && unreadNotifications > 0 ? (
                <span className="absolute right-4 top-4 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
              {title === "Чат" && pendingChatCount > 0 ? (
                <span className="absolute right-4 top-4 min-w-5 rounded-full bg-[#1157ff] px-1.5 text-center text-[11px] font-black leading-5 text-white">
                  +{pendingChatCount > 99 ? "99" : pendingChatCount}
                </span>
              ) : null}
              <Icon className="mb-4 text-[#1157ff]" size={28} />
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
