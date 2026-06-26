import type { Metadata } from "next";
import Link from "next/link";

import {
  CatalogCategoryAside,
  CatalogControls,
} from "@/components/catalog/catalog-controls";
import { ProductCard } from "@/components/catalog/product-card";
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

function normalizePage(value?: string) {
  if (!value) {
    return 1;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
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

function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const items: Array<number | "..."> = [];
  let previousPage = 0;

  for (const nextPage of Array.from(pages).sort((a, b) => a - b)) {
    if (nextPage < 1 || nextPage > totalPages) {
      continue;
    }

    if (previousPage && nextPage - previousPage > 1) {
      items.push("...");
    }

    items.push(nextPage);
    previousPage = nextPage;
  }

  return items;
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
  const requestedPage = normalizePage(getParam(params, "page"));

  const [categories, subcategories, mobileSubcategories, catalogResult] =
    await Promise.all([
      getActiveCategories(),
      getActiveSubcategories(categorySlug),
      getActiveSubcategories(),
      getCatalogProducts({
        q,
        categorySlug,
        subcategorySlug,
        minPrice,
        maxPrice,
        sort,
        page: requestedPage,
        pageSize: 24,
      }),
    ]);
  const products = catalogResult.items;
  const totalCount = catalogResult.totalCount;
  const currentPage = catalogResult.page;
  const totalPages = catalogResult.totalPages;

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
  const resetCategoryFiltersHref = catalogHref({
    q,
    sort: sort === "new" ? undefined : sort,
    minPrice: minPriceValue,
    maxPrice: maxPriceValue,
  });
  const paginationHref = (pageNumber: number) =>
    catalogHref({
      category: categorySlug,
      subcategory: subcategorySlug,
      q,
      sort: sort === "new" ? undefined : sort,
      minPrice: minPriceValue,
      maxPrice: maxPriceValue,
      page: pageNumber > 1 ? String(pageNumber) : undefined,
    });

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
            Найдено: {totalCount}
          </span>
        </div>

        <CatalogControls
          categories={categories}
          categorySlug={categorySlug}
          hasActiveCategoryFilters={hasActiveCategoryFilters}
          hasActiveTopFilters={hasActiveTopFilters}
          maxPriceValue={maxPriceValue}
          mobileSubcategories={mobileSubcategories}
          minPriceValue={minPriceValue}
          q={q}
          resetCategoryFiltersHref={resetCategoryFiltersHref}
          sort={sort}
          subcategories={subcategories}
          subcategorySlug={subcategorySlug}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          <CatalogCategoryAside
            categories={categories}
            categorySlug={categorySlug}
            hasActiveCategoryFilters={hasActiveCategoryFilters}
            hasActiveTopFilters={hasActiveTopFilters}
            maxPriceValue={maxPriceValue}
            minPriceValue={minPriceValue}
            q={q}
            resetCategoryFiltersHref={resetCategoryFiltersHref}
            sort={sort}
            subcategories={mobileSubcategories}
            subcategorySlug={subcategorySlug}
          />

          {products.length > 0 ? (
            <div className="self-start">
              <section className="grid content-start gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </section>

              {totalPages > 1 ? (
                <nav
                  aria-label="Страницы каталога"
                  className="mt-6 flex flex-wrap items-center justify-center gap-2"
                >
                  <Link
                    aria-disabled={currentPage === 1}
                    className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-black ${
                      currentPage === 1
                        ? "pointer-events-none bg-slate-200 text-slate-400"
                        : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50"
                    }`}
                    href={paginationHref(Math.max(1, currentPage - 1))}
                  >
                    Назад
                  </Link>
                  {getPaginationItems(currentPage, totalPages).map((item, index) =>
                    item === "..." ? (
                      <span
                        className="inline-flex h-10 min-w-10 items-center justify-center text-sm font-black text-slate-400"
                        key={`ellipsis-${index}`}
                      >
                        ...
                      </span>
                    ) : (
                      <Link
                        aria-current={item === currentPage ? "page" : undefined}
                        className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-black ${
                          item === currentPage
                            ? "bg-[#1157ff] text-white"
                            : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50"
                        }`}
                        href={paginationHref(item)}
                        key={item}
                      >
                        {item}
                      </Link>
                    ),
                  )}
                  <Link
                    aria-disabled={currentPage === totalPages}
                    className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-black ${
                      currentPage === totalPages
                        ? "pointer-events-none bg-slate-200 text-slate-400"
                        : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50"
                    }`}
                    href={paginationHref(Math.min(totalPages, currentPage + 1))}
                  >
                    Вперёд
                  </Link>
                </nav>
              ) : null}
            </div>
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
