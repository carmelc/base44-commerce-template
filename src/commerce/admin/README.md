# Store Admin (`src/commerce/admin/`)

React admin UI for the Base44 commerce template. Copy this
folder into a Base44 app built on the default template (Vite + React +
Tailwind + shadcn/ui + React Router) to get a full store back office.

> Install docs: [`installation-guidelines.md`](../../../installation-guidelines.md) · architecture & operations: [`implementation-guidelines.md`](../../../implementation-guidelines.md)
> API references: [`docs/api-admin.md`](../../../docs/api-admin.md), [`docs/api-storefront.md`](../../../docs/api-storefront.md)

## Mounting

1. Deploy the backend first (`base44/` entities + functions — see the root README).
2. Copy this folder to `src/commerce/admin/` in your app.
3. Install extra deps (everything else, including `react-markdown`, comes with
   the default template):

   ```bash
   npm i sonner recharts remark-gfm
   ```

4. Mount the app in your router:

   ```jsx
   import AdminApp from "@/commerce/admin";

   <Route path="/admin/*" element={<AdminApp />} />
   // mounted elsewhere? → <AdminApp basePath="/backoffice" />
   ```

5. Make sure your user has the **admin role** (Base44 dashboard → Users, or
   `base44.users.inviteUser(email, "admin")`). Signed-in users without the
   admin role get an access-denied screen — do not weaken this check.
6. Open `/admin` → the first-run screen seeds store defaults (optionally with
   sample data when the store has no products yet).

## External touchpoints

The folder is self-contained; it only imports from:

- `@/api/base44Client` — the app's SDK client (**named `base44` export**, as in
  Base44's default app template; if your app uses a default export instead,
  adjust the single import in `lib/api.js`)
- `@/components/ui/*` — the host app's shadcn/ui kit
- `react-router-dom`, `lucide-react`, `sonner`, `recharts`, `react-markdown`, `remark-gfm`

The StoreAdmin bot panel (`bot/`) additionally requires the `commerce/StoreAdmin`
agent (`base44/agents/commerce/StoreAdmin.jsonc`), which uses the `commerce/*`
backend functions directly as its tools.

### Required shadcn/ui primitives

alert, alert-dialog, badge, button, calendar, card, checkbox, command, dialog,
dropdown-menu, input, label, popover, radio-group, scroll-area, select,
separator, sheet, skeleton, switch, table, tabs, textarea, tooltip

The default Base44 template ships all of these. If one is missing:

```bash
npx shadcn@latest add <component>
```

## Layout of this folder

```
index.jsx        AdminApp: providers → auth guard → layout → routes
routes.jsx       Route table + <AdminRoutes/>
layout/          AdminLayout, Sidebar, Topbar, AuthGuard (admin-role gate), AccessDenied
bot/             StoreAdminBot (chat panel over the commerce/StoreAdmin agent), Markdown (GFM renderer)
context/         SettingsContext (store settings + first-run seeding), BasePathContext
hooks/           useAsync, usePagedList, useMoney, useDebounce
lib/             api (function calls), constants, format, geo-data, order/product utils
components/      DataTable, SearchSelect, MoneyInput, DateRangePicker, AddressForm, …
pages/           All admin pages (orders, products, coupons, customers, reports, settings, webhooks)
```
