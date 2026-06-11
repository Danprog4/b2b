import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { products, sellerOffers } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DatabaseExecutor = Transaction | typeof db;

type PublishedOffer = {
  id: string;
  priceWithVat: string;
  publishedAt: Date | null;
  createdAt: Date;
};

function getOfferPublishedTime(offer: PublishedOffer) {
  return (offer.publishedAt ?? offer.createdAt).getTime();
}

function isBetterPriorityOffer(candidate: PublishedOffer, current: PublishedOffer) {
  const priceDelta = Number(candidate.priceWithVat) - Number(current.priceWithVat);

  if (priceDelta !== 0) {
    return priceDelta < 0;
  }

  return getOfferPublishedTime(candidate) < getOfferPublishedTime(current);
}

function selectAutomaticPriorityOffer(offers: PublishedOffer[]) {
  return offers.reduce<PublishedOffer | null>(
    (best, offer) => (!best || isBetterPriorityOffer(offer, best) ? offer : best),
    null,
  );
}

async function applyPriorityOffer(
  tx: DatabaseExecutor,
  productId: string,
  offerId: string | null,
  priorityIsManual: boolean,
) {
  await tx
    .update(sellerOffers)
    .set({ isPriority: false, updatedAt: new Date() })
    .where(eq(sellerOffers.productId, productId));

  if (offerId) {
    await tx
      .update(sellerOffers)
      .set({ isPriority: true, updatedAt: new Date() })
      .where(and(eq(sellerOffers.id, offerId), eq(sellerOffers.productId, productId)));
  }

  await tx
    .update(products)
    .set({
      priorityOfferId: offerId,
      priorityIsManual,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

export async function setManualProductPriorityOffer(
  tx: DatabaseExecutor,
  productId: string,
  offerId: string,
) {
  await applyPriorityOffer(tx, productId, offerId, true);
}

export async function recalculateAutomaticProductPriority(
  tx: DatabaseExecutor,
  productId: string,
) {
  const offers = await tx
    .select({
      id: sellerOffers.id,
      priceWithVat: sellerOffers.priceWithVat,
      publishedAt: sellerOffers.moderatedAt,
      createdAt: sellerOffers.createdAt,
    })
    .from(sellerOffers)
    .where(and(eq(sellerOffers.productId, productId), eq(sellerOffers.status, "published")));
  const selectedOffer = selectAutomaticPriorityOffer(offers);

  await applyPriorityOffer(tx, productId, selectedOffer?.id ?? null, false);

  return selectedOffer;
}

export async function syncStoredProductPriorityOffer(
  tx: DatabaseExecutor,
  productId: string,
) {
  const [product] = await tx
    .select({ priorityOfferId: products.priorityOfferId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  await applyPriorityOffer(tx, productId, product?.priorityOfferId ?? null, true);
}
