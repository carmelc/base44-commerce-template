# Scheduled work (workflows)

Base44 **has** a scheduler — the recurring maintenance below is run by **scheduled workflows**, and the Base44 agent can create them for you. **This template ships no workflow/schedule files on purpose**: don't look for them under `base44/` and don't add them here — create the workflows directly in the target app.

**Instruct the agent (or set up yourself): create one scheduled workflow per row below.** Each workflow does one thing — invoke the given function action on the chosen cadence:

```js
await base44.functions.invoke("commerce/admin-tools", { action: "clear-abandoned-carts", older_than_days: 2 });
```

| Workflow to create | What it does | Action to invoke | Payload | Suggested cadence |
|---|---|---|---|---|
| Release expired stock holds | Frees stock held by unpaid orders past `hold_stock_minutes`. `commerce/storefront-checkout` `place-order` already runs this at the start of every checkout, so the schedule mainly covers quiet periods. | `commerce/admin-orders` `release-expired-holds` | — | every 5–15 min |
| Abandoned cart cleanup | Marks carts past the 48 h TTL as `abandoned`. Also happens lazily on next cart access. | `commerce/admin-tools` `clear-abandoned-carts` | `{ older_than_days: 2 }` | hourly–daily |
| Prune webhook delivery log | Deletes old `commerce.WebhookDelivery` rows so the log doesn't grow unbounded. **No opportunistic fallback — this one genuinely needs a schedule.** | `commerce/admin-tools` `prune-webhook-deliveries` | `{ keep_days: 30 }` | daily–weekly |

**Optional — drift repair.** Denormalized counters can drift without transactions (see [`limits-and-performance.md`](./limits-and-performance.md)). If you want them self-healing, add a nightly/weekly workflow that calls the `commerce/admin-tools` recount actions: `recount-terms`, `recount-coupon-usage`, `recalculate-customer-stats-all`, `regenerate-download-permissions`.

Every action above is guarded by `requireAdmin()`, so each scheduled workflow must run with **admin privileges** (an admin identity / service context), not as an anonymous caller.
