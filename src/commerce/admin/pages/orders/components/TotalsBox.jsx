import React from "react";
import { Separator } from "@/components/ui/separator";
import useMoney from "../../../hooks/useMoney";
import { orderTotals } from "../../../lib/order-utils";

/** Order totals summary. Props: { order } */
export default function TotalsBox({ order }) {
  const { format } = useMoney();
  const t = orderTotals(order);
  if (!t) return null;

  const row = (label, value, className = "") => (
    <div className={`flex items-center justify-between py-1 text-sm ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );

  const couponCodes = (order.coupon_lines || []).map((c) => c.code).join(", ");

  return (
    <div className="ml-auto w-full max-w-sm">
      {row("Items subtotal", format(t.itemsSubtotal))}
      {t.discount > 0 &&
        row(couponCodes ? `Coupon(s): ${couponCodes}` : "Discount", `− ${format(t.discount)}`)}
      {t.fees !== 0 && row("Fees", format(t.fees))}
      {row("Shipping", format(t.shipping))}
      {(t.taxLines || []).length > 0
        ? t.taxLines.map((tl, i) => (
            <div key={tl.rate_id || i} className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">{tl.label || "Tax"}</span>
              <span>{format((tl.tax_total || 0) + (tl.shipping_tax_total || 0))}</span>
            </div>
          ))
        : row("Tax", format(t.taxTotal))}
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between py-1 font-semibold">
        <span>Order total</span>
        <span>{format(t.total)}</span>
      </div>
      {t.refunded > 0 && (
        <>
          {row("Refunded", `− ${format(t.refunded)}`, "text-destructive")}
          <div className="flex items-center justify-between py-1 text-sm font-medium">
            <span>Net payment</span>
            <span>{format(t.net)}</span>
          </div>
        </>
      )}
    </div>
  );
}
