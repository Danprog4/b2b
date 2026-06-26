"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markCurrentBuyerChatNotificationsReadAction } from "@/lib/chat/actions";

export function BuyerChatReadMarker() {
  const router = useRouter();
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    if (hasMarkedRead.current) {
      return;
    }

    hasMarkedRead.current = true;

    void markCurrentBuyerChatNotificationsReadAction()
      .then((updatedCount) => {
        if (updatedCount > 0) {
          router.refresh();
        }
      })
      .catch(() => undefined);
  }, [router]);

  return null;
}
