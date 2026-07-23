/**
 * commerce/admin-webhooks — test pings and redelivery for webhook endpoints.
 * (Webhook CRUD itself is direct entity access — admin-only RLS.)
 *
 * Actions: test | redeliver
 */
import { createClientFromRequest } from "npm:@base44/sdk";
import { HttpError, requireAdmin } from "../../../shared/commerce/auth.ts";
import { deliverOne } from "../../../shared/commerce/webhooks.ts";

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
      case "test": {
        const hook = await sr.entities["commerce.Webhook"].get(payload.webhook_id);
        if (!hook) throw new HttpError(404, "Webhook not found", "not_found");
        const result = await deliverOne(sr, hook, hook.topic, {
          webhook_id: hook.id,
          topic: hook.topic,
          test: true,
          timestamp: new Date().toISOString(),
        });
        return ok(result);
      }
      case "redeliver": {
        const delivery = await sr.entities["commerce.WebhookDelivery"].get(payload.delivery_id);
        if (!delivery) throw new HttpError(404, "Delivery not found", "not_found");
        const hook = await sr.entities["commerce.Webhook"].get(delivery.webhook_id);
        if (!hook) throw new HttpError(404, "Webhook no longer exists", "not_found");
        let body: unknown = {};
        try { body = JSON.parse(delivery.request_body || "{}"); } catch { body = { raw: delivery.request_body }; }
        const result = await deliverOne(sr, hook, delivery.topic || hook.topic, body);
        return ok(result);
      }
      default:
        return fail(400, `Unknown action: ${action}`, "unknown_action");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message, e.code);
    console.error("commerce/admin-webhooks error:", e);
    return fail(500, (e as Error).message ?? "Internal error");
  }
});
