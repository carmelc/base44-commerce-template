# Installation Guidelines

How to install the Base44 Commerce Template into an existing Base44 app. Once installed, day-2 guidance — extending, operating, and building on the template — lives in [`implementation-guidelines.md`](./implementation-guidelines.md), alongside the API references in [`docs/`](./docs/).

> **If you are a Base44 agent working inside the runtime, read this first:**
> - **Skip the `npx base44` commands.** The runtime deploys functions and pushes entities automatically the moment you write the files — writing a resource file *is* the deploy.
> - **Don't grant admin roles.** Granting a user the `admin` role is not an install step for you; instead, validate that the admin-role gating (§3) is preserved when you merge the admin routes into the app's router.
> - **Don't read the whole codebase up front.** Copy the files, wire the router, and open only what your current task touches.

---

## 1. Static installation (copying the files)

**Scripted.** Copy this entire repository into the target app at `examples/commerce/`, then run from the app root:

```bash
node examples/commerce/scripts/install.js
```

Relative to the script's own folder (`examples/commerce/scripts/`), it copies:

| From (template) | To (app) |
|---|---|
| `../base44/entities/commerce.*.jsonc` | `../../../base44/entities/` |
| `../base44/functions/commerce/` | `../../../base44/functions/commerce/` |
| `../base44/shared/commerce/` | `../../../base44/shared/commerce/` |
| `../src/commerce/admin/` | `../../../src/commerce/admin/` |

Directories are merged: files owned by the template are overwritten (re-running after a template update is safe); everything else in your app is left untouched. The template repo itself stays under `examples/commerce/` — including this file, `implementation-guidelines.md` and `docs/` — so agents and teammates can consult it later.

**Manual.** Equivalently, copy by hand:

1. Copy `base44/entities/commerce.*`, `base44/functions/commerce/*`, `base44/shared/commerce/*` into your app's `base44/` dir (merge, don't overwrite unrelated files). `shared/` is bundled into every function at deploy time.
2. Copy `src/commerce/admin/` → `src/commerce/admin/`.

Confirm your `base44/config.jsonc` `entitiesDir`/`functionsDir` point at these folders (the defaults do).

## 2. Deploy and wire up

1. `npx base44 entities push` — creates/updates the 24 entity schemas. *(CLI path only — the Base44 runtime deploys on write.)*
2. `npx base44 functions deploy` — deploys the 14 functions. *(CLI path only.)*
3. `npm i sonner recharts` (if not already present) and verify the shadcn primitives listed in [`src/commerce/admin/README.md`](./src/commerce/admin/README.md) exist in your app.
4. Mount the admin router (§3).
5. Grant your user the `admin` role.
6. Open `/admin` → **Initialize store defaults** on the first-run setup screen (runs `commerce/seed-store`).

Check the install at any time:

```js
const { data } = (await base44.functions.invoke("commerce/admin-tools", { action: "status" })).data;
// → { template_version, seeded, settings_groups, counts: {...}, checks: [...] }
```

`commerce/seed-store` is **idempotent** and starts with a **canary schema check**: it probe-writes one record per entity it will touch and deletes it. If you've modified an entity schema incompatibly, it aborts with HTTP 422 `schema_incompatible` and writes nothing:

```json
{ "success": false, "code": "schema_incompatible",
  "errors": [{ "entity": "Product", "error": "..." }] }
```

The admin setup screen surfaces these errors verbatim. Sample catalog data is only created when `with_sample_data: true` **and** the store has zero products.

---

## 3. Embedding the admin pages

The admin UI is a self-contained React app under `src/commerce/admin/`. Its only external touchpoints are `@/components/ui/*` (shadcn) and `@/api/base44Client` (your app's SDK client).

**Steps:**

1. Copy `src/commerce/admin/` → `src/commerce/admin/` (already done if you ran `scripts/install.js`).
2. `npm i sonner recharts`. Verify the shadcn primitives listed in `src/commerce/admin/README.md` are present (`npx shadcn@latest add <name>` for any missing).
3. Mount the router:
   ```jsx
   import AdminApp from "@/commerce/admin";
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
2. **Entity RLS** — every admin-only entity (commerce.Order, commerce.Customer, commerce.Coupon, commerce.StoreSettings, …) has `"user_condition": { "role": "admin" }` on all operations, so direct SDK reads/writes from a non-admin are rejected by the backend.
3. **Function guard** — every `commerce/admin-*` function (and `commerce/seed-store`) calls `requireAdmin()`, returning **401** if unauthenticated and **403** if not an admin, before touching data via the service role.

Even if the client guard were bypassed, layers 2 and 3 keep the store data safe. Storefront functions are intentionally public and verify the caller per-action instead (auth session, `cart_token`, or `order_key`).

---

## 4. After installation

- **Register the template in the app's `AGENTS.md`** so future agent sessions know the store exists — see [`implementation-guidelines.md`](./implementation-guidelines.md) §1 for the exact snippet.
- Continue with [`implementation-guidelines.md`](./implementation-guidelines.md) for storefront building, Stripe wiring, scheduled maintenance, emails, webhooks, and operational limits.
