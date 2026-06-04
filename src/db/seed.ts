import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  buyerCompanies,
  categories,
  contentPages,
  products,
  sellerOffers,
  sellers,
  subcategories,
  users,
} from "./schema";
import { hashPassword } from "../lib/auth/password";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/city_market";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const categorySeed = [
  ["Строительные материалы", "stroitelnie-materialy"],
  ["Металлопрокат", "metalloprokat"],
  ["Запчасти", "zapchasti"],
  ["Оборудование", "oborudovanie"],
  ["Материалы для складов", "materialy-dlya-skladov"],
  ["Продукты питания", "produkty-pitaniya"],
  ["Бытовая химия", "bytovaya-himiya"],
  ["Электроника", "elektronika"],
] as const;

const subcategorySeed = [
  ["Сухие смеси", "suhie-smesi", "stroitelnie-materialy"],
  ["Листовой металл", "listovoy-metall", "metalloprokat"],
  ["Складская фурнитура", "skladskaya-furnitura", "materialy-dlya-skladov"],
  ["Насосное оборудование", "nasosnoe-oborudovanie", "oborudovanie"],
] as const;

const sellerSeed = [
  {
    name: "ООО Поставщик Строй",
    inn: "7701000001",
    kpp: "770101001",
    ogrn: "1027700000001",
    legalAddress: "г. Москва, ул. Строителей, д. 1",
    contactName: "Иван Петров",
    email: "seller-build@example.com",
    phone: "+7 900 100-00-01",
  },
  {
    name: "ООО Склад Трейд",
    inn: "7701000002",
    kpp: "770101002",
    ogrn: "1027700000002",
    legalAddress: "г. Москва, ул. Складская, д. 2",
    contactName: "Мария Смирнова",
    email: "seller-warehouse@example.com",
    phone: "+7 900 100-00-02",
  },
] as const;

const pageSeed = [
  ["Частые вопросы", "faq"],
  ["Юридическая информация", "legal"],
  ["Как стать партнером", "partners"],
  ["Условия для продавцов", "seller-terms"],
  ["О нас", "about"],
  ["Контакты", "contacts"],
  ["Вакансии", "vacancies"],
] as const;

async function main() {
  console.log("Seeding City Market development data...");

  for (const [name, slug] of categorySeed) {
    await db
      .insert(categories)
      .values({
        name,
        slug,
        description: `${name} для B2B-закупок`,
        sortOrder: categorySeed.findIndex((item) => item[1] === slug),
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name,
          description: `${name} для B2B-закупок`,
        },
      });
  }

  for (const seller of sellerSeed) {
    await db
      .insert(sellers)
      .values(seller)
      .onConflictDoUpdate({
        target: sellers.inn,
        set: {
          name: seller.name,
          legalAddress: seller.legalAddress,
          contactName: seller.contactName,
          email: seller.email,
          phone: seller.phone,
        },
      });
  }

  await db
    .insert(buyerCompanies)
    .values({
      type: "ooo",
      name: "ООО Покупатель Демо",
      inn: "7702000001",
      kpp: "770201001",
      ogrn: "1027702000001",
      legalAddress: "г. Москва, ул. Закупочная, д. 10",
      contactEmail: "buyer@example.com",
      contactPhone: "+7 900 200-00-01",
      bankDetails: {
        bankName: "Демо Банк",
        bik: "044525000",
        checkingAccount: "40702810000000000001",
        correspondentAccount: "30101810000000000000",
      },
    })
    .onConflictDoUpdate({
      target: buyerCompanies.inn,
      set: {
        name: "ООО Покупатель Демо",
        contactEmail: "buyer@example.com",
        contactPhone: "+7 900 200-00-01",
      },
    });

  const allCategories = await db.select().from(categories);
  const allSellers = await db.select().from(sellers);
  const [demoBuyerCompany] = await db
    .select()
    .from(buyerCompanies)
    .where(eq(buyerCompanies.inn, "7702000001"))
    .limit(1);

  const categoryBySlug = new Map(allCategories.map((category) => [category.slug, category]));
  const sellerByInn = new Map(allSellers.map((seller) => [seller.inn, seller]));

  for (const [name, slug, categorySlug] of subcategorySeed) {
    const category = categoryBySlug.get(categorySlug);

    if (!category) {
      throw new Error(`Missing seed category for subcategory ${slug}`);
    }

    await db
      .insert(subcategories)
      .values({
        categoryId: category.id,
        name,
        slug,
        description: `${name} для B2B-закупок`,
        sortOrder: subcategorySeed.findIndex((item) => item[1] === slug),
      })
      .onConflictDoUpdate({
        target: subcategories.slug,
        set: {
          categoryId: category.id,
          name,
          description: `${name} для B2B-закупок`,
        },
      });
  }

  const allSubcategories = await db.select().from(subcategories);
  const subcategoryBySlug = new Map(
    allSubcategories.map((subcategory) => [subcategory.slug, subcategory]),
  );

  const productSeed = [
    {
      sku: "CM-000001",
      name: "Цемент М500, мешок 50 кг",
      slug: "cement-m500-meshok-50-kg",
      categorySlug: "stroitelnie-materialy",
      subcategorySlug: "suhie-smesi",
      sellerInn: "7701000001",
      priceWithVat: "430.00",
      unit: "мешок",
      size: "50 кг",
      description: "Демо-товар для стартового каталога.",
    },
    {
      sku: "CM-000002",
      name: "Лист стальной 2 мм",
      slug: "list-stalnoy-2-mm",
      categorySlug: "metalloprokat",
      subcategorySlug: "listovoy-metall",
      sellerInn: "7701000001",
      priceWithVat: "2450.00",
      unit: "шт",
      size: "2 мм",
      description: "Демо-позиция металлопроката.",
    },
    {
      sku: "CM-000003",
      name: "Роликовая опора для склада",
      slug: "rolikovaya-opora-dlya-sklada",
      categorySlug: "materialy-dlya-skladov",
      subcategorySlug: "skladskaya-furnitura",
      sellerInn: "7701000002",
      priceWithVat: "1680.00",
      unit: "шт",
      size: "стандарт",
      description: "Демо-товар для складского оснащения.",
    },
    {
      sku: "CM-000004",
      name: "Насос циркуляционный промышленный",
      slug: "nasos-cirkulyacionnyy-promyshlennyy",
      categorySlug: "oborudovanie",
      subcategorySlug: "nasosnoe-oborudovanie",
      sellerInn: "7701000002",
      priceWithVat: "12400.00",
      unit: "шт",
      size: "180 мм",
      description: "Демо-оборудование для каталога.",
    },
  ];

  for (const product of productSeed) {
    const category = categoryBySlug.get(product.categorySlug);
    const subcategory = subcategoryBySlug.get(product.subcategorySlug);
    const seller = sellerByInn.get(product.sellerInn);

    if (!category || !subcategory || !seller) {
      throw new Error(`Missing seed relation for product ${product.sku}`);
    }

    const [storedProduct] = await db
      .insert(products)
      .values({
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        sellerId: seller.id,
        description: product.description,
        priceWithVat: product.priceWithVat,
        vatRate: "22.00",
        size: product.size,
        unit: product.unit,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: product.name,
          slug: product.slug,
          categoryId: category.id,
          subcategoryId: subcategory.id,
          sellerId: seller.id,
          priceWithVat: product.priceWithVat,
          description: product.description,
          size: product.size,
          unit: product.unit,
        },
      })
      .returning({ id: products.id });

    await db
      .insert(sellerOffers)
      .values({
        productId: storedProduct.id,
        sellerId: seller.id,
        priceWithVat: product.priceWithVat,
        vatRate: "22.00",
        status: "published",
      })
      .onConflictDoUpdate({
        target: [sellerOffers.productId, sellerOffers.sellerId],
        set: {
          priceWithVat: product.priceWithVat,
          vatRate: "22.00",
          status: "published",
          updatedAt: new Date(),
        },
      });
  }

  for (const [title, slug] of pageSeed) {
    await db
      .insert(contentPages)
      .values({
        title,
        slug,
        content: `${title}: текст будет предоставлен заказчиком.`,
        metaTitle: `${title} | Сити Маркет`,
        metaDescription: `${title} B2B-маркетплейса Сити Маркет`,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: contentPages.slug,
        set: {
          title,
          content: `${title}: текст будет предоставлен заказчиком.`,
          isPublished: true,
        },
      });
  }

  await db
    .insert(users)
    .values({
      name: "Администратор",
      email: "admin@city-market.local",
      phone: "+7 900 000-00-00",
      passwordHash: hashPassword("password123"),
      role: "admin",
      status: "active",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: "Администратор",
        passwordHash: hashPassword("password123"),
        role: "admin",
        status: "active",
      },
    });

  if (demoBuyerCompany) {
    await db
      .insert(users)
      .values({
        name: "Покупатель Демо",
        email: "buyer@city-market.local",
        phone: "+7 900 200-00-01",
        passwordHash: hashPassword("password123"),
        role: "buyer",
        status: "active",
        buyerCompanyId: demoBuyerCompany.id,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: "Покупатель Демо",
          phone: "+7 900 200-00-01",
          passwordHash: hashPassword("password123"),
          role: "buyer",
          status: "active",
          buyerCompanyId: demoBuyerCompany.id,
        },
      });
  }

  const demoSeller = sellerByInn.get("7701000001");

  if (demoSeller) {
    await db
      .insert(users)
      .values({
        name: demoSeller.contactName ?? demoSeller.name,
        email: "seller@city-market.local",
        phone: demoSeller.phone,
        passwordHash: hashPassword("password123"),
        role: "seller",
        status: "active",
        sellerId: demoSeller.id,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: demoSeller.contactName ?? demoSeller.name,
          phone: demoSeller.phone,
          passwordHash: hashPassword("password123"),
          role: "seller",
          status: "active",
          sellerId: demoSeller.id,
        },
      });
  }

  const [categoryCount] = await db
    .select({ count: categories.id })
    .from(categories)
    .limit(1);

  console.log("Seed complete.");
  console.log(`Categories are ready. First category id: ${categoryCount?.count ?? "n/a"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
