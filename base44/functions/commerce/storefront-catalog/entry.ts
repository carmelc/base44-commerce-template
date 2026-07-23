/**
 * commerce/storefront-catalog — public catalog browsing API.
 *
 * Actions: list-products | get-product | list-categories | list-attributes |
 *          get-store-info | submit-review
 *
 * Visibility rules (Woo): only status=publish products; browse context hides
 * catalog_visibility hidden/search; search context hides hidden/catalog;
 * inventory.hide_out_of_stock removes out-of-stock products entirely.
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError } from "../../../shared/commerce/auth.ts";
import { getSettings, getSetting, storefrontSafeSettings } from "../../../shared/commerce/settings.ts";
import { recalcProductRating } from "../../../shared/commerce/reviews.ts";
import { scanAll } from "../../../shared/commerce/scan.ts";
import { COUNTRIES } from "../../../shared/commerce/data/countries.ts";
import { CURRENCIES } from "../../../shared/commerce/data/currencies.ts";

function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ success: false, error: e.message, code: e.code ?? "error" }, { status: e.status });
  }
  console.error("commerce/storefront-catalog error:", e);
  return Response.json(
    { success: false, error: (e as Error)?.message ?? "Internal error", code: "internal_error" },
    { status: 500 },
  );
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json().catch(() => ({}));
    if (!action) throw new HttpError(400, "action is required.", "action_required");

    switch (action) {
      case "list-products":
        return ok(await listProducts(sr, payload));
      case "get-product":
        return ok(await getProduct(sr, payload));
      case "list-categories":
        return ok(await listCategories(sr));
      case "list-attributes":
        return ok(await listAttributes(sr));
      case "get-store-info":
        return ok(await getStoreInfo(sr));
      case "submit-review":
        return ok(await submitReview(sr, payload));
      default:
        throw new HttpError(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    return fail(e);
  }
});

// ── list-products ────────────────────────────────────────────────────────────

const SORTS: Record<string, (a: any, b: any) => number> = {
  "menu_order": (a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0) || String(a.name).localeCompare(String(b.name)),
  "price": (a, b) => (a.price ?? 0) - (b.price ?? 0),
  "-price": (a, b) => (b.price ?? 0) - (a.price ?? 0),
  "-created_date": (a, b) => String(b.created_date ?? "").localeCompare(String(a.created_date ?? "")),
  "popularity": (a, b) => (b.total_sales ?? 0) - (a.total_sales ?? 0),
  "rating": (a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0),
};

async function listProducts(sr: any, p: any): Promise<any> {
  const settings = await getSettings(sr, "inventory");
  const hideOutOfStock = !!getSetting(settings, "inventory", "hide_out_of_stock", false);
  const page = Math.max(1, Math.floor(Number(p.page) || 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(Number(p.per_page) || 12)));
  const search = String(p.search ?? "").toLowerCase().trim();
  const isSearchContext = !!search;

  let products = await scanAll(sr.entities["commerce.Product"], { status: "publish" }, "-created_date", 5000);

  // visibility per context
  products = products.filter((prod: any) => {
    const vis = prod.catalog_visibility ?? "visible";
    if (vis === "hidden") return false;
    if (isSearchContext && vis === "catalog") return false;
    if (!isSearchContext && vis === "search") return false;
    return true;
  });

  if (hideOutOfStock || p.in_stock_only) {
    products = products.filter((prod: any) => prod.stock_status !== "outofstock");
  }
  if (search) {
    products = products.filter((prod: any) =>
      [prod.name, prod.sku, prod.description, prod.short_description]
        .some((f: any) => String(f ?? "").toLowerCase().includes(search))
    );
  }
  if (p.category_id) {
    const catIds = await categoryWithDescendants(sr, String(p.category_id));
    products = products.filter((prod: any) => (prod.category_ids || []).some((c: string) => catIds.has(c)));
  }
  if (p.tag_id) {
    products = products.filter((prod: any) => (prod.tag_ids || []).includes(String(p.tag_id)));
  }
  if (p.attribute_id && p.attribute_term) {
    products = products.filter((prod: any) =>
      (prod.attributes || []).some((a: any) =>
        (a.attribute_id === p.attribute_id || a.name === p.attribute_id) &&
        (a.options || []).includes(p.attribute_term)
      )
    );
  }
  if (p.min_price != null) products = products.filter((prod: any) => (prod.price ?? 0) >= Number(p.min_price));
  if (p.max_price != null) products = products.filter((prod: any) => (prod.price ?? 0) <= Number(p.max_price));
  if (p.featured != null) products = products.filter((prod: any) => !!prod.featured === !!p.featured);
  if (p.on_sale != null) products = products.filter((prod: any) => !!prod.on_sale === !!p.on_sale);

  const sortKey = String(p.sort ?? "menu_order");
  products.sort(SORTS[sortKey] ?? SORTS["menu_order"]);

  const start = (page - 1) * perPage;
  const pageItems = products.slice(start, start + perPage);
  return {
    products: pageItems,
    page,
    per_page: perPage,
    has_next: products.length > start + perPage,
  };
}

async function categoryWithDescendants(sr: any, rootId: string): Promise<Set<string>> {
  const all = await scanAll(sr.entities["commerce.ProductCategory"], {}, undefined, 2000);
  const byParent = new Map<string, any[]>();
  for (const c of all) {
    const key = c.parent_id || "";
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of byParent.get(cur) ?? []) {
      if (!ids.has(child.id)) { ids.add(child.id); queue.push(child.id); }
    }
  }
  return ids;
}

// ── get-product ──────────────────────────────────────────────────────────────

async function getProduct(sr: any, p: any): Promise<any> {
  let product: any = null;
  if (p.id) {
    try { product = await sr.entities["commerce.Product"].get(String(p.id)); } catch { product = null; }
  } else if (p.slug) {
    product = (await sr.entities["commerce.Product"].filter({ slug: String(p.slug) }, undefined, 1))?.[0] ?? null;
  }
  if (!product || product.status !== "publish" || product.catalog_visibility === "hidden") {
    throw new HttpError(404, "Product not found.", "not_found");
  }

  const [variations, categories, tags] = await Promise.all([
    product.type === "variable"
      ? sr.entities["commerce.ProductVariation"].filter({ product_id: product.id }, "menu_order", 500)
      : Promise.resolve([]),
    resolveMany(sr.entities["commerce.ProductCategory"], product.category_ids),
    resolveMany(sr.entities["commerce.ProductTag"], product.tag_ids),
  ]);

  const purchasableVariations = (variations ?? []).filter(
    (v: any) => !v.status || v.status === "publish",
  );

  const reviewsPage = Math.max(1, Math.floor(Number(p.reviews_page) || 1));
  const reviewsPerPage = Math.min(50, Math.max(1, Math.floor(Number(p.reviews_per_page) || 10)));
  const reviews = (await sr.entities["commerce.ProductReview"].filter(
    { product_id: product.id, status: "approved" },
    "-created_date",
    reviewsPerPage + 1,
    (reviewsPage - 1) * reviewsPerPage,
  )) ?? [];

  const [upsells, crossSells, grouped] = await Promise.all([
    productSummaries(sr, product.upsell_ids),
    productSummaries(sr, product.cross_sell_ids),
    productSummaries(sr, product.grouped_products),
  ]);

  return {
    product,
    variations: purchasableVariations,
    categories,
    tags,
    reviews: {
      items: reviews.slice(0, reviewsPerPage).map(publicReview),
      page: reviewsPage,
      per_page: reviewsPerPage,
      has_next: reviews.length > reviewsPerPage,
      average_rating: product.average_rating ?? 0,
      rating_count: product.rating_count ?? 0,
    },
    upsells,
    cross_sells: crossSells,
    grouped_products: grouped,
  };
}

async function resolveMany(entityApi: any, ids: string[] | undefined): Promise<any[]> {
  const out: any[] = [];
  for (const id of ids ?? []) {
    try {
      const rec = await entityApi.get(id);
      if (rec) out.push(rec);
    } catch { /* skip vanished */ }
  }
  return out;
}

async function productSummaries(sr: any, ids: string[] | undefined): Promise<any[]> {
  const out: any[] = [];
  for (const id of (ids ?? []).slice(0, 20)) {
    try {
      const prod = await sr.entities["commerce.Product"].get(id);
      if (prod && prod.status === "publish") {
        out.push({
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          price: prod.price ?? null,
          on_sale: !!prod.on_sale,
          image: prod.images?.[0]?.src ?? "",
          stock_status: prod.stock_status ?? "instock",
        });
      }
    } catch { /* skip */ }
  }
  return out;
}

function publicReview(r: any): any {
  return {
    id: r.id,
    reviewer: r.reviewer,
    review: r.review,
    rating: r.rating,
    verified: !!r.verified,
    created_date: r.created_date,
  };
}

// ── taxonomies ───────────────────────────────────────────────────────────────

async function listCategories(sr: any): Promise<any> {
  const all = await scanAll(sr.entities["commerce.ProductCategory"], {}, "menu_order", 2000);
  const byId = new Map<string, any>();
  for (const c of all) byId.set(c.id, { ...c, children: [] });
  const roots: any[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortTree = (nodes: any[]) => {
    nodes.sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0) || String(a.name).localeCompare(String(b.name)));
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return { categories: roots };
}

async function listAttributes(sr: any): Promise<any> {
  const attributes = await scanAll(sr.entities["commerce.ProductAttribute"], {}, undefined, 500);
  const out: any[] = [];
  for (const attr of attributes) {
    const terms = (await sr.entities["commerce.ProductAttributeTerm"].filter({ attribute_id: attr.id }, "menu_order", 500)) ?? [];
    out.push({ ...attr, terms });
  }
  return { attributes: out };
}

// ── store info ───────────────────────────────────────────────────────────────

async function getStoreInfo(sr: any): Promise<any> {
  const settings = await getSettings(sr);
  const gateways = (await sr.entities["commerce.PaymentGateway"].filter({ enabled: true }, "order", 50)) ?? [];
  return {
    settings: storefrontSafeSettings(settings),
    payment_gateways: gateways.map((g: any) => ({
      slug: g.slug,
      title: g.title ?? g.slug,
      description: g.description ?? "",
    })),
    countries: COUNTRIES,
    currencies: CURRENCIES,
  };
}

// ── reviews ──────────────────────────────────────────────────────────────────

async function submitReview(sr: any, p: any): Promise<any> {
  const settings = await getSettings(sr, "products");
  if (!getSetting(settings, "products", "enable_reviews", true)) {
    throw new HttpError(403, "Reviews are disabled for this store.", "reviews_disabled");
  }

  const productId = String(p.product_id || "");
  let product: any = null;
  try { product = productId ? await sr.entities["commerce.Product"].get(productId) : null; } catch { product = null; }
  if (!product || product.status !== "publish") {
    throw new HttpError(404, "Product not found.", "not_found");
  }
  if (product.reviews_allowed === false) {
    throw new HttpError(403, "Reviews are disabled for this product.", "reviews_disabled");
  }

  const reviewer = String(p.reviewer ?? "").trim();
  const reviewerEmail = String(p.reviewer_email ?? "").trim().toLowerCase();
  const review = String(p.review ?? "").trim();
  const rating = p.rating == null ? null : Math.floor(Number(p.rating));

  if (!reviewer || !reviewerEmail || !review) {
    throw new HttpError(400, "reviewer, reviewer_email and review are required.", "review_incomplete");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewerEmail)) {
    throw new HttpError(400, "A valid reviewer_email is required.", "invalid_email");
  }
  if (getSetting(settings, "products", "review_rating_required", true) && (rating == null || rating < 1)) {
    throw new HttpError(400, "A star rating is required.", "rating_required");
  }
  if (rating != null && (rating < 0 || rating > 5)) {
    throw new HttpError(400, "Rating must be between 0 and 5.", "invalid_rating");
  }

  const verified = await hasPurchased(sr, reviewerEmail, product.id);
  if (getSetting(settings, "products", "only_verified_reviews", false) && !verified) {
    throw new HttpError(403, "Only customers who purchased this product can review it.", "verified_only");
  }

  const autoApprove = !!getSetting(settings, "products", "auto_approve_reviews", false);
  const created = await sr.entities["commerce.ProductReview"].create({
    product_id: product.id,
    status: autoApprove ? "approved" : "hold",
    reviewer,
    reviewer_email: reviewerEmail,
    review,
    rating: rating ?? 0,
    verified,
  });
  if (autoApprove) {
    await recalcProductRating(sr, product.id);
  }
  return { review_id: created.id, status: created.status, verified };
}

/** Did this email complete (or at least pay for) an order containing the product? */
async function hasPurchased(sr: any, email: string, productId: string): Promise<boolean> {
  const customer = (await sr.entities["commerce.Customer"].filter({ email }, undefined, 1))?.[0];
  if (!customer) return false;
  const orders = await scanAll(sr.entities["commerce.Order"], { customer_id: customer.id }, "-created_date", 1000);
  return orders.some((o: any) =>
    ["completed", "processing"].includes(o.status) &&
    (o.line_items || []).some((l: any) => l.product_id === productId)
  );
}
