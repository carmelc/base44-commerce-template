/**
 * admin-reviews — review moderation; keeps product rating aggregates in sync.
 *
 * Actions: set-status | update | delete
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../shared/auth.ts";
import { recalcProductRating } from "../../shared/reviews.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

const STATUSES = ["approved", "hold", "spam", "trash"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();

    const getReview = async (id: string) => {
      const review = await sr.entities.ProductReview.get(id);
      if (!review) throw new HttpError(404, "Review not found", "not_found");
      return review;
    };

    switch (action) {
      case "set-status": {
        if (!STATUSES.includes(payload.status)) {
          throw new HttpError(400, `Invalid review status: ${payload.status}`, "invalid_status");
        }
        const review = await getReview(payload.id);
        await sr.entities.ProductReview.update(review.id, { status: payload.status });
        const aggregates = await recalcProductRating(sr, review.product_id);
        return ok({ review: { ...review, status: payload.status }, aggregates });
      }
      case "update": {
        const review = await getReview(payload.id);
        const patch: Record<string, any> = {};
        for (const k of ["review", "rating", "reviewer", "reviewer_email", "status"]) {
          if (payload[k] !== undefined) patch[k] = payload[k];
        }
        if (patch.rating != null && (patch.rating < 0 || patch.rating > 5)) {
          throw new HttpError(400, "Rating must be between 0 and 5.", "invalid_rating");
        }
        await sr.entities.ProductReview.update(review.id, patch);
        const aggregates = await recalcProductRating(sr, review.product_id);
        return ok({ review: { ...review, ...patch }, aggregates });
      }
      case "delete": {
        const review = await getReview(payload.id);
        await sr.entities.ProductReview.delete(review.id);
        const aggregates = await recalcProductRating(sr, review.product_id);
        return ok({ deleted: review.id, aggregates });
      }
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("admin-reviews error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});
