import { getOrderStatusClassName, getOrderStatusLabel } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

type OrderStatusBadgeProps = {
  status: string;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold",
        getOrderStatusClassName(status),
        className,
      )}
    >
      {getOrderStatusLabel(status)}
    </span>
  );
}
