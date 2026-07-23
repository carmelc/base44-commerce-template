/**
 * commerce/admin-orders internals: catalog loading, item resolution and the
 * order (re)pricing pipeline shared by create / update / recalculate /
 * apply-coupon / remove-coupon.
 */
import { calculateTotals } from "../../../shared/commerce/totals.ts";
import { getSettings } from "../../../shared/commerce/settings.ts";
import { scanAll } from "../../../shared/commerce/scan.ts";
import { HttpError } from "../../../shared/commerce/auth.ts";
import { round2 } from "../../../shared/commerce/money.ts";
import { uuid } from "../../../shared/commerce/sequence.ts";

export interface PricingContext {
  settings: Record<string, any>;
  taxRates: any[];
  zones: any[];
  zoneMethods: any[];
}

/** Everything calculateTotals needs from the catalog, in one fetch. */
export async function loadPricingContext(sr: any): Promise<PricingContext> {
  const [settings, taxRates, zones, zoneMethods] = await Promise.all([
    getSettings(sr),
    scanAll(sr.entities["commerce.TaxRate"], null, "menu_order"),
    scanAll(sr.entities["commerce.ShippingZone"], null, "order"),
    scanAll(sr.entities["commerce.ShippingZoneMethod"], null, "order"),
  ]);
  return { settings, taxRates, zones, zoneMethods };
}

export interface ItemSpec {
  product_id: string;
  variation_id?: string;
  quantity: number;
  /** Admin manual unit price (ex-tax). Overrides the catalog price. */
  price_override?: number;
  attributes?: Array<{ name: string; option: string }>;
  meta_data?: Array<{ key: string; value: string }>;
}

/**
 * Resolve item specs to {product, variation, quantity} inputs for the totals
 * engine. price_override works by cloning the priced record — the engine
 * reads `.price` off the variation ?? product.
 */
export async function resolveItems(sr: any, items: ItemSpec[]): Promise<any[]> {
  const out: any[] = [];
  for (const spec of items ?? []) {
    if (!spec.product_id || !spec.quantity) continue;
    const product = await sr.entities["commerce.Product"].get(spec.product_id);
    if (!product) throw new HttpError(400, `Product ${spec.product_id} not found`, "product_not_found");
    let variation: any = undefined;
    if (spec.variation_id) {
      variation = await sr.entities["commerce.ProductVariation"].get(spec.variation_id);
      if (!variation) throw new HttpError(400, `Variation ${spec.variation_id} not found`, "variation_not_found");
    }
    if (spec.price_override != null) {
      if (variation) variation = { ...variation, price: round2(Number(spec.price_override)) };
      else Object.assign(product, { price: round2(Number(spec.price_override)) });
    }
    out.push({
      product,
      variation,
      quantity: Number(spec.quantity),
      attributes: spec.attributes ?? variation?.attributes?.map((a: any) => ({ name: a.name, option: a.option })) ?? [],
      meta_data: spec.meta_data ?? [],
    });
  }
  return out;
}

/** Load Coupon records for a list of codes (unknown codes are skipped). */
export async function resolveCoupons(sr: any, codes: string[]): Promise<any[]> {
  const out: any[] = [];
  for (const code of codes ?? []) {
    const hits = (await sr.entities["commerce.Coupon"].filter({ code: String(code).toLowerCase() }, undefined, 1)) ?? [];
    if (hits[0]) out.push(hits[0]);
  }
  return out;
}

export async function gatewayTitle(sr: any, slug: string): Promise<string> {
  if (!slug) return "";
  const hits = (await sr.entities["commerce.PaymentGateway"].filter({ slug }, undefined, 1)) ?? [];
  return hits[0]?.title ?? slug;
}

/** Map a TotalsResult (+ existing order fields) onto Order entity fields. */
export function totalsToOrderFields(totals: any): Record<string, any> {
  return {
    prices_include_tax: totals.prices_include_tax,
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
  };
}

export interface RepriceOpts {
  /** Item specs; defaults to the order's current line_items (catalog-priced,
   * preserving stored unit price as an override so manual pricing survives). */
  items?: ItemSpec[];
  /** Coupon codes; defaults to the order's current coupon_lines codes. */
  couponCodes?: string[];
  /** Fees; defaults to the order's current fee_lines. */
  fees?: Array<{ name: string; amount: number; tax_class?: string; tax_status?: string }>;
  billing?: any;
  shipping?: any;
  chosenShippingMethodId?: string;
  /**
   * Admin manual shipping lines (arbitrary title + cost) that the zone/method
   * engine can't represent. When provided (and no chosenShippingMethodId),
   * these REPLACE zone-computed shipping verbatim. An empty array means "no
   * shipping". Ignored when chosenShippingMethodId is set (that wins).
   */
  manualShippingLines?: Array<{ method_title?: string; total: number; total_tax?: number; method_id?: string }>;
  /** Re-price lines from the current catalog instead of stored unit prices. */
  repriceFromCatalog?: boolean;
  ctx?: PricingContext;
}

/**
 * Re-run the totals engine for an order and return {fields, totals, coupons}.
 * Preserves the order's shipping line when its zone-method no longer resolves
 * (manual/legacy shipping) by re-adding it verbatim and adjusting totals.
 */
export async function repriceOrder(sr: any, order: any, opts: RepriceOpts = {}): Promise<{ fields: Record<string, any>; totals: any; coupons: any[] }> {
  const ctx = opts.ctx ?? (await loadPricingContext(sr));

  const itemSpecs: ItemSpec[] = opts.items ?? (order.line_items ?? []).map((l: any) => ({
    product_id: l.product_id,
    variation_id: l.variation_id || undefined,
    quantity: l.quantity,
    // Use the PRE-discount unit price (subtotal/qty) as the override so coupons
    // re-apply exactly once. `l.price` is post-discount, so using it here would
    // double-apply discounts on every reprice. Fall back to l.price if subtotal
    // is missing. Skipped entirely when repricing from the live catalog.
    price_override: opts.repriceFromCatalog
      ? undefined
      : (l.subtotal != null && l.quantity ? round2(l.subtotal / l.quantity) : l.price),
    attributes: l.attributes,
    meta_data: l.meta_data,
  }));
  const items = await resolveItems(sr, itemSpecs);

  const couponCodes = opts.couponCodes ?? (order.coupon_lines ?? []).map((c: any) => c.code);
  const coupons = await resolveCoupons(sr, couponCodes);

  const fees = opts.fees ?? (order.fee_lines ?? []).map((f: any) => ({
    name: f.name,
    amount: f.total,
    tax_class: f.tax_class,
    tax_status: f.tax_status,
  }));

  // Manual shipping mode: caller passed explicit lines and no zone method.
  const manualMode = opts.manualShippingLines !== undefined && !opts.chosenShippingMethodId;
  const chosen = opts.chosenShippingMethodId ??
    (manualMode ? undefined : order.shipping_lines?.[0]?.instance_id) ?? undefined;

  const totals = calculateTotals({
    items,
    coupons,
    fees,
    billing: opts.billing ?? order.billing,
    shipping_address: opts.shipping ?? order.shipping ?? order.billing,
    chosenShippingMethodId: chosen,
    settings: ctx.settings,
    taxRates: ctx.taxRates,
    zones: ctx.zones,
    zoneMethods: ctx.zoneMethods,
  });

  if (manualMode) {
    // Replace zone-computed shipping (empty, since chosen is undefined) with the
    // admin's manual lines verbatim and fold their cost/tax into the totals.
    const manual = (opts.manualShippingLines ?? []).map((s) => ({
      line_id: uuid(),
      method_id: s.method_id ?? "manual",
      instance_id: "",
      method_title: s.method_title ?? "Shipping",
      total: round2(Number(s.total) || 0),
      total_tax: round2(Number(s.total_tax) || 0),
      taxes: [],
    }));
    const mTotal = round2(manual.reduce((a, s) => a + s.total, 0));
    const mTax = round2(manual.reduce((a, s) => a + s.total_tax, 0));
    totals.shipping_lines = manual;
    totals.shipping_total = mTotal;
    totals.shipping_tax = mTax;
    totals.total_tax = round2(totals.total_tax + mTax);
    totals.total = round2(totals.total + mTotal + mTax);
  } else if (!totals.shipping_lines.length && (order.shipping_lines ?? []).length && !opts.chosenShippingMethodId) {
    // legacy/manual shipping line: zone method no longer offered → keep it as-is
    const kept = order.shipping_lines;
    const keptTotal = round2(kept.reduce((a: number, s: any) => a + (s.total ?? 0), 0));
    const keptTax = round2(kept.reduce((a: number, s: any) => a + (s.total_tax ?? 0), 0));
    totals.shipping_lines = kept;
    totals.shipping_total = keptTotal;
    totals.shipping_tax = round2(totals.shipping_tax + keptTax);
    totals.total_tax = round2(totals.total_tax + keptTax);
    totals.total = round2(totals.total + keptTotal + keptTax);
  }

  return { fields: totalsToOrderFields(totals), totals, coupons };
}

/** Line-level fields an admin may only touch while the order is unlocked. */
export const LINE_FIELDS = ["items", "fees", "coupon_codes", "chosen_shipping_method", "shipping_lines"];

export function isLocked(order: any): boolean {
  return !["pending", "on-hold"].includes(order.status);
}
