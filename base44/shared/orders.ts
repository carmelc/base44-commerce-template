/**
 * Order lifecycle engine. transitionOrder() is the ONLY place status changes
 * happen — it derives side effects from flag diffs (stock_reduced,
 * coupon_usages_counted, download_permissions_granted) so double-effects are
 * impossible even when an admin forces unusual transitions.
 *
 * Side-effect matrix (see plan Part 3): stock, coupon usage, dates, emails,
 * webhooks, download permissions per entering status.
 */
import { getSettings } from "./settings.ts";
import { reduceStock, restoreStock } from "./stock.ts";
import { countUsage, uncountUsage } from "./coupons.ts";
import { sendOrderEmail } from "./emails.ts";
import { dispatch } from "./webhooks.ts";

export const ORDER_STATUSES = [
  "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed",
] as const;

export interface TransitionOpts {
  /** True when creating a brand-new order (fires order.created + creation effects). */
  isCreation?: boolean;
  /** Custom system note; a default "status changed" note is added otherwise. */
  note?: string;
  /** Suppress the automatic order note. */
  skipNote?: boolean;
  /** Who did it ("system" default; admin email for admin actions). */
  actor?: string;
  /** Pre-fetched settings groups (perf). */
  settings?: Record<string, any>;
  /** Extra fields to persist alongside the status patch. */
  extraPatch?: Record<string, any>;
}

/**
 * Transition `order` to `newStatus`, applying every Woo side effect exactly
 * once. Mutates and returns the in-memory order; persists the patch.
 */
export async function transitionOrder(sr: any, order: any, newStatus: string, opts: TransitionOpts = {}): Promise<any> {
  const prev = order.status;
  const isCreation = !!opts.isCreation;
  if (!isCreation && prev === newStatus) return order;
  if (!ORDER_STATUSES.includes(newStatus as any)) {
    throw new Error(`Unknown order status: ${newStatus}`);
  }

  const settings = opts.settings ?? (await getSettings(sr));
  const now = new Date().toISOString();
  const patch: Record<string, any> = { status: newStatus, ...(opts.extraPatch ?? {}) };

  const ensureReduced = async () => {
    if (!order.stock_reduced) {
      await reduceStock(sr, order, { settings }); // sets order.stock_reduced=true
      patch.stock_reduced = true;
    }
  };
  const restore = async () => {
    if (order.stock_reduced) {
      await restoreStock(sr, order, { settings }); // sets order.stock_reduced=false
      patch.stock_reduced = false;
    }
  };
  const count = async () => {
    if (!order.coupon_usages_counted && (order.coupon_lines || []).length) {
      await countUsage(sr, order);
      order.coupon_usages_counted = true;
      patch.coupon_usages_counted = true;
    }
  };
  const uncount = async () => {
    if (order.coupon_usages_counted) {
      await uncountUsage(sr, order);
      order.coupon_usages_counted = false;
      patch.coupon_usages_counted = false;
    }
  };
  const clearHold = () => {
    if (order.hold_expires_at) {
      order.hold_expires_at = null;
      patch.hold_expires_at = null;
    }
  };
  const grant = async () => {
    if (!order.download_permissions_granted) {
      const granted = await grantDownloadPermissions(sr, order);
      if (granted > 0) {
        order.download_permissions_granted = true;
        patch.download_permissions_granted = true;
      }
    }
  };
  const revoke = async () => {
    if (order.download_permissions_granted) {
      await revokeDownloadPermissions(sr, order);
      order.download_permissions_granted = false;
      patch.download_permissions_granted = false;
    }
  };
  const email = (type: string) => sendOrderEmail(sr, type, order, { settings });

  switch (newStatus) {
    case "pending":
      if (isCreation) {
        await ensureReduced();
        await email("new_order");
      }
      break;
    case "processing":
      await ensureReduced();
      clearHold();
      await count();
      if (!order.date_paid) { order.date_paid = now; patch.date_paid = now; }
      await email("new_order"); // deduped if already sent
      await email("processing_order");
      if (await isVirtualOnly(sr, order)) await grant();
      break;
    case "on-hold":
      await ensureReduced();
      clearHold();
      await count();
      await email("new_order");
      await email("on_hold_order");
      break;
    case "completed":
      await ensureReduced();
      await count();
      if (!order.date_paid) { order.date_paid = now; patch.date_paid = now; }
      order.date_completed = now;
      patch.date_completed = now;
      await email("completed_order");
      await grant();
      break;
    case "cancelled":
      await restore();
      await uncount();
      await email("cancelled_order");
      await revoke();
      break;
    case "failed":
      await restore();
      await uncount();
      await email("failed_order");
      break;
    case "refunded":
      // stock restocking is handled per-refund by admin-refunds; coupons stay counted
      await email("refunded_order");
      await revoke();
      break;
  }

  order.status = newStatus;
  Object.assign(order, patch);
  await sr.entities.Order.update(order.id, patch);

  if (!opts.skipNote) {
    const note = opts.note ??
      (isCreation
        ? `Order created via ${order.created_via || "checkout"} (${newStatus}).`
        : `Order status changed from ${prev} to ${newStatus}.`);
    try {
      await sr.entities.OrderNote.create({
        order_id: order.id,
        note,
        is_customer_note: false,
        added_by: opts.actor ?? "system",
      });
    } catch (e) { console.error("order note failed:", e); }
  }

  await dispatch(sr, isCreation ? "order.created" : "order.updated", { ...order });
  return order;
}

/** True when every line item's product is virtual (no physical fulfillment). */
async function isVirtualOnly(sr: any, order: any): Promise<boolean> {
  const lines = order.line_items || [];
  if (!lines.length) return false;
  for (const line of lines) {
    try {
      const product = await sr.entities.Product.get(line.product_id);
      if (!product?.virtual && !product?.downloadable) return false;
    } catch { return false; }
  }
  return true;
}

/**
 * Create DownloadPermission rows for every downloadable file on the order's
 * lines. Returns how many permissions were created.
 */
export async function grantDownloadPermissions(sr: any, order: any): Promise<number> {
  let created = 0;
  for (const line of order.line_items || []) {
    let product: any = null;
    let variation: any = null;
    try { product = line.product_id ? await sr.entities.Product.get(line.product_id) : null; } catch { /* skip */ }
    try { variation = line.variation_id ? await sr.entities.ProductVariation.get(line.variation_id) : null; } catch { /* skip */ }
    const src = variation?.downloadable ? variation : (product?.downloadable ? product : null);
    if (!src) continue;

    const limit = src.download_limit ?? -1;
    const expiryDays = src.download_expiry ?? -1;
    const expires = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86_400_000).toISOString()
      : null;

    for (const dl of src.downloads || []) {
      await sr.entities.DownloadPermission.create({
        order_id: order.id,
        order_key: order.order_key ?? "",
        customer_email: order.billing?.email ?? "",
        product_id: line.product_id,
        variation_id: line.variation_id ?? "",
        download_name: dl.name ?? "Download",
        file_url: dl.file_url ?? "",
        downloads_remaining: limit,
        access_expires: expires,
        download_count: 0,
      });
      created++;
    }
  }
  return created;
}

/** Remove every download permission attached to the order. */
export async function revokeDownloadPermissions(sr: any, order: any): Promise<void> {
  try {
    await sr.entities.DownloadPermission.deleteMany({ order_id: order.id });
  } catch (e) {
    console.error("revokeDownloadPermissions failed:", e);
  }
}

/**
 * Strip internals before handing an order to its customer (storefront-account,
 * checkout responses): no ip/user-agent, no lifecycle flags, no email ledger.
 */
export function serializeOrderForCustomer(order: any): any {
  const {
    customer_ip: _ip,
    customer_user_agent: _ua,
    stock_reduced: _sr,
    coupon_usages_counted: _cc,
    download_permissions_granted: _dp,
    hold_expires_at: _he,
    emails_sent: _es,
    ...safe
  } = order ?? {};
  return safe;
}
