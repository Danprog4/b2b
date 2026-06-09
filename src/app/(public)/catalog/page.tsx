import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/product-card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  type CatalogSort,
  getActiveCategories,
  getActiveSubcategories,
  getCatalogProducts,
} from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Каталог товаров | Сити Маркет",
  description:
    "Каталог B2B-маркетплейса Сити Маркет: товары для юридических лиц и ИП.",
};

type CatalogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeSort(value?: string): CatalogSort {
  if (value === "price_asc" || value === "price_desc" || value === "new") {
    return value;
  }

  return "new";
}

function normalizePrice(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function catalogHref(params: Record<string, string | undefined>) {
  const category = params.category;
  const subcategory = params.subcategory;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "category" && key !== "subcategory") {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  const path = category
    ? subcategory
      ? `/catalog/${category}/${subcategory}`
      : `/catalog/${category}`
    : "/catalog";

  return `${path}${query ? `?${query}` : ""}`;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = (await searchParams) ?? {};
  const q = getParam(params, "q") ?? "";
  const categorySlug = getParam(params, "category");
  const subcategorySlug = getParam(params, "subcategory");
  const minPriceValue = getParam(params, "minPrice") ?? "";
  const maxPriceValue = getParam(params, "maxPrice") ?? "";
  const minPrice = normalizePrice(minPriceValue);
  const maxPrice = normalizePrice(maxPriceValue);
  const sort = normalizeSort(getParam(params, "sort"));

  const [categories, subcategories, products] = await Promise.all([
    getActiveCategories(),
    getActiveSubcategories(categorySlug),
    getCatalogProducts({
      q,
      categorySlug,
      subcategorySlug,
      minPrice,
      maxPrice,
      sort,
    }),
  ]);

  const activeCategory = categories.find((category) => category.slug === categorySlug);
  const activeSubcategory = subcategories.find(
    (subcategory) => subcategory.slug === subcategorySlug,
  );
  const pageTitle =
    activeSubcategory?.name ?? activeCategory?.name ?? "Каталог товаров";
  const hasActiveTopFilters = Boolean(
    q || minPriceValue || maxPriceValue || sort !== "new",
  );
  const hasActiveCategoryFilters = Boolean(categorySlug || subcategorySlug);
  const resetTopFiltersHref = catalogHref({
    category: categorySlug,
    subcategory: subcategorySlug,
  });
  const resetCategoryFiltersHref = catalogHref({
    q,
    sort: sort === "new" ? undefined : sort,
    minPrice: minPriceValue,
    maxPrice: maxPriceValue,
  });
  const filterStateKey = [
    categorySlug ?? "",
    subcategorySlug ?? "",
    q,
    minPriceValue,
    maxPriceValue,
    sort,
  ].join(":");

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-5 py-6 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold text-[#1157ff]">
              ← Главная
            </Link>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              {pageTitle}
            </h1>
            <p className="mt-2 text-slate-600">
              Поиск работает по названию товара. Остатки в первой версии не
              отображаются.
            </p>
          </div>
          <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Найдено: {products.length}
          </span>
        </div>

        <form
          key={filterStateKey}
          className="mt-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:grid-cols-[1fr_180px_180px_220px_auto_auto]"
        >
          {categorySlug ? (
            <input name="category" type="hidden" value={categorySlug} />
          ) : null}
          {subcategorySlug ? (
            <input name="subcategory" type="hidden" value={subcategorySlug} />
          ) : null}
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              className="h-12 w-full rounded-lg border border-slate-200 pl-11 pr-4"
              name="q"
              placeholder="Искать товары"
              type="search"
              defaultValue={q}
            />
          </label>
          <input
            className="h-12 rounded-lg border border-slate-200 px-4"
            inputMode="decimal"
            min="0"
            name="minPrice"
            placeholder="Цена от"
            type="number"
            defaultValue={minPriceValue}
          />
          <input
            className="h-12 rounded-lg border border-slate-200 px-4"
            inputMode="decimal"
            min="0"
            name="maxPrice"
            placeholder="Цена до"
            type="number"
            defaultValue={maxPriceValue}
          />
          <select
            className="h-12 rounded-lg border border-slate-200 px-4"
            name="sort"
            defaultValue={sort}
          >
            <option value="new">По новизне</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
          </select>
          <SubmitButton
            className="h-12 rounded-lg bg-[#1157ff] px-6 font-bold text-white transition hover:bg-[#0b49e0]"
            pendingText="Применяем"
          >
            Применить
          </SubmitButton>
          {hasActiveTopFilters ? (
            <Link
              className="inline-flex h-12 items-center justify-center rounded-lg bg-slate-100 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              href={resetTopFiltersHref}
            >
              Сбросить
            </Link>
          ) : null}
        </form>

        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:self-start">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
              Категории
            </h2>
            <nav className="mt-4 grid gap-1">
              <Link
                className={`w-[calc(100%-20px)] rounded-lg px-3 py-2 text-sm font-bold ${
                  !categorySlug && !subcategorySlug
                    ? "bg-[#eaf1ff] text-[#1157ff]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                href={catalogHref({
                  q,
                  sort,
                  minPrice: minPriceValue,
                  maxPrice: maxPriceValue,
                })}
              >
                Все товары
              </Link>
              {categories.map((category) => {
                const href = catalogHref({
                  category: category.slug,
                  q,
                  sort,
                  minPrice: minPriceValue,
                  maxPrice: maxPriceValue,
                });

                return (
                  <Link
                    key={category.id}
                    className={`block w-[calc(100%-20px)] rounded-lg px-3 py-2 text-sm font-bold ${
                      category.slug === categorySlug
                        ? "bg-[#eaf1ff] text-[#1157ff]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    href={href}
                  >
                    <span className="block truncate">{category.name}</span>
                  </Link>
                );
              })}
            </nav>

            {subcategories.length > 0 ? (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  Подкатегории
                </h2>
                <nav className="mt-4 grid gap-1">
                  {subcategories.map((subcategory) => {
                    const href = catalogHref({
                      category: subcategory.categorySlug,
                      subcategory: subcategory.slug,
                      q,
                      sort,
                      minPrice: minPriceValue,
                      maxPrice: maxPriceValue,
                    });

                    return (
                      <Link
                        key={subcategory.id}
                        className={`block w-[calc(100%-20px)] rounded-lg px-3 py-2 text-sm font-bold ${
                          subcategory.slug === subcategorySlug
                            ? "bg-[#eaf1ff] text-[#1157ff]"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        href={href}
                      >
                        <span className="min-w-0">
                          {!categorySlug ? (
                            <span className="block truncate text-xs font-semibold text-slate-400">
                              {subcategory.categoryName}
                            </span>
                          ) : null}
                          <span className="block truncate">{subcategory.name}</span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ) : null}

            {hasActiveCategoryFilters ? (
              <Link
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
                href={resetCategoryFiltersHref}
              >
                Сбросить категории
              </Link>
            ) : null}
          </aside>

          {products.length > 0 ? (
            <section className="grid self-start content-start gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ) : (
            <section className="flex min-h-[420px] items-center justify-center rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Товары не найдены.
                </h2>
                <p className="mt-2 text-slate-600">
                  Попробуйте изменить запрос или перейти в каталог.
                </p>
                <Link
                  className="mt-6 inline-flex rounded-lg bg-[#1157ff] px-5 py-3 font-bold text-white"
                  href="/catalog"
                >
                  Сбросить фильтры
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
