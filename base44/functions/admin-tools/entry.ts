/**
 * admin-tools — maintenance and diagnostics (mini "system status").
 *
 * Actions: status | recount-terms | recount-coupon-usage |
 * recalculate-customer-stats-all | prune-webhook-deliveries |
 * clear-abandoned-carts | regenerate-download-permissions
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../shared/auth.ts";
import { getSettings } from "../../shared/settings.ts";
import { round2 } from "../../shared/money.ts";
import { grantDownloadPermissions, revokeDownloadPermissions } from "../../shared/orders.ts";
import { scanAll } from "../../shared/scan.ts";

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
      case "status": return ok(await status(sr));
      case "recount-terms": return ok(await recountTerms(sr));
      case "recount-coupon-usage": return ok(await recountCouponUsage(sr));
      case "recalculate-customer-stats-all": return ok(await recalcAllCustomerStats(sr));
      case "prune-webhook-deliveries": return ok(await pruneDeliveries(sr, payload));
      case "clear-abandoned-carts": return ok(await clearCarts(sr, payload));
      case "regenerate-download-permissions": return ok(await regenPermissions(sr, payload));
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("admin-tools error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

/** Entity counts (capped at 1000 — shown as "1000+"), settings sanity, seeded flag. */
async function status(sr: any): Promise<any> {
  const entities = [
    "Product", "ProductVariation", "ProductCategory", "ProductTag", "ProductAttribute",
    "Order", "OrderRefund", "Coupon", "Customer", "ProductReview",
    "TaxRate", "ShippingZone", "PaymentGateway", "Webhook", "Cart",
  ];
  const counts: Record<string, string | number> = {};
  for (const name of entities) {
    try {
      const page = (await sr.entities[name].list(undefined, 1000)) ?? [];
      counts[name] = page.length >= 1000 ? "1000+" : page.length;
    } catch (e) {
      counts[name] = `error: ${(e as Error).message}`;
    }
  }
  const settings = await getSettings(sr);
  const groups = Object.keys(settings);
  return {
    template_version: "1.0.0",
    seeded: groups.includes("general"),
    settings_groups: groups,
    counts,
    checks: {
      has_payment_gateways: (counts.PaymentGateway as number) > 0,
      has_default_zone: (counts.ShippingZone as number) > 0,
      taxes_enabled: settings.general?.enable_taxes ?? null,
    },
  };
}

/** Rebuild category/tag/shipping-class/attribute-term `count` fields from products. */
async function recountTerms(sr: any): Promise<any> {
  const products = await scanAll(sr.entities.Product);
  const catCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  const termCounts: Record<string, number> = {}; // `${attribute_id}::${option}`

  for (const p of products) {
    for (const c of p.category_ids ?? []) catCounts[c] = (catCounts[c] ?? 0) + 1;
    for (const t of p.tag_ids ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    if (p.shipping_class_id) classCounts[p.shipping_class_id] = (classCounts[p.shipping_class_id] ?? 0) + 1;
    for (const a of p.attributes ?? []) {
      if (!a.attribute_id) continue;
      for (const opt of a.options ?? []) {
        const key = `${a.attribute_id}::${String(opt).toLowerCase()}`;
        termCounts[key] = (termCounts[key] ?? 0) + 1;
      }
    }
  }

  const updateCounts = async (entity: string, expected: Record<string, number>) => {
    let updated = 0;
    for (const rec of await scanAll(sr.entities[entity])) {
      const want = expected[rec.id] ?? 0;
      if ((rec.count ?? 0) !== want) {
        await sr.entities[entity].update(rec.id, { count: want });
        updated++;
      }
    }
    return updated;
  };

  const categories = await updateCounts("ProductCategory", catCounts);
  const tags = await updateCounts("ProductTag", tagCounts);
  const classes = await updateCounts("ShippingClass", classCounts);

  let terms = 0;
  for (const term of await scanAll(sr.entities.ProductAttributeTerm)) {
    const want = termCounts[`${term.attribute_id}::${String(term.name).toLowerCase()}`] ?? 0;
    if ((term.count ?? 0) !== want) {
      await sr.entities.ProductAttributeTerm.update(term.id, { count: want });
      terms++;
    }
  }
  return { updated: { categories, tags, shipping_classes: classes, attribute_terms: terms } };
}

/** Rebuild coupon usage_count/used_by from orders where usage was counted. */
async function recountCouponUsage(sr: any): Promise<any> {
  const orders = await scanAll(sr.entities.Order, { coupon_usages_counted: true });
  const usage: Record<string, string[]> = {};
  for (const o of orders) {
    const email = (o.billing?.email ?? "").toLowerCase();
    for (const cl of o.coupon_lines ?? []) {
      const code = (cl.code ?? "").toLowerCase();
      if (!code) continue;
      (usage[code] ??= []).push(email);
    }
  }
  let updated = 0;
  for (const coupon of await scanAll(sr.entities.Coupon)) {
    const uses = usage[coupon.code] ?? [];
    if ((coupon.usage_count ?? 0) !== uses.length) {
      await sr.entities.Coupon.update(coupon.id, { usage_count: uses.length, used_by: uses });
      updated++;
    }
  }
  return { coupons_updated: updated };
}

async function recalcAllCustomerStats(sr: any): Promise<any> {
  const customers = await scanAll(sr.entities.Customer);
  const orders = await scanAll(sr.entities.Order);
  const byCustomer = new Map<string, any[]>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    (byCustomer.get(o.customer_id) ?? byCustomer.set(o.customer_id, []).get(o.customer_id))!.push(o);
  }

  let updated = 0;
  for (const c of customers) {
    const own = byCustomer.get(c.id) ?? [];
    const counted = own.filter((o) => !["cancelled", "failed"].includes(o.status));
    const paid = own.filter((o) => o.date_paid || ["processing", "completed"].includes(o.status));
    const totalSpent = round2(paid.reduce((a, o) => a + (o.total ?? 0) - (o.total_refunded ?? 0), 0));
    const patch = {
      orders_count: counted.length,
      total_spent: totalSpent,
      is_paying_customer: totalSpent > 0,
    };
    if (patch.orders_count !== (c.orders_count ?? 0) || patch.total_spent !== (c.total_spent ?? 0)) {
      await sr.entities.Customer.update(c.id, patch);
      updated++;
    }
  }
  return { customers_updated: updated };
}

async function pruneDeliveries(sr: any, payload: any): Promise<any> {
  const keepDays = Number(payload.keep_days ?? 30);
  const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
  const deliveries = await scanAll(sr.entities.WebhookDelivery, null, "created_date");
  let deleted = 0;
  for (const d of deliveries) {
    if (d.created_date < cutoff) {
      await sr.entities.WebhookDelivery.delete(d.id);
      deleted++;
    }
  }
  return { deleted, cutoff };
}

async function clearCarts(sr: any, payload: any): Promise<any> {
  const olderThanDays = Number(payload.older_than_days ?? 30);
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const carts = await scanAll(sr.entities.Cart, null, "created_date");
  let deleted = 0;
  for (const cart of carts) {
    const stale = (cart.updated_date ?? cart.created_date) < cutoff;
    if (stale || cart.status === "converted") {
      await sr.entities.Cart.delete(cart.id);
      deleted++;
    }
  }
  return { deleted, cutoff };
}

async function regenPermissions(sr: any, payload: any): Promise<any> {
  const order = await sr.entities.Order.get(payload.order_id);
  if (!order) throw new HttpError(404, "Order not found", "not_found");
  await revokeDownloadPermissions(sr, order);
  const granted = await grantDownloadPermissions(sr, order);
  await sr.entities.Order.update(order.id, { download_permissions_granted: granted > 0 });
  return { granted };
}
