/**
 * commerce/storefront-cart — public cart API (guest + member).
 * Every action takes `cart_token` except `create`. Carts are bearer-token
 * scoped (RLS blocks direct entity access); logged-in callers get their
 * active carts merged by email.
 *
 * Actions: create | get | add-item | update-item | remove-item |
 *          apply-coupon | remove-coupon | set-shipping-address |
 *          choose-shipping-method | totals
 * Every mutating action returns the fresh priced cart view.
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, getCallerUser } from "../../../shared/commerce/auth.ts";
import { getSetting } from "../../../shared/commerce/settings.ts";
import { checkPurchasable } from "../../../shared/commerce/stock.ts";
import { validateCoupon } from "../../../shared/commerce/coupons.ts";
import { uuid } from "../../../shared/commerce/sequence.ts";
import {
  cartExpiry,
  couponCtxLines,
  findCoupon,
  loadCart,
  loadPricingData,
  priceCart,
} from "./cart-pricing.ts";
import { round2 } from "../../../shared/commerce/money.ts";

function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ success: false, error: e.message, code: e.code ?? "error" }, { status: e.status });
  }
  console.error("commerce/storefront-cart error:", e);
  return Response.json(
    { success: false, error: (e as Error)?.message ?? "Internal error", code: "internal_error" },
    { status: 500 },
  );
}

/** Persist a patch and refresh the rolling 48h expiry. */
async function touch(sr: any, cart: any, patch: Record<string, any> = {}): Promise<void> {
  const full = { ...patch, expires_at: cartExpiry() };
  await sr.entities["commerce.Cart"].update(cart.id, full);
  Object.assign(cart, full);
}

async function loadProductPair(sr: any, productId: string, variationId?: string): Promise<{ product: any; variation?: any }> {
  let product: any = null;
  try { product = productId ? await sr.entities["commerce.Product"].get(productId) : null; } catch { product = null; }
  if (!product) throw new HttpError(404, "Product not found.", "product_not_found");
  let variation: any = undefined;
  if (variationId) {
    try { variation = await sr.entities["commerce.ProductVariation"].get(variationId); } catch { variation = undefined; }
    if (!variation || variation.product_id !== product.id) {
      throw new HttpError(404, "Product option not found.", "variation_not_found");
    }
  }
  return { product, variation };
}

/**
 * Merge the user's other active carts into `cart` (login-after-browsing flow),
 * abandoning the sources. Quantities sum; sold-individually products cap at 1.
 */
async function mergeUserCarts(sr: any, cart: any, user: any): Promise<void> {
  if (!user?.email) return;
  const patch: Record<string, any> = {};
  if (cart.customer_email !== user.email) patch.customer_email = user.email;

  const others = (await sr.entities["commerce.Cart"].filter({ customer_email: user.email, status: "active" }, "-updated_date", 20)) ?? [];
  let merged = false;
  for (const other of others) {
    if (other.id === cart.id || other.cart_token === cart.cart_token) continue;
    for (const oi of other.items || []) {
      const existing = (cart.items || []).find(
        (i: any) => i.product_id === oi.product_id && (i.variation_id || "") === (oi.variation_id || ""),
      );
      if (existing) {
        let qty = existing.quantity + oi.quantity;
        try {
          const { product } = await loadProductPair(sr, oi.product_id, undefined);
          if (product.sold_individually) qty = 1;
        } catch { /* keep summed qty; pricing revalidates */ }
        existing.quantity = qty;
      } else {
        cart.items = [...(cart.items || []), oi];
      }
      merged = true;
    }
    for (const code of other.coupon_codes || []) {
      if (!(cart.coupon_codes || []).includes(code)) {
        cart.coupon_codes = [...(cart.coupon_codes || []), code];
        merged = true;
      }
    }
    try { await sr.entities["commerce.Cart"].update(other.id, { status: "abandoned" }); } catch { /* best-effort */ }
  }
  if (merged) {
    patch.items = cart.items;
    patch.coupon_codes = cart.coupon_codes ?? [];
  }
  if (Object.keys(patch).length) await touch(sr, cart, patch);
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json().catch(() => ({}));
    if (!action) throw new HttpError(400, "action is required.", "action_required");
    const user = await getCallerUser(base44);

    switch (action) {
      case "create": {
        const cart = await sr.entities["commerce.Cart"].create({
          cart_token: uuid(),
          customer_email: user?.email ?? "",
          items: [],
          coupon_codes: [],
          status: "active",
          expires_at: cartExpiry(),
        });
        // optional initial items go through the same add path validations
        for (const it of payload.items || []) {
          await addItem(sr, cart, it);
        }
        if (user) await mergeUserCarts(sr, cart, user);
        return ok((await priceCart(sr, cart)).view);
      }

      case "get":
      case "totals": {
        const cart = await loadCart(sr, payload.cart_token);
        if (user) await mergeUserCarts(sr, cart, user);
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "add-item": {
        const cart = await loadCart(sr, payload.cart_token);
        await addItem(sr, cart, payload);
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "update-item": {
        const cart = await loadCart(sr, payload.cart_token);
        const { item_key, quantity } = payload;
        const items = [...(cart.items || [])];
        const idx = items.findIndex((i: any) => i.item_key === item_key);
        if (idx < 0) throw new HttpError(404, "Cart item not found.", "item_not_found");
        const qty = Math.floor(Number(quantity));
        if (!Number.isFinite(qty) || qty <= 0) {
          items.splice(idx, 1);
        } else {
          const { product, variation } = await loadProductPair(sr, items[idx].product_id, items[idx].variation_id);
          const pricing = await loadPricingData(sr);
          const check = checkPurchasable(product, variation, qty, pricing.settings);
          if (!check.ok) throw new HttpError(400, check.error ?? "Not available.", check.code);
          items[idx] = { ...items[idx], quantity: qty };
        }
        await touch(sr, cart, { items });
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "remove-item": {
        const cart = await loadCart(sr, payload.cart_token);
        const items = (cart.items || []).filter((i: any) => i.item_key !== payload.item_key);
        await touch(sr, cart, { items });
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "apply-coupon": {
        const cart = await loadCart(sr, payload.cart_token);
        const pricingData = await loadPricingData(sr);
        if (!getSetting(pricingData.settings, "general", "enable_coupons", true)) {
          throw new HttpError(400, "Coupons are disabled for this store.", "coupons_disabled");
        }
        const code = String(payload.code || "").toLowerCase().trim();
        if (!code) throw new HttpError(400, "Coupon code is required.", "code_required");
        if ((cart.coupon_codes || []).includes(code)) {
          throw new HttpError(400, "Coupon is already applied.", "already_applied");
        }
        const pre = await priceCart(sr, cart, { pricingData, customerEmail: user?.email });
        const coupon = await findCoupon(sr, code);
        const lines = couponCtxLines(pre.resolved);
        const itemsSubtotal = round2(lines.reduce((a: number, l: any) => a + l.subtotal, 0));
        const res = validateCoupon(coupon, {
          lines,
          itemsSubtotal,
          customerEmail: cart.customer_email || user?.email,
          appliedCoupons: pre.validCoupons,
        });
        if (!res.valid) throw new HttpError(400, res.error ?? "Invalid coupon.", res.code);
        await touch(sr, cart, { coupon_codes: [...(cart.coupon_codes || []), code] });
        return ok((await priceCart(sr, cart, { pricingData, customerEmail: user?.email })).view);
      }

      case "remove-coupon": {
        const cart = await loadCart(sr, payload.cart_token);
        const code = String(payload.code || "").toLowerCase().trim();
        await touch(sr, cart, { coupon_codes: (cart.coupon_codes || []).filter((c: string) => c !== code) });
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "set-shipping-address": {
        const cart = await loadCart(sr, payload.cart_token);
        const a = payload.address || {};
        const address = {
          country: a.country ?? "",
          state: a.state ?? "",
          postcode: a.postcode ?? "",
          city: a.city ?? "",
        };
        if (!address.country) throw new HttpError(400, "address.country is required.", "country_required");
        await touch(sr, cart, { shipping_address: address });
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      case "choose-shipping-method": {
        const cart = await loadCart(sr, payload.cart_token);
        const methodId = String(payload.method_id || "");
        const pre = await priceCart(sr, cart, { customerEmail: user?.email });
        if (!pre.view.available_shipping_methods.some((m: any) => m.id === methodId)) {
          throw new HttpError(400, "This shipping method is not available for your address.", "invalid_shipping_method");
        }
        await touch(sr, cart, { chosen_shipping_method: methodId });
        return ok((await priceCart(sr, cart, { customerEmail: user?.email })).view);
      }

      default:
        throw new HttpError(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    return fail(e);
  }
});

/** Shared add-item validation path (used by `create` initial items too). */
async function addItem(sr: any, cart: any, payload: any): Promise<void> {
  const { product_id, variation_id, attributes } = payload;
  let quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const { product, variation } = await loadProductPair(sr, product_id, variation_id);
  if (product.type === "variable" && !variation) {
    throw new HttpError(400, "Please choose product options.", "variation_required");
  }
  if (product.sold_individually) quantity = 1;

  const items = [...(cart.items || [])];
  const existing = items.find(
    (i: any) => i.product_id === product_id && (i.variation_id || "") === (variation_id || ""),
  );
  const newQty = product.sold_individually ? 1 : (existing ? existing.quantity + quantity : quantity);

  const pricing = await loadPricingData(sr);
  const check = checkPurchasable(product, variation, newQty, pricing.settings);
  if (!check.ok) throw new HttpError(400, check.error ?? "Not available.", check.code);

  if (existing) {
    existing.quantity = newQty;
  } else {
    items.push({
      item_key: uuid(),
      product_id,
      variation_id: variation_id ?? "",
      quantity: newQty,
      attributes: attributes ?? (variation?.attributes ?? []),
    });
  }
  const expires_at = cartExpiry();
  await sr.entities["commerce.Cart"].update(cart.id, { items, expires_at });
  cart.items = items;
  cart.expires_at = expires_at;
}
