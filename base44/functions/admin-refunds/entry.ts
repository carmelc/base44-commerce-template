/**
 * admin-refunds — create/delete order refunds with optional restock and
 * (placeholder) gateway refunds.
 *
 * Actions: create | delete
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../shared/auth.ts";
import { round2 } from "../../shared/money.ts";
import { restockLine } from "../../shared/stock.ts";
import { transitionOrder } from "../../shared/orders.ts";
import { sendOrderEmail } from "../../shared/emails.ts";
import { dispatch } from "../../shared/webhooks.ts";

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status: number, error: string, code?: string) =>
  Response.json({ success: false, error, code }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const sr = base44.asServiceRole;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "create":
        return ok(await create(sr, payload, admin.email ?? "admin"), 201);
      case "delete":
        return ok(await remove(sr, payload));
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("admin-refunds error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});

/**
 * payload: {order_id, amount, reason?, line_items?: [{line_id, quantity,
 * refund_total, refund_tax?}], restock_items?, refund_payment?}
 */
async function create(sr: any, payload: any, actor: string): Promise<any> {
  const order = await sr.entities.Order.get(payload.order_id);
  if (!order) throw new HttpError(404, "Order not found", "not_found");

  const amount = round2(Number(payload.amount) || 0);
  if (amount <= 0) throw new HttpError(400, "Refund amount must be greater than zero.", "invalid_amount");
  const alreadyRefunded = round2(order.total_refunded ?? 0);
  const refundable = round2((order.total ?? 0) - alreadyRefunded);
  if (amount > refundable + 0.005) {
    throw new HttpError(400, `Refund amount exceeds the remaining refundable total (${refundable}).`, "amount_exceeds_refundable");
  }

  // enrich refund line specs with product refs from the order's line items
  const lineItems = (payload.line_items ?? []).map((spec: any) => {
    const line = (order.line_items ?? []).find((l: any) => l.line_id === spec.line_id) ?? {};
    return {
      line_id: spec.line_id,
      product_id: line.product_id ?? "",
      variation_id: line.variation_id ?? "",
      quantity: Number(spec.quantity) || 0,
      refund_total: round2(Number(spec.refund_total) || 0),
      refund_tax: round2(Number(spec.refund_tax) || 0),
    };
  });

  const refund = await sr.entities.OrderRefund.create({
    order_id: order.id,
    amount,
    reason: payload.reason ?? "",
    refunded_by: actor,
    refunded_payment: false, // flips only when a real gateway refund succeeds
    restock_items: !!payload.restock_items,
    line_items: lineItems,
    meta_data: [],
  });

  if (payload.restock_items) {
    for (const li of lineItems) {
      if (li.quantity > 0) await restockLine(sr, li, li.quantity);
    }
  }

  const totalRefunded = round2(alreadyRefunded + amount);
  await sr.entities.Order.update(order.id, { total_refunded: totalRefunded });
  order.total_refunded = totalRefunded;

  await sr.entities.OrderNote.create({
    order_id: order.id,
    note: `Refund of ${amount} created${payload.reason ? ` — ${payload.reason}` : ""}.${payload.restock_items ? " Items restocked." : ""}`,
    is_customer_note: false,
    added_by: actor,
  });

  const fullyRefunded = totalRefunded >= round2(order.total ?? 0) - 0.005;
  if (fullyRefunded && order.status !== "refunded") {
    await transitionOrder(sr, order, "refunded", { actor });
  } else {
    await sendOrderEmail(sr, "partial_refund", order, { force: true, extra: { refund } });
    await dispatch(sr, "order.updated", order);
  }

  // Stripe placeholder — see implementation-guidelines.md §Stripe wiring
  const gatewayRefund = payload.refund_payment ? "not_implemented" : undefined;
  return { refund, order, ...(gatewayRefund ? { gateway_refund: gatewayRefund } : {}) };
}

async function remove(sr: any, payload: any): Promise<any> {
  const refund = await sr.entities.OrderRefund.get(payload.refund_id);
  if (!refund) throw new HttpError(404, "Refund not found", "not_found");
  const order = await sr.entities.Order.get(refund.order_id);

  if (order) {
    const totalRefunded = round2(Math.max(0, (order.total_refunded ?? 0) - (refund.amount ?? 0)));
    await sr.entities.Order.update(order.id, { total_refunded: totalRefunded });
    await sr.entities.OrderNote.create({
      order_id: order.id,
      note: `Refund of ${refund.amount} deleted. Note: restocked items (if any) were NOT un-restocked — adjust stock manually if needed.`,
      is_customer_note: false,
      added_by: "system",
    });
    await dispatch(sr, "order.updated", { ...order, total_refunded: totalRefunded });
  }

  await sr.entities.OrderRefund.delete(refund.id);
  return { deleted: refund.id };
}
