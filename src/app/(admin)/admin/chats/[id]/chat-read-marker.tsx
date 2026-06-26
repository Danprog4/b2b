"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markAdminChatNotificationsReadAction } from "@/lib/chat/actions";

type AdminChatReadMarkerProps = {
  buyerCompanyId: string;
};

export function AdminChatReadMarker({
  buyerCompanyId,
}: AdminChatReadMarkerProps) {
  const router = useRouter();
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    if (hasMarkedRead.current) {
      return;
    }

    hasMarkedRead.current = true;

    void markAdminChatNotificationsReadAction(buyerCompanyId)
      .then((updatedCount) => {
        if (updatedCount > 0) {
          router.refresh();
        }
      })
      .catch(() => undefined);
  }, [buyerCompanyId, router]);

  return null;
}
