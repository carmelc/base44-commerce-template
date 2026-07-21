import React from "react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUSES, statusMeta } from "../lib/constants";

/**
 * Colored status pill.
 * Props: { status, map? } — `map` defaults to ORDER_STATUSES; pass
 * REVIEW_STATUSES / WEBHOOK_STATUSES / STOCK_STATUSES for other domains.
 */
export default function StatusBadge({ status, map = ORDER_STATUSES, className = "" }) {
  const meta = statusMeta(map, status);
  return (
    <Badge variant="outline" className={`${meta.color} ${className}`}>
      {meta.label}
    </Badge>
  );
}
