import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { cartItems, carts } from "@/db/schema";
import { CART_SESSION_COOKIE } from "@/lib/cart/queries";

function sumQuantities(left: string, right: string) {
  const total = Number(left) + Number(right);

  return String(Math.min(total, 9999));
}

export async function mergeGuestCartIntoUserCart(userId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return;
  }

  const [guestCart] = await db
    .select()
    .from(carts)
    .where(eq(carts.sessionId, sessionId))
    .limit(1);

  if (!guestCart) {
    cookieStore.delete(CART_SESSION_COOKIE);
    return;
  }

  const [userCart] = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  if (!userCart) {
    await db
      .update(carts)
      .set({
        userId,
        sessionId: null,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, guestCart.id));

    cookieStore.delete(CART_SESSION_COOKIE);
    return;
  }

  if (userCart.id === guestCart.id) {
    cookieStore.delete(CART_SESSION_COOKIE);
    return;
  }

  const guestItems = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, guestCart.id));

  await db.transaction(async (tx) => {
    for (const guestItem of guestItems) {
      const [existingItem] = await tx
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, userCart.id),
            eq(cartItems.productId, guestItem.productId),
          ),
        )
        .limit(1);

      if (existingItem) {
        await tx
          .update(cartItems)
          .set({
            quantity: sumQuantities(existingItem.quantity, guestItem.quantity),
            updatedAt: new Date(),
          })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        await tx.insert(cartItems).values({
          cartId: userCart.id,
          productId: guestItem.productId,
          quantity: guestItem.quantity,
          priceSnapshot: guestItem.priceSnapshot,
        });
      }
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, guestCart.id));
    await tx.delete(carts).where(eq(carts.id, guestCart.id));
  });

  cookieStore.delete(CART_SESSION_COOKIE);
}
