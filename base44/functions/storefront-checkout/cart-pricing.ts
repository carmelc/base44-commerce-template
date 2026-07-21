/**
 * Cart resolution + pricing helpers for storefront functions.
 * NOTE: duplicated in storefront-cart/ and storefront-checkout/ — keep in sync.
 * (Base44 functions can only share code via base44/shared/, which this
 * template treats as engine-only; per-function helpers live beside entry.ts.)
 */
import { HttpError } from "../../shared/auth.ts";
import { getSettings } from "../../shared/settings.ts";
import { calculateTotals } from "../../shared/totals.ts";
import { validateCoupon } from "../../shared/coupons.ts";
import { checkPurchasable } from "../../shared/stock.ts";
import { round2 } from "../../shared/money.ts";
import { scanAll } from "../../shared/scan.ts";

export const CART_TTL_MS = 48 * 60 * 60 * 1000; // 48h, refreshed on touch

export function cartExpiry(): string {
  return new Date(Date.now() + CART_TTL_MS).toISOString();
}

/** Load an active cart by its bearer token. Throws 404 (not found / expired). */
export async function loadCart(sr: any, cartToken: string | undefined): Promise<any> {
  if (!cartToken) throw new HttpError(400, "cart_token is required.", "cart_token_required");
  const cart = (await sr.entities.Cart.filter({ cart_token: cartToken }, undefined, 1))?.[0];
  if (!cart || cart.status !== "active") {
    throw new HttpError(404, "Cart not found.", "cart_not_found");
  }
  if (cart.expires_at && new Date(cart.expires_at).getTime() < Date.now()) {
    try { await sr.entities.Cart.update(cart.id, { status: "abandoned" }); } catch { /* best-effort */ }
    throw new HttpError(404, "Cart has expired.", "cart_expired");
  }
  return cart;
}

export interface PricingData {
  settings: Record<string, any>;
  taxRates: any[];
  zones: any[];
  zoneMethods: any[];
}

/** One round of catalog-config reads shared by every priced response. */
export async function loadPricingData(sr: any): Promise<PricingData> {
  const [settings, taxRates, zones, zoneMethods] = await Promise.all([
    getSettings(sr),
    scanAll(sr.entities.TaxRate, {}, "menu_order", 2000),
    scanAll(sr.entities.ShippingZone, {}, "order", 500),
    scanAll(sr.entities.ShippingZoneMethod, {}, "order", 1000),
  ]);
  return { settings, taxRates, zones, zoneMethods };
}

export interface ResolvedItem {
  item: any;        // the stored cart item {item_key, product_id, variation_id, quantity, attributes}
  product: any;
  variation?: any;
}

/**
 * Resolve stored cart items to live products/variations. Items whose product
 * vanished or was unpublished are reported in `removed` (Woo removes them from
 * the cart and tells the shopper).
 */
export async function resolveItems(sr: any, cart: any): Promise<{ resolved: ResolvedItem[]; removed: any[] }> {
  const resolved: ResolvedItem[] = [];
  const removed: any[] = [];
  for (const item of cart.items || []) {
    let product: any = null;
    let variation: any = undefined;
    try { product = item.product_id ? await sr.entities.Product.get(item.product_id) : null; } catch { product = null; }
    if (!product || product.status !== "publish") {
      removed.push({ item_key: item.item_key, product_id: item.product_id, reason: "This product is no longer available.", code: "unavailable" });
      continue;
    }
    if (item.variation_id) {
      try { variation = await sr.entities.ProductVariation.get(item.variation_id); } catch { variation = undefined; }
      if (!variation || (variation.status && variation.status !== "publish")) {
        removed.push({ item_key: item.item_key, product_id: item.product_id, reason: "This product option is no longer available.", code: "unavailable" });
        continue;
      }
    }
    resolved.push({ item, product, variation });
  }
  return { resolved, removed };
}

/** Lines in the shape coupons.ts validateCoupon()/eligibleLines() expect. */
export function couponCtxLines(resolved: ResolvedItem[]): any[] {
  return resolved.map(({ item, product, variation }) => {
    const src = variation ?? product;
    const price = Number(src?.price ?? 0);
    return {
      line_id: item.item_key,
      product_id: item.product_id,
      variation_id: item.variation_id ?? "",
      quantity: item.quantity,
      unit_price: price,
      subtotal: round2(price * item.quantity),
      discount: 0,
      product,
      variation,
    };
  });
}

export async function findCoupon(sr: any, code: string): Promise<any | null> {
  if (!code) return null;
  return (await sr.entities.Coupon.filter({ code: String(code).toLowerCase().trim() }, undefined, 1))?.[0] ?? null;
}

export interface PricedCart {
  view: any;              // customer-facing cart payload
  totals: any;            // full TotalsResult
  resolved: ResolvedItem[];
  removed: any[];
  validCoupons: any[];
  couponNotices: any[];
  pricingData: PricingData;
}

/**
 * Produce the priced view of a cart: resolve items, revalidate stored coupons
 * (silently dropping ones that stopped validating, with notices), run the
 * totals engine in preview mode, and enrich items for display.
 * Persists item removals / coupon drops back onto the Cart record.
 */
export async function priceCart(sr: any, cart: any, opts: { pricingData?: PricingData; customerEmail?: string } = {}): Promise<PricedCart> {
  const pricingData = opts.pricingData ?? (await loadPricingData(sr));
  const { settings } = pricingData;
  const { resolved, removed } = await resolveItems(sr, cart);

  const cartPatch: Record<string, any> = {};
  if (removed.length) {
    const removedKeys = new Set(removed.map((r) => r.item_key));
    cart.items = (cart.items || []).filter((i: any) => !removedKeys.has(i.item_key));
    cartPatch.items = cart.items;
  }

  // revalidate stored coupons in application order
  const ctxLines = couponCtxLines(resolved);
  const itemsSubtotal = round2(ctxLines.reduce((a, l) => a + l.subtotal, 0));
  const customerEmail = cart.customer_email || opts.customerEmail || "";
  const validCoupons: any[] = [];
  const keptCodes: string[] = [];
  const couponNotices: any[] = [];
  for (const code of cart.coupon_codes || []) {
    const coupon = await findCoupon(sr, code);
    const res = validateCoupon(coupon, {
      lines: ctxLines,
      itemsSubtotal,
      customerEmail,
      appliedCoupons: validCoupons,
    });
    if (res.valid) {
      validCoupons.push(coupon);
      keptCodes.push(code);
    } else {
      couponNotices.push({ code, error: res.error, error_code: res.code });
    }
  }
  if (keptCodes.length !== (cart.coupon_codes || []).length) {
    cart.coupon_codes = keptCodes;
    cartPatch.coupon_codes = keptCodes;
  }
  if (Object.keys(cartPatch).length) {
    try { await sr.entities.Cart.update(cart.id, cartPatch); } catch { /* view still correct */ }
  }

  const totals = calculateTotals({
    items: resolved.map((r) => ({
      product: r.product,
      variation: r.variation,
      quantity: r.item.quantity,
      attributes: r.item.attributes ?? [],
    })),
    coupons: validCoupons,
    shipping_address: cart.shipping_address,
    chosenShippingMethodId: cart.chosen_shipping_method || undefined,
    settings,
    taxRates: pricingData.taxRates,
    zones: pricingData.zones,
    zoneMethods: pricingData.zoneMethods,
  });

  // display items: engine lines align by index with `resolved`
  const items = resolved.map((r, i) => {
    const priced = totals.line_items[i] ?? {};
    const src = r.variation ?? r.product;
    return {
      item_key: r.item.item_key,
      product_id: r.item.product_id,
      variation_id: r.item.variation_id ?? "",
      quantity: r.item.quantity,
      attributes: r.item.attributes ?? [],
      name: r.product.name ?? "",
      sku: priced.sku ?? "",
      image: r.variation?.image?.src || r.product.images?.[0]?.src || "",
      price: priced.price ?? Number(src?.price ?? 0),
      subtotal: priced.subtotal ?? 0,
      total: priced.total ?? 0,
      total_tax: priced.total_tax ?? 0,
      virtual: !!(r.variation?.virtual ?? r.product.virtual),
      sold_individually: !!r.product.sold_individually,
      purchasable: checkPurchasable(r.product, r.variation, r.item.quantity, settings),
    };
  });

  const view = {
    cart_token: cart.cart_token,
    items,
    coupon_codes: cart.coupon_codes ?? [],
    coupons: totals.coupon_lines,
    coupon_notices: couponNotices,
    removed_items: removed,
    shipping_address: cart.shipping_address ?? null,
    chosen_shipping_method: cart.chosen_shipping_method ?? "",
    available_shipping_methods: totals.available_shipping_methods,
    totals: {
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      discount_tax: totals.discount_tax,
      shipping_total: totals.shipping_total,
      shipping_tax: totals.shipping_tax,
      cart_tax: totals.cart_tax,
      total_tax: totals.total_tax,
      total: totals.total,
      prices_include_tax: totals.prices_include_tax,
      tax_lines: totals.tax_lines,
    },
    expires_at: cart.expires_at ?? null,
  };

  return { view, totals, resolved, removed, validCoupons, couponNotices, pricingData };
}
