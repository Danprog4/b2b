import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

const footerGroups = [
  {
    title: "Информация",
    links: [
      { label: "Юридическая информация", href: "/info/legal" },
      { label: "Как стать партнером", href: "/info/partners" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О нас", href: "/info/about" },
      { label: "Контакты", href: "/info/contacts" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 text-slate-700">
      <div className="mx-auto grid max-w-[1480px] gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link className="text-2xl font-black text-[#1157ff]" href="/">
            {APP_NAME}
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
            B2B-площадка для закупок юридических лиц: каталог, счета, документы
            и обработка заказов в личном кабинете.
          </p>
        </div>

        {footerGroups.map((group) => (
          <nav className="grid content-start gap-3" key={group.title}>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
              {group.title}
            </h2>
            {group.links.map((link) => (
              <Link
                className="text-sm font-bold text-slate-700 hover:text-[#1157ff]"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
}
