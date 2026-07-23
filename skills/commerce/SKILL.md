---
name: commerce
description: Base44 Commerce template — 24 commerce.* entities, 14 commerce/* backend functions (storefront + admin APIs), the shared commerce engine under base44/shared/commerce/, the store admin UI mounted at /admin, and the commerce/StoreAdmin agent (admin copilot). Read before working on store features — the admin UI, storefront building, Stripe wiring, scheduled maintenance, emails, webhooks, downloads, or scaling limits.
---

# Commerce

Operational guidance for extending, operating and building on the Base44 Commerce Template. This file is the map: it stays short, and each topic links to a focused reference under [`skills/commerce/references/`](./references/) — open one only when your task touches that area. The API references live in [`skills/commerce/docs/`](./docs/).

> **If you are a Base44 agent working inside the runtime, read this first:**
> - **Don't read the whole codebase up front.** Start with this file, then open only the files your current task touches plus the matching reference below, pulling in more as you go. Reading everything first just burns context.
> - **Don't weaken the admin gating.** The UI guard, entity RLS and function guards form three enforcement layers — see [`skills/commerce/post-installation.md`](./post-installation.md) — keep all of them intact when changing routes or schemas.

## IMPORTANT — first-time installation

If the template was just installed (or you are installing it right now), read [`skills/commerce/post-installation.md`](./post-installation.md) **before anything else**: embedding the admin pages, the three-layer admin-role enforcement (do not weaken), and registering the template + skill in the app's `AGENTS.md`. The full install-from-scratch steps are in [`skills/commerce/installation-guidelines.md`](./installation-guidelines.md).

## Working on the UI

- **Admin UI** (`src/commerce/admin/`) — a complete store back office ships with the template, and it is **yours to change**: restyle it, add or remove pages, rework flows, extend it however the app needs. To understand the backend it talks to, read [`skills/commerce/docs/api-admin.md`](./docs/api-admin.md) — every admin function/action plus the direct-entity-CRUD contract. The only invariant is the admin-role gating (see above).
- **Storefront** — **no visitor UI ships**; only the storefront *API* is included (complete, token-based cart). To build the customer-facing shopfront, read [`skills/commerce/docs/api-storefront.md`](./docs/api-storefront.md) first — full request/response shapes, error codes, and end-to-end guest + member walkthroughs — and implement against it.

All functions return the envelope `{ success, data }` (or `{ success, error, code }`); with the SDK the body is on `res.data`:

```js
const res = await base44.functions.invoke("commerce/storefront-catalog", { action: "list-products", per_page: 12 });
const { products, has_next } = res.data.data;   // res.data = envelope, .data = payload
```

## Topic references

Open the matching file under `skills/commerce/references/` only when a task touches its area:

| Topic | Read when the task involves | Reference |
|---|---|---|
| Stripe & payments | wiring real payment processing (gateways are data-only; `stripe` is a placeholder with three wiring sites) | [`references/stripe-payments.md`](./references/stripe-payments.md) |
| Scheduled work | recurring maintenance — stock-hold release, abandoned-cart cleanup, webhook-log pruning, counter-drift repair | [`references/scheduled-work.md`](./references/scheduled-work.md) |
| Emails | transactional order emails, per-type overrides, deliverability, the email log | [`references/emails.md`](./references/emails.md) |
| Webhooks | outbound webhooks, HMAC signing, delivery log, auto-disable behavior | [`references/webhooks.md`](./references/webhooks.md) |
| Images & downloads | catalog image uploads, downloadable products, private files & signed URLs | [`references/media-and-downloads.md`](./references/media-and-downloads.md) |
| Limits & performance | pagination caps, search, no-transaction consequences, record size, reports scaling | [`references/limits-and-performance.md`](./references/limits-and-performance.md) |
| Guest access & security | public storefront functions, `cart_token`/`order_key` handling, RLS boundaries | [`references/guest-access-security.md`](./references/guest-access-security.md) |
