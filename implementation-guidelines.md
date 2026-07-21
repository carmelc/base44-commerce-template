# Implementation Guidelines

Operational guidance for installing, embedding, extending and running the Base44 Commerce Template. Read alongside [`docs/api-admin.md`](./docs/api-admin.md) and [`docs/api-storefront.md`](./docs/api-storefront.md).

---

## 1. Installation

**CLI path (self-hosted repo):**

1. Copy `base44/entities/*`, `base44/functions/*`, `base44/shared/*` into your app's `base44/` dir (merge, don't overwrite unrelated files). `shared/` is bundled into every function at deploy time.
2. `npx base44 entities push` — creates/updates the 24 entity schemas.
3. `npx base44 functions deploy` — deploys the 14 functions.
4. Copy `admin/` → `src/admin/`, `npm i sonner recharts`, mount `<Route path="/admin/*" element={<AdminApp/>}/>`.
5. Grant your user the `admin` role.
6. Open `/admin` → **Initialize store defaults** (runs `seed-store`).

**MCP path (hosted apps):** use the Base44 agent to `write_file` each file; adapt import paths (`@/api/base44Client`, router location) via `list_directory`/`read_file`; then seed as above.

**Verify the install** by invoking `admin-tools` `status`:

```js
const { data } = (await base44.functions.invoke("admin-tools", { action: "status" })).data;
// → { template_version, seeded, settings_groups, counts: {...}, checks: [...] }
```

`seed-store` is **idempotent** and starts with a **canary schema check**: it probe-writes one record per entity it will touch and deletes it. If you've modified an entity schema incompatibly, it aborts with HTTP 422 `schema_incompatible` and writes nothing:

```json
{ "success": false, "code": "schema_incompatible",
  "errors": [{ "entity": "Product", "error": "..." }] }
```

The admin setup screen surfaces these errors verbatim. Sample catalog data is only created when `with_sample_data: true` **and** the store has zero products.

---

## 2. Embedding the admin pages

The admin UI is a self-contained React app under `admin/`. Its only external touchpoints are `@/components/ui/*` (shadcn) and `@/api/base44Client` (your app's SDK client).

**Steps:**

1. Copy `admin/` → `src/admin/`.
2. `npm i sonner recharts`. Verify the shadcn primitives listed in `admin/README.md` are present (`npx shadcn@latest add <name>` for any missing).
3. Mount the router:
   ```jsx
   import AdminApp from "@/admin";
   <Route path="/admin/*" element={<AdminApp />} />
   ```
   If you mount at a different base path, pass it: `<AdminApp basePath="/store-admin" />`.

### Admin-role enforcement (do not weaken)

The shipped `AuthGuard` requires an authenticated user **whose `role === "admin"`**:

- Not logged in → "Please sign in" screen.
- Logged in but **not** admin → "Admin access required" screen (a merely-authenticated customer cannot reach any admin page).

Grant the role via the Base44 dashboard (user management) or `base44.users.inviteUser(email, "admin")`.

**Do not relax this check.** It is the first of three enforcement layers:

1. **UI guard** — `AuthGuard` (client-side; convenience + UX).
2. **Entity RLS** — every admin-only entity (Order, Customer, Coupon, StoreSettings, …) has `"user_condition": { "role": "admin" }` on all operations, so direct SDK reads/writes from a non-admin are rejected by the backend.
3. **Function guard** — every `admin-*` function (and `seed-store`) calls `requireAdmin()`, returning **401** if unauthenticated and **403** if not an admin, before touching data via the service role.

Even if the client guard were bypassed, layers 2 and 3 keep the store data safe. Storefront functions are intentionally public and verify the caller per-action instead (auth session, `cart_token`, or `order_key`).

---

## 3. Building your own UI

The included admin UI is for **store operators**. To build a **customer-facing storefront** (or an alternative admin), use the documented APIs:

- **Storefront** (catalog, cart, checkout, account): [`docs/api-storefront.md`](./docs/api-storefront.md) — includes full request/response shapes, error codes, and end-to-end guest + member walkthroughs. The cart API is complete and token-based; no visitor UI ships with this template, so this is your starting point.
- **Admin / automation**: [`docs/api-admin.md`](./docs/api-admin.md) — every admin function/action plus the direct-entity-CRUD contract.

All functions return the envelope `{ success, data }` (or `{ success, error, code }`); with the SDK the body is on `res.data`:

```js
const res = await base44.functions.invoke("storefront-catalog", { action: "list-products", per_page: 12 });
const { products, has_next } = res.data.data;   // res.data = envelope, .data = payload
```

---

## 4. Stripe wiring (payments)

Payments are **data-only** in this template. `bacs` (bank transfer), `cheque` and `cod` work as manual flows out of the box. The `stripe` gateway is a **placeholder** — enabling it in Payments settings does nothing until you wire it. There are exactly **three** placeholder sites:

1. **`base44/functions/storefront-checkout/entry.ts`** — the `place-order` gateway switch, `case "stripe"`:
   ```ts
   case "stripe":
     payment = { status: "not_implemented", note: "Create a PaymentIntent here and call confirm-payment after success." };
     break;
   ```
   Replace with: create a Stripe PaymentIntent for `order.total` (currency `order.currency`), store `paymentIntent.id` on the order (e.g. `transaction_id`), and return the client secret so your storefront can confirm the card. Leave the order `pending`.

2. **`storefront-checkout` `confirm-payment`** — already implemented as the post-payment hook (`pending`/`on-hold` → `processing`, sets `date_paid`). Call it from your Stripe **webhook** (`payment_intent.succeeded`) or redirect handler, passing `{ order_id, order_key, transaction_id }`.

3. **`base44/functions/admin-refunds/entry.ts`** — `create` with `refund_payment: true` currently returns `gateway_refund: "not_implemented"`. Wire the Stripe refund API here and flip the refund's `refunded_payment` to `true` on success.

**Connector access** (from any function, server-side):

```ts
const { accessToken } = await base44.asServiceRole.connectors.getConnection("stripe");
const res = await fetch("https://api.stripe.com/v1/payment_intents", {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ amount: String(Math.round(order.total * 100)), currency: order.currency.toLowerCase() }),
});
```

Never store card data or secret keys in the `PaymentGateway` entity — use the Base44 Stripe connector / secrets.

---

## 5. No-cron (scheduled work)

Base44 has no scheduler. Three time-based concerns are handled **opportunistically** and via on-demand `admin-tools` actions you can trigger from an external cron (e.g. a GitHub Action hitting the function URL):

| Concern | Opportunistic trigger | On-demand action |
|---|---|---|
| Release stock held by unpaid orders past `hold_stock_minutes` | `storefront-checkout` `place-order` calls it at the start of every checkout | `admin-orders` action `release-expired-holds` |
| Abandoned cart cleanup (48h TTL) | expired carts are marked `abandoned` on next access | `admin-tools` action `clear-abandoned-carts` `{ older_than_days }` |
| Webhook delivery log growth | — | `admin-tools` action `prune-webhook-deliveries` `{ keep_days }` |

Other maintenance actions on `admin-tools`: `recount-terms`, `recount-coupon-usage`, `recalculate-customer-stats-all`, `regenerate-download-permissions`.

---

## 6. Emails

Transactional email is sent via `base44.integrations.Core.SendEmail` from the shared `emails.ts`. Ten order emails are wired to the lifecycle (see the side-effect matrix in `docs/api-admin.md`): `new_order`, `cancelled_order`, `failed_order`, `on_hold_order`, `processing_order`, `completed_order`, `refunded_order`, `partial_refund`, `customer_invoice`, `customer_note`. `reset_password` and `new_account` are handled by **Base44 auth**, not this template.

- Per-type enable/subject/heading/recipient overrides live in the `emails` StoreSettings group (editable in Settings → Emails). Blank = built-in default.
- `emails_sent[]` on each order dedupes lifecycle emails so a re-entered status won't re-send.
- Deliverability (SPF/DKIM, from-address) depends on your Base44 email configuration; set a real `from_address` and `admin_recipients` before going live. Every send is recorded in the `EmailLog` entity.

---

## 7. Webhooks

`webhooks.ts` `dispatch()` fires on `order.*`, `product.*`, `customer.*`, `coupon.*` (created/updated/deleted, plus order/product `restored`). Each active `Webhook` matching the topic receives an HTTP POST with headers `X-WC-Webhook-Topic/-Resource/-Event/-ID/-Delivery-ID/-Signature`. The signature is **base64 HMAC-SHA256** of the body, keyed by the webhook's `secret` (Web Crypto).

- Every attempt is logged as a `WebhookDelivery` (request/response bodies truncated to 32 KB). Prune with `admin-tools` `prune-webhook-deliveries`.
- `failure_count` increments on non-2xx/timeout and resets on success; a webhook auto-disables after **5** consecutive failures.
- The `secret` is stored on the (admin-only-RLS) `Webhook` entity. For higher assurance, move it to Base44 secrets and read it in `dispatch()`.
- Verify deliveries on the receiver by recomputing the HMAC over the raw body with your secret.

---

## 8. Images & downloadable files

- **Catalog images** — the admin `MediaUploader` uses `base44.integrations.Core.UploadFile({ file })` → public URL, stored in `product.images[]` / `variation.image`.
- **Downloadable products** — store files as the download's `file_url`. For private files, upload with `Core.UploadPrivateFile` (stores a `file_uri`, not an `http` URL). `storefront-account` `get-download` detects non-`http` URIs and returns a short-lived signed URL via `Core.CreateFileSignedUrl` (1-hour expiry), decrementing `downloads_remaining` and enforcing `access_expires`.

---

## 9. Limits & concurrency

- **Pagination.** The SDK `filter`/`list` cap out at 5,000 records/page and there is **no total-count API**. Server-side scans use paged loops (`shared/scan.ts` `scanAll`, page size 500). Admin lists use limit+skip with a `limit+1` "has-next" probe — the UI shows *Page N ‹ ›*, never a total.
- **Search** is server-side (`search` actions scan + JS-filter) because entity `filter` is exact-match only.
- **Reports** scan orders on demand — fine to ~10k orders per range. Beyond that, materialize an `OrderStats` entity updated on each order transition and aggregate from it (sketch: one record per day per status with summed totals; `admin-reports` reads the pre-aggregated rows instead of scanning `Order`).
- **No transactions.** A few consequences, all documented in code:
  - `nextOrderNumber` is `max(order_number)+1` with a small retry; under heavy concurrent checkout two orders could theoretically collide — acceptable for typical volume, or front it with a dedicated counter entity if needed.
  - Stock decrement is last-write-wins; oversell is possible under simultaneous checkouts of the last unit. Mitigate with the hold mechanism (already in place) or a stricter reserve step if your volume warrants.
  - Denormalized counters (`usage_count`, `total_sales`, `orders_count`, term `count`) can drift; `admin-tools` recount actions repair them.
- **Record size.** Orders embed their line/shipping/tax/fee/coupon lines. Extremely large orders (hundreds of distinct line items) push against per-record size limits; split or paginate if you expect that.

---

## 10. Reports performance

See §9. The `admin-reports` `summary`/`sales`/`top-sellers` actions scan `Order` (and `OrderRefund`) filtered to counted orders (`date_paid` set, or status `processing`/`completed`). Net sales = gross − refunds − tax − shipping (Woo convention). For large catalogs, cache `summary` on the dashboard and consider the `OrderStats` materialization above.

---

## 11. Guest access & security

- Storefront functions are **public** (anonymous invocation). Confirm your app allows unauthenticated function calls and public reads of the public-read entities (catalog). If you want a login-required store, set `accounts.guest_checkout = false` (checkout then returns `401 login_required` for anonymous callers) and gate catalog reads.
- `cart_token` and `order_key` are **bearer credentials** — possession grants access to that cart/order. Always serve over HTTPS; don't log them; treat them like secrets.
- Carts and orders have admin-only RLS; customers never touch those entities directly — all access is mediated by `storefront-*` functions using the service role after verifying the caller.

---

## 12. Divergences from WooCommerce

Honest list of where this template intentionally differs:

- **No `checkout-draft` order status.** In-progress checkouts live in the `Cart` entity (bearer-token) instead of draft orders.
- **Stock is reduced immediately at order creation** + released on hold expiry, replacing Woo's separate `wc_reserved_stock` table.
- **Downloads track a count only** — `download_count` + `downloads_remaining`; no per-event download log rows.
- **No review replies.** Matches the WooCommerce REST surface (replies are a WP-comment feature).
- **One tax rate per priority** is applied (first by `menu_order`), matching Woo's documented behavior; exotic multi-rate-per-priority setups are simplified.
- **`limit_usage_to_x_items`** applies to the highest-priced eligible units first (price-desc) — a deterministic approximation of Woo's item selection.
- **Payment tokens / saved cards** are delegated to Stripe (when wired); no local token vault.
- **Money is stored as numbers** (2-dp, rounded via `round2`), not Woo's decimal strings.
- **Settings are grouped records** (`StoreSettings` one per group), not individual option rows.
