/**
 * Tax-rate matching and application, following standard commerce tax semantics:
 * - rates match by tax class + location (empty field = wildcard)
 * - rates sort by priority asc; ONE rate applies per priority level
 * - non-compound rates apply on the base amount; compound rates apply on
 *   (base + all previously accumulated tax), in priority order
 */
import { round2 } from "./money.ts";

export interface TaxAddress {
  country?: string;
  state?: string;
  postcode?: string;
  city?: string;
}

/** Does `postcode` match `pattern`? Supports exact, `90*` wildcard, `1000...2000` numeric range. */
export function postcodeMatchesPattern(pattern: string, postcode: string): boolean {
  const p = (pattern || "").trim().toUpperCase();
  const pc = (postcode || "").trim().toUpperCase();
  if (!p) return true; // empty pattern = wildcard
  if (!pc) return false;
  if (p.includes("...")) {
    const [lo, hi] = p.split("...").map((s) => parseInt(s.trim(), 10));
    const n = parseInt(pc, 10);
    return !Number.isNaN(lo) && !Number.isNaN(hi) && !Number.isNaN(n) && n >= lo && n <= hi;
  }
  if (p.includes("*")) {
    const re = new RegExp("^" + p.split("*").map(escapeRegex).join(".*") + "$");
    return re.test(pc);
  }
  return p === pc;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rateMatchesLocation(rate: any, addr: TaxAddress): boolean {
  const country = (addr.country || "").toUpperCase();
  const state = (addr.state || "").toUpperCase();
  const city = (addr.city || "").toLowerCase();
  if (rate.country && rate.country.toUpperCase() !== country) return false;
  if (rate.state && rate.state.toUpperCase() !== state) return false;
  const postcodes: string[] = rate.postcodes || [];
  if (postcodes.length && !postcodes.some((p: string) => postcodeMatchesPattern(p, addr.postcode || ""))) return false;
  const cities: string[] = rate.cities || [];
  if (cities.length && !cities.some((c: string) => (c || "").toLowerCase() === city)) return false;
  return true;
}

/**
 * Find the applicable rates for a tax class at an address.
 * Sorted by priority asc (menu_order breaks ties); one rate per priority.
 */
export function matchTaxRates(allRates: any[], addr: TaxAddress, taxClass: string): any[] {
  const cls = taxClass || "standard";
  const candidates = (allRates || [])
    .filter((r) => (r.tax_class || "standard") === cls && rateMatchesLocation(r, addr))
    .sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1) || (a.menu_order ?? 0) - (b.menu_order ?? 0));
  // only the first matching rate per priority level applies
  const byPriority = new Map<number, any>();
  for (const r of candidates) {
    const p = r.priority ?? 1;
    if (!byPriority.has(p)) byPriority.set(p, r);
  }
  return [...byPriority.values()];
}

export interface AppliedRate {
  rate: any;
  amount: number;
}

/**
 * Apply matched rates (already priority-deduped, priority-ordered) to an
 * ex-tax amount. Non-compound rates each apply on the base; compound rates
 * apply on base + accumulated tax so far.
 */
export function applyRates(amount: number, rates: any[]): AppliedRate[] {
  const base = Number(amount) || 0;
  const out: AppliedRate[] = [];
  let accumulated = 0;
  for (const rate of rates || []) {
    const pct = (Number(rate.rate) || 0) / 100;
    const taxable = rate.compound ? base + accumulated : base;
    const tax = round2(taxable * pct);
    accumulated += tax;
    out.push({ rate, amount: tax });
  }
  return out;
}

export interface InclusiveTaxResult {
  net: number;
  taxes: AppliedRate[];
  totalTax: number;
}

/**
 * Extract tax from a tax-INCLUSIVE gross amount (prices_include_tax mode),
 * mirroring standard inclusive-tax extraction: compound rates are unwound from the
 * outside in (last priority first), then the remaining amount is split across
 * the non-compound rates which all share the same net base.
 */
export function extractInclusiveTax(gross: number, rates: any[]): InclusiveTaxResult {
  let remaining = Number(gross) || 0;
  const taxesByRate = new Map<any, number>();

  // 1) unwind compound rates, highest priority (applied last) first
  const compound = (rates || []).filter((r) => r.compound).reverse();
  for (const rate of compound) {
    const pct = (Number(rate.rate) || 0) / 100;
    const tax = round2(remaining - remaining / (1 + pct));
    taxesByRate.set(rate, tax);
    remaining -= tax;
  }

  // 2) the non-compound rates all apply on the same net base
  const regular = (rates || []).filter((r) => !r.compound);
  const regularSum = regular.reduce((a, r) => a + (Number(r.rate) || 0) / 100, 0);
  const net = regularSum > 0 ? remaining / (1 + regularSum) : remaining;
  for (const rate of regular) {
    const pct = (Number(rate.rate) || 0) / 100;
    taxesByRate.set(rate, round2(net * pct));
  }

  const taxes: AppliedRate[] = (rates || []).map((rate) => ({ rate, amount: taxesByRate.get(rate) ?? 0 }));
  const totalTax = round2(taxes.reduce((a, t) => a + t.amount, 0));
  return { net: round2((Number(gross) || 0) - totalTax), taxes, totalTax };
}

/** Sum of applied-rate amounts, rounded. */
export function sumTax(applied: AppliedRate[]): number {
  return round2((applied || []).reduce((a, t) => a + t.amount, 0));
}
