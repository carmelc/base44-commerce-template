# Storefront API Reference

Everything needed to build a customer-facing shopfront (or headless client) against the Base44 Commerce Template. No visitor UI ships with the template — this is your integration surface.

Four public functions: **`commerce/storefront-catalog`**, **`commerce/storefront-cart`**, **`commerce/storefront-checkout`**, **`commerce/storefront-account`**. All are invoked the same way and return the same envelope.

## Conventions

- **Invoke:** `base44.functions.invoke("commerce/<function>", { action, ...payload })`. Response body is on `res.data`; the envelope is `{ success, data }` on success or `{ success, error, code }` on failure (HTTP status set accordingly).
  ```js
  const res = await base44.functions.invoke("commerce/storefront-catalog", { action: "get-store-info" });
  const info = res.data.data;              // envelope → payload
  ```
- **Auth modes:** most actions are anonymous. Some require an authenticated Base44 session (marked **auth**). Guest order access uses `order_key`; cart access uses `cart_token` — both are bearer credentials (HTTPS only).
- **Money:** numbers, 2-dp. **Dates:** ISO strings.
- **Errors:** every failure has a stable `code` (listed per action) plus a human `error` message.

---

## commerce/storefront-catalog

Public catalog browsing. No auth.

### `get-store-info`
Bootstrap data for a storefront. No payload.

**Response:**
```json
{
  "settings": { "currency": "USD", "currency_position": "left", "thousand_sep": ",", "decimal_sep": ".",
                "num_decimals": 2, "weight_unit": "kg", "dimension_unit": "cm", "guest_checkout": true,
                "prices_include_tax": false, "enable_reviews": true, "review_rating_required": true },
  "payment_gateways": [ { "slug": "cod", "title": "Cash on delivery", "description": "..." } ],
  "countries": [ { "code": "US", "name": "United States", "states": [ { "code": "CA", "name": "California" } ] } ],
  "currencies": [ { "code": "USD", "name": "US Dollar", "symbol": "$", "decimals": 2 } ]
}
```
`settings` is a safe projection — only display/behavior keys, never admin config.

### `list-products`
**Payload** (all optional): `search`, `category_id` (includes descendants), `tag_id`, `attribute_id` + `attribute_term`, `min_price`, `max_price`, `featured` (bool), `on_sale` (bool), `in_stock_only` (bool), `sort` (`menu_order`|`price`|`-price`|`-created_date`|`popularity`|`rating`, default `menu_order`), `page` (default 1), `per_page` (default 12, max 100).

Only `status: "publish"` products are returned. Visibility: passing `search` uses **search context** (hides `catalog_visibility: hidden|catalog`); no `search` uses **browse context** (hides `hidden|search`). `inventory.hide_out_of_stock` (or `in_stock_only`) drops out-of-stock products.

**Response:** `{ "products": [Product...], "page": 1, "per_page": 12, "has_next": true }`

### `get-product`
**Payload:** `{ id }` **or** `{ slug }`; optional `reviews_page` (1), `reviews_per_page` (10, max 50).

**Response:**
```json
{
  "product": { Product },
  "variations": [ ProductVariation... ],          // publishable only; [] for non-variable
  "categories": [ ProductCategory... ],
  "tags": [ ProductTag... ],
  "reviews": { "items": [ { "id", "reviewer", "review", "rating", "verified", "created_date" } ],
               "page": 1, "per_page": 10, "has_next": false,
               "average_rating": 4.5, "rating_count": 12 },
  "upsells":  [ { "id", "name", "slug", "price", "on_sale", "image", "stock_status" } ],
  "cross_sells": [ ...summaries ],
  "grouped_products": [ ...summaries ]
}
```
**Errors:** `404 not_found` (missing / not published / hidden).

### `list-categories`
No payload. Returns a nested tree: `{ "categories": [ { ...category, "children": [...] } ] }` sorted by `menu_order` then name.

### `list-attributes`
No payload. Returns `{ "attributes": [ { ...attribute, "terms": [ ...terms ] } ] }` — for building filter UIs.

### `submit-review`
**Payload:** `{ product_id, reviewer, reviewer_email, review, rating }`.

Requires `products.enable_reviews` and the product's `reviews_allowed`. Rating required when `review_rating_required`. If `only_verified_reviews`, the email must have a `processing`/`completed` order containing the product. Status is `hold` unless `auto_approve_reviews`.

**Response:** `{ "review_id", "status": "hold"|"approved", "verified": true }`
**Errors:** `403 reviews_disabled`, `403 verified_only`, `404 not_found`, `400 review_incomplete|invalid_email|rating_required|invalid_rating`.

---

## commerce/storefront-cart

Token-scoped cart (guest + member). Every action **except `create`** takes `cart_token`. **Every mutating action returns the full priced cart view.** Carts have a rolling 48h TTL (refreshed on each touch). An authenticated caller's other active carts are merged in (quantities summed, `sold_individually` capped, coupon codes unioned; source carts marked abandoned).

### The priced cart view (returned by every action)
```json
{
  "cart_token": "uuid",
  "items": [ {
    "item_key": "uuid", "product_id": "...", "variation_id": "", "quantity": 2,
    "attributes": [ { "name": "Color", "option": "Red" } ],
    "name": "T-Shirt", "sku": "TS-RED-M", "image": "https://...",
    "price": 20, "subtotal": 40, "total": 36, "total_tax": 3.6,
    "virtual": false, "sold_individually": false,
    "purchasable": { "ok": true }
  } ],
  "coupon_codes": ["welcome10"],
  "coupons": [ { "code": "welcome10", "coupon_id": "...", "discount": 4, "discount_tax": 0, "free_shipping": false } ],
  "coupon_notices": [ { "code": "old", "error": "Coupon has expired.", "error_code": "expired" } ],
  "removed_items": [ { "item_key": "...", "product_id": "...", "reason": "...", "code": "unavailable" } ],
  "shipping_address": { "country": "US", "state": "CA", "postcode": "90210", "city": "LA" },
  "chosen_shipping_method": "<zoneMethodId>",
  "available_shipping_methods": [ { "id": "<zoneMethodId>", "method_id": "flat_rate", "title": "Flat rate", "cost": 5 } ],
  "totals": { "subtotal": 40, "discount_total": 4, "discount_tax": 0, "shipping_total": 5, "shipping_tax": 0,
              "cart_tax": 3.6, "total_tax": 3.6, "total": 44.6, "prices_include_tax": false,
              "tax_lines": [ { "rate_id": "...", "label": "CA Tax", "tax_total": 3.6 } ] },
  "expires_at": "2025-..."
}
```
Stored coupons that stop validating are **auto-removed** and reported in `coupon_notices`; items whose product vanished/unpublished appear in `removed_items`.

### Actions
| Action | Payload | Notes / errors |
|---|---|---|
| `create` | `{ items?: [{product_id, variation_id?, quantity, attributes?}] }` | Mints and returns a new `cart_token`. Initial items go through add validation. |
| `get` | `{ cart_token }` | Priced view (also re-prices + merges). |
| `totals` | `{ cart_token }` | Alias of `get`. |
| `add-item` | `{ cart_token, product_id, variation_id?, quantity?, attributes? }` | Variable product requires `variation_id` (`400 variation_required`); `sold_individually` caps qty at 1; merges same product+variation. `400 <stock code>`, `404 product_not_found|variation_not_found`. |
| `update-item` | `{ cart_token, item_key, quantity }` | qty ≤ 0 removes the line. `404 item_not_found`, `400 <stock code>`. |
| `remove-item` | `{ cart_token, item_key }` | |
| `apply-coupon` | `{ cart_token, code }` | Full validation. `400 coupons_disabled|code_required|already_applied|<coupon code>`. |
| `remove-coupon` | `{ cart_token, code }` | |
| `set-shipping-address` | `{ cart_token, address: {country, state?, postcode?, city?} }` | `400 country_required`. Returns matched zone's `available_shipping_methods`. |
| `choose-shipping-method` | `{ cart_token, method_id }` | `method_id` = a `commerce.ShippingZoneMethod` id from `available_shipping_methods`. `400 invalid_shipping_method`. |

Common: `400 cart_token_required`, `404 cart_not_found`, `404 cart_expired`.

---

## commerce/storefront-checkout

### `place-order`
Converts a cart into an order. **Payload:**
```json
{ "cart_token": "uuid", "payment_method": "cod",
  "billing":  { "first_name", "last_name", "address_1", "address_2?", "city", "state?", "postcode?", "country", "email", "phone?" },
  "shipping": { ...address without email },
  "customer_note?": "...", "create_account?": false }
```
Required billing fields: `first_name, last_name, address_1, city, country, email`. If any line is non-virtual, a shipping address + a chosen shipping method are required.

**Steps:** releases expired holds → revalidates stock & coupons → computes authoritative totals → upserts the Customer by billing email → creates a `pending` order (with `order_key`, `hold_expires_at`) → reduces stock, fires `new_order` email + `order.created` webhook → marks cart `converted` → routes by gateway: **cod → processing**, **bacs/cheque → on-hold** (with `payment_instructions`), **stripe → stays pending** with a `not_implemented` placeholder, **custom → pending_external**.

**Response:**
```json
{
  "order_id": "...", "order_number": 1001, "order_key": "order_...",
  "status": "processing", "currency": "USD",
  "payment_method": "cod", "payment_method_title": "Cash on delivery",
  "payment_instructions": { "type": "cod", "description": "...", "account_details?": [...] },
  "payment": null,                       // or { "status": "not_implemented" | "pending_external", "note": "..." } for stripe/custom
  "notices": [],                         // e.g. ["account_creation_requires_login"]
  "totals": { "subtotal", "discount_total", "shipping_total", "shipping_tax", "cart_tax", "total_tax", "total" },
  "order": { ...customer-safe order (internal flags/ip stripped) }
}
```
**Errors:** `401 login_required` (guest checkout disabled), `400 billing_incomplete`, `400 empty_cart`, `409 items_unavailable`, `409 coupon_invalid`, `400 shipping_required`, `400 invalid_payment_method`.

### `confirm-payment`
Post-payment hook (call from a Stripe webhook/redirect, or any external PSP). **Payload:** `{ order_id, order_key, transaction_id? }`. Transitions `pending`/`on-hold` → `processing`, sets `date_paid`, bumps customer stats.
**Response:** `{ "order": { ...customer-safe order } }` · **Errors:** `400 order_key_required`, `404 order_not_found`, `409 invalid_status`.

### `cancel-order`
Customer-initiated cancel. **Payload:** `{ order_id, order_key }`. Only `pending`/`on-hold` (restores stock). Same response/error shape as `confirm-payment`.

---

## commerce/storefront-account

Two access modes: **auth** (Base44 session) or **`order_key` bearer** (guest tracking).

| Action | Auth | Payload | Response |
|---|---|---|---|
| `my-orders` | auth | `{ page?, per_page? }` | `{ orders: [customer-safe], page, per_page, has_next }` |
| `get-order` | order_key | `{ order_id, order_key }` | `{ order: customer-safe }` |
| `order-notes` | order_key | `{ order_id, order_key }` | `{ notes: [{ id, note, created_date }] }` (customer notes only) |
| `my-downloads` | auth | — | `{ downloads: [{ permission_id, order_id, product_id, download_name, downloads_remaining, access_expires, download_count }] }` |
| `get-download` | auth **or** order_key | `{ permission_id, order_key? }` | `{ url, download_name, downloads_remaining }` — decrements remaining; returns a signed URL for private files |
| `update-my-addresses` | auth | `{ billing?, shipping? }` | `{ customer: { email, first_name, last_name, billing, shipping } }` |
| `my-reviews` | auth | — | `{ reviews: [{ id, product_id, review, rating, status, verified, created_date }] }` |

**Errors:** `401 login_required`, `400 order_key_required|permission_required|nothing_to_update`, `404 order_not_found|download_not_found`, `403 forbidden|download_limit_reached|download_expired`.

---

## Walkthrough A — guest checkout

```js
const inv = (fn, payload) => base44.functions.invoke(fn, payload).then(r => r.data.data);

// 1. Browse
const { products } = await inv("commerce/storefront-catalog", { action: "list-products", per_page: 12 });

// 2. New cart with one item
let cart = await inv("commerce/storefront-cart", { action: "create",
  items: [{ product_id: products[0].id, quantity: 1 }] });
const token = cart.cart_token;

// 3. (variable product) fetch options, then add the chosen variation
const detail = await inv("commerce/storefront-catalog", { action: "get-product", id: products[0].id });
if (detail.product.type === "variable") {
  cart = await inv("commerce/storefront-cart", { action: "add-item",
    cart_token: token, product_id: detail.product.id, variation_id: detail.variations[0].id });
}

// 4. Coupon (optional)
cart = await inv("commerce/storefront-cart", { action: "apply-coupon", cart_token: token, code: "welcome10" });

// 5. Shipping address → pick a method
cart = await inv("commerce/storefront-cart", { action: "set-shipping-address",
  cart_token: token, address: { country: "US", state: "CA", postcode: "90210", city: "Los Angeles" } });
cart = await inv("commerce/storefront-cart", { action: "choose-shipping-method",
  cart_token: token, method_id: cart.available_shipping_methods[0].id });

// 6. Place the order (COD → processing immediately)
const order = await inv("commerce/storefront-checkout", { action: "place-order",
  cart_token: token, payment_method: "cod",
  billing: { first_name: "Ada", last_name: "Lovelace", address_1: "1 St",
             city: "Los Angeles", state: "CA", postcode: "90210", country: "US", email: "ada@example.com" } });

// 7. Track it later without an account (order_key from step 6)
const tracked = await inv("commerce/storefront-account", { action: "get-order",
  order_id: order.order_id, order_key: order.order_key });
```

## Walkthrough B — member experience

```js
const inv = (fn, payload) => base44.functions.invoke(fn, payload).then(r => r.data.data);
// (caller is authenticated via base44 auth — the SDK sends the session automatically)

// Browsing carts made while logged out merge into this one automatically on `get`/`create`.
let cart = await inv("commerce/storefront-cart", { action: "create", items: [{ product_id, quantity: 2 }] });

// Saved addresses speed up checkout
await inv("commerce/storefront-account", { action: "update-my-addresses",
  billing: { first_name: "Ada", last_name: "Lovelace", address_1: "1 St", city: "LA",
             state: "CA", postcode: "90210", country: "US", email: "ada@example.com" } });

const order = await inv("commerce/storefront-checkout", { action: "place-order",
  cart_token: cart.cart_token, payment_method: "bacs", billing: { /* ... */ } });
// bacs → on-hold; show order.payment_instructions.account_details

// Order history, downloads, reviews (all auth, no order_key needed)
const { orders } = await inv("commerce/storefront-account", { action: "my-orders", per_page: 10 });
const { downloads } = await inv("commerce/storefront-account", { action: "my-downloads" });
const file = await inv("commerce/storefront-account", { action: "get-download", permission_id: downloads[0]?.permission_id });
```
