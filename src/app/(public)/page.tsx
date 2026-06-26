import {
  Building2,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/product-card";
import { CategoryCardImage } from "@/components/public/category-card-image";
import { HomeBannerCarousel } from "@/components/public/home-banner-carousel";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveCategories, getCatalogProducts } from "@/lib/catalog/queries";
import { getActiveHomeBanners } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Сити Маркет — B2B-маркетплейс для юридических лиц и ИП",
  description:
    "Каталог товаров для бизнеса, корзина, счета на оплату и документы для закупок юридических лиц и ИП.",
};

const advantages = [
  {
    title: "Закупки для бизнеса",
    description: "Регистрация компании, реквизиты и оформление заказов от юрлица.",
    icon: Building2,
  },
  {
    title: "Документы в кабинете",
    description: "Счета, договоры, УПД и статусы документов доступны по заказам.",
    icon: FileText,
  },
  {
    title: "Контроль заказов",
    description: "История статусов, повтор заказа и связь с оператором в одном месте.",
    icon: ClipboardCheck,
  },
  {
    title: "Проверенные поставщики",
    description: "Категории, продавцы и условия поставки ведутся через админку.",
    icon: ShieldCheck,
  },
];

export default async function Home() {
  const [latestProductsResult, categories, banners, currentUser] = await Promise.all([
    getCatalogProducts({ sort: "new", limit: 4 }),
    getActiveCategories(),
    getActiveHomeBanners(),
    getCurrentUser(),
  ]);
  const latestProducts = latestProductsResult.items;

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-slate-900">
      <section className="scroll-reveal mx-auto max-w-[1920px] px-5 pb-0 pt-5 md:py-5">
        <HomeBannerCarousel
          banners={banners}
          isAuthenticated={Boolean(currentUser)}
        />
      </section>

      <section>
        <div className="mx-auto grid max-w-[1480px] gap-4 px-5 pb-6 pt-4 md:grid-cols-2 md:py-6 xl:grid-cols-4">
          {advantages.map((advantage) => {
            const Icon = advantage.icon;

            return (
              <div
                className="scroll-reveal rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
                key={advantage.title}
              >
                <Icon className="text-[#1157ff]" size={28} />
                <h2 className="mt-4 text-lg font-black text-slate-950">
                  {advantage.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {advantage.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="scroll-reveal mx-auto max-w-[1480px] px-5 pb-6 pt-4 md:pb-8 md:pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">Категории</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
            {categories.map((category) => (
              <Link
                className="group flex h-[180px] min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#1157ff]/25"
                href={`/catalog/${category.slug}`}
                key={category.id}
              >
                <div className="relative flex min-h-24 flex-1 items-center justify-center bg-[#f0f3f9]">
                  <CategoryCardImage
                    alt={category.name}
                    src={category.imageUrl}
                  />
                </div>
                <div className="flex h-[64px] items-center px-4">
                  <h2 className="line-clamp-2 text-base font-black leading-5 text-slate-950 group-hover:text-[#1157ff]">
                    {category.name}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="scroll-reveal mx-auto max-w-[1480px] px-5 pb-12 pt-4 md:pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Новые товары</h2>
          <Link className="text-sm font-bold text-[#1157ff]" href="/catalog">
            Смотреть все
          </Link>
        </div>
        <div className="grid content-start gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-4">
          {latestProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}
