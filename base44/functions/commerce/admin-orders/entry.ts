/**
 * commerce/admin-orders — order creation, editing, status lifecycle, notes, emails,
 * download permissions and hold release.
 *
 * Actions: create-draft | create | update | update-status | bulk-status |
 * status-counts | search | recalculate | apply-coupon | remove-coupon |
 * add-note | delete-note | send-email | grant-download | revoke-download |
 * delete | release-expired-holds
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../../shared/commerce/auth.ts";
import { getSettings } from "../../../shared/commerce/settings.ts";
import { generateOrderKey, nextOrderNumber } from "../../../shared/commerce/sequence.ts";
import { ORDER_STATUSES, transitionOrder } from "../../../shared/commerce/orders.ts";
import { releaseExpiredHolds } from "../../../shared/commerce/stock.ts";
import { validateCoupon } from "../../../shared/commerce/coupons.ts";
import { sendOrderEmail } from "../../../shared/commerce/emails.ts";
import { dispatch } from "../../../shared/commerce/webhooks.ts";
import { pageSlice, scanAll, textMatch } from "../../../shared/commerce/scan.ts";
import {
  gatewayTitle,
  isLocked,
  loadPricingContext,
  repriceOrder,
  resolveCoupons,
} from "./helpers.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();
    const actor = admin.email ?? "admin";

    switch (action) {
      case "create-draft": return ok(await createDraft(sr));
      case "create": return ok(await create(sr, payload, actor), 201);
      case "update": return ok(await update(sr, payload, actor));
      case "update-status": {
        const order = await getOrder(sr, payload.order_id);
        assertStatus(payload.status);
        await transitionOrder(sr, order, payload.status, { actor, note: payload.note });
        return ok(order);
      }
      case "bulk-status": return ok(await bulkStatus(sr, payload, actor));
      case "status-counts": return ok(await statusCounts(sr));
      case "search": return ok(await search(sr, payload));
      case "recalculate": {
        const order = await getOrder(sr, payload.order_id);
        const { fields } = await repriceOrder(sr, order, { repriceFromCatalog: !!payload.reprice_from_catalog });
        await sr.entities["commerce.Order"].update(order.id, fields);
        Object.assign(order, fields);
        await dispatch(sr, "order.updated", order);
        return ok(order);
      }
      case "apply-coupon": return ok(await applyCoupon(sr, payload));
      case "remove-coupon": return ok(await removeCoupon(sr, payload));
      case "add-note": return ok(await addNote(sr, payload, actor), 201);
      case "delete-note": {
        await sr.entities["commerce.OrderNote"].delete(payload.note_id);
        return ok({ deleted: payload.note_id });
      }
      case "send-email": {
        const order = await getOrder(sr, payload.order_id);
        const result = await sendOrderEmail(sr, payload.type ?? "customer_invoice", order, { force: true });
        return ok(result);
      }
      case "grant-download": return ok(await grantDownload(sr, payload));
      case "revoke-download": {
        await sr.entities["commerce.DownloadPermission"].delete(payload.permission_id);
        return ok({ deleted: payload.permission_id });
      }
      case "delete": return ok(await remove(sr, payload.order_id));
      case "release-expired-holds": {
        const settings = await getSettings(sr);
        const released = await releaseExpiredHolds(sr, settings, transitionOrder);
        return ok({ released });
      }
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("commerce/admin-orders error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function getOrder(sr: any, orderId: string): Promise<any> {
  if (!orderId) throw new HttpError(400, "order_id is required", "invalid_payload");
  const order = await sr.entities["commerce.Order"].get(orderId);
  if (!order) throw new HttpError(404, "Order not found", "not_found");
  return order;
}

function assertStatus(status: string): void {
  if (!ORDER_STATUSES.includes(status as any)) {
    throw new HttpError(400, `Invalid order status: ${status}`, "invalid_status");
  }
}

// ── create ───────────────────────────────────────────────────────────────────

/** Empty admin order shell — no lifecycle side effects until it's edited/saved. */
async function createDraft(sr: any): Promise<any> {
  const settings = await getSettings(sr, "general");
  const order = await sr.entities["commerce.Order"].create({
    order_number: await nextOrderNumber(sr),
    order_key: generateOrderKey(),
    status: "pending",
    currency: settings.general?.currency ?? "USD",
    created_via: "admin",
    customer_id: "",
    billing: {},
    shipping: {},
    line_items: [],
    shipping_lines: [],
    tax_lines: [],
    fee_lines: [],
    coupon_lines: [],
    subtotal: 0, discount_total: 0, discount_tax: 0, shipping_total: 0,
    shipping_tax: 0, cart_tax: 0, total_tax: 0, total: 0, total_refunded: 0,
    stock_reduced: false, coupon_usages_counted: false,
    download_permissions_granted: false, emails_sent: [], meta_data: [],
  });
  await sr.entities["commerce.OrderNote"].create({
    order_id: order.id, note: "Order draft created by admin.", is_customer_note: false, added_by: "system",
  });
  return order;
}

/**
 * Manual admin order: prices via the same totals engine as checkout.
 * payload: {items, coupon_codes?, fees?, billing?, shipping?, customer_id?,
 * chosen_shipping_method?, payment_method?, customer_note?, status?, reduce_stock?}
 */
async function create(sr: any, payload: any, actor: string): Promise<any> {
  const ctx = await loadPricingContext(sr);
  const shipping = payload.shipping ?? payload.billing ?? {};
  const { fields } = await repriceOrder(sr, {
    line_items: [], coupon_lines: [], fee_lines: [], shipping_lines: [],
    billing: payload.billing ?? {}, shipping,
  }, {
    items: payload.items ?? [],
    couponCodes: payload.coupon_codes ?? [],
    fees: payload.fees ?? [],
    billing: payload.billing ?? {},
    shipping,
    chosenShippingMethodId: payload.chosen_shipping_method,
    ctx,
  });

  const order = await sr.entities["commerce.Order"].create({
    order_number: await nextOrderNumber(sr),
    order_key: generateOrderKey(),
    status: "pending",
    currency: ctx.settings.general?.currency ?? "USD",
    created_via: "admin",
    customer_id: payload.customer_id ?? "",
    customer_note: payload.customer_note ?? "",
    billing: payload.billing ?? {},
    shipping,
    payment_method: payload.payment_method ?? "",
    payment_method_title: await gatewayTitle(sr, payload.payment_method ?? ""),
    ...fields,
    total_refunded: 0,
    stock_reduced: false, coupon_usages_counted: false,
    download_permissions_granted: false, emails_sent: [],
    meta_data: payload.meta_data ?? [],
  });

  const target = payload.status ?? "pending";
  assertStatus(target);
  if (payload.reduce_stock === false && target === "pending") {
    // creation without a stock reduction: fire the creation effects manually
    await sendOrderEmail(sr, "new_order", order, { settings: ctx.settings });
    await sr.entities["commerce.OrderNote"].create({
      order_id: order.id, note: "Order created via admin (pending, stock not reduced).",
      is_customer_note: false, added_by: actor,
    });
    await dispatch(sr, "order.created", order);
  } else {
    await transitionOrder(sr, order, target, { isCreation: true, actor, settings: ctx.settings });
  }
  return order;
}

// ── update ───────────────────────────────────────────────────────────────────

/**
 * Patch an order. Line-level edits ({items, fees, coupon_codes,
 * chosen_shipping_method}) require an unlocked order (pending/on-hold) and
 * trigger a full reprice. Addresses/customer/meta are editable any time.
 * A `status` in the patch is delegated to the transition engine last.
 */
async function update(sr: any, payload: any, actor: string): Promise<any> {
  const order = await getOrder(sr, payload.order_id);
  const patch = payload.patch ?? {};
  const wantsLineEdit = ["items", "fees", "coupon_codes", "chosen_shipping_method", "shipping_lines"]
    .some((k) => patch[k] !== undefined);
  if (wantsLineEdit && isLocked(order)) {
    throw new HttpError(409, `Order items can only be edited while pending or on-hold (current: ${order.status}).`, "order_locked");
  }

  const fields: Record<string, any> = {};
  for (const k of ["billing", "shipping", "customer_id", "customer_note", "payment_method", "meta_data"]) {
    if (patch[k] !== undefined) fields[k] = patch[k];
  }
  if (patch.payment_method !== undefined) {
    fields.payment_method_title = await gatewayTitle(sr, patch.payment_method);
  }

  const addressesChanged = patch.billing !== undefined || patch.shipping !== undefined;
  if (wantsLineEdit || addressesChanged) {
    const { fields: priced } = await repriceOrder(sr, order, {
      items: patch.items,
      couponCodes: patch.coupon_codes,
      fees: patch.fees,
      billing: patch.billing ?? order.billing,
      shipping: patch.shipping ?? order.shipping,
      chosenShippingMethodId: patch.chosen_shipping_method,
      manualShippingLines: patch.shipping_lines !== undefined
        ? (patch.shipping_lines ?? []).map((s: any) => ({
          method_title: s.method_title,
          total: s.total,
          total_tax: s.total_tax,
        }))
        : undefined,
    });
    Object.assign(fields, priced);
  }

  await sr.entities["commerce.Order"].update(order.id, fields);
  Object.assign(order, fields);

  if (patch.status && patch.status !== order.status) {
    assertStatus(patch.status);
    await transitionOrder(sr, order, patch.status, { actor });
  } else {
    await dispatch(sr, "order.updated", order);
  }
  return order;
}

async function bulkStatus(sr: any, payload: any, actor: string): Promise<any> {
  assertStatus(payload.status);
  const results: any[] = [];
  for (const id of payload.ids ?? []) {
    try {
      const order = await getOrder(sr, id);
      await transitionOrder(sr, order, payload.status, { actor });
      results.push({ id, success: true });
    } catch (e) {
      results.push({ id, success: false, error: (e as Error).message });
    }
  }
  return { results };
}

// ── lists ────────────────────────────────────────────────────────────────────

async function statusCounts(sr: any): Promise<Record<string, number>> {
  const orders = await scanAll(sr.entities["commerce.Order"], null, "-created_date", { fields: ["id", "status"] });
  const counts: Record<string, number> = { all: orders.length };
  for (const s of ORDER_STATUSES) counts[s] = 0;
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return counts;
}

async function search(sr: any, payload: any): Promise<any> {
  const { q, status, date_min, date_max, sort = "-created_date", limit = 20, skip = 0 } = payload;
  let rows = await scanAll(sr.entities["commerce.Order"], status ? { status } : null, sort);
  if (q) {
    rows = rows.filter((o) =>
      String(o.order_number ?? "").includes(String(q).replace(/^#/, "")) ||
      textMatch(`${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`, q) ||
      textMatch(o.billing?.email, q)
    );
  }
  if (date_min) rows = rows.filter((o) => o.created_date >= date_min);
  if (date_max) rows = rows.filter((o) => o.created_date <= `${date_max}~`); // '~' sorts after any time suffix
  return pageSlice(rows, Number(limit), Number(skip));
}

// ── coupons on an order ──────────────────────────────────────────────────────

async function applyCoupon(sr: any, payload: any): Promise<any> {
  const order = await getOrder(sr, payload.order_id);
  if (isLocked(order)) throw new HttpError(409, "Coupons can only change while the order is pending or on-hold.", "order_locked");
  const code = String(payload.code ?? "").toLowerCase().trim();
  if (!code) throw new HttpError(400, "code is required", "invalid_payload");
  if ((order.coupon_lines ?? []).some((c: any) => c.code === code)) {
    throw new HttpError(409, "Coupon already applied.", "already_applied");
  }

  const [coupon] = await resolveCoupons(sr, [code]);
  const applied = await resolveCoupons(sr, (order.coupon_lines ?? []).map((c: any) => c.code));
  const lines = (order.line_items ?? []).map((l: any) => ({
    line_id: l.line_id, product_id: l.product_id, variation_id: l.variation_id,
    quantity: l.quantity, unit_price: l.price, subtotal: l.subtotal, discount: 0,
  }));
  const verdict = validateCoupon(coupon ?? null, {
    lines, itemsSubtotal: order.subtotal ?? 0,
    customerEmail: order.billing?.email, appliedCoupons: applied,
  });
  if (!verdict.valid) throw new HttpError(400, verdict.error ?? "Invalid coupon", verdict.code);

  const codes = [...(order.coupon_lines ?? []).map((c: any) => c.code), code];
  const { fields } = await repriceOrder(sr, order, { couponCodes: codes });
  await sr.entities["commerce.Order"].update(order.id, fields);
  Object.assign(order, fields);
  await dispatch(sr, "order.updated", order);
  return order;
}

async function removeCoupon(sr: any, payload: any): Promise<any> {
  const order = await getOrder(sr, payload.order_id);
  if (isLocked(order)) throw new HttpError(409, "Coupons can only change while the order is pending or on-hold.", "order_locked");
  const code = String(payload.code ?? "").toLowerCase().trim();
  const codes = (order.coupon_lines ?? []).map((c: any) => c.code).filter((c: string) => c !== code);
  const { fields } = await repriceOrder(sr, order, { couponCodes: codes });
  await sr.entities["commerce.Order"].update(order.id, fields);
  Object.assign(order, fields);
  await dispatch(sr, "order.updated", order);
  return order;
}

// ── notes / downloads / delete ───────────────────────────────────────────────

async function addNote(sr: any, payload: any, actor: string): Promise<any> {
  const order = await getOrder(sr, payload.order_id);
  const note = await sr.entities["commerce.OrderNote"].create({
    order_id: order.id,
    note: payload.note ?? "",
    is_customer_note: !!payload.is_customer_note,
    added_by: actor,
  });
  if (payload.is_customer_note) {
    await sendOrderEmail(sr, "customer_note", order, { force: true, extra: { note: payload.note } });
  }
  return note;
}

/** Grant download permissions for one downloadable product on the order. */
async function grantDownload(sr: any, payload: any): Promise<any> {
  const order = await getOrder(sr, payload.order_id);
  const product = await sr.entities["commerce.Product"].get(payload.product_id);
  if (!product) throw new HttpError(404, "Product not found", "not_found");
  if (!product.downloadable || !(product.downloads ?? []).length) {
    throw new HttpError(400, "Product has no downloadable files.", "not_downloadable");
  }
  const expiryDays = product.download_expiry ?? -1;
  const created: any[] = [];
  for (const dl of product.downloads) {
    created.push(await sr.entities["commerce.DownloadPermission"].create({
      order_id: order.id,
      order_key: order.order_key ?? "",
      customer_email: order.billing?.email ?? "",
      product_id: product.id,
      variation_id: "",
      download_name: dl.name ?? "Download",
      file_url: dl.file_url ?? "",
      downloads_remaining: product.download_limit ?? -1,
      access_expires: expiryDays > 0 ? new Date(Date.now() + expiryDays * 86_400_000).toISOString() : null,
      download_count: 0,
    }));
  }
  return { granted: created };
}

async function remove(sr: any, orderId: string): Promise<any> {
  const order = await getOrder(sr, orderId);
  if (!["pending", "cancelled", "failed"].includes(order.status)) {
    throw new HttpError(409, `Only pending, cancelled or failed orders can be deleted (current: ${order.status}).`, "order_locked");
  }
  await sr.entities["commerce.OrderNote"].deleteMany({ order_id: order.id }).catch(() => {});
  await sr.entities["commerce.OrderRefund"].deleteMany({ order_id: order.id }).catch(() => {});
  await sr.entities["commerce.DownloadPermission"].deleteMany({ order_id: order.id }).catch(() => {});
  await sr.entities["commerce.Order"].delete(order.id);
  await dispatch(sr, "order.deleted", order);
  return { deleted: order.id };
}
