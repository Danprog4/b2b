import {
  Building2,
  ImageIcon,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/product-card";
import { HomeBannerCarousel } from "@/components/public/home-banner-carousel";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveCategories, getCatalogProducts } from "@/lib/catalog/queries";
import { getActiveHomeBanners } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, popularProducts, banners, currentUser] = await Promise.all([
    getActiveCategories(),
    getCatalogProducts({ sort: "popular", limit: 4 }),
    getActiveHomeBanners(),
    getCurrentUser(),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-slate-900">
      <section className="mx-auto max-w-[1480px] px-5 py-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <HomeBannerCarousel
            banners={banners}
            isAuthenticated={Boolean(currentUser)}
          />

          <aside className="grid gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Building2 className="mb-4 text-[#1157ff]" size={30} />
              <h2 className="text-xl font-bold">Для ООО и ИП</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Регистрация по ИНН, реквизиты, счета и документы в кабинете.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Truck className="mb-4 text-[#1157ff]" size={30} />
              <h2 className="text-xl font-bold">Поставка с менеджером</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Доставка и условия отгрузки согласуются с оператором.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 pb-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/catalog/${category.slug}`}
              className="group flex min-h-32 flex-col justify-between overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:ring-[#1157ff]"
            >
              <span className="flex h-20 items-center justify-center overflow-hidden bg-slate-100 text-slate-300">
                {category.imageUrl ? (
                  <img
                    alt={category.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    src={category.imageUrl}
                  />
                ) : (
                  <ImageIcon size={26} />
                )}
              </span>
              <span className="px-4 py-3 text-sm font-bold leading-5 text-slate-900">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 pb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Популярные товары</h2>
          <Link className="text-sm font-bold text-[#1157ff]" href="/catalog">
            Смотреть все
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {popularProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}
