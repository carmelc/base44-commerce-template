# Stripe wiring (payments)

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
