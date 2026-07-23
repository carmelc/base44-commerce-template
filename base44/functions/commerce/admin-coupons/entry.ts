/**
 * commerce/admin-coupons — coupon CRUD with code normalization/uniqueness and webhooks.
 *
 * Actions: save | delete | batch | search
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../../shared/commerce/auth.ts";
import { dispatch } from "../../../shared/commerce/webhooks.ts";
import { pageSlice, scanAll, textMatch } from "../../../shared/commerce/scan.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "save":
        return ok(await save(sr, payload.coupon));
      case "delete":
        return ok(await remove(sr, payload.id));
      case "batch":
        return ok(await batch(sr, payload));
      case "search": {
        const { q, limit = 20, skip = 0, sort = "-created_date" } = payload;
        let rows = await scanAll(sr.entities["commerce.Coupon"], null, sort);
        if (q) rows = rows.filter((c) => textMatch(c.code, q) || textMatch(c.description, q));
        return ok(pageSlice(rows, Number(limit), Number(skip)));
      }
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("commerce/admin-coupons error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

async function save(sr: any, coupon: any): Promise<any> {
  if (!coupon) throw new HttpError(400, "coupon is required", "invalid_payload");
  const code = String(coupon.code ?? "").toLowerCase().trim();
  if (!code) throw new HttpError(400, "Coupon code is required.", "invalid_payload");
  if (coupon.amount == null || Number(coupon.amount) < 0) {
    throw new HttpError(400, "Coupon amount is required.", "invalid_amount");
  }
  if (coupon.discount_type === "percent" && Number(coupon.amount) > 100) {
    throw new HttpError(400, "Percentage discounts cannot exceed 100.", "invalid_amount");
  }

  const dupes = (await sr.entities["commerce.Coupon"].filter({ code }, undefined, 2)) ?? [];
  if (dupes.some((c: any) => c.id !== coupon.id)) {
    throw new HttpError(409, `Coupon code "${code}" already exists.`, "duplicate_code");
  }

  const { id, created_date: _cd, updated_date: _ud, created_by: _cb, ...fields } = { ...coupon, code };
  let saved: any;
  if (id) {
    const prev = await sr.entities["commerce.Coupon"].get(id);
    if (!prev) throw new HttpError(404, "Coupon not found", "not_found");
    await sr.entities["commerce.Coupon"].update(id, fields);
    saved = { ...prev, ...fields };
    await dispatch(sr, "coupon.updated", saved);
  } else {
    saved = await sr.entities["commerce.Coupon"].create({ usage_count: 0, used_by: [], ...fields });
    await dispatch(sr, "coupon.created", saved);
  }
  return saved;
}

async function remove(sr: any, id: string): Promise<any> {
  const coupon = await sr.entities["commerce.Coupon"].get(id);
  if (!coupon) throw new HttpError(404, "Coupon not found", "not_found");
  await sr.entities["commerce.Coupon"].delete(id);
  await dispatch(sr, "coupon.deleted", coupon);
  return { deleted: id };
}

async function batch(sr: any, payload: any): Promise<any> {
  const results = { create: [] as any[], update: [] as any[], delete: [] as any[] };
  const cap = 100;
  for (const c of (payload.create ?? []).slice(0, cap)) {
    try { results.create.push({ success: true, coupon: await save(sr, c) }); }
    catch (e) { results.create.push({ success: false, error: (e as Error).message }); }
  }
  for (const c of (payload.update ?? []).slice(0, cap)) {
    try { results.update.push({ success: true, coupon: await save(sr, c) }); }
    catch (e) { results.update.push({ success: false, id: c.id, error: (e as Error).message }); }
  }
  for (const id of (payload.delete ?? []).slice(0, cap)) {
    try { results.delete.push({ success: true, ...(await remove(sr, id)) }); }
    catch (e) { results.delete.push({ success: false, id, error: (e as Error).message }); }
  }
  return results;
}
