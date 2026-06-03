import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CatalogPage from "../../page";
import {
  getActiveCategories,
  getActiveSubcategories,
} from "@/lib/catalog/queries";

type SubcategoryCatalogPageProps = {
  params: Promise<{ categorySlug: string; subcategorySlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: SubcategoryCatalogPageProps): Promise<Metadata> {
  const { categorySlug, subcategorySlug } = await params;
  const subcategories = await getActiveSubcategories(categorySlug);
  const subcategory = subcategories.find((item) => item.slug === subcategorySlug);

  if (!subcategory) {
    return {
      title: "Подкатегория не найдена | Сити Маркет",
    };
  }

  return {
    title: `${subcategory.name} | ${subcategory.categoryName} | Сити Маркет`,
    description: `Товары подкатегории ${subcategory.name} в категории ${subcategory.categoryName} для юридических лиц и ИП.`,
  };
}

export default async function SubcategoryCatalogPage({
  params,
  searchParams,
}: SubcategoryCatalogPageProps) {
  const { categorySlug, subcategorySlug } = await params;
  const [categories, subcategories] = await Promise.all([
    getActiveCategories(),
    getActiveSubcategories(categorySlug),
  ]);

  if (
    !categories.some((category) => category.slug === categorySlug) ||
    !subcategories.some((subcategory) => subcategory.slug === subcategorySlug)
  ) {
    notFound();
  }

  const search = (await searchParams) ?? {};

  return CatalogPage({
    searchParams: Promise.resolve({
      ...search,
      category: categorySlug,
      subcategory: subcategorySlug,
    }),
  });
}
