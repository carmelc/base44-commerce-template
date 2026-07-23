/**
 * commerce/storefront-account — customer self-service API.
 *
 * Two access modes:
 *   - authenticated (base44 auth): my-orders, my-downloads, update-my-addresses, my-reviews
 *   - order_key bearer (guest order tracking): get-order, order-notes, get-download
 *
 * All entity access is service-role; the caller is verified per-action
 * (Order/Customer/DownloadPermission entities are admin-only RLS).
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, getCallerUser } from "../../../shared/commerce/auth.ts";
import { serializeOrderForCustomer } from "../../../shared/commerce/orders.ts";

function ok(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ success: false, error: e.message, code: e.code ?? "error" }, { status: e.status });
  }
  console.error("commerce/storefront-account error:", e);
  return Response.json(
    { success: false, error: (e as Error)?.message ?? "Internal error", code: "internal_error" },
    { status: 500 },
  );
}

function requireUser(user: any): any {
  if (!user) throw new HttpError(401, "Please log in.", "login_required");
  return user;
}

async function customerByEmail(sr: any, email: string): Promise<any | null> {
  return (await sr.entities["commerce.Customer"].filter({ email: String(email).toLowerCase() }, undefined, 1))?.[0] ?? null;
}

async function orderByKey(sr: any, orderId: string, orderKey: string): Promise<any> {
  if (!orderId || !orderKey) throw new HttpError(400, "order_id and order_key are required.", "order_key_required");
  let order: any = null;
  try { order = await sr.entities["commerce.Order"].get(orderId); } catch { order = null; }
  if (!order || order.order_key !== orderKey) throw new HttpError(404, "Order not found.", "order_not_found");
  return order;
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json().catch(() => ({}));
    if (!action) throw new HttpError(400, "action is required.", "action_required");
    const user = await getCallerUser(base44);

    switch (action) {
      case "my-orders": {
        requireUser(user);
        const page = Math.max(1, Math.floor(Number(payload.page) || 1));
        const perPage = Math.min(50, Math.max(1, Math.floor(Number(payload.per_page) || 10)));
        const customer = await customerByEmail(sr, user.email);
        if (!customer) return ok({ orders: [], page, per_page: perPage, has_next: false });
        const rows = (await sr.entities["commerce.Order"].filter(
          { customer_id: customer.id },
          "-created_date",
          perPage + 1,
          (page - 1) * perPage,
        )) ?? [];
        return ok({
          orders: rows.slice(0, perPage).map(serializeOrderForCustomer),
          page,
          per_page: perPage,
          has_next: rows.length > perPage,
        });
      }

      case "get-order": {
        const order = await orderByKey(sr, payload.order_id, payload.order_key);
        return ok({ order: serializeOrderForCustomer(order) });
      }

      case "order-notes": {
        const order = await orderByKey(sr, payload.order_id, payload.order_key);
        const notes = (await sr.entities["commerce.OrderNote"].filter(
          { order_id: order.id, is_customer_note: true },
          "-created_date",
          100,
        )) ?? [];
        return ok({ notes: notes.map((n: any) => ({ id: n.id, note: n.note, created_date: n.created_date })) });
      }

      case "my-downloads": {
        requireUser(user);
        const permissions = (await sr.entities["commerce.DownloadPermission"].filter(
          { customer_email: String(user.email).toLowerCase() },
          "-created_date",
          200,
        )) ?? [];
        return ok({ downloads: permissions.map(publicPermission) });
      }

      case "get-download": {
        const permissionId = String(payload.permission_id || "");
        if (!permissionId) throw new HttpError(400, "permission_id is required.", "permission_required");
        let perm: any = null;
        try { perm = await sr.entities["commerce.DownloadPermission"].get(permissionId); } catch { perm = null; }
        if (!perm) throw new HttpError(404, "Download not found.", "download_not_found");

        // access check: authenticated owner OR order_key bearer
        const authed = user && String(user.email).toLowerCase() === String(perm.customer_email).toLowerCase();
        const keyed = payload.order_key && payload.order_key === perm.order_key;
        if (!authed && !keyed) throw new HttpError(403, "You do not have access to this download.", "forbidden");

        if (perm.downloads_remaining === 0) {
          throw new HttpError(403, "Download limit reached.", "download_limit_reached");
        }
        if (perm.access_expires && new Date(perm.access_expires).getTime() < Date.now()) {
          throw new HttpError(403, "Download access has expired.", "download_expired");
        }

        const patch: Record<string, any> = { download_count: (perm.download_count ?? 0) + 1 };
        if (perm.downloads_remaining > 0) patch.downloads_remaining = perm.downloads_remaining - 1;
        await sr.entities["commerce.DownloadPermission"].update(perm.id, patch);

        // private files (non-http uri) get a short-lived signed URL
        let url = perm.file_url ?? "";
        if (url && !/^https?:\/\//i.test(url)) {
          const signed = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 3600 });
          url = signed?.signed_url ?? url;
        }
        return ok({
          url,
          download_name: perm.download_name,
          downloads_remaining: patch.downloads_remaining ?? perm.downloads_remaining,
        });
      }

      case "update-my-addresses": {
        requireUser(user);
        const email = String(user.email).toLowerCase();
        const existing = await customerByEmail(sr, email);
        const patch: Record<string, any> = {};
        if (payload.billing) patch.billing = payload.billing;
        if (payload.shipping) patch.shipping = payload.shipping;
        if (!Object.keys(patch).length) {
          throw new HttpError(400, "Provide billing and/or shipping.", "nothing_to_update");
        }
        let customer: any;
        if (existing) {
          await sr.entities["commerce.Customer"].update(existing.id, patch);
          customer = { ...existing, ...patch };
        } else {
          customer = await sr.entities["commerce.Customer"].create({
            email,
            first_name: user.full_name?.split(" ")[0] ?? "",
            last_name: user.full_name?.split(" ").slice(1).join(" ") ?? "",
            user_id: user.id,
            is_guest: false,
            ...patch,
          });
        }
        return ok({ customer: publicCustomer(customer) });
      }

      case "my-reviews": {
        requireUser(user);
        const reviews = (await sr.entities["commerce.ProductReview"].filter(
          { reviewer_email: String(user.email).toLowerCase() },
          "-created_date",
          100,
        )) ?? [];
        return ok({
          reviews: reviews.map((r: any) => ({
            id: r.id,
            product_id: r.product_id,
            review: r.review,
            rating: r.rating,
            status: r.status,
            verified: !!r.verified,
            created_date: r.created_date,
          })),
        });
      }

      default:
        throw new HttpError(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    return fail(e);
  }
});

function publicPermission(p: any): any {
  return {
    permission_id: p.id,
    order_id: p.order_id,
    product_id: p.product_id,
    download_name: p.download_name,
    downloads_remaining: p.downloads_remaining,
    access_expires: p.access_expires,
    download_count: p.download_count ?? 0,
  };
}

function publicCustomer(c: any): any {
  return {
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    billing: c.billing ?? {},
    shipping: c.shipping ?? {},
  };
}
