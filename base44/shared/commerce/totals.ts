/**
 * The order totals engine — the single source of truth for pricing math.
 * Used by: commerce/storefront-cart `totals` (preview), commerce/storefront-checkout
 * `place-order` (authoritative), commerce/admin-orders `create`/`recalculate`.
 *
 * Pipeline (Woo semantics): resolve lines → coupons → fees → shipping → tax → totals.
 * All internal math is ex-tax; tax-inclusive catalog prices are netted first.
 */
import { round2, distributeProportionally } from "./money.ts";
import { applyRates, extractInclusiveTax, matchTaxRates, sumTax } from "./tax.ts";
import { availableMethods, matchZone } from "./shipping.ts";
import { applyCoupons } from "./coupons.ts";
import { getSetting } from "./settings.ts";
import { uuid } from "./sequence.ts";

export interface TotalsItem {
  product: any;
  variation?: any;
  quantity: number;
  attributes?: Array<{ name: string; option: string }>;
  meta_data?: Array<{ key: string; value: string }>;
}

export interface TotalsFee {
  name: string;
  amount: number;
  tax_class?: string;
  tax_status?: string; // taxable | none
  line_id?: string;
}

export interface TotalsInput {
  items: TotalsItem[];
  coupons?: any[];  // validated Coupon records, in application order
  fees?: TotalsFee[];
  billing?: any;
  shipping_address?: any;
  chosenShippingMethodId?: string; // ShippingZoneMethod id
  settings: Record<string, any>;   // groups object from getSettings()
  taxRates?: any[];
  zones?: any[];
  zoneMethods?: any[];
}

export interface TotalsResult {
  line_items: any[];
  shipping_lines: any[];
  tax_lines: any[];
  fee_lines: any[];
  coupon_lines: any[];
  subtotal: number;
  discount_total: number;
  discount_tax: number;
  shipping_total: number;
  shipping_tax: number;
  cart_tax: number;
  total_tax: number;
  total: number;
  prices_include_tax: boolean;
  available_shipping_methods: Array<{ id: string; method_id: string; title: string; cost: number }>;
  matched_zone_id: string | null;
}

/** Effective tax class/status with variation "parent" inheritance. */
function effectiveTax(product: any, variation?: any): { tax_class: string; tax_status: string } {
  const status = variation?.tax_status && variation.tax_status !== "parent"
    ? variation.tax_status
    : product.tax_status ?? "taxable";
  const cls = (variation?.tax_class || product.tax_class) ?? "standard";
  return { tax_class: cls, tax_status: status };
}

function resolveTaxAddress(input: TotalsInput): any {
  const basedOn = getSetting(input.settings, "tax", "tax_based_on", "shipping");
  if (basedOn === "billing") return input.billing ?? input.shipping_address ?? {};
  if (basedOn === "base") return getSetting(input.settings, "general", "address", {});
  return input.shipping_address ?? input.billing ?? {}; // "shipping" default
}

/** Run the full totals pipeline. Pure aside from reading its inputs. */
export function calculateTotals(input: TotalsInput): TotalsResult {
  const settings = input.settings ?? {};
  const taxesEnabled = !!getSetting(settings, "general", "enable_taxes", true);
  const pricesIncludeTax = taxesEnabled && !!getSetting(settings, "tax", "prices_include_tax", false);
  const taxRates = input.taxRates ?? [];
  const taxAddress = resolveTaxAddress(input);

  // ── 1. resolve lines (ex-tax) ────────────────────────────────────────────
  const lines = (input.items || []).map((it) => {
    const src = it.variation ?? it.product;
    const { tax_class, tax_status } = effectiveTax(it.product, it.variation);
    const rates = taxesEnabled && tax_status === "taxable" ? matchTaxRates(taxRates, taxAddress, tax_class) : [];
    let unitPrice = Number(src.price ?? it.product?.price ?? 0);
    let subtotal = round2(unitPrice * it.quantity);
    if (pricesIncludeTax && rates.length) {
      const { net } = extractInclusiveTax(subtotal, rates);
      subtotal = net;
      unitPrice = it.quantity ? net / it.quantity : 0;
    }
    return {
      line_id: uuid(),
      product_id: it.product?.id ?? "",
      variation_id: it.variation?.id ?? "",
      name: it.product?.name ?? "",
      sku: (it.variation?.sku || it.product?.sku) ?? "",
      quantity: it.quantity,
      unit_price: unitPrice,
      tax_class,
      tax_status,
      rates,
      subtotal,
      discount: 0,
      total: subtotal,
      subtotal_tax: 0,
      total_tax: 0,
      taxes: [] as any[],
      attributes: it.attributes ?? [],
      meta_data: it.meta_data ?? [],
      shipping_class_id: (it.variation?.shipping_class_id || it.product?.shipping_class_id) ?? "",
      virtual: !!(it.variation?.virtual ?? it.product?.virtual),
      product: it.product,
      variation: it.variation,
    };
  });

  const itemsSubtotal = round2(lines.reduce((a, l) => a + l.subtotal, 0));

  // ── 2. coupons ───────────────────────────────────────────────────────────
  const couponsEnabled = !!getSetting(settings, "general", "enable_coupons", true);
  const coupons = couponsEnabled ? input.coupons ?? [] : [];
  const couponLines = applyCoupons(lines, coupons, settings);
  for (const l of lines) l.total = round2(l.subtotal - l.discount);
  const discountTotal = round2(lines.reduce((a, l) => a + l.discount, 0));
  const itemsAfterDiscount = round2(lines.reduce((a, l) => a + l.total, 0));

  // ── 3. fees ──────────────────────────────────────────────────────────────
  const feeLines = (input.fees || []).map((f) => ({
    line_id: f.line_id ?? uuid(),
    name: f.name,
    tax_class: f.tax_class ?? "standard",
    tax_status: f.tax_status ?? "taxable",
    total: round2(Number(f.amount) || 0),
    total_tax: 0,
    taxes: [] as any[],
  }));

  // ── 4. shipping ──────────────────────────────────────────────────────────
  const shippingEnabled = getSetting(settings, "shipping", "enable_shipping", true) !== false;
  const needsShipping = lines.some((l) => !l.virtual);
  const shippingLines: any[] = [];
  let available: Array<{ id: string; method_id: string; title: string; cost: number }> = [];
  let matchedZoneId: string | null = null;

  if (shippingEnabled && needsShipping && input.shipping_address?.country) {
    const zone = matchZone(input.zones ?? [], input.shipping_address);
    if (zone) {
      matchedZoneId = zone.id ?? null;
      const cart = { lines, itemsSubtotal, itemsSubtotalAfterDiscount: itemsAfterDiscount };
      const offers = availableMethods(zone, input.zoneMethods ?? [], cart, settings, coupons);
      available = offers.map((o) => ({
        id: o.method.id,
        method_id: o.method.method_id,
        title: o.method.title || defaultMethodTitle(o.method.method_id),
        cost: o.cost,
      }));
      if (input.chosenShippingMethodId) {
        const chosen = offers.find((o) => o.method.id === input.chosenShippingMethodId);
        if (chosen) {
          shippingLines.push({
            line_id: uuid(),
            method_id: chosen.method.method_id,
            instance_id: chosen.method.id,
            method_title: chosen.method.title || defaultMethodTitle(chosen.method.method_id),
            total: chosen.cost,
            total_tax: 0,
            taxes: [] as any[],
          });
        }
      }
    }
  }

  // ── 5. tax ───────────────────────────────────────────────────────────────
  // aggregated per rate for order-level tax_lines
  const agg = new Map<string, { rate: any; tax_total: number; shipping_tax_total: number }>();
  const bump = (rate: any, tax: number, shippingTax: number) => {
    const key = rate.id ?? `${rate.name}-${rate.priority}`;
    const cur = agg.get(key) ?? { rate, tax_total: 0, shipping_tax_total: 0 };
    cur.tax_total = round2(cur.tax_total + tax);
    cur.shipping_tax_total = round2(cur.shipping_tax_total + shippingTax);
    agg.set(key, cur);
  };

  if (taxesEnabled) {
    for (const l of lines) {
      if (!l.rates.length) continue;
      const subApplied = applyRates(l.subtotal, l.rates);
      const totApplied = applyRates(l.total, l.rates);
      l.subtotal_tax = sumTax(subApplied);
      l.total_tax = sumTax(totApplied);
      l.taxes = totApplied.map((t, i) => ({
        rate_id: t.rate.id ?? "",
        total: t.amount,
        subtotal: subApplied[i]?.amount ?? 0,
      }));
      for (const t of totApplied) bump(t.rate, t.amount, 0);
    }
    for (const fee of feeLines) {
      if (fee.tax_status !== "taxable") continue;
      const rates = matchTaxRates(taxRates, taxAddress, fee.tax_class);
      const applied = applyRates(fee.total, rates);
      fee.total_tax = sumTax(applied);
      fee.taxes = applied.map((t) => ({ rate_id: t.rate.id ?? "", total: t.amount }));
      for (const t of applied) bump(t.rate, t.amount, 0);
    }
    if (shippingLines.length) {
      // shipping_tax_class "inherit" = first taxable line's class (Woo behavior)
      const cfg = getSetting(settings, "tax", "shipping_tax_class", "inherit");
      const cls = cfg === "inherit"
        ? (lines.find((l) => l.tax_status === "taxable")?.tax_class ?? "standard")
        : cfg;
      const rates = matchTaxRates(taxRates, taxAddress, cls).filter((r) => r.shipping !== false);
      for (const sl of shippingLines) {
        const applied = applyRates(sl.total, rates);
        sl.total_tax = sumTax(applied);
        sl.taxes = applied.map((t) => ({ rate_id: t.rate.id ?? "", total: t.amount }));
        for (const t of applied) bump(t.rate, 0, t.amount);
      }
    }
  }

  // ── 6. totals ────────────────────────────────────────────────────────────
  const cartTax = round2(
    lines.reduce((a, l) => a + l.total_tax, 0) + feeLines.reduce((a, f) => a + f.total_tax, 0),
  );
  const shippingTotal = round2(shippingLines.reduce((a, s) => a + s.total, 0));
  const shippingTax = round2(shippingLines.reduce((a, s) => a + s.total_tax, 0));
  const totalTax = round2(cartTax + shippingTax);
  const feesTotal = round2(feeLines.reduce((a, f) => a + f.total, 0));

  // discount tax = tax saved by the discounts (subtotal tax − total tax per line),
  // allocated across coupon lines proportionally to their discounts
  const discountTax = round2(lines.reduce((a, l) => a + (l.subtotal_tax - l.total_tax), 0));
  if (discountTax > 0 && couponLines.length) {
    const shares = distributeProportionally(discountTax, couponLines.map((c) => c.discount));
    couponLines.forEach((c, i) => { c.discount_tax = shares[i] ?? 0; });
  }

  const total = round2(itemsSubtotal - discountTotal + feesTotal + shippingTotal + totalTax);

  const taxLines = [...agg.values()].map(({ rate, tax_total, shipping_tax_total }) => ({
    rate_id: rate.id ?? "",
    rate_code: buildRateCode(rate),
    label: rate.name ?? "Tax",
    rate_percent: Number(rate.rate) || 0,
    compound: !!rate.compound,
    tax_total,
    shipping_tax_total,
  }));

  return {
    line_items: lines.map(stripLine),
    shipping_lines: shippingLines,
    tax_lines: taxLines,
    fee_lines: feeLines,
    coupon_lines: couponLines,
    subtotal: itemsSubtotal,
    discount_total: discountTotal,
    discount_tax: discountTax,
    shipping_total: shippingTotal,
    shipping_tax: shippingTax,
    cart_tax: cartTax,
    total_tax: totalTax,
    total,
    prices_include_tax: pricesIncludeTax,
    available_shipping_methods: available,
    matched_zone_id: matchedZoneId,
  };
}

/** Convert an engine line to the embedded Order.line_items shape. */
function stripLine(l: any): any {
  return {
    line_id: l.line_id,
    product_id: l.product_id,
    variation_id: l.variation_id,
    name: l.name,
    sku: l.sku,
    quantity: l.quantity,
    price: l.quantity ? round2(l.total / l.quantity) : 0, // post-discount ex-tax unit price
    tax_class: l.tax_class,
    subtotal: l.subtotal,
    subtotal_tax: l.subtotal_tax,
    total: l.total,
    total_tax: l.total_tax,
    taxes: l.taxes,
    attributes: l.attributes,
    meta_data: l.meta_data,
  };
}

function buildRateCode(rate: any): string {
  const parts = [rate.country || "ANY", rate.state || "", (rate.name || "TAX").replace(/\s+/g, "-"), String(rate.priority ?? 1)];
  return parts.filter(Boolean).join("-").toUpperCase();
}

function defaultMethodTitle(methodId: string): string {
  switch (methodId) {
    case "flat_rate": return "Flat rate";
    case "free_shipping": return "Free shipping";
    case "local_pickup": return "Local pickup";
    default: return methodId;
  }
}
