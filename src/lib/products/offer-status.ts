export const SELLER_DELETED_OFFER_COMMENT = "Удалено продавцом";

export function isSellerDeletedOffer({
  moderationComment,
  status,
}: {
  moderationComment: string | null;
  status: string | null;
}) {
  return status === "hidden" && moderationComment === SELLER_DELETED_OFFER_COMMENT;
}
