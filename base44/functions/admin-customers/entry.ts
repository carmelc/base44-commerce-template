/**
 * admin-customers — customer CRUD, invites and denormalized stats.
 *
 * Actions: save | delete | search | invite | recalculate-stats
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../shared/auth.ts";
import { round2 } from "../../shared/money.ts";
import { dispatch } from "../../shared/webhooks.ts";
import { pageSlice, scanAll, textMatch } from "../../shared/scan.ts";

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
        return ok(await save(sr, payload.customer));
      case "delete":
        return ok(await remove(sr, payload));
      case "search": {
        const { q, limit = 20, skip = 0, sort = "-created_date" } = payload;
        let rows = await scanAll(sr.entities.Customer, null, sort);
        if (q) {
          rows = rows.filter((c) =>
            textMatch(c.email, q) || textMatch(c.username, q) ||
            textMatch(`${c.first_name ?? ""} ${c.last_name ?? ""}`, q)
          );
        }
        return ok(pageSlice(rows, Number(limit), Number(skip)));
      }
      case "invite":
        return ok(await invite(base44, sr, payload));
      case "recalculate-stats": {
        const customer = await getCustomer(sr, payload.customer_id);
        return ok(await recalcStats(sr, customer));
      }
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("admin-customers error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

async function getCustomer(sr: any, id: string): Promise<any> {
  if (!id) throw new HttpError(400, "customer_id is required", "invalid_payload");
  const customer = await sr.entities.Customer.get(id);
  if (!customer) throw new HttpError(404, "Customer not found", "not_found");
  return customer;
}

async function save(sr: any, customer: any): Promise<any> {
  if (!customer) throw new HttpError(400, "customer is required", "invalid_payload");
  const email = String(customer.email ?? "").toLowerCase().trim();
  if (!email) throw new HttpError(400, "Customer email is required.", "invalid_payload");

  const dupes = (await sr.entities.Customer.filter({ email }, undefined, 2)) ?? [];
  if (dupes.some((c: any) => c.id !== customer.id)) {
    throw new HttpError(409, `A customer with email "${email}" already exists.`, "duplicate_email");
  }

  const { id, created_date: _cd, updated_date: _ud, created_by: _cb, ...fields } = { ...customer, email };
  let saved: any;
  if (id) {
    const prev = await getCustomer(sr, id);
    await sr.entities.Customer.update(id, fields);
    saved = { ...prev, ...fields };
    await dispatch(sr, "customer.updated", saved);
  } else {
    saved = await sr.entities.Customer.create({
      is_guest: fields.user_id ? false : (fields.is_guest ?? true),
      orders_count: 0,
      total_spent: 0,
      is_paying_customer: false,
      ...fields,
    });
    await dispatch(sr, "customer.created", saved);
  }
  return saved;
}

async function remove(sr: any, payload: any): Promise<any> {
  const customer = await getCustomer(sr, payload.id);
  if (payload.reassign_orders_to_guest !== false) {
    const orders = await scanAll(sr.entities.Order, { customer_id: customer.id }, "-created_date", { fields: ["id"] });
    for (const o of orders) await sr.entities.Order.update(o.id, { customer_id: "" });
  }
  await sr.entities.Customer.delete(customer.id);
  await dispatch(sr, "customer.deleted", customer);
  return { deleted: customer.id };
}

/** Invite the customer to the app (creates/links a Base44 user, role "user"). */
async function invite(base44: any, sr: any, payload: any): Promise<any> {
  const customer = await getCustomer(sr, payload.customer_id);
  try {
    const result = await base44.users.inviteUser(customer.email, "user");
    const userId = result?.id ?? result?.user_id ?? "";
    if (userId) {
      await sr.entities.Customer.update(customer.id, { user_id: userId, is_guest: false });
      customer.user_id = userId;
      customer.is_guest = false;
    }
    return { invited: true, customer };
  } catch (e) {
    // invite may fail if the user already exists — surface but don't 500
    return { invited: false, error: (e as Error).message, customer };
  }
}

/**
 * Recompute orders_count / total_spent / is_paying_customer.
 * Counted spend = paid orders (date_paid set or processing/completed) minus
 * their refunds; orders_count excludes cancelled/failed (Woo semantics).
 */
async function recalcStats(sr: any, customer: any): Promise<any> {
  const orders = await scanAll(sr.entities.Order, { customer_id: customer.id });
  const counted = orders.filter((o) => !["cancelled", "failed"].includes(o.status));
  const paid = orders.filter((o) => o.date_paid || ["processing", "completed"].includes(o.status));
  const totalSpent = round2(paid.reduce(
    (a, o) => a + (Number(o.total) || 0) - (Number(o.total_refunded) || 0),
    0,
  ));
  const patch = {
    orders_count: counted.length,
    total_spent: totalSpent,
    is_paying_customer: totalSpent > 0,
  };
  await sr.entities.Customer.update(customer.id, patch);
  return { ...customer, ...patch };
}
