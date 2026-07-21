# Base44 Commerce Template

A **WooCommerce-parity commerce backend + admin UI** for [Base44](https://base44.com) apps, delivered as a copyable file set. Drop `base44/` and `src/commerce/admin/` into an existing Base44 app to add a full store: catalog, orders, coupons, customers, reviews, tax, shipping, webhooks, reports and transactional emails — plus a public storefront API for building your own shopfront.

It reproduces WooCommerce's **data model and behavior** (product types, order lifecycle, coupon rules, tax priority/compound math, shipping zones) using Base44-idiomatic primitives (entity JSON schemas, Deno functions, the Base44 SDK). It is an independent implementation of the publicly documented WooCommerce feature set — no WooCommerce/WordPress code is used.

## What's included

- **24 entities** — Products (simple/grouped/external/variable), variations, categories, tags, attributes + terms, reviews, orders (embedded line/shipping/tax/fee/coupon lines), order notes, refunds, coupons, customers, tax classes/rates, shipping zones/methods, payment gateways, store settings, webhooks + deliveries, carts, download permissions, email log.
- **14 backend functions** — 9 admin (`admin-products`, `admin-orders`, `admin-refunds`, `admin-coupons`, `admin-customers`, `admin-reviews`, `admin-webhooks`, `admin-reports`, `admin-tools`), 4 storefront (`storefront-catalog`, `storefront-cart`, `storefront-checkout`, `storefront-account`), and an idempotent `seed-store`.
- **Shared commerce engine** (`base44/shared/`) — totals, tax, shipping, coupons, stock, order lifecycle, webhook dispatch (HMAC-signed), emails, plus static country/currency/continent data.
- **Admin UI** (`src/commerce/admin/`) — a React/Tailwind/shadcn admin mirroring WooCommerce's information architecture: dashboard, orders, products, coupons, customers, reports, full settings, webhooks. Admin-role gated.
- **Docs** — this README, [`implementation-guidelines.md`](./implementation-guidelines.md), and the API references in [`docs/`](./docs/).

## Repo map

```
base44-commerce-template/
├── base44/
│   ├── entities/     24 .jsonc entity schemas
│   ├── functions/    14 Deno functions (entry.ts each)
│   └── shared/       commerce engine + static data (bundled into every function)
├── src/
│   └── commerce/
│       └── admin/    React admin UI (copy into your app's src/commerce/)
├── docs/
│   ├── api-admin.md       admin function/entity reference
│   └── api-storefront.md  storefront function reference (build your own shopfront)
├── implementation-guidelines.md
└── README.md
```

## Quick start (Base44 CLI)

From your existing Base44 app:

1. **Copy backend assets** into your app's `base44/` directory (merge `entities/`, `functions/`, `shared/`). Confirm your `base44/config.jsonc` `entitiesDir`/`functionsDir` point at these folders.
2. **Push the schema and functions:**
   ```bash
   npx base44 entities push
   npx base44 functions deploy
   ```
3. **Copy the admin UI:** `src/commerce/admin/` → `src/commerce/admin/`.
4. **Install UI deps** (if not already present) and confirm shadcn primitives:
   ```bash
   npm i sonner recharts
   ```
   See [`src/commerce/admin/README.md`](./src/commerce/admin/README.md) for the exact shadcn component list.
5. **Mount the admin router** in your app:
   ```jsx
   import AdminApp from "@/commerce/admin";
   // inside your <Routes>:
   <Route path="/admin/*" element={<AdminApp />} />
   ```
6. **Grant yourself the `admin` role** (Base44 dashboard → users, or `users.inviteUser(email, "admin")`). The admin UI refuses non-admins.
7. **Open `/admin`** → click **Initialize store defaults** on the first-run setup screen. This runs `seed-store` (settings, gateways, tax classes, fallback shipping zone; optional sample catalog if the store is empty).

## Quick start (Base44 MCP / hosted apps)

If you build on Base44's hosted platform, use the Base44 agent/MCP to write the files instead of the CLI:

1. Use `write_file` to copy every file under `base44/` and `src/commerce/admin/` into the target app (use `list_directory`/`read_file` to adapt to the app's actual layout — e.g. the `@/api/base44Client` path and your router file).
2. Wait for the app to build (`get_app_status`), then confirm entities exist (`list_entity_schemas`).
3. Grant your user the `admin` role, open the app, and run **Initialize store defaults**.

## What's NOT included

- **No visitor/storefront UI.** The storefront **API** is complete (`storefront-*` functions); building the shopfront is up to you — see [`docs/api-storefront.md`](./docs/api-storefront.md).
- **No live payment processing.** Payment gateways are modeled as data (bank transfer / cheque / COD work as manual flows). A **Stripe** gateway placeholder is included; wire it via the Base44 Stripe connector — see [`implementation-guidelines.md`](./implementation-guidelines.md) §Stripe wiring.
- **No scheduled workflows shipped.** Base44 *does* have a scheduler, but this template ships no workflow files — time-based jobs (stock-hold release, cart expiry, webhook-log pruning) run **opportunistically** where possible, and for the rest you (or the Base44 agent) create scheduled workflows that call `admin-tools`/`admin-orders` actions — see *Scheduled work* in [`implementation-guidelines.md`](./implementation-guidelines.md).

## Next steps

- **Embedding & operations:** [`implementation-guidelines.md`](./implementation-guidelines.md)
- **Build a storefront:** [`docs/api-storefront.md`](./docs/api-storefront.md)
- **Admin automation / alternative admin:** [`docs/api-admin.md`](./docs/api-admin.md)
