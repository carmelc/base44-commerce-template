/** Client-side helpers for order display and refund math. */

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Statuses in which line items are editable (Woo behavior). */
export function canEditLines(order) {
  return ["pending", "on-hold"].includes(order?.status);
}

/** Aggregate display totals for the TotalsBox. */
export function orderTotals(order) {
  if (!order) return null;
  const fees = (order.fee_lines || []).reduce((s, f) => s + (f.total || 0), 0);
  const refunded = order.total_refunded || 0;
  return {
    itemsSubtotal: order.subtotal || 0,
    discount: order.discount_total || 0,
    fees: round2(fees),
    shipping: order.shipping_total || 0,
    taxLines: order.tax_lines || [],
    taxTotal: order.total_tax || 0,
    total: order.total || 0,
    refunded,
    net: round2((order.total || 0) - refunded),
  };
}

/** Quantity of a line still refundable, given existing refunds. */
export function refundableQty(order, refunds, lineId) {
  const line = (order?.line_items || []).find((l) => l.line_id === lineId);
  if (!line) return 0;
  const refundedQty = (refunds || []).reduce(
    (sum, r) =>
      sum +
      (r.line_items || [])
        .filter((rl) => rl.line_id === lineId)
        .reduce((s, rl) => s + (rl.quantity || 0), 0),
    0
  );
  return Math.max(0, (line.quantity || 0) - refundedQty);
}

/** Max amount still refundable on the order. */
export function refundableAmount(order) {
  return round2((order?.total || 0) - (order?.total_refunded || 0));
}

/** Human line for a shipping/billing address. */
export function shortAddress(addr) {
  if (!addr) return "—";
  return [addr.city, addr.state, addr.country].filter(Boolean).join(", ") || "—";
}

export function customerName(order) {
  const b = order?.billing || {};
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ");
  return name || b.email || "Guest";
}
