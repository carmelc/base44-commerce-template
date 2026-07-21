/**
 * Stock management with Woo semantics:
 * - purchasability checks (status, stock/backorders, sold_individually)
 * - reduce/restore around the order lifecycle, guarded by order.stock_reduced
 *   (this module mutates the in-memory flag; orders.ts persists it)
 * - variation-aware: variation.manage_stock "yes" | "no" | "parent"
 * - threshold-crossing low/out-of-stock notifications
 * - expired-hold release (replaces Woo's wc_reserved_stock table; invoked
 *   opportunistically since Base44 has no cron)
 */
import { sendStockEmail } from "./emails.ts";
import { getSettings } from "./settings.ts";

export interface PurchasableResult {
  ok: boolean;
  error?: string;
  code?: string;
}

/** Where does stock live for this product/variation combo? */
function stockTarget(product: any, variation?: any): { entity: string; record: any } | null {
  if (variation) {
    const mode = variation.manage_stock ?? "parent";
    if (mode === "yes") return { entity: "ProductVariation", record: variation };
    if (mode === "parent") {
      return product?.manage_stock ? { entity: "Product", record: product } : null;
    }
    return null; // "no": status-only tracking on the variation
  }
  return product?.manage_stock ? { entity: "Product", record: product } : null;
}

function effectiveBackorders(product: any, variation?: any): string {
  if (variation && (variation.manage_stock ?? "parent") === "yes") {
    return variation.backorders ?? "no";
  }
  return product?.backorders ?? "no";
}

/** Derive stock_status from a quantity (Woo derivation). */
export function deriveStockStatus(qty: number, backorders: string, outOfStockThreshold = 0): string {
  if (qty <= outOfStockThreshold) {
    return backorders !== "no" ? "onbackorder" : "outofstock";
  }
  return "instock";
}

/**
 * Can `qty` of this product/variation be bought right now?
 * Codes: not_published | variation_required | not_purchasable | sold_individually |
 * out_of_stock | insufficient_stock
 */
export function checkPurchasable(product: any, variation: any | undefined, qty: number, settings: Record<string, any>): PurchasableResult {
  if (!product || product.status !== "publish") {
    return { ok: false, code: "not_published", error: "This product is not available." };
  }
  if (product.type === "variable" && !variation) {
    return { ok: false, code: "variation_required", error: "Please choose product options." };
  }
  if (variation && variation.status && variation.status !== "publish") {
    return { ok: false, code: "not_published", error: "This product option is not available." };
  }
  if (product.type === "external") {
    return { ok: false, code: "not_purchasable", error: "This product can only be purchased on an external site." };
  }
  const src = variation ?? product;
  if (src.price === undefined || src.price === null) {
    return { ok: false, code: "not_purchasable", error: "This product cannot be purchased (no price set)." };
  }
  if (product.sold_individually && qty > 1) {
    return { ok: false, code: "sold_individually", error: "Only one of this product may be purchased per order." };
  }

  const target = stockTarget(product, variation);
  const backorders = effectiveBackorders(product, variation);
  if (target) {
    const available = Number(target.record.stock_quantity ?? 0);
    if (qty > available && backorders === "no") {
      return available <= 0
        ? { ok: false, code: "out_of_stock", error: "This product is out of stock." }
        : { ok: false, code: "insufficient_stock", error: `Only ${available} left in stock.` };
    }
  } else {
    const status = (variation?.stock_status ?? product.stock_status) || "instock";
    if (status === "outofstock") {
      return { ok: false, code: "out_of_stock", error: "This product is out of stock." };
    }
  }
  return { ok: true };
}

interface StockOpts {
  settings?: Record<string, any>;
}

/**
 * Reduce stock for every line of an order. No-op if order.stock_reduced.
 * Mutates order.stock_reduced=true in memory (caller persists), bumps
 * Product.total_sales, and fires low/out-of-stock notifications on
 * threshold crossings.
 */
export async function reduceStock(sr: any, order: any, opts: StockOpts = {}): Promise<void> {
  if (order.stock_reduced) return;
  const settings = opts.settings ?? (await getSettings(sr, "inventory", "emails", "general"));
  const inv = settings.inventory ?? {};
  const outThreshold = Number(inv.out_of_stock_threshold ?? 0);
  const defaultLow = Number(inv.low_stock_threshold ?? 2);

  for (const line of order.line_items || []) {
    const { product, variation } = await loadLineProducts(sr, line);
    if (!product) continue;

    const target = stockTarget(product, variation);
    if (target) {
      const before = Number(target.record.stock_quantity ?? 0);
      const after = before - line.quantity;
      const backorders = effectiveBackorders(product, variation);
      const status = deriveStockStatus(after, backorders, outThreshold);
      await sr.entities[target.entity].update(target.record.id, {
        stock_quantity: after,
        stock_status: status,
      });
      target.record.stock_quantity = after;
      target.record.stock_status = status;

      // threshold-crossing notifications (once per crossing)
      const low = Number(target.record.low_stock_amount ?? defaultLow);
      if (after <= outThreshold && before > outThreshold) {
        await sendStockEmail(sr, "out_of_stock", { ...product, stock_quantity: after }, { settings });
      } else if (after <= low && before > low) {
        await sendStockEmail(sr, "low_stock", { ...product, stock_quantity: after }, { settings });
      }
    }

    // units sold live on the parent product regardless of variation
    await sr.entities.Product.update(product.id, {
      total_sales: (product.total_sales ?? 0) + line.quantity,
    });
  }
  order.stock_reduced = true;
}

/**
 * Restore stock for every line (cancel/fail flows). No-op unless
 * order.stock_reduced. Mutates order.stock_reduced=false in memory.
 */
export async function restoreStock(sr: any, order: any, opts: StockOpts = {}): Promise<void> {
  if (!order.stock_reduced) return;
  const settings = opts.settings ?? (await getSettings(sr, "inventory"));
  const outThreshold = Number(settings.inventory?.out_of_stock_threshold ?? 0);

  for (const line of order.line_items || []) {
    const { product, variation } = await loadLineProducts(sr, line);
    if (!product) continue;
    await restoreLineQuantity(sr, product, variation, line.quantity, outThreshold);
    await sr.entities.Product.update(product.id, {
      total_sales: Math.max(0, (product.total_sales ?? 0) - line.quantity),
    });
  }
  order.stock_reduced = false;
}

/**
 * Restock a specific quantity for one line (refund-with-restock flow).
 * Does NOT touch total_sales or the stock_reduced flag.
 */
export async function restockLine(sr: any, line: any, quantity: number, opts: StockOpts = {}): Promise<void> {
  const settings = opts.settings ?? (await getSettings(sr, "inventory"));
  const outThreshold = Number(settings.inventory?.out_of_stock_threshold ?? 0);
  const { product, variation } = await loadLineProducts(sr, line);
  if (!product) return;
  await restoreLineQuantity(sr, product, variation, quantity, outThreshold);
}

async function restoreLineQuantity(sr: any, product: any, variation: any | undefined, quantity: number, outThreshold: number): Promise<void> {
  const target = stockTarget(product, variation);
  if (!target) return;
  const after = Number(target.record.stock_quantity ?? 0) + quantity;
  const backorders = effectiveBackorders(product, variation);
  await sr.entities[target.entity].update(target.record.id, {
    stock_quantity: after,
    stock_status: deriveStockStatus(after, backorders, outThreshold),
  });
  target.record.stock_quantity = after;
}

async function loadLineProducts(sr: any, line: any): Promise<{ product: any | null; variation?: any }> {
  let product: any = null;
  let variation: any = undefined;
  try {
    if (line.product_id) product = await sr.entities.Product.get(line.product_id);
  } catch { product = null; }
  try {
    if (line.variation_id) variation = await sr.entities.ProductVariation.get(line.variation_id);
  } catch { variation = undefined; }
  return { product, variation };
}

/**
 * Cancel pending orders whose stock hold expired, releasing their stock.
 * `transitionFn` is orders.ts transitionOrder (passed in to avoid a circular
 * import). Returns how many orders were released.
 */
export async function releaseExpiredHolds(
  sr: any,
  settings: Record<string, any> | null,
  transitionFn: (sr: any, order: any, status: string, opts?: any) => Promise<any>,
): Promise<number> {
  const now = Date.now();
  let released = 0;
  let skip = 0;
  while (true) {
    const page = (await sr.entities.Order.filter({ status: "pending", stock_reduced: true }, "-created_date", 200, skip)) ?? [];
    for (const order of page) {
      if (order.hold_expires_at && new Date(order.hold_expires_at).getTime() < now) {
        await transitionFn(sr, order, "cancelled", {
          note: "Unpaid order — stock hold expired and the order was cancelled automatically.",
          settings: settings ?? undefined,
        });
        released++;
      }
    }
    if (page.length < 200) break;
    skip += 200;
  }
  return released;
}
