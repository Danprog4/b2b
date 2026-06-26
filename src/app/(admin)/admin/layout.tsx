import {
  AlertTriangle,
  Bell,
  BookOpen,
  Boxes,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FolderTree,
  ImageIcon,
  LayoutDashboard,
  MailWarning,
  MessageSquare,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/session";

type AdminNavItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
};

type AdminNavGroup = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  items: AdminNavItem[];
};

const navGroups: AdminNavGroup[] = [
  {
    label: "Юзеры",
    icon: UsersRound,
    items: [
      { label: "Все юзеры", href: "/admin/users", icon: UserRound },
      { label: "Покупатели", href: "/admin/users?role=buyer", icon: UsersRound },
      { label: "Продавцы", href: "/admin/sellers", icon: Store },
      {
        label: "Заявки на присоединение",
        href: "/admin/company-join-requests",
        icon: UserRound,
      },
      { label: "Компании", href: "/admin/companies", icon: Store },
    ],
  },
  {
    label: "Продажи",
    icon: ReceiptText,
    items: [
      { label: "Заказы", href: "/admin/orders", icon: ReceiptText },
      {
        label: "Экспорт заказов",
        href: "/admin/orders/export",
        icon: FileSpreadsheet,
      },
      { label: "Комиссии", href: "/admin/commissions", icon: ScrollText },
    ],
  },
  {
    label: "Каталог",
    icon: Boxes,
    items: [
      { label: "Товары", href: "/admin/products", icon: Package },
      {
        label: "Модерация товаров",
        href: "/admin/products/moderation",
        icon: AlertTriangle,
      },
      {
        label: "Импорт товаров",
        href: "/admin/products/import",
        icon: FileSpreadsheet,
      },
      { label: "Категории", href: "/admin/categories", icon: FolderTree },
    ],
  },
  {
    label: "Контент",
    icon: BookOpen,
    items: [
      { label: "Баннеры", href: "/admin/banners", icon: ImageIcon },
      { label: "Страницы", href: "/admin/pages", icon: FileText },
      { label: "Документы", href: "/admin/documents", icon: FileText },
    ],
  },
  {
    label: "Коммуникации",
    icon: MessageSquare,
    items: [
      { label: "Чаты", href: "/admin/chats", icon: MessageSquare },
      { label: "Уведомления", href: "/admin/notifications", icon: Bell },
      { label: "Email-очередь", href: "/admin/email-outbox", icon: MailWarning },
    ],
  },
  {
    label: "Система",
    icon: Settings,
    items: [
      {
        label: "Ошибки системы",
        href: "/admin/system-events?severity=error",
        icon: AlertTriangle,
      },
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText },
    ],
  },
];

function SidebarLink({ item }: { item: AdminNavItem }) {
  const Icon = item.icon ?? ChevronRight;

  return (
    <Link
      className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1157ff]"
      href={item.href}
    >
      <Icon className="shrink-0" size={17} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarGroup({ group }: { group: AdminNavGroup }) {
  const Icon = group.icon;

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="shrink-0 text-slate-400 transition group-open:rotate-90"
          size={17}
        />
        <Icon className="shrink-0" size={18} />
        <span className="truncate">{group.label}</span>
      </summary>
      <div className="mt-1 space-y-1 pl-7">
        {group.items.map((item) => (
          <SidebarLink item={item} key={item.href} />
        ))}
      </div>
    </details>
  );
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireUser(["admin"]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-4 py-5">
            <Link
              className="flex items-center gap-3 text-lg font-black text-slate-950"
              href="/admin"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#1157ff] text-white">
                <LayoutDashboard size={20} />
              </span>
              Админ-панель
            </Link>
            <p className="mt-3 truncate text-xs font-semibold text-slate-500">
              {user.email}
            </p>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-5">
            <SidebarLink
              item={{
                label: "Дашборд",
                href: "/admin",
                icon: LayoutDashboard,
              }}
            />
            {navGroups.map((group) => (
              <SidebarGroup group={group} key={group.label} />
            ))}
          </nav>

          <div className="border-t border-slate-100 p-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
