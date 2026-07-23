# Webhooks

`webhooks.ts` `dispatch()` fires on `order.*`, `product.*`, `customer.*`, `coupon.*` (created/updated/deleted, plus order/product `restored`). Each active `commerce.Webhook` matching the topic receives an HTTP POST with headers `X-Commerce-Webhook-Topic/-Resource/-Event/-ID/-Delivery-ID/-Signature`. The signature is **base64 HMAC-SHA256** of the body, keyed by the webhook's `secret` (Web Crypto).

- Every attempt is logged as a `commerce.WebhookDelivery` (request/response bodies truncated to 32 KB). Prune with `commerce/admin-tools` `prune-webhook-deliveries`.
- `failure_count` increments on non-2xx/timeout and resets on success; a webhook auto-disables after **5** consecutive failures.
- The `secret` is stored on the (admin-only-RLS) `commerce.Webhook` entity. For higher assurance, move it to Base44 secrets and read it in `dispatch()`.
- Verify deliveries on the receiver by recomputing the HMAC over the raw body with your secret.
