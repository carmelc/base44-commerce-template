# Limits, concurrency & reports performance

## Limits & concurrency

- **Pagination.** The SDK `filter`/`list` cap out at 5,000 records/page and there is **no total-count API**. Server-side scans use paged loops (`shared/scan.ts` `scanAll`, page size 500). Admin lists use limit+skip with a `limit+1` "has-next" probe — the UI shows *Page N ‹ ›*, never a total.
- **Search** is server-side (`search` actions scan + JS-filter) because entity `filter` is exact-match only.
- **Reports** scan orders on demand — fine to ~10k orders per range. Beyond that, materialize an `OrderStats` entity updated on each order transition and aggregate from it (sketch: one record per day per status with summed totals; `commerce/admin-reports` reads the pre-aggregated rows instead of scanning `commerce.Order`).
- **No transactions.** A few consequences, all documented in code:
  - `nextOrderNumber` is `max(order_number)+1` with a small retry; under heavy concurrent checkout two orders could theoretically collide — acceptable for typical volume, or front it with a dedicated counter entity if needed.
  - Stock decrement is last-write-wins; oversell is possible under simultaneous checkouts of the last unit. Mitigate with the hold mechanism (already in place) or a stricter reserve step if your volume warrants.
  - Denormalized counters (`usage_count`, `total_sales`, `orders_count`, term `count`) can drift; `commerce/admin-tools` recount actions repair them (schedule them via [`scheduled-work.md`](./scheduled-work.md)).
- **Record size.** Orders embed their line/shipping/tax/fee/coupon lines. Extremely large orders (hundreds of distinct line items) push against per-record size limits; split or paginate if you expect that.

## Reports performance

The `commerce/admin-reports` `summary`/`sales`/`top-sellers` actions scan `commerce.Order` (and `commerce.OrderRefund`) filtered to counted orders (`date_paid` set, or status `processing`/`completed`). Net sales = gross − refunds − tax − shipping (standard convention). For large catalogs, cache `summary` on the dashboard and consider the `OrderStats` materialization above.
