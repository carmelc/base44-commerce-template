/**
 * StoreSettings access. Settings are stored one record per group:
 * { group_id: "general" | "products" | "inventory" | "downloadable" | "tax"
 *           | "shipping" | "accounts" | "emails", values: {...} }
 */

/**
 * Fetch settings groups in one list() call.
 * Returns { [group_id]: values }. Pass no groupIds to get every group.
 * Callers should fetch once per invocation and pass the object around.
 */
export async function getSettings(sr: any, ...groupIds: string[]): Promise<Record<string, any>> {
  const records = (await sr.entities.StoreSettings.list(undefined, 100)) ?? [];
  const out: Record<string, any> = {};
  for (const rec of records) {
    if (!rec?.group_id) continue;
    if (groupIds.length && !groupIds.includes(rec.group_id)) continue;
    out[rec.group_id] = rec.values ?? {};
  }
  return out;
}

/** Read one key from a fetched groups object with a fallback. */
export function getSetting(groups: Record<string, any>, group: string, key: string, fallback?: any): any {
  const v = groups?.[group]?.[key];
  return v === undefined || v === null ? fallback : v;
}

/**
 * Project only the settings that are safe to expose to anonymous storefront
 * callers (used by storefront-catalog `get-store-info`). Never expose the
 * emails group, notification recipients, or internal thresholds.
 */
export function storefrontSafeSettings(groups: Record<string, any>): Record<string, any> {
  const general = groups.general ?? {};
  const products = groups.products ?? {};
  const tax = groups.tax ?? {};
  const accounts = groups.accounts ?? {};
  const inventory = groups.inventory ?? {};
  return {
    store_name: general.store_name ?? "",
    currency: general.currency ?? "USD",
    currency_position: general.currency_position ?? "left",
    thousand_sep: general.thousand_sep ?? ",",
    decimal_sep: general.decimal_sep ?? ".",
    num_decimals: general.num_decimals ?? 2,
    enable_taxes: general.enable_taxes ?? true,
    enable_coupons: general.enable_coupons ?? true,
    weight_unit: products.weight_unit ?? "kg",
    dimension_unit: products.dimension_unit ?? "cm",
    enable_reviews: products.enable_reviews ?? true,
    review_rating_required: products.review_rating_required ?? true,
    prices_include_tax: tax.prices_include_tax ?? false,
    display_prices_shop: tax.display_prices_shop ?? "excl",
    display_prices_cart: tax.display_prices_cart ?? "excl",
    guest_checkout: accounts.guest_checkout ?? true,
    hide_out_of_stock: inventory.hide_out_of_stock ?? false,
  };
}
