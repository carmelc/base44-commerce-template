/**
 * Shipping-zone matching and method cost computation (standard commerce semantics):
 * - zones are checked in `order` asc; the first matching zone wins
 * - region locations (continent/country/state) OR together; postcode locations
 *   act as an AND filter on top (a zone with only postcode locations matches
 *   any region but requires a postcode hit)
 * - a zone with NO locations is the "Rest of the world" fallback, used only
 *   when no located zone matches
 */
import { round2 } from "./money.ts";
import { postcodeMatchesPattern } from "./tax.ts";
import { continentOf } from "./data/continents.ts";

export interface ShipAddress {
  country?: string;
  state?: string;
  postcode?: string;
  city?: string;
}

/** Re-export for callers that only import shipping.ts. */
export function postcodeMatches(pattern: string, postcode: string): boolean {
  return postcodeMatchesPattern(pattern, postcode);
}

function zoneMatches(zone: any, addr: ShipAddress): boolean {
  const locations: any[] = zone.locations || [];
  if (!locations.length) return false; // fallback zones handled by caller
  const country = (addr.country || "").toUpperCase();
  const state = (addr.state || "").toUpperCase();
  const stateCode = country && state ? `${country}:${state}` : "";

  const regions = locations.filter((l) => l.type !== "postcode");
  const postcodes = locations.filter((l) => l.type === "postcode");

  let regionOk = regions.length === 0; // postcode-only zone: no region restriction
  for (const loc of regions) {
    const code = (loc.code || "").toUpperCase();
    if (loc.type === "continent" && continentOf(country)?.code === code) regionOk = true;
    if (loc.type === "country" && code === country) regionOk = true;
    if (loc.type === "state" && code === stateCode) regionOk = true;
    if (regionOk) break;
  }
  if (!regionOk) return false;

  if (postcodes.length) {
    return postcodes.some((loc) => postcodeMatchesPattern(loc.code || "", addr.postcode || ""));
  }
  return true;
}

/**
 * Pick the shipping zone for an address: first located zone (by `order` asc)
 * that matches, else the fallback zone (empty locations — "Rest of the world"),
 * else null.
 */
export function matchZone(zones: any[], addr: ShipAddress): any | null {
  const sorted = [...(zones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const zone of sorted) {
    if ((zone.locations || []).length && zoneMatches(zone, addr)) return zone;
  }
  return sorted.find((z) => !(z.locations || []).length) ?? null;
}

export interface PricedCartForShipping {
  /** Lines with shipping_class_id + discounted totals (ex tax). */
  lines: Array<{
    shipping_class_id?: string;
    virtual?: boolean;
    quantity: number;
    subtotal: number;
    total: number;
  }>;
  itemsSubtotal: number;            // pre-discount, ex tax
  itemsSubtotalAfterDiscount: number; // post-discount, ex tax
}

export interface AvailableMethod {
  method: any;
  cost: number;
}

function flatRateCost(method: any, cart: PricedCartForShipping): number {
  const s = method.settings || {};
  let cost = Number(s.cost) || 0;
  const classCosts: any[] = s.class_costs || [];
  const noClassCost = Number(s.no_class_cost) || 0;
  const shippable = cart.lines.filter((l) => !l.virtual);
  const classesPresent = [...new Set(shippable.filter((l) => l.shipping_class_id).map((l) => l.shipping_class_id))];
  const hasClassless = shippable.some((l) => !l.shipping_class_id);

  const applicable: number[] = [];
  for (const clsId of classesPresent) {
    const entry = classCosts.find((c) => c.shipping_class_id === clsId);
    if (entry) applicable.push(Number(entry.cost) || 0);
  }
  if (hasClassless && noClassCost) applicable.push(noClassCost);

  if ((s.calculation_type || "class") === "class") {
    // "Charge shipping for each class individually"
    cost += applicable.reduce((a, b) => a + b, 0);
  } else if (applicable.length) {
    // "order": charge based on the most expensive class in the cart
    cost += Math.max(...applicable);
  }
  return round2(cost);
}

function freeShippingAvailable(method: any, cart: PricedCartForShipping, appliedCoupons: any[]): boolean {
  const s = method.settings || {};
  const requires = s.requires || "";
  if (!requires) return true;
  const hasCoupon = (appliedCoupons || []).some((c) => c?.free_shipping);
  const basis = s.ignore_discounts ? cart.itemsSubtotal : cart.itemsSubtotalAfterDiscount;
  const minOk = basis >= (Number(s.min_amount) || 0);
  switch (requires) {
    case "coupon": return hasCoupon;
    case "min_amount": return minOk;
    case "either": return hasCoupon || minOk;
    case "both": return hasCoupon && minOk;
    default: return true;
  }
}

/**
 * Compute the offer-able methods (with costs) for a matched zone.
 * `methods` = the zone's ShippingZoneMethod records (any order); disabled and
 * unmet-requirement methods are excluded. Free-shipping coupons only *enable*
 * the free_shipping method — they never zero out flat rates (intended behavior).
 */
export function availableMethods(
  zone: any,
  methods: any[],
  cart: PricedCartForShipping,
  _settings: Record<string, any>,
  appliedCoupons: any[] = [],
): AvailableMethod[] {
  const zoneMethods = (methods || [])
    .filter((m) => m.zone_id === zone?.id && m.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: AvailableMethod[] = [];
  for (const method of zoneMethods) {
    switch (method.method_id) {
      case "flat_rate":
        out.push({ method, cost: flatRateCost(method, cart) });
        break;
      case "free_shipping":
        if (freeShippingAvailable(method, cart, appliedCoupons)) out.push({ method, cost: 0 });
        break;
      case "local_pickup":
        out.push({ method, cost: round2(Number(method.settings?.cost) || 0) });
        break;
      default:
        // unknown custom method: offer at its configured flat cost
        out.push({ method, cost: round2(Number(method.settings?.cost) || 0) });
    }
  }
  return out;
}
