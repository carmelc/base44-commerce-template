# Post-installation

What to do right after the static installation ([`installation-guidelines.md`](./installation-guidelines.md)): embed the admin pages into the app, and register the template + skill in `AGENTS.md`. Installed into the app at `skills/commerce/post-installation.md`.

---

## 1. Embedding the admin pages

The admin UI is a self-contained React app under `src/commerce/admin/`. Its only external touchpoints are `@/components/ui/*` (shadcn) and `@/api/base44Client` (your app's SDK client).

**Steps:**

1. Copy `src/commerce/admin/` → `src/commerce/admin/` (already done if you ran `scripts/install.js`).
2. `npm i sonner recharts remark-gfm` (`react-markdown` ships with the default Base44 template; add it too if your app lacks it). Verify the shadcn primitives listed in `src/commerce/admin/README.md` are present (`npx shadcn@latest add <name>` for any missing).
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

## 2. Register the template and skill in `AGENTS.md`

So future agent sessions know the store exists and read the skill before touching it, add the template to an **Installed templates** section and point at the skill from a **My Skills** section (create either section if it doesn't exist):

```md
## Installed templates

- commerce

## My Skills

- `skills/commerce/SKILL.md` — Base44 Commerce template: 24 `commerce.*` entities, 14 `commerce/*` backend functions (storefront + admin APIs), the shared commerce engine under `base44/shared/commerce/`, the store admin UI mounted at `/admin`, and the `commerce/StoreAdmin` agent (admin copilot bot in the admin sidebar). Read before working on store features — catalog, cart, checkout, orders, payments, emails, webhooks, or the admin UI.
```

---

## 3. Next

Continue with the commerce skill — [`skills/commerce/SKILL.md`](./SKILL.md) — for day-2 work: UI changes, storefront building, Stripe wiring, scheduled maintenance, emails, webhooks, and operational limits.
