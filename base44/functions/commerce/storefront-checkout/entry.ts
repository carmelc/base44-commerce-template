/**
 * commerce/storefront-checkout — public checkout API.
 *
 * Actions:
 *   place-order     — the 9-step checkout (validate → totals → customer upsert
 *                     → order create pending → stock reduce → gateway routing)
 *   confirm-payment — post-payment hook (pending/on-hold → processing);
 *                     this is what a Stripe webhook/redirect handler would call
 *   cancel-order    — customer-initiated cancel (pending/on-hold only)
 *
 * Guest access is controlled by the accounts.guest_checkout setting.
 * order_key possession is the guest bearer credential.
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, getCallerUser } from "../../../shared/commerce/auth.ts";
import { getSetting } from "../../../shared/commerce/settings.ts";
import { calculateTotals } from "../../../shared/commerce/totals.ts";
import { validateCoupon } from "../../../shared/commerce/coupons.ts";
import { checkPurchasable, releaseExpiredHolds } from "../../../shared/commerce/stock.ts";
import { transitionOrder, serializeOrderForCustomer } from "../../../shared/commerce/orders.ts";
import { generateOrderKey, nextOrderNumber } from "../../../shared/commerce/sequence.ts";
import { round2 } from "../../../shared/commerce/money.ts";
import {
  couponCtxLines,
  findCoupon,
  loadCart,
  loadPricingData,
  resolveItems,
} from "./cart-pricing.ts";

function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ success: false, error: e.message, code: e.code ?? "error" }, { status: e.status });
  }
  console.error("commerce/storefront-checkout error:", e);
  return Response.json(
    { success: false, error: (e as Error)?.message ?? "Internal error", code: "internal_error" },
    { status: 500 },
  );
}

const REQUIRED_BILLING = ["first_name", "last_name", "address_1", "city", "country", "email"];

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json().catch(() => ({}));
    if (!action) throw new HttpError(400, "action is required.", "action_required");
    const user = await getCallerUser(base44);

    switch (action) {
      case "place-order":
        return ok(await placeOrder(sr, req, user, payload));
      case "confirm-payment":
        return ok(await confirmPayment(sr, payload));
      case "cancel-order":
        return ok(await cancelOrder(sr, payload));
      default:
        throw new HttpError(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    return fail(e);
  }
});

async function placeOrder(sr: any, req: Request, user: any, payload: any): Promise<any> {
  const pricingData = await loadPricingData(sr);
  const settings = pricingData.settings;

  // (1) opportunistically release expired stock holds (no cron on Base44)
  releaseExpiredHolds(sr, settings, transitionOrder).catch((e) =>
    console.error("release-expired-holds failed:", e)
  );

  // guest policy
  if (!user && !getSetting(settings, "accounts", "guest_checkout", true)) {
    throw new HttpError(401, "Please log in to complete your purchase.", "login_required");
  }

  // billing validation
  const billing = payload.billing || {};
  const missing = REQUIRED_BILLING.filter((f) => !String(billing[f] ?? "").trim());
  if (missing.length) {
    throw new HttpError(400, `Missing required billing fields: ${missing.join(", ")}.`, "billing_incomplete");
  }

  // cart
  const cart = await loadCart(sr, payload.cart_token);
  const { resolved, removed } = await resolveItems(sr, cart);
  if (!resolved.length) throw new HttpError(400, "Your cart is empty.", "empty_cart");
  if (removed.length) {
    throw new HttpError(409, "Some items in your cart are no longer available.", "items_unavailable");
  }

  // (2a) revalidate stock/purchasability at exact quantities
  const unavailable: any[] = [];
  for (const r of resolved) {
    const check = checkPurchasable(r.product, r.variation, r.item.quantity, settings);
    if (!check.ok) {
      unavailable.push({ item_key: r.item.item_key, product_id: r.item.product_id, error: check.error, code: check.code });
    }
  }
  if (unavailable.length) {
    throw new HttpError(409, "Some items in your cart cannot be purchased.", "items_unavailable");
  }

  // (2b) revalidate coupons — a stale coupon fails checkout loudly (intended behavior)
  const ctxLines = couponCtxLines(resolved);
  const itemsSubtotal = round2(ctxLines.reduce((a: number, l: any) => a + l.subtotal, 0));
  const coupons: any[] = [];
  for (const code of cart.coupon_codes || []) {
    const coupon = await findCoupon(sr, code);
    const res = validateCoupon(coupon, {
      lines: ctxLines,
      itemsSubtotal,
      customerEmail: billing.email,
      appliedCoupons: coupons,
    });
    if (!res.valid) {
      throw new HttpError(409, `Coupon "${code}": ${res.error}`, "coupon_invalid");
    }
    coupons.push(coupon);
  }

  // shipping requirements
  const needsShipping = resolved.some((r) => !(r.variation?.virtual ?? r.product.virtual));
  const shippingAddress = payload.shipping && payload.shipping.country
    ? payload.shipping
    : (cart.shipping_address?.country ? cart.shipping_address : billingAsShipping(billing));

  // (3) authoritative totals
  const totals = calculateTotals({
    items: resolved.map((r) => ({
      product: r.product,
      variation: r.variation,
      quantity: r.item.quantity,
      attributes: r.item.attributes ?? [],
    })),
    coupons,
    billing,
    shipping_address: shippingAddress,
    chosenShippingMethodId: cart.chosen_shipping_method || undefined,
    settings,
    taxRates: pricingData.taxRates,
    zones: pricingData.zones,
    zoneMethods: pricingData.zoneMethods,
  });
  if (needsShipping && getSetting(settings, "shipping", "enable_shipping", true) !== false && !totals.shipping_lines.length) {
    throw new HttpError(400, "Please choose a shipping method for your address.", "shipping_required");
  }

  // payment gateway
  const gatewaySlug = String(payload.payment_method || "");
  const gateway = (await sr.entities["commerce.PaymentGateway"].filter({ slug: gatewaySlug }, undefined, 1))?.[0];
  if (!gateway || !gateway.enabled) {
    throw new HttpError(400, "The selected payment method is not available.", "invalid_payment_method");
  }

  // (4) customer upsert by billing email
  const notices: string[] = [];
  if (payload.create_account && !user) {
    notices.push("account_creation_requires_login"); // see skills/commerce/references/guest-access-security.md
  }
  const customer = await upsertCustomer(sr, billing, shippingAddress, user);

  // (5) create the pending order
  const holdMinutes = Number(getSetting(settings, "inventory", "hold_stock_minutes", 60)) || 0;
  const now = Date.now();
  const order = await sr.entities["commerce.Order"].create({
    order_number: await nextOrderNumber(sr),
    order_key: generateOrderKey(),
    status: "pending",
    currency: getSetting(settings, "general", "currency", "USD"),
    prices_include_tax: totals.prices_include_tax,
    created_via: "checkout",
    customer_id: customer?.id ?? "",
    customer_note: payload.customer_note ?? "",
    customer_ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(),
    customer_user_agent: req.headers.get("user-agent") ?? "",
    billing,
    shipping: needsShipping ? stripShippingEmail(shippingAddress) : {},
    payment_method: gateway.slug,
    payment_method_title: gateway.title ?? gateway.slug,
    transaction_id: "",
    line_items: totals.line_items,
    shipping_lines: totals.shipping_lines,
    tax_lines: totals.tax_lines,
    fee_lines: totals.fee_lines,
    coupon_lines: totals.coupon_lines,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    discount_tax: totals.discount_tax,
    shipping_total: totals.shipping_total,
    shipping_tax: totals.shipping_tax,
    cart_tax: totals.cart_tax,
    total_tax: totals.total_tax,
    total: totals.total,
    total_refunded: 0,
    stock_reduced: false,
    coupon_usages_counted: false,
    download_permissions_granted: false,
    hold_expires_at: holdMinutes > 0 ? new Date(now + holdMinutes * 60_000).toISOString() : null,
    emails_sent: [],
    meta_data: [],
  });

  // (6) creation effects: stock reduce, new_order email, order.created webhook
  await transitionOrder(sr, order, "pending", { isCreation: true, settings });

  // (7) cart consumed
  try { await sr.entities["commerce.Cart"].update(cart.id, { status: "converted" }); } catch { /* best-effort */ }

  // (9) gateway routing
  let paymentInstructions: any = null;
  let payment: any = null;
  switch (gateway.slug) {
    case "cod":
      await transitionOrder(sr, order, "processing", { settings });
      paymentInstructions = { type: "cod", description: gateway.description ?? "Pay with cash upon delivery." };
      break;
    case "bacs":
      await transitionOrder(sr, order, "on-hold", { settings });
      paymentInstructions = {
        type: "bacs",
        description: gateway.description ?? "Make your payment directly into our bank account.",
        account_details: gateway.settings?.account_details ?? [],
      };
      break;
    case "cheque":
      await transitionOrder(sr, order, "on-hold", { settings });
      paymentInstructions = { type: "cheque", description: gateway.description ?? "Please send a check to our store address." };
      break;
    case "stripe":
      // Payment processing is intentionally not wired in this template.
      payment = {
        status: "not_implemented",
        note: "Create a PaymentIntent here and call confirm-payment after success. See skills/commerce/references/stripe-payments.md.",
      };
      break;
    default:
      // custom gateway added by the store: leave pending for external wiring
      payment = { status: "pending_external", note: `Gateway "${gateway.slug}" requires custom wiring.` };
      break;
  }

  // update customer aggregates for paid statuses
  if (customer && (order.status === "processing" || order.status === "completed")) {
    await bumpCustomerStats(sr, customer, order);
  }

  return {
    order_id: order.id,
    order_number: order.order_number,
    order_key: order.order_key,
    status: order.status,
    currency: order.currency,
    payment_method: order.payment_method,
    payment_method_title: order.payment_method_title,
    payment_instructions: paymentInstructions,
    payment,
    notices,
    totals: {
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      shipping_total: order.shipping_total,
      shipping_tax: order.shipping_tax,
      cart_tax: order.cart_tax,
      total_tax: order.total_tax,
      total: order.total,
    },
    order: serializeOrderForCustomer(order),
  };
}

async function confirmPayment(sr: any, payload: any): Promise<any> {
  const order = await loadOrderByKey(sr, payload.order_id, payload.order_key);
  if (!["pending", "on-hold"].includes(order.status)) {
    throw new HttpError(409, `Order is ${order.status} and cannot be confirmed.`, "invalid_status");
  }
  await transitionOrder(sr, order, "processing", {
    note: "Payment confirmed via storefront confirm-payment.",
    extraPatch: payload.transaction_id ? { transaction_id: String(payload.transaction_id) } : {},
  });
  if (order.customer_id) {
    try {
      const customer = await sr.entities["commerce.Customer"].get(order.customer_id);
      if (customer) await bumpCustomerStats(sr, customer, order);
    } catch { /* stats can be recomputed by commerce/admin-tools */ }
  }
  return { order: serializeOrderForCustomer(order) };
}

async function cancelOrder(sr: any, payload: any): Promise<any> {
  const order = await loadOrderByKey(sr, payload.order_id, payload.order_key);
  if (!["pending", "on-hold"].includes(order.status)) {
    throw new HttpError(409, `Order is ${order.status} and can no longer be cancelled.`, "invalid_status");
  }
  await transitionOrder(sr, order, "cancelled", { note: "Order cancelled by customer." });
  return { order: serializeOrderForCustomer(order) };
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function loadOrderByKey(sr: any, orderId: string, orderKey: string): Promise<any> {
  if (!orderId || !orderKey) throw new HttpError(400, "order_id and order_key are required.", "order_key_required");
  let order: any = null;
  try { order = await sr.entities["commerce.Order"].get(orderId); } catch { order = null; }
  if (!order || order.order_key !== orderKey) {
    throw new HttpError(404, "Order not found.", "order_not_found");
  }
  return order;
}

function billingAsShipping(billing: any): any {
  const { email: _e, ...rest } = billing || {};
  return rest;
}

function stripShippingEmail(address: any): any {
  const { email: _e, ...rest } = address || {};
  return rest;
}

/** Find-or-create the Customer for this checkout and refresh their addresses. */
async function upsertCustomer(sr: any, billing: any, shippingAddress: any, user: any): Promise<any> {
  const email = String(billing.email).toLowerCase().trim();
  const existing = (await sr.entities["commerce.Customer"].filter({ email }, undefined, 1))?.[0];
  const base = {
    first_name: billing.first_name ?? "",
    last_name: billing.last_name ?? "",
    billing,
    shipping: stripShippingEmail(shippingAddress),
  };
  if (existing) {
    const patch: Record<string, any> = { ...base };
    if (user && !existing.user_id) {
      patch.user_id = user.id;
      patch.is_guest = false;
    }
    await sr.entities["commerce.Customer"].update(existing.id, patch);
    return { ...existing, ...patch };
  }
  return await sr.entities["commerce.Customer"].create({
    email,
    ...base,
    username: "",
    user_id: user?.id ?? "",
    is_guest: !user,
    is_paying_customer: false,
    orders_count: 0,
    total_spent: 0,
    meta_data: [],
  });
}

/** Denormalized customer aggregates (recount available via commerce/admin-tools). */
async function bumpCustomerStats(sr: any, customer: any, order: any): Promise<void> {
  try {
    await sr.entities["commerce.Customer"].update(customer.id, {
      orders_count: (customer.orders_count ?? 0) + 1,
      total_spent: round2((customer.total_spent ?? 0) + (order.total ?? 0)),
      is_paying_customer: true,
    });
  } catch (e) {
    console.error("customer stats update failed:", e);
  }
}
