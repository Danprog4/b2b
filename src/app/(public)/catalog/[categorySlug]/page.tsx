import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CatalogPage from "../page";
import { getActiveCategories } from "@/lib/catalog/queries";

type CategoryCatalogPageProps = {
  params: Promise<{ categorySlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CategoryCatalogPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const categories = await getActiveCategories();
  const category = categories.find((item) => item.slug === categorySlug);

  if (!category) {
    return {
      title: "Категория не найдена | Сити Маркет",
    };
  }

  return {
    title: `${category.name} | Сити Маркет`,
    description:
      category.description ||
      `Товары категории ${category.name} для юридических лиц и ИП.`,
  };
}

export default async function CategoryCatalogPage({
  params,
  searchParams,
}: CategoryCatalogPageProps) {
  const { categorySlug } = await params;
  const categories = await getActiveCategories();

  if (!categories.some((category) => category.slug === categorySlug)) {
    notFound();
  }

  const search = (await searchParams) ?? {};

  return CatalogPage({
    searchParams: Promise.resolve({
      ...search,
      category: categorySlug,
    }),
  });
}
