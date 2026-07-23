# Admin API Reference

For building store automation or an alternative admin UI against the Base44 Commerce Template. The bundled admin UI (`src/commerce/admin/`) uses exactly this surface.

## Data-access contract

Two access styles. **Reads are direct** entity SDK calls; **mutations with side effects go through `admin-*` functions**; simple config entities are **direct CRUD** (protected by admin-only RLS).

| Resource | Reads | Writes | Why |
|---|---|---|---|
| Product, ProductVariation | direct (`filter`/`get`/`list`) | **`admin-products`** | derived pricing/stock, taxonomy counts, webhooks |
| Order, OrderNote | direct | **`admin-orders`** | lifecycle side effects (stock, emails, webhooks, dates) |
| OrderRefund | direct | **`admin-refunds`** | restock, totals, refund status transition |
| Coupon | direct | **`admin-coupons`** | code normalization/uniqueness, webhooks |
| Customer | direct | **`admin-customers`** | email uniqueness, invite/link, stats |
| ProductReview | direct | **`admin-reviews`** | rating recalculation |
| ProductCategory, ProductTag, ProductAttribute, ProductAttributeTerm, ShippingClass | direct | **direct CRUD** | plain config; RLS enforces admin-only |
| TaxClass, TaxRate, ShippingZone, ShippingZoneMethod, PaymentGateway | direct | **direct CRUD** | config; consumed by the pricing engine at read time |
| StoreSettings | direct | **direct CRUD** (one record per `group_id`) | grouped config |
| Webhook | direct | **direct CRUD** (+ `admin-webhooks` for test/redeliver) | definition is data; dispatch is engine |
| WebhookDelivery, EmailLog | direct (read-only logs) | written by the engine | audit logs |

All entities carry admin-only RLS on the operations they restrict (catalog entities are public-read, admin-write; transactional entities are admin-only on all ops). A direct write from a non-admin is rejected by the backend regardless of the UI.

## Invocation & envelope

```js
const res = await base44.functions.invoke("admin-products", { action: "search", q: "shirt", limit: 20 });
const { rows, has_next } = res.data.data;   // res.data = { success, data }; .data = payload
```
Success: `{ success: true, data }`. Failure: `{ success: false, error, code }` with the HTTP status set. Auth: every `admin-*` function calls `requireAdmin()` → **401** if not signed in, **403** if signed in without the `admin` role, before any data access (via the service role).

## Pagination & search

- No total-count API. List endpoints use **limit + skip** with a **`limit+1`** probe: request one extra row; if it comes back, there's a next page. `search` actions return `{ rows, has_next }`.
- Entity `filter` is **exact-match only** — free-text search is server-side (`search` actions scan + JS-match), so use those for name/email/code lookups rather than `filter`.
- Status-tab counts come from dedicated count actions (`admin-orders` `status-counts`), not from search.

---

## admin-products

Actions: `save` · `delete` · `batch` · `duplicate` · `set-stock` · `search`

- **`save`** — `{ product, variations? }`. Upserts the product (create if no `id`); when `variations` is provided, diffs them (create/update/delete-missing). Enforces SKU + slug uniqueness across products *and* variations (auto-suffixes slug on collision; `duplicate_sku` on SKU clash). Derives `price`/`on_sale` from the sale window and `stock_status` when stock is managed; updates category/tag `count`; rolls parent stock up for variable products; fires `product.created`/`product.updated`. → `{ product, variations }`.
- **`delete`** — `{ id }`. Cascades variations, decrements counts, fires `product.deleted`.
- **`batch`** — `{ create?: [], update?: [], delete?: [] }` (≤100 total) → per-item results.
- **`duplicate`** — `{ id }` → new draft copy (name "(Copy)", suffixed SKU, reset sales/ratings) incl. variations.
- **`set-stock`** — `{ id, variation_id?, quantity }`. Sets quantity, re-derives status, sends low/out-of-stock admin emails on threshold crossings.
- **`search`** — `{ q?, category_id?, type?, stock_status?, status?, sort?, limit?, skip? }` → `{ rows, has_next }`. `category_id` includes descendant categories.

## admin-orders

Actions: `create-draft` · `create` · `update` · `update-status` · `bulk-status` · `status-counts` · `search` · `recalculate` · `apply-coupon` · `remove-coupon` · `add-note` · `delete-note` · `send-email` · `grant-download` · `revoke-download` · `delete` · `release-expired-holds`

- **`create-draft`** — no payload → empty `pending` admin order (with `order_number`/`order_key`), no lifecycle effects yet. Used by "Add order".
- **`create`** — `{ items, coupon_codes?, fees?, billing?, shipping?, customer_id?, chosen_shipping_method?, payment_method?, customer_note?, status?, reduce_stock? }`. Prices via the same totals engine as checkout, then transitions to `status` (default `pending`). `reduce_stock: false` on a pending order fires creation effects (new_order email, `order.created`) **without** reducing stock.
- **`update`** — `{ order_id, patch }`. The **patch** shape:
  - Any time: `billing`, `shipping`, `customer_id`, `customer_note`, `payment_method`, `meta_data`, `status`.
  - **Line edits require pending/on-hold** (else `409 order_locked`): `items` (specs `{ product_id, variation_id?, quantity, price_override? }`), `fees`, `coupon_codes`, `chosen_shipping_method`. Providing any of these — or changing addresses — triggers a full reprice.
  - A `status` in the patch is delegated to the transition engine last (fires the side effects below); otherwise an `order.updated` webhook fires.
- **`update-status`** — `{ order_id, status, note? }` → runs the transition engine (side-effect matrix below).
- **`bulk-status`** — `{ ids, status }` → `{ results: [{ id, success, error? }] }`.
- **`status-counts`** — no payload → `{ all, pending, processing, "on-hold", completed, cancelled, refunded, failed }` (includes the `all` key). Powers the list tabs.
- **`search`** — `{ q?, status?, date_min?, date_max?, sort?, limit?, skip? }` → `{ rows, has_next }`. `q` matches order number, billing name, billing email.
- **`recalculate`** — `{ order_id, reprice_from_catalog? }` → re-runs tax + totals on the current lines.
- **`apply-coupon` / `remove-coupon`** — `{ order_id, code }` (validates, then reprices; `409 order_locked` if not editable, `409 already_applied`).
- **`add-note`** — `{ order_id, note, is_customer_note? }` (a customer note emails the customer) · **`delete-note`** — `{ note_id }`.
- **`send-email`** — `{ order_id, type }` (re-send an order email, e.g. `customer_invoice`; `force`d).
- **`grant-download`** — `{ order_id, product_id }` (creates `DownloadPermission`s for the product's files) · **`revoke-download`** — `{ permission_id }`.
- **`delete`** — `{ order_id }` — only `pending`/`cancelled`/`failed` (`409 order_locked` otherwise); cascades notes/refunds/permissions; fires `order.deleted`.
- **`release-expired-holds`** — cancels unpaid orders past `hold_expires_at` and restores their stock → `{ released }`.

### Order status side-effect matrix

Applied by the transition engine; each effect is flag-guarded so a re-entered status never double-fires.

| Entering | Stock | Coupons | Dates | Emails | Webhook | Downloads |
|---|---|---|---|---|---|---|
| pending (create) | reduce + set `hold_expires_at` | — | — | `new_order`→admin | `order.created` | — |
| processing | ensure reduced; clear hold | count usage | `date_paid` if unset | `processing`→customer (+`new_order` if unsent) | `order.updated` | grant if virtual-only |
| on-hold | ensure reduced; clear hold | count usage | — | `on_hold_order`→customer | `order.updated` | — |
| completed | ensure reduced | count usage | `date_completed` (+`date_paid`) | `completed_order`→customer | `order.updated` | grant |
| cancelled | restore if reduced | uncount if counted | — | `cancelled_order`→admin | `order.updated` | revoke |
| failed | restore | uncount | — | `failed_order`→admin+customer | `order.updated` | — |
| refunded | (per-refund restock) | keep counted | — | `refunded_order`→customer | `order.updated` | revoke |

`total_sales` increments on first stock reduction, decrements on restore.

## admin-refunds

Actions: `create` · `delete`

- **`create`** — `{ order_id, amount, reason?, line_items?, restock_items?, refund_payment? }`. `line_items` specs: `{ line_id, quantity, refund_total, refund_tax? }`. Validates `amount` ≤ remaining refundable (`400 amount_exceeds_refundable`, `400 invalid_amount`). Restocks per line when `restock_items`. Updates `order.total_refunded`; a full refund transitions the order to `refunded`, otherwise sends `partial_refund` + `order.updated`. When `refund_payment: true`, the response includes `gateway_refund: "not_implemented"` (Stripe placeholder — the UI shows a notice). → `{ refund, order, gateway_refund? }`.
- **`delete`** — `{ refund_id }`. Reverses `total_refunded`; adds a note warning that restocked items are **not** auto-un-restocked.

## admin-coupons

Actions: `save` · `delete` · `batch` · `search`

- **`save`** — `{ coupon }`. Lowercases + enforces unique `code` (`duplicate_code`); percent amount ≤ 100. Fires `coupon.created`/`updated`.
- **`delete`** — `{ id }` (fires `coupon.deleted`) · **`batch`** — `{ create?, update?, delete? }` · **`search`** — `{ q?, limit?, skip? }` → `{ rows, has_next }` (matches code/description).

## admin-customers

Actions: `save` · `delete` · `search` · `invite` · `recalculate-stats`

- **`save`** — `{ customer }`. Unique email; links guest→registered. Fires `customer.*`.
- **`delete`** — `{ id, reassign_orders_to_guest? }`.
- **`search`** — `{ q?, limit?, skip? }` → `{ rows, has_next }` (name/email/username).
- **`invite`** — `{ email }` → `base44.users.inviteUser(email)`, links `user_id`.
- **`recalculate-stats`** — `{ id }` → recomputes `orders_count`, `total_spent`, `is_paying_customer` from the customer's paid orders.

## admin-reviews

Actions: `set-status` · `update` · `delete`. Each recomputes the product's `average_rating`/`rating_count` from approved reviews.
- **`set-status`** — `{ id, status }` (`approved`|`hold`|`spam`|`trash`) · **`update`** — `{ id, rating?, review? }` · **`delete`** — `{ id }`.

## admin-webhooks

Actions: `test` · `redeliver` (webhook definitions themselves are direct `Webhook` CRUD).
- **`test`** — `{ webhook_id }` → POSTs a sample payload, logs a `WebhookDelivery`, returns `{ delivery_id, response_code, success, duration_ms }`.
- **`redeliver`** — `{ delivery_id }` → re-sends the original request body.

## admin-reports

All actions scan orders on demand (counted = `date_paid` set, or status `processing`/`completed`). See implementation-guidelines §Reports for scaling.

| Action | Payload | Returns |
|---|---|---|
| `summary` | — | `{ sales_today, sales_month, orders_by_status, low_stock_count, out_of_stock_count, top_seller }` where `sales_*` = `{ gross_sales, net_sales, orders, items, tax, shipping, discount, refunds }` |
| `sales` | `{ date_min?, date_max?, interval? }` (`day`\|`week`\|`month`) | `{ totals: <agg>, series: [{ period, ...agg }] }` (net = gross − refunds − tax − shipping) |
| `top-sellers` | `{ date_min?, date_max?, limit? }` | `{ rows: [{ product_id, name, sku, quantity, net_revenue }] }` |
| `stock` | — | `{ low_stock: [...], out_of_stock: [...] }` |
| `orders-totals` | — | `{ [status]: count }` |
| `products-totals` | — | `{ total, by: { [type]: count } }` |
| `customers-totals` | — | `{ total, guests, registered, paying }` |
| `coupons-totals` | — | `{ total, by: { [discount_type]: count } }` |
| `reviews-totals` | — | `{ total, by: { [status]: count } }` |
| `categories-totals` / `tags-totals` | — | `{ total, terms: [{ id, name, count }] }` |
| `attributes-totals` | — | `{ total, attributes: [{ id, name, terms }] }` |

## admin-tools

Actions: `status` · `recount-terms` · `recount-coupon-usage` · `recalculate-customer-stats-all` · `prune-webhook-deliveries` · `clear-abandoned-carts` · `regenerate-download-permissions`

- **`status`** — `{ template_version, seeded, settings_groups, counts: { <Entity>: n | "1000+" }, checks: [...] }` — mini system-status; also the seeded/health check for install verification.
- **`recount-terms`** — repairs category/tag/term `count`.
- **`recount-coupon-usage`** — repairs `usage_count`/`used_by`.
- **`recalculate-customer-stats-all`** — repairs all customers' `orders_count`/`total_spent`.
- **`prune-webhook-deliveries`** — `{ keep_days }`.
- **`clear-abandoned-carts`** — `{ older_than_days }`.
- **`regenerate-download-permissions`** — `{ order_id }`.

## seed-store

Not action-routed. Body `{ with_sample_data?: boolean }`. Requires admin. Runs a **canary schema check** first — on any incompatibility returns **422** `{ success:false, code:"schema_incompatible", errors:[{ entity, error }] }` and writes nothing. Otherwise seeds defaults idempotently and (if `with_sample_data` and the store has no products) a sample catalog. → `{ seeded: { settings_groups, gateways, tax_classes, zones, zone_methods }, sample_data: {...counts} | false }`.
