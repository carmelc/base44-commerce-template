/**
 * commerce/admin-reports — on-demand report aggregation over orders.
 * Fine to ~10k orders; larger stores should materialize stats
 * (see skills/commerce/SKILL.md §Reports performance).
 *
 * Actions: summary | sales | top-sellers | stock |
 * orders-totals | products-totals | customers-totals | coupons-totals |
 * reviews-totals | categories-totals | tags-totals | attributes-totals
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../../shared/commerce/auth.ts";
import { round2 } from "../../../shared/commerce/money.ts";
import { getSettings } from "../../../shared/commerce/settings.ts";
import { scanAll } from "../../../shared/commerce/scan.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "summary": return ok(await summary(sr));
      case "sales": return ok(await sales(sr, payload));
      case "top-sellers": return ok(await topSellers(sr, payload));
      case "stock": return ok(await stockReport(sr));
      case "orders-totals": return ok(await ordersTotals(sr));
      case "products-totals": return ok(await groupCount(sr.entities["commerce.Product"], "type"));
      case "customers-totals": return ok(await customersTotals(sr));
      case "coupons-totals": return ok(await groupCount(sr.entities["commerce.Coupon"], "discount_type"));
      case "reviews-totals": return ok(await groupCount(sr.entities["commerce.ProductReview"], "status"));
      case "categories-totals": return ok(await termTotals(sr.entities["commerce.ProductCategory"]));
      case "tags-totals": return ok(await termTotals(sr.entities["commerce.ProductTag"]));
      case "attributes-totals": return ok(await attributesTotals(sr));
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("commerce/admin-reports error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

// ── shared aggregation ───────────────────────────────────────────────────────

/** An order counts toward sales when it was paid (standard report semantics). */
function isCounted(o: any): boolean {
  return !!o.date_paid || ["processing", "completed"].includes(o.status);
}

function inRange(dateIso: string | undefined, min?: string, max?: string): boolean {
  if (!dateIso) return false;
  if (min && dateIso < min) return false;
  if (max && dateIso > `${max}~`) return false; // '~' > any time suffix
  return true;
}

function bucketKey(dateIso: string, interval: string): string {
  const d = new Date(dateIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (interval === "month") return `${y}-${m}`;
  if (interval === "week") {
    // bucket by the Monday of the week (UTC)
    const monday = new Date(d);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    monday.setUTCDate(d.getUTCDate() - dow);
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
  }
  return `${y}-${m}-${day}`; // day
}

interface SalesAgg {
  gross_sales: number;
  net_sales: number;
  orders: number;
  items: number;
  tax: number;
  shipping: number;
  discount: number;
  refunds: number;
}

const emptyAgg = (): SalesAgg => ({
  gross_sales: 0, net_sales: 0, orders: 0, items: 0, tax: 0, shipping: 0, discount: 0, refunds: 0,
});

function addOrder(agg: SalesAgg, o: any): void {
  agg.gross_sales = round2(agg.gross_sales + (o.total ?? 0));
  agg.orders += 1;
  agg.items += (o.line_items ?? []).reduce((a: number, l: any) => a + (l.quantity ?? 0), 0);
  agg.tax = round2(agg.tax + (o.total_tax ?? 0));
  agg.shipping = round2(agg.shipping + (o.shipping_total ?? 0));
  agg.discount = round2(agg.discount + (o.discount_total ?? 0));
}

function finalizeNet(agg: SalesAgg): void {
  // net = gross − refunds − tax − shipping
  agg.net_sales = round2(agg.gross_sales - agg.refunds - agg.tax - agg.shipping);
}

async function salesAggregation(sr: any, dateMin?: string, dateMax?: string, interval?: string): Promise<{ totals: SalesAgg; series: Array<{ period: string } & SalesAgg> }> {
  const orders = (await scanAll(sr.entities["commerce.Order"])).filter(
    (o) => isCounted(o) && inRange(o.created_date, dateMin, dateMax),
  );
  // refunds counted by refund date (intended behavior)
  const refunds = (await scanAll(sr.entities["commerce.OrderRefund"])).filter(
    (r) => inRange(r.created_date, dateMin, dateMax),
  );

  const totals = emptyAgg();
  const buckets = new Map<string, SalesAgg>();
  const bucketOf = (dateIso: string) => {
    const key = bucketKey(dateIso, interval ?? "day");
    if (!buckets.has(key)) buckets.set(key, emptyAgg());
    return buckets.get(key)!;
  };

  for (const o of orders) {
    addOrder(totals, o);
    if (interval) addOrder(bucketOf(o.created_date), o);
  }
  for (const r of refunds) {
    totals.refunds = round2(totals.refunds + (r.amount ?? 0));
    if (interval) {
      const b = bucketOf(r.created_date);
      b.refunds = round2(b.refunds + (r.amount ?? 0));
    }
  }
  finalizeNet(totals);
  const series = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, agg]) => {
      finalizeNet(agg);
      return { period, ...agg };
    });
  return { totals, series };
}

// ── actions ──────────────────────────────────────────────────────────────────

async function summary(sr: any): Promise<any> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;

  const [todayAgg, monthAgg, statusAgg, stock, top] = await Promise.all([
    salesAggregation(sr, today, today),
    salesAggregation(sr, monthStart, today),
    ordersTotals(sr),
    stockReport(sr),
    topSellers(sr, { date_min: monthStart, date_max: today, limit: 1 }),
  ]);

  return {
    sales_today: todayAgg.totals,
    sales_month: monthAgg.totals,
    orders_by_status: statusAgg,
    low_stock_count: stock.low_stock.length,
    out_of_stock_count: stock.out_of_stock.length,
    top_seller: top.rows[0] ?? null,
  };
}

async function sales(sr: any, payload: any): Promise<any> {
  const { date_min, date_max, interval = "day" } = payload;
  return await salesAggregation(sr, date_min, date_max, interval);
}

async function topSellers(sr: any, payload: any): Promise<any> {
  const { date_min, date_max, limit = 10 } = payload;
  const orders = (await scanAll(sr.entities["commerce.Order"])).filter(
    (o) => isCounted(o) && inRange(o.created_date, date_min, date_max),
  );
  const byProduct = new Map<string, { product_id: string; quantity: number; net_revenue: number }>();
  for (const o of orders) {
    for (const l of o.line_items ?? []) {
      if (!l.product_id) continue;
      const cur = byProduct.get(l.product_id) ?? { product_id: l.product_id, quantity: 0, net_revenue: 0 };
      cur.quantity += l.quantity ?? 0;
      cur.net_revenue = round2(cur.net_revenue + (l.total ?? 0));
      byProduct.set(l.product_id, cur);
    }
  }
  const top = [...byProduct.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, Number(limit));
  for (const row of top as any[]) {
    try {
      const p = await sr.entities["commerce.Product"].get(row.product_id);
      row.name = p?.name ?? "(deleted product)";
      row.sku = p?.sku ?? "";
    } catch { row.name = "(deleted product)"; }
  }
  return { rows: top };
}

async function stockReport(sr: any): Promise<any> {
  const settings = await getSettings(sr, "inventory");
  const defaultLow = Number(settings.inventory?.low_stock_threshold ?? 2);
  const outThreshold = Number(settings.inventory?.out_of_stock_threshold ?? 0);

  const products = await scanAll(sr.entities["commerce.Product"]);
  const variations = await scanAll(sr.entities["commerce.ProductVariation"]);

  const low: any[] = [];
  const out: any[] = [];
  const consider = (rec: any, name: string, isVariation: boolean, parent?: any) => {
    const managed = isVariation ? (rec.manage_stock === "yes") : !!rec.manage_stock;
    const entry = {
      id: rec.id, product_id: isVariation ? rec.product_id : rec.id,
      name, sku: rec.sku ?? "", stock_quantity: rec.stock_quantity ?? null,
      is_variation: isVariation,
    };
    if (managed) {
      const qty = Number(rec.stock_quantity ?? 0);
      const lowAt = Number(rec.low_stock_amount ?? parent?.low_stock_amount ?? defaultLow);
      if (qty <= outThreshold) out.push(entry);
      else if (qty <= lowAt) low.push(entry);
    } else if (rec.stock_status === "outofstock") {
      out.push(entry);
    }
  };

  const byId = new Map(products.map((p) => [p.id, p]));
  for (const p of products) consider(p, p.name, false);
  for (const v of variations) {
    const parent = byId.get(v.product_id);
    const label = `${parent?.name ?? "?"} — ${(v.attributes ?? []).map((a: any) => a.option).join(" / ")}`;
    consider(v, label, true, parent);
  }
  return { low_stock: low, out_of_stock: out };
}

async function ordersTotals(sr: any): Promise<Record<string, number>> {
  const orders = await scanAll(sr.entities["commerce.Order"], null, "-created_date", { fields: ["id", "status"] });
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return counts;
}

async function customersTotals(sr: any): Promise<any> {
  const customers = await scanAll(sr.entities["commerce.Customer"], null, "-created_date", { fields: ["id", "is_guest", "is_paying_customer"] });
  return {
    total: customers.length,
    guests: customers.filter((c) => c.is_guest).length,
    registered: customers.filter((c) => !c.is_guest).length,
    paying: customers.filter((c) => c.is_paying_customer).length,
  };
}

async function groupCount(entityApi: any, field: string): Promise<any> {
  const rows = await scanAll(entityApi, null, "-created_date", { fields: ["id", field] });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const key = r[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return { total: rows.length, by: counts };
}

async function termTotals(entityApi: any): Promise<any> {
  const rows = await scanAll(entityApi, null, "-created_date", { fields: ["id", "name", "count"] });
  return { total: rows.length, terms: rows.map((r) => ({ id: r.id, name: r.name, count: r.count ?? 0 })) };
}

async function attributesTotals(sr: any): Promise<any> {
  const attrs = await scanAll(sr.entities["commerce.ProductAttribute"]);
  const terms = await scanAll(sr.entities["commerce.ProductAttributeTerm"], null, "-created_date", { fields: ["id", "attribute_id"] });
  const byAttr: Record<string, number> = {};
  for (const t of terms) byAttr[t.attribute_id] = (byAttr[t.attribute_id] ?? 0) + 1;
  return {
    total: attrs.length,
    attributes: attrs.map((a) => ({ id: a.id, name: a.name, terms: byAttr[a.id] ?? 0 })),
  };
}
