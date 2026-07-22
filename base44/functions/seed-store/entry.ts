/**
 * seed-store — idempotent store initialization.
 *
 * Flow: (1) canary schema validation (probe create+delete per entity; abort
 * with 422 schema_incompatible and write nothing on any failure), (2) seed
 * required defaults (settings groups, gateways, tax classes, fallback zone),
 * (3) optional sample catalog (~12 products across every product type, with
 * images and descriptions, plus three variable products with variants) — only
 * when with_sample_data=true and the store has zero products, with best-effort
 * rollback on mid-failure.
 *
 * Body: { with_sample_data?: boolean }
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../shared/auth.ts";
import { round2 } from "../../shared/money.ts";
import {
  GATEWAY_DEFAULTS,
  REST_OF_WORLD_EXAMPLE_METHOD,
  REST_OF_WORLD_ZONE,
  SETTINGS_DEFAULTS,
  TAX_CLASS_DEFAULTS,
} from "./defaults.ts";
import {
  SAMPLE_ATTRIBUTE_TERMS,
  SAMPLE_ATTRIBUTES,
  SAMPLE_CATEGORIES,
  SAMPLE_COUPONS,
  SAMPLE_PRODUCTS,
  SAMPLE_TAX_RATES,
} from "./sample-data.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string, extra?: Record<string, unknown>) =>
  Response.json({ success: false, error, code, ...extra }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const withSample = !!body.with_sample_data;

    // ── 1. canary schema validation — abort before writing anything real ────
    const canaryErrors = await runCanaries(sr, withSample);
    if (canaryErrors.length) {
      return fail(422,
        "Entity schemas have been modified and are incompatible with the seeder.",
        "schema_incompatible",
        { errors: canaryErrors });
    }

    // ── 2. required defaults (idempotent) ────────────────────────────────────
    const seeded = { settings_groups: 0, gateways: 0, tax_classes: 0, zones: 0, zone_methods: 0 };

    const existingSettings = (await sr.entities.StoreSettings.list(undefined, 100)) ?? [];
    const existingGroups = new Set(existingSettings.map((s: any) => s.group_id));
    for (const group of SETTINGS_DEFAULTS) {
      if (existingGroups.has(group.group_id)) continue;
      await sr.entities.StoreSettings.create(group);
      seeded.settings_groups++;
    }

    for (const gw of GATEWAY_DEFAULTS) {
      const hits = (await sr.entities.PaymentGateway.filter({ slug: gw.slug }, undefined, 1)) ?? [];
      if (hits.length) continue;
      await sr.entities.PaymentGateway.create(gw);
      seeded.gateways++;
    }

    for (const tc of TAX_CLASS_DEFAULTS) {
      const hits = (await sr.entities.TaxClass.filter({ slug: tc.slug }, undefined, 1)) ?? [];
      if (hits.length) continue;
      await sr.entities.TaxClass.create(tc);
      seeded.tax_classes++;
    }

    let zone = ((await sr.entities.ShippingZone.filter({ name: REST_OF_WORLD_ZONE.name }, undefined, 1)) ?? [])[0];
    if (!zone) {
      zone = await sr.entities.ShippingZone.create(REST_OF_WORLD_ZONE);
      seeded.zones++;
    }
    const zoneMethods = (await sr.entities.ShippingZoneMethod.filter({ zone_id: zone.id }, undefined, 5)) ?? [];
    if (!zoneMethods.length) {
      await sr.entities.ShippingZoneMethod.create({ ...REST_OF_WORLD_EXAMPLE_METHOD, zone_id: zone.id });
      seeded.zone_methods++;
    }

    // ── 3. optional sample catalog ───────────────────────────────────────────
    let sampleResult: Record<string, number> | null = null;
    if (withSample) {
      const anyProduct = (await sr.entities.Product.list(undefined, 1)) ?? [];
      if (!anyProduct.length) {
        sampleResult = await seedSampleData(sr);
      }
    }

    return ok({ seeded, sample_data: sampleResult ?? false });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("seed-store error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

// ── canaries ─────────────────────────────────────────────────────────────────

/** Minimal-valid probe records per entity the seeder writes. */
function canarySpecs(withSample: boolean): Array<{ entity: string; record: Record<string, any> }> {
  const base = [
    { entity: "StoreSettings", record: { group_id: "general", values: { __canary: true } } },
    { entity: "PaymentGateway", record: { slug: "__canary", title: "Canary", enabled: false, order: 999, settings: {} } },
    { entity: "TaxClass", record: { slug: "__canary", name: "Canary" } },
    { entity: "ShippingZone", record: { name: "__canary", order: 998, locations: [] } },
    { entity: "ShippingZoneMethod", record: { zone_id: "__canary", method_id: "flat_rate", title: "Canary", enabled: false, order: 0, settings: { cost: 0 } } },
  ];
  const sample = [
    { entity: "ProductCategory", record: { name: "__canary", slug: "__canary", count: 0 } },
    { entity: "ProductAttribute", record: { name: "__canary", slug: "__canary", type: "select" } },
    { entity: "ProductAttributeTerm", record: { attribute_id: "__canary", name: "__canary", slug: "__canary" } },
    { entity: "Product", record: { name: "__canary", type: "simple", status: "draft", regular_price: 1, price: 1 } },
    { entity: "ProductVariation", record: { product_id: "__canary", attributes: [], status: "draft" } },
    { entity: "Coupon", record: { code: "__canary", discount_type: "percent", amount: 1, usage_count: 0, used_by: [] } },
    { entity: "TaxRate", record: { country: "ZZ", rate: 1, name: "__canary", priority: 1, compound: false, shipping: true, tax_class: "standard" } },
  ];
  return withSample ? [...base, ...sample] : base;
}

async function runCanaries(sr: any, withSample: boolean): Promise<Array<{ entity: string; error: string }>> {
  const errors: Array<{ entity: string; error: string }> = [];
  for (const spec of canarySpecs(withSample)) {
    let created: any = null;
    try {
      created = await sr.entities[spec.entity].create(spec.record);
    } catch (e) {
      errors.push({ entity: spec.entity, error: String((e as Error)?.message ?? e) });
    } finally {
      if (created?.id) {
        try { await sr.entities[spec.entity].delete(created.id); } catch { /* orphaned canary is harmless */ }
      }
    }
  }
  return errors;
}

// ── sample catalog ───────────────────────────────────────────────────────────

/** price/on_sale/stock_status derivation for seeded products (mirrors admin-products). */
function deriveSeedProduct(p: any): any {
  const out = { ...p };
  out.on_sale = out.sale_price != null;
  const effective = out.on_sale ? out.sale_price : out.regular_price;
  if (effective != null) out.price = round2(Number(effective));
  if (out.manage_stock) {
    const qty = Number(out.stock_quantity ?? 0);
    out.stock_status = qty > 0 ? "instock" : (out.backorders && out.backorders !== "no" ? "onbackorder" : "outofstock");
  } else if (!out.stock_status) {
    out.stock_status = "instock";
  }
  return out;
}

async function seedSampleData(sr: any): Promise<Record<string, number>> {
  // rollback ledger — delete in reverse order on failure
  const created: Array<{ entity: string; id: string }> = [];
  const track = async (entity: string, record: Record<string, any>) => {
    const rec = await sr.entities[entity].create(record);
    created.push({ entity, id: rec.id });
    return rec;
  };

  try {
    // categories
    const categoryBySlug: Record<string, any> = {};
    for (const cat of SAMPLE_CATEGORIES) {
      categoryBySlug[cat.slug] = await track("ProductCategory", cat);
    }

    // attributes + terms
    const attributeBySlug: Record<string, any> = {};
    for (const attr of SAMPLE_ATTRIBUTES) {
      const rec = await track("ProductAttribute", attr);
      attributeBySlug[attr.slug] = rec;
      for (const term of SAMPLE_ATTRIBUTE_TERMS[attr.slug] ?? []) {
        await track("ProductAttributeTerm", { ...term, attribute_id: rec.id, count: 0 });
      }
    }

    // products (two passes: grouped references resolved after simple products exist)
    const productByKey: Record<string, any> = {};
    let variationCount = 0;
    const specs = [...SAMPLE_PRODUCTS].sort((a, b) => (a.type === "grouped" ? 1 : 0) - (b.type === "grouped" ? 1 : 0));

    for (const spec of specs) {
      const { key, categories, attributes, default_attributes, variations, grouped_keys, options: _o, ...fields } = spec;
      const record: any = deriveSeedProduct({
        ...fields,
        slug: fields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        category_ids: (categories ?? []).map((slug: string) => categoryBySlug[slug]?.id).filter(Boolean),
        tag_ids: [],
        images: fields.images ?? [],
        meta_data: [],
        total_sales: 0,
      });
      if (attributes) {
        record.attributes = attributes.map((a: any, i: number) => ({
          attribute_id: attributeBySlug[a.slug]?.id ?? "",
          name: attributeBySlug[a.slug]?.name ?? a.slug,
          position: i,
          visible: a.visible !== false,
          variation: !!a.variation,
          options: a.options ?? [],
        }));
      }
      if (default_attributes) {
        record.default_attributes = default_attributes.map((d: any) => ({
          attribute_id: attributeBySlug[d.slug]?.id ?? "",
          name: attributeBySlug[d.slug]?.name ?? d.slug,
          option: d.option,
        }));
      }
      if (grouped_keys) {
        record.grouped_products = grouped_keys.map((k: string) => productByKey[k]?.id).filter(Boolean);
      }
      const product = await track("Product", record);
      productByKey[key] = product;

      for (const v of variations ?? []) {
        const attrs = Object.entries(v.options).map(([slug, option]) => ({
          attribute_id: attributeBySlug[slug]?.id ?? "",
          name: attributeBySlug[slug]?.name ?? slug,
          option,
        }));
        await track("ProductVariation", deriveSeedProduct({
          product_id: product.id,
          attributes: attrs,
          status: "publish",
          sku: `${record.sku}-${Object.values(v.options).join("-").toUpperCase()}`,
          regular_price: v.regular_price,
          ...(v.sale_price != null ? { sale_price: v.sale_price } : {}),
          manage_stock: "yes",
          stock_quantity: v.stock_quantity,
          backorders: v.backorders ?? "no",
          ...(v.image ? { image: v.image } : {}),
        }));
        variationCount++;
      }
    }

    // taxonomy counts for the seeded catalog
    for (const cat of Object.values(categoryBySlug) as any[]) {
      const count = specs.filter((s) => (s.categories ?? []).some((slug: string) => categoryBySlug[slug]?.id === cat.id)).length;
      await sr.entities.ProductCategory.update(cat.id, { count });
    }

    for (const coupon of SAMPLE_COUPONS) await track("Coupon", coupon);
    for (const rate of SAMPLE_TAX_RATES) await track("TaxRate", rate);

    return {
      categories: SAMPLE_CATEGORIES.length,
      attributes: SAMPLE_ATTRIBUTES.length,
      products: SAMPLE_PRODUCTS.length,
      variations: variationCount,
      coupons: SAMPLE_COUPONS.length,
      tax_rates: SAMPLE_TAX_RATES.length,
    };
  } catch (e) {
    // best-effort rollback, newest first
    for (const { entity, id } of created.reverse()) {
      try { await sr.entities[entity].delete(id); } catch { /* leave orphans; admin-tools can clean */ }
    }
    throw new HttpError(500, `Sample data seeding failed and was rolled back: ${(e as Error).message}`, "sample_seed_failed");
  }
}
