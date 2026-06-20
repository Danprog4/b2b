"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";

import type { CatalogSort } from "@/lib/catalog/queries";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
};

type CatalogControlsProps = {
  categories: Category[];
  subcategories: Subcategory[];
  mobileSubcategories?: Subcategory[];
  q: string;
  categorySlug?: string;
  subcategorySlug?: string;
  minPriceValue: string;
  maxPriceValue: string;
  sort: CatalogSort;
  hasActiveTopFilters: boolean;
  hasActiveCategoryFilters: boolean;
  resetCategoryFiltersHref: string;
};

function getPathCategory(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "catalog") {
    return {};
  }

  return {
    category: parts[1],
    subcategory: parts[2],
  };
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

function CategoryLinks({
  categories,
  subcategories,
  q,
  categorySlug,
  subcategorySlug,
  minPriceValue,
  maxPriceValue,
  sort,
  onNavigate,
}: Pick<
  CatalogControlsProps,
  | "categories"
  | "subcategories"
  | "q"
  | "categorySlug"
  | "subcategorySlug"
  | "minPriceValue"
  | "maxPriceValue"
  | "sort"
> & {
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="mt-4 grid gap-1">
        <Link
          className={`rounded-lg px-3 py-2 text-sm font-bold ${
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
          onClick={onNavigate}
        >
          Все товары
        </Link>
        {categories.map((category) => (
          <Link
            className={`block rounded-lg px-3 py-2 text-sm font-bold ${
              category.slug === categorySlug
                ? "bg-[#eaf1ff] text-[#1157ff]"
                : "text-slate-700 hover:bg-slate-50"
            }`}
            href={catalogHref({
              category: category.slug,
              q,
              sort,
              minPrice: minPriceValue,
              maxPrice: maxPriceValue,
            })}
            key={category.id}
            onClick={onNavigate}
          >
            <span className="block truncate">{category.name}</span>
          </Link>
        ))}
      </nav>

      {subcategories.length > 0 ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Подкатегории
          </h2>
          <nav className="mt-4 grid gap-1">
            {subcategories.map((subcategory) => (
              <Link
                className={`block rounded-lg px-3 py-2 text-sm font-bold ${
                  subcategory.slug === subcategorySlug
                    ? "bg-[#eaf1ff] text-[#1157ff]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                href={catalogHref({
                  category: subcategory.categorySlug,
                  subcategory: subcategory.slug,
                  q,
                  sort,
                  minPrice: minPriceValue,
                  maxPrice: maxPriceValue,
                })}
                key={subcategory.id}
                onClick={onNavigate}
              >
                {!categorySlug ? (
                  <span className="block truncate text-xs font-semibold text-slate-400">
                    {subcategory.categoryName}
                  </span>
                ) : null}
                <span className="block truncate">{subcategory.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

function MobileCategoryPicker({
  categories,
  subcategories,
  draftCategorySlug,
  draftSubcategorySlug,
  onSelectAll,
  onSelectCategory,
  onSelectSubcategory,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  draftCategorySlug?: string;
  draftSubcategorySlug?: string;
  onSelectAll: () => void;
  onSelectCategory: (categorySlug: string) => void;
  onSelectSubcategory: (subcategory: Subcategory) => void;
}) {
  return (
    <>
      <nav className="mt-4 grid gap-1">
        <button
          className={`rounded-lg px-3 py-2 text-left text-sm font-bold ${
            !draftCategorySlug && !draftSubcategorySlug
              ? "bg-[#eaf1ff] text-[#1157ff]"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          type="button"
          onClick={onSelectAll}
        >
          Все товары
        </button>
        {categories.map((category) => (
          <button
            className={`block rounded-lg px-3 py-2 text-left text-sm font-bold ${
              category.slug === draftCategorySlug && !draftSubcategorySlug
                ? "bg-[#eaf1ff] text-[#1157ff]"
                : "text-slate-700 hover:bg-slate-50"
            }`}
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.slug)}
          >
            <span className="block truncate">{category.name}</span>
          </button>
        ))}
      </nav>

      {subcategories.length > 0 ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Подкатегории
          </h2>
          <nav className="mt-4 grid gap-1">
            {subcategories.map((subcategory) => (
              <button
                className={`block rounded-lg px-3 py-2 text-left text-sm font-bold ${
                  subcategory.slug === draftSubcategorySlug &&
                  subcategory.categorySlug === draftCategorySlug
                    ? "bg-[#eaf1ff] text-[#1157ff]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                key={subcategory.id}
                type="button"
                onClick={() => onSelectSubcategory(subcategory)}
              >
                {!draftCategorySlug ? (
                  <span className="block truncate text-xs font-semibold text-slate-400">
                    {subcategory.categoryName}
                  </span>
                ) : null}
                <span className="block truncate">{subcategory.name}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

export function CatalogCategoryAside(props: CatalogControlsProps) {
  return (
    <aside className="hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:block lg:self-start">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
        Категории
      </h2>
      <CategoryLinks {...props} />
      {props.hasActiveCategoryFilters ? (
        <Link
          className="mt-6 inline-flex w-full justify-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
          href={props.resetCategoryFiltersHref}
        >
          Сбросить категории
        </Link>
      ) : null}
    </aside>
  );
}

export function CatalogControls({
  categories,
  subcategories,
  mobileSubcategories = subcategories,
  q,
  categorySlug,
  subcategorySlug,
  minPriceValue,
  maxPriceValue,
  sort,
  hasActiveTopFilters,
  hasActiveCategoryFilters,
}: CatalogControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const minPriceInputRef = useRef<HTMLInputElement>(null);
  const maxPriceInputRef = useRef<HTMLInputElement>(null);
  const isFullResettingRef = useRef(false);
  const [searchValue, setSearchValue] = useState(q);
  const [minPriceInputValue, setMinPriceInputValue] = useState(minPriceValue);
  const [maxPriceInputValue, setMaxPriceInputValue] = useState(maxPriceValue);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draftCategorySlug, setDraftCategorySlug] = useState<string | undefined>(
    categorySlug,
  );
  const [draftSubcategorySlug, setDraftSubcategorySlug] = useState<
    string | undefined
  >(subcategorySlug);
  const pathCategory = useMemo(() => getPathCategory(pathname), [pathname]);
  const currentCategorySlug = categorySlug ?? pathCategory.category;
  const currentSubcategorySlug = subcategorySlug ?? pathCategory.subcategory;
  const visibleMobileSubcategories = useMemo(
    () =>
      draftCategorySlug
        ? mobileSubcategories.filter(
            (subcategory) => subcategory.categorySlug === draftCategorySlug,
          )
        : mobileSubcategories,
    [draftCategorySlug, mobileSubcategories],
  );
  const hasDraftCategoryChanges =
    (draftCategorySlug ?? "") !== (currentCategorySlug ?? "") ||
    (draftSubcategorySlug ?? "") !== (currentSubcategorySlug ?? "");
  const hasAnyActiveFilters =
    hasActiveTopFilters ||
    hasActiveCategoryFilters ||
    Boolean(
      searchValue.trim() ||
        minPriceInputValue.trim() ||
        maxPriceInputValue.trim(),
    );

  const navigateFromForm = useCallback(
    (
      next?: Partial<Record<string, string>>,
      mode: "push" | "replace" = "push",
    ) => {
      const form = formRef.current;
      if (!form) {
        return;
      }

      const formData = new FormData(form);
      const values = {
        category: categorySlug ?? pathCategory.category,
        subcategory: subcategorySlug ?? pathCategory.subcategory,
        q: String(formData.get("q") ?? "").trim(),
        minPrice: String(formData.get("minPrice") ?? "").trim(),
        maxPrice: String(formData.get("maxPrice") ?? "").trim(),
        sort: String(formData.get("sort") ?? "new"),
        ...next,
      };
      const href = catalogHref({
        category: values.category,
        subcategory: values.subcategory,
        q: values.q || undefined,
        minPrice: values.minPrice || undefined,
        maxPrice: values.maxPrice || undefined,
        sort: values.sort === "new" ? undefined : values.sort,
      });

      if (mode === "replace") {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [
      categorySlug,
      pathCategory.category,
      pathCategory.subcategory,
      router,
      subcategorySlug,
    ],
  );

  const draftCategoryHref = useMemo(
    () =>
      catalogHref({
        category: draftCategorySlug,
        subcategory: draftSubcategorySlug,
        q: searchValue.trim() || undefined,
        minPrice: minPriceInputValue.trim() || undefined,
        maxPrice: maxPriceInputValue.trim() || undefined,
        sort: sort === "new" ? undefined : sort,
      }),
    [
      draftCategorySlug,
      draftSubcategorySlug,
      maxPriceInputValue,
      minPriceInputValue,
      searchValue,
      sort,
    ],
  );

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsSheetOpen(nextOpen);

      if (nextOpen) {
        setDraftCategorySlug(currentCategorySlug);
        setDraftSubcategorySlug(currentSubcategorySlug);
      }
    },
    [currentCategorySlug, currentSubcategorySlug],
  );

  const saveDraftCategoryFilters = useCallback(() => {
    if (!hasDraftCategoryChanges) {
      return;
    }

    setIsSheetOpen(false);
    window.setTimeout(() => {
      router.push(draftCategoryHref);
    }, 300);
  }, [draftCategoryHref, hasDraftCategoryChanges, router]);

  const didMountRef = useRef(false);

  useEffect(() => {
    if (isFullResettingRef.current) {
      return;
    }

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const nextSearchValue = searchValue.trim();
    if (nextSearchValue === q.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigateFromForm({ q: nextSearchValue }, "replace");
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [navigateFromForm, q, searchValue]);

  useEffect(() => {
    if (isFullResettingRef.current) {
      return;
    }

    const nextMinPriceValue = minPriceInputValue.trim();
    const nextMaxPriceValue = maxPriceInputValue.trim();

    if (
      nextMinPriceValue === minPriceValue.trim() &&
      nextMaxPriceValue === maxPriceValue.trim()
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigateFromForm(
        {
          minPrice: nextMinPriceValue,
          maxPrice: nextMaxPriceValue,
        },
        "replace",
      );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    maxPriceInputValue,
    maxPriceValue,
    minPriceInputValue,
    minPriceValue,
    navigateFromForm,
  ]);

  useEffect(() => {
    if (
      !q &&
      !minPriceValue &&
      !maxPriceValue &&
      !categorySlug &&
      !subcategorySlug &&
      sort === "new"
    ) {
      isFullResettingRef.current = false;
    }
  }, [categorySlug, maxPriceValue, minPriceValue, q, sort, subcategorySlug]);

  useEffect(() => {
    if (document.activeElement === searchInputRef.current) {
      return;
    }

    setSearchValue(q);
  }, [q]);

  useEffect(() => {
    if (document.activeElement === minPriceInputRef.current) {
      return;
    }

    setMinPriceInputValue(minPriceValue);
  }, [minPriceValue]);

  useEffect(() => {
    if (document.activeElement === maxPriceInputRef.current) {
      return;
    }

    setMaxPriceInputValue(maxPriceValue);
  }, [maxPriceValue]);

  return (
    <>
      <form
        className="mt-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:grid-cols-[1fr_180px_180px_220px_auto]"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          navigateFromForm();
        }}
      >
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            className="h-12 w-full rounded-lg border border-slate-200 pl-11 pr-11"
            name="q"
            placeholder="Искать товары"
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                navigateFromForm({ q: event.currentTarget.value });
              }
            }}
          />
          {searchValue ? (
            <button
              aria-label="Сбросить поиск"
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              type="button"
              onClick={() => {
                setSearchValue("");
                navigateFromForm({ q: undefined });
              }}
            >
              <X size={16} />
            </button>
          ) : null}
        </label>
        <input
          className="h-12 rounded-lg border border-slate-200 px-4"
          inputMode="decimal"
          min="0"
          name="minPrice"
          placeholder="Цена от"
          ref={minPriceInputRef}
          type="number"
          value={minPriceInputValue}
          onChange={(event) => setMinPriceInputValue(event.currentTarget.value)}
        />
        <input
          className="h-12 rounded-lg border border-slate-200 px-4"
          inputMode="decimal"
          min="0"
          name="maxPrice"
          placeholder="Цена до"
          ref={maxPriceInputRef}
          type="number"
          value={maxPriceInputValue}
          onChange={(event) => setMaxPriceInputValue(event.currentTarget.value)}
        />
        <select
          className="h-12 rounded-lg border border-slate-200 px-4"
          defaultValue={sort}
          key={sort}
          name="sort"
          onChange={(event) => {
            const nextSort = event.currentTarget.value as CatalogSort;
            navigateFromForm({ sort: nextSort });
          }}
        >
          <option value="new">По новизне</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
        </select>
        <button
          className="inline-flex h-12 items-center justify-center rounded-lg bg-slate-100 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-slate-100"
          disabled={!hasAnyActiveFilters}
          type="button"
          onClick={() => {
            isFullResettingRef.current = true;
            setSearchValue("");
            setMinPriceInputValue("");
            setMaxPriceInputValue("");
            router.push("/catalog");
            window.setTimeout(() => {
              isFullResettingRef.current = false;
            }, 300);
          }}
        >
          Сбросить все
        </button>
      </form>

      <Drawer.Root
        direction="bottom"
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
      >
        <Drawer.Trigger asChild>
          <button
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-100 lg:hidden"
            type="button"
          >
            <SlidersHorizontal size={18} />
            Категории и подкатегории
          </button>
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[60] max-h-[82vh] rounded-t-2xl bg-white shadow-2xl outline-none lg:hidden">
            <div className="flex max-h-[82vh] flex-col">
              <div className="p-5 pb-3">
                <Drawer.Handle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-center justify-between gap-3">
                  <Drawer.Title className="text-lg font-black text-slate-950">
                    Категории
                  </Drawer.Title>
                  <Drawer.Description className="sr-only">
                    Выберите категорию или подкатегорию каталога.
                  </Drawer.Description>
                  <Drawer.Close asChild>
                    <button
                      aria-label="Закрыть"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </Drawer.Close>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                <MobileCategoryPicker
                  categories={categories}
                  draftCategorySlug={draftCategorySlug}
                  draftSubcategorySlug={draftSubcategorySlug}
                  subcategories={visibleMobileSubcategories}
                  onSelectAll={() => {
                    setDraftCategorySlug(undefined);
                    setDraftSubcategorySlug(undefined);
                  }}
                  onSelectCategory={(nextCategorySlug) => {
                    setDraftCategorySlug(nextCategorySlug);
                    setDraftSubcategorySlug(undefined);
                  }}
                  onSelectSubcategory={(subcategory) => {
                    setDraftCategorySlug(subcategory.categorySlug);
                    setDraftSubcategorySlug(subcategory.slug);
                  }}
                />
                {hasActiveCategoryFilters ? (
                  <button
                    className="mt-6 inline-flex w-full justify-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
                    type="button"
                    onClick={() => {
                      setDraftCategorySlug(undefined);
                      setDraftSubcategorySlug(undefined);
                    }}
                  >
                    Сбросить категории
                  </button>
                ) : null}
              </div>
              <div className="border-t border-slate-100 bg-white p-5">
                <button
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#1157ff] px-5 text-sm font-black text-white transition hover:bg-[#0b49e0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  disabled={!hasDraftCategoryChanges}
                  type="button"
                  onClick={saveDraftCategoryFilters}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
