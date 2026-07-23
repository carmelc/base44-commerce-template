/**
 * commerce/admin-products — product + variation mutations with side effects
 * (derived pricing, stock status, taxonomy counts, webhooks).
 *
 * Actions: save | delete | batch | duplicate | set-stock | search
 * Body: { action, ...payload } — see skills/commerce/docs/api-admin.md.
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../../shared/commerce/auth.ts";
import { getSettings } from "../../../shared/commerce/settings.ts";
import { deriveStockStatus } from "../../../shared/commerce/stock.ts";
import { sendStockEmail } from "../../../shared/commerce/emails.ts";
import { dispatch } from "../../../shared/commerce/webhooks.ts";
import { pageSlice, scanAll, textMatch } from "../../../shared/commerce/scan.ts";
import { round2 } from "../../../shared/commerce/money.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "save":
        return ok(await save(sr, payload));
      case "delete":
        return ok(await remove(sr, payload.id));
      case "batch":
        return ok(await batch(sr, payload));
      case "duplicate":
        return ok(await duplicate(sr, payload.id));
      case "set-stock":
        return ok(await setStock(sr, payload));
      case "search":
        return ok(await search(sr, payload));
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("commerce/admin-products error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

// ── derivations ──────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product";
}

/** price/on_sale from the sale window. Mutates rec. */
function derivePricing(rec: any): void {
  const now = Date.now();
  const from = rec.date_on_sale_from ? new Date(rec.date_on_sale_from).getTime() : -Infinity;
  const to = rec.date_on_sale_to ? new Date(rec.date_on_sale_to).getTime() : Infinity;
  const saleActive = rec.sale_price != null && rec.sale_price !== "" && now >= from && now <= to;
  rec.on_sale = !!saleActive;
  const effective = saleActive ? rec.sale_price : rec.regular_price;
  if (effective != null && effective !== "") rec.price = round2(Number(effective));
}

/** stock_status derivation when stock is managed. Mutates rec. */
function deriveStock(rec: any, outThreshold: number, managed: boolean): void {
  if (managed) {
    rec.stock_status = deriveStockStatus(
      Number(rec.stock_quantity ?? 0),
      rec.backorders ?? "no",
      outThreshold,
    );
  } else if (!rec.stock_status) {
    rec.stock_status = "instock";
  }
}

// ── uniqueness ───────────────────────────────────────────────────────────────

async function ensureUniqueSlug(sr: any, slug: string, selfId?: string): Promise<string> {
  let candidate = slug;
  for (let i = 2; i < 100; i++) {
    const hits = (await sr.entities["commerce.Product"].filter({ slug: candidate }, undefined, 2)) ?? [];
    if (!hits.some((p: any) => p.id !== selfId)) return candidate;
    candidate = `${slug}-${i}`;
  }
  return `${slug}-${crypto.randomUUID().slice(0, 6)}`;
}

/** SKU must be unique across products AND variations. Throws duplicate_sku. */
async function assertUniqueSku(sr: any, sku: string, opts: { productId?: string; variationId?: string }): Promise<void> {
  if (!sku) return;
  const prods = (await sr.entities["commerce.Product"].filter({ sku }, undefined, 2)) ?? [];
  if (prods.some((p: any) => p.id !== opts.productId)) {
    throw new HttpError(409, `SKU "${sku}" is already in use by another product.`, "duplicate_sku");
  }
  const vars = (await sr.entities["commerce.ProductVariation"].filter({ sku }, undefined, 2)) ?? [];
  if (vars.some((v: any) => v.id !== opts.variationId)) {
    throw new HttpError(409, `SKU "${sku}" is already in use by a product variation.`, "duplicate_sku");
  }
}

// ── taxonomy counts ──────────────────────────────────────────────────────────

async function adjustTermCounts(sr: any, entity: string, prevIds: string[], nextIds: string[]): Promise<void> {
  const added = nextIds.filter((id) => !prevIds.includes(id));
  const removed = prevIds.filter((id) => !nextIds.includes(id));
  for (const id of added) await bumpCount(sr, entity, id, +1);
  for (const id of removed) await bumpCount(sr, entity, id, -1);
}

async function bumpCount(sr: any, entity: string, id: string, delta: number): Promise<void> {
  try {
    const rec = await sr.entities[entity].get(id);
    if (rec) await sr.entities[entity].update(id, { count: Math.max(0, (rec.count ?? 0) + delta) });
  } catch { /* stale reference — recount-terms repairs */ }
}

// ── save ─────────────────────────────────────────────────────────────────────

async function save(sr: any, payload: any): Promise<any> {
  const { product, variations } = payload;
  if (!product || (!product.id && !product.name)) {
    throw new HttpError(400, "product.name is required", "invalid_payload");
  }

  const settings = await getSettings(sr, "inventory");
  const outThreshold = Number(settings.inventory?.out_of_stock_threshold ?? 0);

  const prev = product.id ? await sr.entities["commerce.Product"].get(product.id) : null;
  if (product.id && !prev) throw new HttpError(404, "Product not found", "not_found");

  const rec = { ...(prev ?? {}), ...product };
  if (!rec.slug) rec.slug = slugify(rec.name);
  rec.slug = await ensureUniqueSlug(sr, slugify(rec.slug), rec.id);
  await assertUniqueSku(sr, rec.sku, { productId: rec.id });
  derivePricing(rec);
  deriveStock(rec, outThreshold, !!rec.manage_stock && rec.type !== "variable");

  const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, ...fields } = rec;
  let saved: any;
  if (prev) {
    await sr.entities["commerce.Product"].update(prev.id, fields);
    saved = { ...prev, ...fields };
  } else {
    saved = await sr.entities["commerce.Product"].create(fields);
  }

  await adjustTermCounts(sr, "commerce.ProductCategory", prev?.category_ids ?? [], saved.category_ids ?? []);
  await adjustTermCounts(sr, "commerce.ProductTag", prev?.tag_ids ?? [], saved.tag_ids ?? []);
  if ((prev?.shipping_class_id ?? "") !== (saved.shipping_class_id ?? "")) {
    if (prev?.shipping_class_id) await bumpCount(sr, "commerce.ShippingClass", prev.shipping_class_id, -1);
    if (saved.shipping_class_id) await bumpCount(sr, "commerce.ShippingClass", saved.shipping_class_id, +1);
  }

  // variations diff — only when the caller sends a variations array
  let savedVariations: any[] | undefined;
  if (Array.isArray(variations)) {
    savedVariations = await diffVariations(sr, saved, variations, outThreshold);
    await rollUpParentStock(sr, saved, savedVariations);
  } else if (saved.type === "variable") {
    const existing = await scanAll(sr.entities["commerce.ProductVariation"], { product_id: saved.id });
    await rollUpParentStock(sr, saved, existing);
  }

  await dispatch(sr, prev ? "product.updated" : "product.created", saved);
  return { product: saved, variations: savedVariations };
}

async function diffVariations(sr: any, parent: any, incoming: any[], outThreshold: number): Promise<any[]> {
  const existing = await scanAll(sr.entities["commerce.ProductVariation"], { product_id: parent.id });
  const incomingIds = new Set(incoming.filter((v) => v.id).map((v) => v.id));
  const out: any[] = [];

  for (const stale of existing.filter((v: any) => !incomingIds.has(v.id))) {
    await sr.entities["commerce.ProductVariation"].delete(stale.id);
  }

  for (const v of incoming) {
    const prev = v.id ? existing.find((e: any) => e.id === v.id) : null;
    const rec = { ...(prev ?? {}), ...v, product_id: parent.id };
    await assertUniqueSku(sr, rec.sku, { variationId: rec.id });
    derivePricing(rec);
    deriveStock(rec, outThreshold, (rec.manage_stock ?? "parent") === "yes");
    const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, ...fields } = rec;
    if (prev) {
      await sr.entities["commerce.ProductVariation"].update(prev.id, fields);
      out.push({ ...prev, ...fields });
    } else {
      out.push(await sr.entities["commerce.ProductVariation"].create(fields));
    }
  }
  return out;
}

/** Variable parent shows outofstock only when every purchasable variation is out. */
async function rollUpParentStock(sr: any, parent: any, variations: any[]): Promise<void> {
  if (parent.type !== "variable" || parent.manage_stock) return;
  const live = variations.filter((v) => (v.status ?? "publish") === "publish");
  const status = live.length && live.every((v) => v.stock_status === "outofstock")
    ? "outofstock"
    : "instock";
  if (status !== parent.stock_status) {
    await sr.entities["commerce.Product"].update(parent.id, { stock_status: status });
    parent.stock_status = status;
  }
}

// ── delete / batch / duplicate ───────────────────────────────────────────────

async function remove(sr: any, id: string): Promise<any> {
  const product = await sr.entities["commerce.Product"].get(id);
  if (!product) throw new HttpError(404, "Product not found", "not_found");

  const variations = await scanAll(sr.entities["commerce.ProductVariation"], { product_id: id });
  for (const v of variations) await sr.entities["commerce.ProductVariation"].delete(v.id);

  await adjustTermCounts(sr, "commerce.ProductCategory", product.category_ids ?? [], []);
  await adjustTermCounts(sr, "commerce.ProductTag", product.tag_ids ?? [], []);
  if (product.shipping_class_id) await bumpCount(sr, "commerce.ShippingClass", product.shipping_class_id, -1);

  await sr.entities["commerce.Product"].delete(id);
  await dispatch(sr, "product.deleted", product);
  return { deleted: id, variations_deleted: variations.length };
}

async function batch(sr: any, payload: any): Promise<any> {
  const results = { create: [] as any[], update: [] as any[], delete: [] as any[] };
  const cap = 100;
  for (const p of (payload.create ?? []).slice(0, cap)) {
    try { results.create.push({ success: true, ...(await save(sr, { product: p })) }); }
    catch (e) { results.create.push({ success: false, error: (e as Error).message }); }
  }
  for (const p of (payload.update ?? []).slice(0, cap)) {
    try { results.update.push({ success: true, ...(await save(sr, { product: p })) }); }
    catch (e) { results.update.push({ success: false, id: p.id, error: (e as Error).message }); }
  }
  for (const id of (payload.delete ?? []).slice(0, cap)) {
    try { results.delete.push({ success: true, ...(await remove(sr, id)) }); }
    catch (e) { results.delete.push({ success: false, id, error: (e as Error).message }); }
  }
  return results;
}

async function duplicate(sr: any, id: string): Promise<any> {
  const source = await sr.entities["commerce.Product"].get(id);
  if (!source) throw new HttpError(404, "Product not found", "not_found");

  const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, ...fields } = source;
  const copy: any = {
    ...fields,
    name: `${source.name} (Copy)`,
    status: "draft",
    total_sales: 0,
    average_rating: 0,
    rating_count: 0,
  };
  copy.slug = await ensureUniqueSlug(sr, slugify(copy.name));
  if (copy.sku) {
    copy.sku = `${copy.sku}-copy`;
    try { await assertUniqueSku(sr, copy.sku, {}); }
    catch { copy.sku = `${copy.sku}-${crypto.randomUUID().slice(0, 4)}`; }
  }
  const created = await sr.entities["commerce.Product"].create(copy);

  const variations = await scanAll(sr.entities["commerce.ProductVariation"], { product_id: id });
  let copied = 0;
  for (const v of variations) {
    const { id: _vi, created_date: _vc, updated_date: _vu, created_by: _vb, ...vf } = v;
    const vCopy: any = { ...vf, product_id: created.id };
    if (vCopy.sku) vCopy.sku = `${vCopy.sku}-copy-${crypto.randomUUID().slice(0, 4)}`;
    await sr.entities["commerce.ProductVariation"].create(vCopy);
    copied++;
  }

  // duplicated product participates in taxonomy counts too
  await adjustTermCounts(sr, "commerce.ProductCategory", [], created.category_ids ?? []);
  await adjustTermCounts(sr, "commerce.ProductTag", [], created.tag_ids ?? []);
  if (created.shipping_class_id) await bumpCount(sr, "commerce.ShippingClass", created.shipping_class_id, +1);

  await dispatch(sr, "product.created", created);
  return { product: created, variations_copied: copied };
}

// ── set-stock ────────────────────────────────────────────────────────────────

async function setStock(sr: any, payload: any): Promise<any> {
  const { id, variation_id, quantity } = payload;
  const product = await sr.entities["commerce.Product"].get(id);
  if (!product) throw new HttpError(404, "Product not found", "not_found");
  const variation = variation_id ? await sr.entities["commerce.ProductVariation"].get(variation_id) : null;

  const settings = await getSettings(sr, "inventory", "emails", "general");
  const inv = settings.inventory ?? {};
  const outThreshold = Number(inv.out_of_stock_threshold ?? 0);
  const target = variation ?? product;
  const entity = variation ? "commerce.ProductVariation" : "commerce.Product";
  const backorders = variation && (variation.manage_stock ?? "parent") === "yes"
    ? variation.backorders ?? "no"
    : product.backorders ?? "no";

  const before = Number(target.stock_quantity ?? 0);
  const after = Number(quantity);
  const status = deriveStockStatus(after, backorders, outThreshold);
  await sr.entities[entity].update(target.id, { stock_quantity: after, stock_status: status });

  const low = Number(target.low_stock_amount ?? inv.low_stock_threshold ?? 2);
  if (after <= outThreshold && before > outThreshold) {
    await sendStockEmail(sr, "out_of_stock", { ...product, stock_quantity: after }, { settings });
  } else if (after <= low && before > low) {
    await sendStockEmail(sr, "low_stock", { ...product, stock_quantity: after }, { settings });
  }

  await dispatch(sr, "product.updated", { ...product, stock_quantity: variation ? product.stock_quantity : after });
  return { id: target.id, stock_quantity: after, stock_status: status };
}

// ── search ───────────────────────────────────────────────────────────────────

/** Category subtree ids (self + descendants) for the category filter. */
async function categoryWithDescendants(sr: any, rootId: string): Promise<Set<string>> {
  const all = await scanAll(sr.entities["commerce.ProductCategory"], null, "menu_order");
  const wanted = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parent_id && wanted.has(c.parent_id) && !wanted.has(c.id)) {
        wanted.add(c.id);
        grew = true;
      }
    }
  }
  return wanted;
}

async function search(sr: any, payload: any): Promise<any> {
  const { q, category_id, type, stock_status, status, sort = "-created_date", limit = 20, skip = 0 } = payload;

  const query: Record<string, any> = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (stock_status) query.stock_status = stock_status;

  let rows = await scanAll(sr.entities["commerce.Product"], Object.keys(query).length ? query : null, sort);
  if (q) {
    rows = rows.filter((p) =>
      textMatch(p.name, q) || textMatch(p.sku, q) || textMatch(p.description, q)
    );
  }
  if (category_id) {
    const cats = await categoryWithDescendants(sr, category_id);
    rows = rows.filter((p) => (p.category_ids ?? []).some((c: string) => cats.has(c)));
  }
  return pageSlice(rows, Number(limit), Number(skip));
}
