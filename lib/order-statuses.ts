// ─────────────────────────────────────────────────────────────────────────────
// Order Status Constants
//
// Plain runtime values — NO @prisma/client import — safe to use in both
// Server Components and Client Components without triggering the
// "Can't resolve '.prisma/client/index-browser'" Turbopack error.
//
// Mirrors the Prisma OrderStatus enum in prisma/schema.prisma.
// If you rename or add a status in the schema, update this file too.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

/** Client-safe type alias — identical to the Prisma-generated OrderStatus. */
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING:    "Pending",
  PROCESSING: "Processing",
  SHIPPED:    "Shipped",
  DELIVERED:  "Delivered",
  CANCELLED:  "Cancelled",
};
