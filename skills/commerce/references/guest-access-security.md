# Guest access & security

- Storefront functions are **public** (anonymous invocation). Confirm your app allows unauthenticated function calls and public reads of the public-read entities (catalog). If you want a login-required store, set `accounts.guest_checkout = false` (checkout then returns `401 login_required` for anonymous callers) and gate catalog reads.
- `cart_token` and `order_key` are **bearer credentials** — possession grants access to that cart/order. Always serve over HTTPS; don't log them; treat them like secrets.
- Carts and orders have admin-only RLS; customers never touch those entities directly — all access is mediated by `commerce/storefront-*` functions using the service role after verifying the caller.
- The admin side has three enforcement layers (UI guard, entity RLS, `requireAdmin()` function guard) — see [`post-installation.md`](../post-installation.md); never weaken them.
