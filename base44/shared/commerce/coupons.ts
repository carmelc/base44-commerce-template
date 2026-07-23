/**
 * Coupon validation and discount application (standard commerce semantics).
 * Validation runs the ordered checks from the plan; application supports
 * percent / fixed_cart / fixed_product with the standard eligibility rules.
 */
import { distributeProportionally, round2 } from "./money.ts";

export interface CouponLineInput {
  line_id: string;
  product_id: string;
  variation_id?: string;
  quantity: number;
  unit_price: number;   // ex-tax unit price
  subtotal: number;     // ex-tax pre-discount line total
  discount: number;     // accumulated so far (mutated by applyCoupons)
  product?: any;        // resolved Product (category_ids, on_sale)
  variation?: any;
}

export interface CouponValidationCtx {
  lines: CouponLineInput[];
  itemsSubtotal: number;
  customerEmail?: string;
  appliedCoupons?: any[]; // other coupons already in the cart
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

function emailMatchesRestriction(email: string, patterns: string[]): boolean {
  const e = (email || "").toLowerCase();
  return (patterns || []).some((p) => {
    const pat = (p || "").toLowerCase().trim();
    if (!pat) return false;
    const re = new RegExp(
      "^" + pat.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$",
    );
    return re.test(e);
  });
}

/** Lines a coupon can touch: include-lists intersect, exclude-lists subtract. */
export function eligibleLines(coupon: any, lines: CouponLineInput[]): CouponLineInput[] {
  let out = [...(lines || [])];
  const inclProducts: string[] = coupon.product_ids || [];
  const exclProducts: string[] = coupon.excluded_product_ids || [];
  const inclCats: string[] = coupon.product_category_ids || [];
  const exclCats: string[] = coupon.excluded_product_category_ids || [];

  if (inclProducts.length) {
    out = out.filter((l) => inclProducts.includes(l.product_id) || (l.variation_id && inclProducts.includes(l.variation_id)));
  }
  if (exclProducts.length) {
    out = out.filter((l) => !exclProducts.includes(l.product_id) && !(l.variation_id && exclProducts.includes(l.variation_id)));
  }
  if (inclCats.length) {
    out = out.filter((l) => (l.product?.category_ids || []).some((c: string) => inclCats.includes(c)));
  }
  if (exclCats.length) {
    out = out.filter((l) => !(l.product?.category_ids || []).some((c: string) => exclCats.includes(c)));
  }
  if (coupon.exclude_sale_items) {
    out = out.filter((l) => !(l.variation?.on_sale ?? l.product?.on_sale));
  }
  return out;
}

/**
 * The 9 ordered validation checks. Pass `coupon = null` for a lookup miss.
 * Error codes: not_found | expired | usage_limit_reached |
 * usage_limit_per_user_reached | individual_use | min_amount_not_met |
 * max_amount_exceeded | not_applicable | sale_items_excluded | email_restricted
 */
export function validateCoupon(coupon: any | null, ctx: CouponValidationCtx): CouponValidationResult {
  // 1. exists
  if (!coupon) return { valid: false, code: "not_found", error: "Coupon does not exist." };

  // 2. expiry
  if (coupon.date_expires && new Date(coupon.date_expires).getTime() < Date.now()) {
    return { valid: false, code: "expired", error: "This coupon has expired." };
  }

  // 3. global usage limit
  if (coupon.usage_limit != null && (coupon.usage_count ?? 0) >= coupon.usage_limit) {
    return { valid: false, code: "usage_limit_reached", error: "Coupon usage limit has been reached." };
  }

  // 4. per-user usage limit (usages recorded in used_by, one entry per use)
  if (coupon.usage_limit_per_user != null && ctx.customerEmail) {
    const uses = (coupon.used_by || []).filter(
      (e: string) => (e || "").toLowerCase() === ctx.customerEmail!.toLowerCase(),
    ).length;
    if (uses >= coupon.usage_limit_per_user) {
      return { valid: false, code: "usage_limit_per_user_reached", error: "Coupon usage limit has been reached for your account." };
    }
  }

  // 5. individual use — both directions
  const others = (ctx.appliedCoupons || []).filter((c) => c.code !== coupon.code);
  if (coupon.individual_use && others.length) {
    return { valid: false, code: "individual_use", error: "This coupon cannot be used in conjunction with other coupons." };
  }
  if (others.some((c) => c.individual_use)) {
    return { valid: false, code: "individual_use", error: "An applied coupon does not allow other coupons." };
  }

  // 6. min / max spend (vs items subtotal, ex tax)
  if (coupon.minimum_amount != null && coupon.minimum_amount > 0 && ctx.itemsSubtotal < coupon.minimum_amount) {
    return { valid: false, code: "min_amount_not_met", error: `The minimum spend for this coupon is ${coupon.minimum_amount}.` };
  }
  if (coupon.maximum_amount != null && coupon.maximum_amount > 0 && ctx.itemsSubtotal > coupon.maximum_amount) {
    return { valid: false, code: "max_amount_exceeded", error: `The maximum spend for this coupon is ${coupon.maximum_amount}.` };
  }

  // 7. product/category restrictions must leave something to discount
  const restricted =
    (coupon.product_ids || []).length || (coupon.excluded_product_ids || []).length ||
    (coupon.product_category_ids || []).length || (coupon.excluded_product_category_ids || []).length;
  const withoutSaleFilter = eligibleLines({ ...coupon, exclude_sale_items: false }, ctx.lines);
  if (restricted && !withoutSaleFilter.length) {
    return { valid: false, code: "not_applicable", error: "Sorry, this coupon is not applicable to your cart contents." };
  }

  // 8. exclude_sale_items must still leave eligible lines
  if (coupon.exclude_sale_items && withoutSaleFilter.length && !eligibleLines(coupon, ctx.lines).length) {
    return { valid: false, code: "sale_items_excluded", error: "Sorry, this coupon is not valid for sale items." };
  }

  // 9. email restrictions
  if ((coupon.email_restrictions || []).length) {
    if (!ctx.customerEmail || !emailMatchesRestriction(ctx.customerEmail, coupon.email_restrictions)) {
      return { valid: false, code: "email_restricted", error: "This coupon is not valid for your email address." };
    }
  }

  return { valid: true };
}

export interface CouponLineTotal {
  code: string;
  coupon_id: string;
  discount: number;
  discount_tax: number; // filled in by totals.ts after tax
  free_shipping: boolean;
}

/**
 * Apply coupons in order, mutating each line's `.discount`.
 * `calc_discounts_sequentially` (general settings): when true each coupon sees
 * the line total minus prior discounts; when false all see the original
 * subtotal (the default). Line discounts never exceed the line's remaining value.
 */
export function applyCoupons(
  lines: CouponLineInput[],
  coupons: any[],
  settings: Record<string, any>,
): CouponLineTotal[] {
  const sequential = !!settings?.general?.calc_discounts_sequentially;
  const couponLines: CouponLineTotal[] = [];
  const base = (l: CouponLineInput) => Math.max(0, sequential ? l.subtotal - l.discount : l.subtotal);
  const remaining = (l: CouponLineInput) => Math.max(0, round2(l.subtotal - l.discount));

  for (const coupon of coupons || []) {
    const eligible = eligibleLines(coupon, lines);
    const amount = Number(coupon.amount) || 0;
    let discountTotal = 0;
    const add = (l: CouponLineInput, d: number) => {
      const capped = Math.min(round2(d), remaining(l));
      if (capped <= 0) return;
      l.discount = round2(l.discount + capped);
      discountTotal = round2(discountTotal + capped);
    };

    switch (coupon.discount_type) {
      case "percent": {
        for (const l of eligible) add(l, base(l) * (amount / 100));
        break;
      }
      case "fixed_product": {
        // per-unit discount; limit_usage_to_x_items caps units, priciest first
        let unitsCap = coupon.limit_usage_to_x_items != null ? Number(coupon.limit_usage_to_x_items) : Infinity;
        const sorted = [...eligible].sort((a, b) => b.unit_price - a.unit_price);
        for (const l of sorted) {
          if (unitsCap <= 0) break;
          const units = Math.min(l.quantity, unitsCap);
          const perUnit = Math.min(amount, l.unit_price);
          add(l, perUnit * units);
          unitsCap -= units;
        }
        break;
      }
      case "fixed_cart":
      default: {
        // distribute across eligible lines proportionally, cents-exact
        const weights = eligible.map((l) => base(l));
        const pool = Math.min(amount, weights.reduce((a, b) => a + b, 0));
        const shares = distributeProportionally(pool, weights);
        eligible.forEach((l, i) => add(l, shares[i] ?? 0));
      }
    }

    couponLines.push({
      code: coupon.code,
      coupon_id: coupon.id ?? "",
      discount: discountTotal,
      discount_tax: 0,
      free_shipping: !!coupon.free_shipping,
    });
  }
  return couponLines;
}

/**
 * Record coupon usage for an order (usage_count +1, used_by += billing email
 * per coupon line). Caller guards/persists order.coupon_usages_counted.
 */
export async function countUsage(sr: any, order: any): Promise<void> {
  const email = (order.billing?.email || "").toLowerCase();
  for (const cl of order.coupon_lines || []) {
    const coupon = await findCoupon(sr, cl);
    if (!coupon) continue;
    await sr.entities["commerce.Coupon"].update(coupon.id, {
      usage_count: (coupon.usage_count ?? 0) + 1,
      used_by: [...(coupon.used_by || []), email],
    });
  }
}

/** Reverse of countUsage (removes ONE used_by entry per coupon line). */
export async function uncountUsage(sr: any, order: any): Promise<void> {
  const email = (order.billing?.email || "").toLowerCase();
  for (const cl of order.coupon_lines || []) {
    const coupon = await findCoupon(sr, cl);
    if (!coupon) continue;
    const usedBy = [...(coupon.used_by || [])];
    const idx = usedBy.findIndex((e: string) => (e || "").toLowerCase() === email);
    if (idx >= 0) usedBy.splice(idx, 1);
    await sr.entities["commerce.Coupon"].update(coupon.id, {
      usage_count: Math.max(0, (coupon.usage_count ?? 0) - 1),
      used_by: usedBy,
    });
  }
}

async function findCoupon(sr: any, couponLine: any): Promise<any | null> {
  if (couponLine.coupon_id) {
    try {
      const c = await sr.entities["commerce.Coupon"].get(couponLine.coupon_id);
      if (c) return c;
    } catch { /* fall through to code lookup */ }
  }
  const matches = await sr.entities["commerce.Coupon"].filter({ code: (couponLine.code || "").toLowerCase() }, undefined, 1);
  return matches?.[0] ?? null;
}
