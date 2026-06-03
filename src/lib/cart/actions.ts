"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { CART_SESSION_COOKIE, findCartItem } from "@/lib/cart/queries";

async function getOrCreateCart() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (user && user.role !== "buyer") {
    return null;
  }

  if (user?.role === "buyer") {
    const [existingCart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, user.id))
      .limit(1);

    if (existingCart) {
      return existingCart;
    }

    const [cart] = await db.insert(carts).values({ userId: user.id }).returning();
    return cart;
  }

  const sessionId = existingSessionId ?? randomUUID();

  if (!existingSessionId) {
    cookieStore.set(CART_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const [existingCart] = await db
    .select()
    .from(carts)
    .where(eq(carts.sessionId, sessionId))
    .limit(1);

  if (existingCart) {
    return existingCart;
  }

  const [cart] = await db.insert(carts).values({ sessionId }).returning();
  return cart;
}

async function addProductToCurrentCart(productId: string, quantity: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);

  if (!product) {
    return {
      ok: false,
      error: "product_unavailable",
    };
  }

  const cart = await getOrCreateCart();
  if (!cart) {
    return {
      ok: false,
      error: "cart_forbidden",
    };
  }

  const existingItem = await findCartItem(cart.id, product.id);
  let cartItemId = existingItem?.id;
  let nextQuantity = quantity;

  if (existingItem) {
    nextQuantity = Number(existingItem.quantity) + quantity;

    await db
      .update(cartItems)
      .set({
        quantity: String(nextQuantity),
        priceSnapshot: product.priceWithVat,
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    const [item] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        productId: product.id,
        quantity: String(quantity),
        priceSnapshot: product.priceWithVat,
      })
      .returning({ id: cartItems.id });

    cartItemId = item.id;
  }

  return {
    ok: true,
    itemId: cartItemId,
    productId: product.id,
    productName: product.name,
    quantity: nextQuantity,
  };
}

async function getCurrentWritableCart() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (user && user.role !== "buyer") {
    return null;
  }

  if (user?.role === "buyer") {
    const [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, user.id))
      .limit(1);

    return cart ?? null;
  }

  if (!sessionId) {
    return null;
  }

  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.sessionId, sessionId))
    .limit(1);

  return cart ?? null;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeQuantity(value: string) {
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.min(parsed, 9999);
}

export async function addToCartAction(formData: FormData) {
  const productId = getString(formData, "productId");
  const quantity = sanitizeQuantity(getString(formData, "quantity") || "1");
  const result = await addProductToCurrentCart(productId, quantity);

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/cart");

  return result;
}

export async function addProductToBuyerCart(productId: string, quantity: number) {
  return addProductToCurrentCart(productId, Math.max(1, Math.min(quantity, 9999)));
}

export async function updateCartItemAction(formData: FormData) {
  const itemId = getString(formData, "itemId");
  const quantity = sanitizeQuantity(getString(formData, "quantity"));
  const cart = await getCurrentWritableCart();

  if (!cart) {
    return;
  }

  await db
    .update(cartItems)
    .set({
      quantity: String(quantity),
      updatedAt: new Date(),
    })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));

  revalidatePath("/cart");
}

export async function removeCartItemAction(formData: FormData) {
  const itemId = getString(formData, "itemId");
  const cart = await getCurrentWritableCart();

  if (!cart) {
    return;
  }

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));

  revalidatePath("/cart");
}
