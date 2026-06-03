import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { cartItems, carts, categories, files, products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";

export const CART_SESSION_COOKIE = "city_market_cart";

export type CartLine = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  slug: string;
  categoryName: string;
  mainImageUrl: string | null;
  priceWithVat: string;
  priceSnapshot: string;
  vatRate: string | null;
  vatAmount: number;
  quantity: string;
  unit: string;
  isActive: boolean;
  lineTotal: number;
  priceChanged: boolean;
};

export type CartView = {
  cartId: string | null;
  lines: CartLine[];
  total: number;
  vatTotal: number;
  count: number;
};

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateVatAmount(amountWithVat: number, vatRate: number) {
  if (vatRate <= 0) {
    return 0;
  }

  return toMoney(amountWithVat * (vatRate / (100 + vatRate)));
}

export async function getCurrentCart(): Promise<CartView> {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (user && user.role !== "buyer") {
    return {
      cartId: null,
      lines: [],
      total: 0,
      vatTotal: 0,
      count: 0,
    };
  }

  let cart:
    | {
        id: string;
      }
    | undefined;

  if (user?.role === "buyer") {
    [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, user.id))
      .limit(1);
  }

  if (!cart && sessionId) {
    [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.sessionId, sessionId))
      .limit(1);
  }

  if (!cart) {
    return {
      cartId: null,
      lines: [],
      total: 0,
      vatTotal: 0,
      count: 0,
    };
  }

  const rows = await db
    .select({
      id: cartItems.id,
      productId: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      categoryName: categories.name,
      mainImageFileId: files.id,
      mainImageStorageKey: files.storageKey,
      mainImageIsActive: files.isActive,
      priceWithVat: products.priceWithVat,
      priceSnapshot: cartItems.priceSnapshot,
      vatRate: products.vatRate,
      quantity: cartItems.quantity,
      unit: products.unit,
      isActive: products.isActive,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(files, eq(files.id, products.mainImageFileId))
    .where(eq(cartItems.cartId, cart.id));

  const lines = rows.map((row) => {
    const quantity = Number(row.quantity);
    const price = Number(row.priceWithVat);
    const snapshot = Number(row.priceSnapshot);
    const lineTotal = toMoney(quantity * price);
    const vatRate = Number(row.vatRate ?? 22);

    return {
      ...row,
      mainImageUrl: row.mainImageIsActive
        ? getPublicFileUrl({
            id: row.mainImageFileId,
            storageKey: row.mainImageStorageKey,
          })
        : null,
      lineTotal,
      vatAmount: calculateVatAmount(lineTotal, vatRate),
      priceChanged: price !== snapshot,
    };
  });

  return {
    cartId: cart.id,
    lines,
    total: toMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    vatTotal: toMoney(lines.reduce((sum, line) => sum + line.vatAmount, 0)),
    count: lines.reduce((sum, line) => sum + Number(line.quantity), 0),
  };
}

export async function findCartItem(cartId: string, productId: string) {
  const [item] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .limit(1);

  return item ?? null;
}
