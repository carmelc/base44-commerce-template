# Base44 Commerce Template

A **Commerce backend + admin UI** for [Base44](https://base44.com) apps, delivered as a copyable file set. Drop `base44/` and `src/commerce/admin/` into an existing Base44 app to add a full store: catalog, orders, coupons, customers, reviews, tax, shipping, webhooks, reports and transactional emails — plus a public storefront API for building your own shopfront.

It provides a full-featured **commerce data model and behavior** (product types, order lifecycle, coupon rules, tax priority/compound math, shipping zones) using Base44-idiomatic primitives (entity JSON schemas, Deno functions, the Base44 SDK).

## What's included

- **24 entities** — Products (simple/grouped/external/variable), variations, categories, tags, attributes + terms, reviews, orders (embedded line/shipping/tax/fee/coupon lines), order notes, refunds, coupons, customers, tax classes/rates, shipping zones/methods, payment gateways, store settings, webhooks + deliveries, carts, download permissions, email log.
- **14 backend functions** — 9 admin (`commerce/admin-products`, `commerce/admin-orders`, `commerce/admin-refunds`, `commerce/admin-coupons`, `commerce/admin-customers`, `commerce/admin-reviews`, `commerce/admin-webhooks`, `commerce/admin-reports`, `commerce/admin-tools`), 4 storefront (`commerce/storefront-catalog`, `commerce/storefront-cart`, `commerce/storefront-checkout`, `commerce/storefront-account`), and an idempotent `commerce/seed-store`.
- **Shared commerce engine** (`base44/shared/commerce/`) — totals, tax, shipping, coupons, stock, order lifecycle, webhook dispatch (HMAC-signed), emails, plus static country/currency/continent data.
- **Admin UI** (`src/commerce/admin/`) — a React/Tailwind/shadcn admin with a familiar store back-office information architecture: dashboard, orders, products, coupons, customers, reports, full settings, webhooks. Admin-role gated.
- **StoreAdmin agent + bot** — an AI copilot (`base44/agents/commerce/StoreAdmin.jsonc`, registered as `commerce/StoreAdmin`) with the `commerce/*` functions attached directly as tools (calls run as the chatting user → `requireAdmin()` still applies), variant-aware order editing, plus a chat panel in the admin sidebar with GFM markdown-table rendering.
- **Docs** — this README, [`installation-guidelines.md`](./installation-guidelines.md), the commerce skill [`skills/commerce/SKILL.md`](./skills/commerce/SKILL.md) (operating & extending, installed into the app so agents pick it up natively), and the API references in [`docs/`](./docs/).

## Repo map

```
base44-commerce-template/
├── base44/
│   ├── entities/     24 .jsonc entity schemas (commerce.*.jsonc)
│   ├── functions/
│   │   └── commerce/ 14 Deno functions (entry.ts each), invoked as "commerce/<name>"
│   ├── agents/
│   │   └── commerce/ StoreAdmin.jsonc — AI admin copilot ("commerce/StoreAdmin")
│   └── shared/
│       └── commerce/ commerce engine + static data (bundled into every function)
├── src/
│   └── commerce/
│       └── admin/    React admin UI (copy into your app's src/commerce/)
├── docs/
│   ├── api-admin.md       admin function/entity reference
│   └── api-storefront.md  storefront function reference (build your own shopfront)
├── scripts/
│   └── install.js         static installer (run from <app>/examples/commerce/scripts/)
├── skills/
│   └── commerce/
│       └── SKILL.md       commerce skill — operating & extending after installation
│                          (copied into the app's skills/ so agents know the store natively)
├── installation-guidelines.md   installing into an app (scripted or manual)
└── README.md
```

## Quick start (Base44 CLI)

From your existing Base44 app:

1. **Copy the files** — either copy this whole repo into your app at `examples/commerce/` and run `node examples/commerce/scripts/install.js`, or merge `entities/`, `functions/`, `shared/` into your app's `base44/` directory by hand (see [`installation-guidelines.md`](./installation-guidelines.md)). Confirm your `base44/config.jsonc` `entitiesDir`/`functionsDir` point at these folders.
2. **Push the schema, functions and agent:**
   ```bash
   npx base44 entities push
   npx base44 functions deploy
   npx base44 agents push
   ```
3. **Copy the admin UI:** `src/commerce/admin/` → `src/commerce/admin/`.
4. **Install UI deps** (if not already present) and confirm shadcn primitives:
   ```bash
   npm i sonner recharts remark-gfm
   ```
   See [`src/commerce/admin/README.md`](./src/commerce/admin/README.md) for the exact shadcn component list.
5. **Mount the admin router** in your app:
   ```jsx
   import AdminApp from "@/commerce/admin";
   // inside your <Routes>:
   <Route path="/admin/*" element={<AdminApp />} />
   ```
6. **Grant yourself the `admin` role** (Base44 dashboard → users, or `users.inviteUser(email, "admin")`). The admin UI refuses non-admins.
7. **Open `/admin`** → click **Initialize store defaults** on the first-run setup screen. This runs `commerce/seed-store` (settings, gateways, tax classes, fallback shipping zone; optional sample catalog if the store is empty).

## Quick start (Base44 MCP / hosted apps)

If you build on Base44's hosted platform, use the Base44 agent/MCP to write the files instead of the CLI:

1. Copy this whole repo into the target app at `examples/commerce/` (e.g. download + extract a tarball with `run_command`), then run `node examples/commerce/scripts/install.js` via `run_command` — or use `write_file` to copy every file under `base44/` and `src/commerce/admin/` individually (use `list_directory`/`read_file` to adapt to the app's actual layout — e.g. the `@/api/base44Client` path and your router file).
2. Wait for the app to build (`get_app_status`), then confirm entities exist (`list_entity_schemas`).
3. Grant your user the `admin` role, open the app, and run **Initialize store defaults**.

## What's NOT included

- **No visitor/storefront UI.** The storefront **API** is complete (`commerce/storefront-*` functions); building the shopfront is up to you — see [`docs/api-storefront.md`](./docs/api-storefront.md).
- **No live payment processing.** Payment gateways are modeled as data (bank transfer / cheque / COD work as manual flows). A **Stripe** gateway placeholder is included; wire it via the Base44 Stripe connector — see [`skills/commerce/SKILL.md`](./skills/commerce/SKILL.md) §Stripe wiring.
- **No scheduled workflows shipped.** Base44 *does* have a scheduler, but this template ships no workflow files — time-based jobs (stock-hold release, cart expiry, webhook-log pruning) run **opportunistically** where possible, and for the rest you (or the Base44 agent) create scheduled workflows that call `commerce/admin-tools`/`commerce/admin-orders` actions — see *Scheduled work* in [`skills/commerce/SKILL.md`](./skills/commerce/SKILL.md).

## Next steps

- **Install into your app:** [`installation-guidelines.md`](./installation-guidelines.md)
- **Operate & extend:** the commerce skill — [`skills/commerce/SKILL.md`](./skills/commerce/SKILL.md)
- **Build a storefront:** [`docs/api-storefront.md`](./docs/api-storefront.md)
- **Admin automation / alternative admin:** [`docs/api-admin.md`](./docs/api-admin.md)
