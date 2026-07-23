/**
 * Order-number sequencing and opaque key/id generation.
 *
 * NOTE ON CONCURRENCY: Base44 has no transactions, so nextOrderNumber() is a
 * read-max-then-increment and two simultaneous checkouts could race. The window
 * is tiny and order ids (not numbers) are the primary key; see
 * implementation-guidelines.md "Limits & concurrency" for mitigations.
 */

const ORDER_NUMBER_START = 1001;

/** Next human-facing sequential order number (max existing + 1, starts at 1001). */
export async function nextOrderNumber(sr: any): Promise<number> {
  const latest = (await sr.entities.Order.list("-order_number", 1)) ?? [];
  const max = Number(latest[0]?.order_number ?? 0);
  return Math.max(max + 1, ORDER_NUMBER_START);
}

/**
 * Random order key used as a bearer credential for guest order tracking
 * (Woo's wc_order_xxx key). Treat like a secret; only ever share with the
 * order's owner.
 */
export function generateOrderKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let key = "";
  for (const b of bytes) key += (b % 36).toString(36);
  return `wc_order_${key.slice(0, 24)}`;
}

/** Stable uuid for embedded line ids, cart tokens, item keys. */
export function uuid(): string {
  return crypto.randomUUID();
}
