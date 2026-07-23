# Implementation Guidelines

Operational guidance for extending, operating and building on the Base44 Commerce Template. This document assumes the static installation is already done — see [`installation-guidelines.md`](./installation-guidelines.md) — and remains available inside the installed app at `examples/commerce/implementation-guidelines.md`. Read alongside [`docs/api-admin.md`](./docs/api-admin.md) and [`docs/api-storefront.md`](./docs/api-storefront.md).

> **If you are a Base44 agent working inside the runtime, read this first:**
> - **Don't read the whole codebase up front.** Start with this file, then open only the files your current task touches plus the matching API reference (below), pulling in more as you go. Reading everything first just burns context.
> - **Don't weaken the admin gating.** The UI guard, entity RLS and function guards form three enforcement layers — see *Embedding the admin pages* in [`installation-guidelines.md`](./installation-guidelines.md) — keep all of them intact when changing routes or schemas.
> - **No storefront UI ships** — only the storefront *API* is included. To build the visitor-facing shopfront, read [`docs/api-storefront.md`](./docs/api-storefront.md) first and implement against it (see §2).

---

## 1. Register the template in `AGENTS.md`

So that future agent sessions working on the app know the store exists and where its documentation lives, add an entry to the app's `AGENTS.md` under an **Installed templates** section (create the section if it doesn't exist), pointing at this file:

```md
## Installed templates

- commerce - `examples/commerce/implementation-guidelines.md` — Base44 Commerce template: 24 `commerce.*` entities, 14 `commerce/*` backend functions (storefront + admin APIs), the shared commerce engine under `base44/shared/commerce/`, the store admin UI mounted at `/admin`, and the `commerce/StoreAdmin` agent (admin copilot bot in the admin sidebar). Read that file before working on store features.
```

---

## 2. Building your own UI

The included admin UI is for **store operators**. To build a **customer-facing storefront** (or an alternative admin), use the documented APIs:

- **Storefront** (catalog, cart, checkout, account): [`docs/api-storefront.md`](./docs/api-storefront.md) — includes full request/response shapes, error codes, and end-to-end guest + member walkthroughs. The cart API is complete and token-based; no visitor UI ships with this template, so this is your starting point.
- **Admin / automation**: [`docs/api-admin.md`](./docs/api-admin.md) — every admin function/action plus the direct-entity-CRUD contract.

All functions return the envelope `{ success, data }` (or `{ success, error, code }`); with the SDK the body is on `res.data`:

```js
const res = await base44.functions.invoke("commerce/storefront-catalog", { action: "list-products", per_page: 12 });
const { products, has_next } = res.data.data;   // res.data = envelope, .data = payload
```

---

## 3. Stripe wiring (payments)

Payments are **data-only** in this template. `bacs` (bank transfer), `cheque` and `cod` work as manual flows out of the box. The `stripe` gateway is a **placeholder** — enabling it in Payments settings does nothing until you wire it. There are exactly **three** placeholder sites:

1. **`base44/functions/commerce/storefront-checkout/entry.ts`** — the `place-order` gateway switch, `case "stripe"`:
   ```ts
   case "stripe":
     payment = { status: "not_implemented", note: "Create a PaymentIntent here and call confirm-payment after success." };
     break;
   ```
   Replace with: create a Stripe PaymentIntent for `order.total` (currency `order.currency`), store `paymentIntent.id` on the order (e.g. `transaction_id`), and return the client secret so your storefront can confirm the card. Leave the order `pending`.

2. **`commerce/storefront-checkout` `confirm-payment`** — already implemented as the post-payment hook (`pending`/`on-hold` → `processing`, sets `date_paid`). Call it from your Stripe **webhook** (`payment_intent.succeeded`) or redirect handler, passing `{ order_id, order_key, transaction_id }`.

3. **`base44/functions/commerce/admin-refunds/entry.ts`** — `create` with `refund_payment: true` currently returns `gateway_refund: "not_implemented"`. Wire the Stripe refund API here and flip the refund's `refunded_payment` to `true` on success.

**Connector access** (from any function, server-side):

```ts
const { accessToken } = await base44.asServiceRole.connectors.getConnection("stripe");
const res = await fetch("https://api.stripe.com/v1/payment_intents", {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ amount: String(Math.round(order.total * 100)), currency: order.currency.toLowerCase() }),
});
```

Never store card data or secret keys in the `commerce.PaymentGateway` entity — use the Base44 Stripe connector / secrets.

---

## 4. Scheduled work (workflows)

Base44 **has** a scheduler — the recurring maintenance below is run by **scheduled workflows**, and the Base44 agent can create them for you. **This template ships no workflow/schedule files on purpose**: don't look for them under `base44/` and don't add them here — create the workflows directly in the target app.

**Instruct the agent (or set up yourself): create one scheduled workflow per row below.** Each workflow does one thing — invoke the given function action on the chosen cadence:

```js
await base44.functions.invoke("commerce/admin-tools", { action: "clear-abandoned-carts", older_than_days: 2 });
```

| Workflow to create | What it does | Action to invoke | Payload | Suggested cadence |
|---|---|---|---|---|
| Release expired stock holds | Frees stock held by unpaid orders past `hold_stock_minutes`. `commerce/storefront-checkout` `place-order` already runs this at the start of every checkout, so the schedule mainly covers quiet periods. | `commerce/admin-orders` `release-expired-holds` | — | every 5–15 min |
| Abandoned cart cleanup | Marks carts past the 48 h TTL as `abandoned`. Also happens lazily on next cart access. | `commerce/admin-tools` `clear-abandoned-carts` | `{ older_than_days: 2 }` | hourly–daily |
| Prune webhook delivery log | Deletes old `commerce.WebhookDelivery` rows so the log doesn't grow unbounded. **No opportunistic fallback — this one genuinely needs a schedule.** | `commerce/admin-tools` `prune-webhook-deliveries` | `{ keep_days: 30 }` | daily–weekly |

**Optional — drift repair.** Denormalized counters can drift without transactions (see §7). If you want them self-healing, add a nightly/weekly workflow that calls the `commerce/admin-tools` recount actions: `recount-terms`, `recount-coupon-usage`, `recalculate-customer-stats-all`, `regenerate-download-permissions`.

Every action above is guarded by `requireAdmin()`, so each scheduled workflow must run with **admin privileges** (an admin identity / service context), not as an anonymous caller.

---

## 5. Emails

Transactional email is sent via `base44.integrations.Core.SendEmail` from the shared `emails.ts`. Ten order emails are wired to the lifecycle (see the side-effect matrix in `docs/api-admin.md`): `new_order`, `cancelled_order`, `failed_order`, `on_hold_order`, `processing_order`, `completed_order`, `refunded_order`, `partial_refund`, `customer_invoice`, `customer_note`. `reset_password` and `new_account` are handled by **Base44 auth**, not this template.

- Per-type enable/subject/heading/recipient overrides live in the `emails` StoreSettings group (editable in Settings → Emails). Blank = built-in default.
- `emails_sent[]` on each order dedupes lifecycle emails so a re-entered status won't re-send.
- Deliverability (SPF/DKIM, from-address) depends on your Base44 email configuration; set a real `from_address` and `admin_recipients` before going live. Every send is recorded in the `commerce.EmailLog` entity.

---

## 6. Webhooks

`webhooks.ts` `dispatch()` fires on `order.*`, `product.*`, `customer.*`, `coupon.*` (created/updated/deleted, plus order/product `restored`). Each active `commerce.Webhook` matching the topic receives an HTTP POST with headers `X-Commerce-Webhook-Topic/-Resource/-Event/-ID/-Delivery-ID/-Signature`. The signature is **base64 HMAC-SHA256** of the body, keyed by the webhook's `secret` (Web Crypto).

- Every attempt is logged as a `commerce.WebhookDelivery` (request/response bodies truncated to 32 KB). Prune with `commerce/admin-tools` `prune-webhook-deliveries`.
- `failure_count` increments on non-2xx/timeout and resets on success; a webhook auto-disables after **5** consecutive failures.
- The `secret` is stored on the (admin-only-RLS) `commerce.Webhook` entity. For higher assurance, move it to Base44 secrets and read it in `dispatch()`.
- Verify deliveries on the receiver by recomputing the HMAC over the raw body with your secret.

---

## 7. Images & downloadable files

- **Catalog images** — the admin `MediaUploader` uses `base44.integrations.Core.UploadFile({ file })` → public URL, stored in `product.images[]` / `variation.image`.
- **Downloadable products** — store files as the download's `file_url`. For private files, upload with `Core.UploadPrivateFile` (stores a `file_uri`, not an `http` URL). `commerce/storefront-account` `get-download` detects non-`http` URIs and returns a short-lived signed URL via `Core.CreateFileSignedUrl` (1-hour expiry), decrementing `downloads_remaining` and enforcing `access_expires`.

---

## 8. Limits & concurrency

- **Pagination.** The SDK `filter`/`list` cap out at 5,000 records/page and there is **no total-count API**. Server-side scans use paged loops (`shared/scan.ts` `scanAll`, page size 500). Admin lists use limit+skip with a `limit+1` "has-next" probe — the UI shows *Page N ‹ ›*, never a total.
- **Search** is server-side (`search` actions scan + JS-filter) because entity `filter` is exact-match only.
- **Reports** scan orders on demand — fine to ~10k orders per range. Beyond that, materialize an `OrderStats` entity updated on each order transition and aggregate from it (sketch: one record per day per status with summed totals; `commerce/admin-reports` reads the pre-aggregated rows instead of scanning `commerce.Order`).
- **No transactions.** A few consequences, all documented in code:
  - `nextOrderNumber` is `max(order_number)+1` with a small retry; under heavy concurrent checkout two orders could theoretically collide — acceptable for typical volume, or front it with a dedicated counter entity if needed.
  - Stock decrement is last-write-wins; oversell is possible under simultaneous checkouts of the last unit. Mitigate with the hold mechanism (already in place) or a stricter reserve step if your volume warrants.
  - Denormalized counters (`usage_count`, `total_sales`, `orders_count`, term `count`) can drift; `commerce/admin-tools` recount actions repair them.
- **Record size.** Orders embed their line/shipping/tax/fee/coupon lines. Extremely large orders (hundreds of distinct line items) push against per-record size limits; split or paginate if you expect that.

---

## 9. Reports performance

See §8. The `commerce/admin-reports` `summary`/`sales`/`top-sellers` actions scan `commerce.Order` (and `commerce.OrderRefund`) filtered to counted orders (`date_paid` set, or status `processing`/`completed`). Net sales = gross − refunds − tax − shipping (standard convention). For large catalogs, cache `summary` on the dashboard and consider the `OrderStats` materialization above.

---

## 10. Guest access & security

- Storefront functions are **public** (anonymous invocation). Confirm your app allows unauthenticated function calls and public reads of the public-read entities (catalog). If you want a login-required store, set `accounts.guest_checkout = false` (checkout then returns `401 login_required` for anonymous callers) and gate catalog reads.
- `cart_token` and `order_key` are **bearer credentials** — possession grants access to that cart/order. Always serve over HTTPS; don't log them; treat them like secrets.
- Carts and orders have admin-only RLS; customers never touch those entities directly — all access is mediated by `commerce/storefront-*` functions using the service role after verifying the caller.
