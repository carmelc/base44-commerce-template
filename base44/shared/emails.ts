/**
 * Transactional email dispatch (the Woo email set, minus reset_password /
 * new_account which Base44 auth handles). Reads the `emails` settings group,
 * renders via email-templates.ts, sends with Core.SendEmail, logs to EmailLog,
 * and records lifecycle sends on order.emails_sent to prevent duplicates.
 *
 * Persistence note: this module OWNS order.emails_sent (it updates that field
 * on the Order record itself); orders.ts transitionOrder never writes it.
 */
import { getSettings } from "./settings.ts";
import { renderOrderEmail, RenderExtra } from "./email-templates.ts";

/** Types sent to store admins. */
const ADMIN_TYPES = new Set(["new_order", "cancelled_order", "failed_order"]);
/** Types sent to the customer. */
const CUSTOMER_TYPES = new Set([
  "failed_order", "on_hold_order", "processing_order", "completed_order",
  "refunded_order", "partial_refund", "customer_invoice", "customer_note",
]);
/** Lifecycle types that only ever fire once per order (deduped via emails_sent). */
const ONCE_TYPES = new Set([
  "new_order", "cancelled_order", "failed_order", "on_hold_order",
  "processing_order", "completed_order", "refunded_order",
]);

export interface SendOrderEmailOpts {
  settings?: Record<string, any>; // pre-fetched groups (emails + general)
  extra?: RenderExtra;
  force?: boolean;                // bypass the emails_sent dedupe (manual re-send)
}

/**
 * Send one of the transactional order emails. Returns
 * {sent, reason?} — never throws (email failures must not break checkout).
 */
export async function sendOrderEmail(
  sr: any,
  type: string,
  order: any,
  opts: SendOrderEmailOpts = {},
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const settings = opts.settings ?? (await getSettings(sr, "emails", "general"));
    const cfg = settings.emails ?? {};
    const typeCfg = cfg[type] ?? {};

    if (typeCfg.enabled === false) return { sent: false, reason: "disabled" };
    if (!opts.force && ONCE_TYPES.has(type) && (order.emails_sent || []).includes(type)) {
      return { sent: false, reason: "already_sent" };
    }

    // resolve recipients
    const recipients: string[] = [];
    if (ADMIN_TYPES.has(type)) {
      const admins = typeCfg.recipient
        ? [typeCfg.recipient]
        : (cfg.admin_recipients || []).filter(Boolean);
      recipients.push(...admins);
    }
    if (CUSTOMER_TYPES.has(type) && order.billing?.email) {
      recipients.push(order.billing.email);
    }
    if (!recipients.length) {
      await logEmail(sr, type, "", "", order, false, "no recipient configured");
      return { sent: false, reason: "no_recipient" };
    }

    const { subject, html } = renderOrderEmail(type, order, settings, opts.extra ?? {});
    const fromName = cfg.from_name || settings.general?.store_name || undefined;

    let anySent = false;
    for (const to of [...new Set(recipients)]) {
      try {
        await sr.integrations.Core.SendEmail({ to, subject, body: html, from_name: fromName });
        await logEmail(sr, type, to, subject, order, true);
        anySent = true;
      } catch (e) {
        await logEmail(sr, type, to, subject, order, false, String((e as Error)?.message ?? e));
      }
    }

    if (anySent && ONCE_TYPES.has(type)) {
      const sent = [...(order.emails_sent || []), type];
      order.emails_sent = sent;
      await sr.entities.Order.update(order.id, { emails_sent: sent });
    }
    return { sent: anySent };
  } catch (e) {
    console.error(`sendOrderEmail(${type}) failed:`, e);
    return { sent: false, reason: "error" };
  }
}

/**
 * Low/out-of-stock notifications to the inventory recipient
 * (kind: "low_stock" | "out_of_stock" | "backorder").
 */
export async function sendStockEmail(sr: any, kind: string, product: any, opts: { settings?: Record<string, any> } = {}): Promise<void> {
  try {
    const settings = opts.settings ?? (await getSettings(sr, "inventory", "emails", "general"));
    const inv = settings.inventory ?? {};
    if (kind === "low_stock" && inv.notify_low_stock === false) return;
    if (kind === "out_of_stock" && inv.notify_out_of_stock === false) return;
    const to = inv.notification_recipient || (settings.emails?.admin_recipients || [])[0];
    if (!to) return;

    const storeName = settings.general?.store_name ?? "your store";
    const labels: Record<string, string> = {
      low_stock: "is low in stock",
      out_of_stock: "is out of stock",
      backorder: "is on backorder",
    };
    const subject = `[${storeName}] Product ${labels[kind] ?? kind}: ${product.name}`;
    const body = `<p><strong>${product.name}</strong> (${product.sku || "no SKU"}) ${labels[kind] ?? kind}.</p>
<p>Remaining stock: ${product.stock_quantity ?? "n/a"}</p>`;
    await sr.integrations.Core.SendEmail({ to, subject, body, from_name: settings.emails?.from_name });
    await sr.entities.EmailLog.create({ email_type: kind, recipient: to, subject, success: true });
  } catch (e) {
    console.error(`sendStockEmail(${kind}) failed:`, e);
  }
}

async function logEmail(
  sr: any,
  type: string,
  recipient: string,
  subject: string,
  order: any,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await sr.entities.EmailLog.create({
      email_type: type,
      recipient,
      subject,
      order_id: order?.id ?? "",
      success,
      error: error ?? "",
    });
  } catch { /* logging must never break the caller */ }
}
