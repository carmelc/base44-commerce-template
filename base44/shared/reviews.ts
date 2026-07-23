/**
 * Review aggregates: keep Product.average_rating / rating_count in sync with
 * approved reviews. Called by admin-reviews on any moderation change and by
 * storefront-catalog when auto-approve is enabled.
 */
import { round2 } from "./money.ts";

/** Recompute a product's rating aggregates from its APPROVED reviews. */
export async function recalcProductRating(sr: any, productId: string): Promise<{ average: number; count: number }> {
  const approved: any[] = [];
  let skip = 0;
  // paginate defensively; a product rarely has >500 reviews but be correct
  while (true) {
    const page = (await sr.entities.ProductReview.filter(
      { product_id: productId, status: "approved" },
      "-created_date",
      500,
      skip,
    )) ?? [];
    approved.push(...page);
    if (page.length < 500) break;
    skip += 500;
  }

  const rated = approved.filter((r) => typeof r.rating === "number" && r.rating > 0);
  const count = approved.length;
  const average = rated.length
    ? round2(rated.reduce((a, r) => a + r.rating, 0) / rated.length)
    : 0;

  await sr.entities.Product.update(productId, {
    average_rating: average,
    rating_count: count,
  });
  return { average, count };
}
