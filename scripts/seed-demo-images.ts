import "dotenv/config";

import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  categories,
  files,
  productImages,
  products,
  subcategories,
} from "../src/db/schema";
import { writeStorageFile } from "../src/lib/files/storage";

type EntityType = "category" | "subcategory" | "product";

type ImageAsset = {
  type: EntityType;
  slug: string;
  title: string;
  url: string;
  storagePrefix: string;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/city_market";
const shouldReplaceExisting = process.env.REPLACE_SEED_IMAGES === "YES";

const imageParams = "auto=format&fit=crop&w=1200&h=900&q=82";

const assets: ImageAsset[] = [
  {
    type: "category",
    slug: "stroitelnie-materialy",
    title: "Строительные материалы",
    url: `https://images.unsplash.com/photo-1504307651254-35680f356dfd?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "metalloprokat",
    title: "Металлопрокат",
    url: `https://images.unsplash.com/photo-1697698532634-ea59b636ccea?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "zapchasti",
    title: "Запчасти",
    url: `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "oborudovanie",
    title: "Оборудование",
    url: `https://images.unsplash.com/photo-1496247749665-49cf5b1022e9?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "materialy-dlya-skladov",
    title: "Материалы для складов",
    url: `https://images.unsplash.com/photo-1644079446600-219068676743?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "produkty-pitaniya",
    title: "Продукты питания",
    url: `https://images.unsplash.com/photo-1614735241165-6756e1df61ab?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "bytovaya-himiya",
    title: "Бытовая химия",
    url: `https://images.unsplash.com/photo-1563453392212-326f5e854473?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "category",
    slug: "elektronika",
    title: "Электроника",
    url: `https://images.unsplash.com/photo-1518770660439-4636190af475?${imageParams}`,
    storagePrefix: "seed-assets/categories",
  },
  {
    type: "subcategory",
    slug: "suhie-smesi",
    title: "Сухие смеси",
    url: `https://images.unsplash.com/photo-1575493438282-4e0fb32d1bdd?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "listovoy-metall",
    title: "Листовой металл",
    url: `https://images.unsplash.com/photo-1501166222995-ff31c7e93cef?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "avtozapchasti",
    title: "Автозапчасти",
    url: `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "skladskaya-furnitura",
    title: "Складская фурнитура",
    url: `https://images.unsplash.com/photo-1665238456957-48788e0a3e16?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "nasosnoe-oborudovanie",
    title: "Насосное оборудование",
    url: `https://images.unsplash.com/photo-1513828583688-c52646db42da?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "optovaya-bakaleya",
    title: "Оптовая бакалея",
    url: `https://images.unsplash.com/photo-1614735241165-6756e1df61ab?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "professionalnaya-himiya",
    title: "Профессиональная химия",
    url: `https://images.unsplash.com/photo-1563453392212-326f5e854473?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "subcategory",
    slug: "kabel-i-komplektuyuschie",
    title: "Кабель и комплектующие",
    url: `https://images.unsplash.com/photo-1518770660439-4636190af475?${imageParams}`,
    storagePrefix: "seed-assets/subcategories",
  },
  {
    type: "product",
    slug: "cement-m500-meshok-50-kg",
    title: "Цемент М500, мешок 50 кг",
    url: `https://images.unsplash.com/photo-1575493438282-4e0fb32d1bdd?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "list-stalnoy-2-mm",
    title: "Лист стальной 2 мм",
    url: `https://images.unsplash.com/photo-1501166222995-ff31c7e93cef?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "rolikovaya-opora-dlya-sklada",
    title: "Роликовая опора для склада",
    url: `https://images.unsplash.com/photo-1665238456957-48788e0a3e16?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "nasos-cirkulyacionnyy-promyshlennyy",
    title: "Насос циркуляционный промышленный",
    url: `https://images.unsplash.com/photo-1513828583688-c52646db42da?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "filtr-maslyanyy-dlya-gruzovoy-tehniki",
    title: "Фильтр масляный для грузовой техники",
    url: `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "ris-dlinnozernyy-meshok-25-kg",
    title: "Рис длиннозерный, мешок 25 кг",
    url: `https://images.unsplash.com/photo-1614735241165-6756e1df61ab?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "sredstvo-moyuschee-professionalnoe-5-l",
    title: "Средство моющее профессиональное 5 л",
    url: `https://images.unsplash.com/photo-1563453392212-326f5e854473?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
  {
    type: "product",
    slug: "kabel-utp-cat-6-buhta-305-m",
    title: "Кабель UTP Cat.6, бухта 305 м",
    url: `https://images.unsplash.com/photo-1518770660439-4636190af475?${imageParams}`,
    storagePrefix: "seed-assets/products",
  },
];

const client = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(client);

function getStorageKey(asset: ImageAsset) {
  return `${asset.storagePrefix}/${asset.slug}.jpg`;
}

function getOriginalName(asset: ImageAsset) {
  return `${asset.slug}.jpg`;
}

async function downloadImage(asset: ImageAsset) {
  const response = await fetch(asset.url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${asset.title}: HTTP ${response.status}`,
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0];
  if (!mimeType?.startsWith("image/")) {
    throw new Error(`Unexpected content type for ${asset.title}: ${mimeType}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType,
  };
}

async function getOrCreateFile(asset: ImageAsset) {
  const storageKey = getStorageKey(asset);
  const [existingFile] = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.storageKey, storageKey))
    .limit(1);

  if (existingFile) {
    return existingFile.id;
  }

  const { bytes, mimeType } = await downloadImage(asset);
  const { sizeBytes } = await writeStorageFile(storageKey, bytes, {
    contentType: mimeType,
  });
  const [storedFile] = await db
    .insert(files)
    .values({
      originalName: getOriginalName(asset),
      storageKey,
      mimeType,
      sizeBytes,
      access: "public",
    })
    .returning({ id: files.id });

  return storedFile.id;
}

async function applyCategoryImage(asset: ImageAsset) {
  const [category] = await db
    .select({ id: categories.id, imageFileId: categories.imageFileId })
    .from(categories)
    .where(eq(categories.slug, asset.slug))
    .limit(1);

  if (!category) {
    return "missing";
  }

  if (category.imageFileId && !shouldReplaceExisting) {
    return "skipped";
  }

  const fileId = await getOrCreateFile(asset);
  await db
    .update(categories)
    .set({ imageFileId: fileId, updatedAt: new Date() })
    .where(eq(categories.id, category.id));

  return "updated";
}

async function applySubcategoryImage(asset: ImageAsset) {
  const [subcategory] = await db
    .select({
      id: subcategories.id,
      imageFileId: subcategories.imageFileId,
    })
    .from(subcategories)
    .where(eq(subcategories.slug, asset.slug))
    .limit(1);

  if (!subcategory) {
    return "missing";
  }

  if (subcategory.imageFileId && !shouldReplaceExisting) {
    return "skipped";
  }

  const fileId = await getOrCreateFile(asset);
  await db
    .update(subcategories)
    .set({ imageFileId: fileId, updatedAt: new Date() })
    .where(eq(subcategories.id, subcategory.id));

  return "updated";
}

async function applyProductImage(asset: ImageAsset) {
  const [product] = await db
    .select({ id: products.id, mainImageFileId: products.mainImageFileId })
    .from(products)
    .where(eq(products.slug, asset.slug))
    .limit(1);

  if (!product) {
    return "missing";
  }

  if (product.mainImageFileId && !shouldReplaceExisting) {
    return "skipped";
  }

  const fileId = await getOrCreateFile(asset);
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ mainImageFileId: fileId, updatedAt: new Date() })
      .where(eq(products.id, product.id));

    const [firstProductImage] = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, product.id),
          eq(productImages.sortOrder, 0),
        ),
      )
      .orderBy(asc(productImages.createdAt))
      .limit(1);

    if (!firstProductImage) {
      await tx.insert(productImages).values({
        productId: product.id,
        fileId,
        sortOrder: 0,
      });
      return;
    }

    if (shouldReplaceExisting) {
      await tx
        .update(productImages)
        .set({ fileId, updatedAt: new Date() })
        .where(eq(productImages.id, firstProductImage.id));
    }
  });

  return "updated";
}

async function applyImage(asset: ImageAsset) {
  if (asset.type === "category") {
    return applyCategoryImage(asset);
  }

  if (asset.type === "subcategory") {
    return applySubcategoryImage(asset);
  }

  return applyProductImage(asset);
}

async function main() {
  const counters = {
    updated: 0,
    skipped: 0,
    missing: 0,
  };

  for (const asset of assets) {
    const status = await applyImage(asset);
    counters[status] += 1;
    console.log(`${status}: ${asset.type} ${asset.slug}`);
  }

  console.log(
    `Seed images complete. Updated: ${counters.updated}, skipped: ${counters.skipped}, missing: ${counters.missing}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
