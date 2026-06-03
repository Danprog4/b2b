import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { categories, contentPages, products, subcategories } from "@/db/schema";

export type BannerLinkSuggestion = {
  href: string;
  label: string;
  group: string;
  description?: string;
};

const staticSuggestions: BannerLinkSuggestion[] = [
  {
    href: "/catalog",
    label: "Каталог",
    group: "Основные",
    description: "Все категории и товары",
  },
  {
    href: "/register",
    label: "Регистрация",
    group: "Основные",
    description: "Регистрация ООО или ИП",
  },
  {
    href: "/login",
    label: "Вход",
    group: "Основные",
    description: "Авторизация клиента",
  },
];

export async function getBannerLinkSuggestions(): Promise<BannerLinkSuggestion[]> {
  const [categoryRows, subcategoryRows, productRows, pageRows] = await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .limit(16),
    db
      .select({
        name: subcategories.name,
        slug: subcategories.slug,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(and(eq(subcategories.isActive, true), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name))
      .limit(20),
    db
      .select({
        name: products.name,
        slug: products.slug,
        sku: products.sku,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.isPopular), desc(products.createdAt))
      .limit(20),
    db
      .select({
        title: contentPages.title,
        slug: contentPages.slug,
      })
      .from(contentPages)
      .where(eq(contentPages.isPublished, true))
      .orderBy(asc(contentPages.title))
      .limit(16),
  ]);

  return [
    ...staticSuggestions,
    ...categoryRows.map((category) => ({
      href: `/catalog/${category.slug}`,
      label: category.name,
      group: "Категории",
      description: "Раздел каталога",
    })),
    ...subcategoryRows.map((subcategory) => ({
      href: `/catalog/${subcategory.categorySlug}/${subcategory.slug}`,
      label: subcategory.name,
      group: "Подкатегории",
      description: subcategory.categoryName,
    })),
    ...productRows.map((product) => ({
      href: `/product/${product.slug}`,
      label: product.name,
      group: "Товары",
      description: product.sku,
    })),
    ...pageRows.map((page) => ({
      href: `/info/${page.slug}`,
      label: page.title,
      group: "Инфо-страницы",
      description: "Публичная страница",
    })),
  ];
}
