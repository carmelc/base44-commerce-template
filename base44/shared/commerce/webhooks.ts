/**
 * Webhook dispatch (Woo-compatible headers + HMAC signature).
 * Fire-and-forget safe: every failure is swallowed and logged — a broken
 * webhook endpoint must never break an order flow.
 */

const MAX_BODY = 32 * 1024; // truncate logged request/response bodies at 32KB
const TIMEOUT_MS = 10_000;
const AUTO_DISABLE_AFTER = 5; // consecutive failures

async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Deliver `payload` to every active webhook subscribed to `topic`
 * (e.g. "order.created"). Logs each attempt as a WebhookDelivery, maintains
 * failure_count, and auto-disables a hook after 5 consecutive failures.
 */
export async function dispatch(sr: any, topic: string, payload: unknown): Promise<void> {
  try {
    const hooks = (await sr.entities["commerce.Webhook"].filter({ status: "active", topic })) ?? [];
    for (const hook of hooks) {
      await deliverOne(sr, hook, topic, payload);
    }
  } catch (e) {
    console.error(`webhook dispatch(${topic}) failed:`, e);
  }
}

/** Deliver to a single webhook record; used by dispatch and commerce/admin-webhooks test/redeliver. */
export async function deliverOne(sr: any, hook: any, topic: string, payload: unknown): Promise<any> {
  const [resource, event] = topic.split(".");
  const body = JSON.stringify(payload ?? {});
  const started = Date.now();

  // create the delivery record first so its id can ride in the header
  let delivery: any = null;
  try {
    delivery = await sr.entities["commerce.WebhookDelivery"].create({
      webhook_id: hook.id,
      topic,
      delivery_url: hook.delivery_url,
      request_headers: {},
      request_body: body.slice(0, MAX_BODY),
      response_code: 0,
      response_body: "",
      duration_ms: 0,
      success: false,
    });
  } catch (e) {
    console.error("webhook delivery log create failed:", e);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-WC-Webhook-Topic": topic,
    "X-WC-Webhook-Resource": resource ?? "",
    "X-WC-Webhook-Event": event ?? "",
    "X-WC-Webhook-ID": hook.id ?? "",
    "X-WC-Webhook-Delivery-ID": delivery?.id ?? "",
  };
  if (hook.secret) {
    try {
      headers["X-WC-Webhook-Signature"] = await hmacSha256Base64(hook.secret, body);
    } catch { /* signature best-effort */ }
  }

  let responseCode = 0;
  let responseBody = "";
  let success = false;
  try {
    const res = await fetch(hook.delivery_url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    responseCode = res.status;
    responseBody = (await res.text()).slice(0, MAX_BODY);
    success = res.ok;
  } catch (e) {
    responseBody = String((e as Error)?.message ?? e).slice(0, MAX_BODY);
  }

  const duration = Date.now() - started;
  try {
    if (delivery) {
      await sr.entities["commerce.WebhookDelivery"].update(delivery.id, {
        request_headers: headers,
        response_code: responseCode,
        response_body: responseBody,
        duration_ms: duration,
        success,
      });
    }
    const failureCount = success ? 0 : (hook.failure_count ?? 0) + 1;
    const patch: any = { failure_count: failureCount };
    if (!success && failureCount >= AUTO_DISABLE_AFTER) patch.status = "disabled";
    await sr.entities["commerce.Webhook"].update(hook.id, patch);
  } catch (e) {
    console.error("webhook delivery bookkeeping failed:", e);
  }

  return { delivery_id: delivery?.id ?? "", response_code: responseCode, success, duration_ms: duration };
}
