/**
 * HTML rendering for transactional order emails. Simple, inline-styled,
 * 600px table layout that renders acceptably in every mail client.
 * Subjects/headings follow standard commerce conventions and can be overridden per type
 * in the `emails` settings group.
 */
import { formatMoney } from "./money.ts";

interface EmailCopy {
  subject: string;
  heading: string;
  intro: string;
}

/** Default copy per email type; {placeholders} substituted at render time. */
const DEFAULT_COPY: Record<string, EmailCopy> = {
  new_order: {
    subject: "[{store_name}]: New order #{order_number}",
    heading: "New Order: #{order_number}",
    intro: "You have received the following order from {customer_name}:",
  },
  cancelled_order: {
    subject: "[{store_name}]: Order #{order_number} has been cancelled",
    heading: "Order Cancelled: #{order_number}",
    intro: "The following order has been cancelled. Order details:",
  },
  failed_order: {
    subject: "[{store_name}]: Order #{order_number} has failed",
    heading: "Order Failed: #{order_number}",
    intro: "Payment for the following order has failed. Order details:",
  },
  on_hold_order: {
    subject: "Your {store_name} order has been received!",
    heading: "Thank you for your order",
    intro: "Your order is on hold until we confirm that payment has been received. Order details below for your reference:",
  },
  processing_order: {
    subject: "Your {store_name} order has been received!",
    heading: "Thank you for your order",
    intro: "We have received your order and it is now being processed. Order details below for your reference:",
  },
  completed_order: {
    subject: "Your {store_name} order is now complete",
    heading: "Thanks for shopping with us",
    intro: "Your order is now complete. Order details below for your reference:",
  },
  refunded_order: {
    subject: "Your {store_name} order has been refunded",
    heading: "Order Refunded: #{order_number}",
    intro: "Your order has been refunded. Details below for your reference:",
  },
  partial_refund: {
    subject: "Your {store_name} order has been partially refunded",
    heading: "Order Partially Refunded: #{order_number}",
    intro: "Your order has been partially refunded. Details below for your reference:",
  },
  customer_invoice: {
    subject: "Invoice for order #{order_number} from {store_name}",
    heading: "Invoice for order #{order_number}",
    intro: "Details of your order are below:",
  },
  customer_note: {
    subject: "Note added to your {store_name} order #{order_number}",
    heading: "A note has been added to your order",
    intro: "The following note has been added to your order:",
  },
};

function substitute(text: string, order: any, general: Record<string, any>): string {
  const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ") || "customer";
  return (text || "")
    .replaceAll("{order_number}", String(order.order_number ?? ""))
    .replaceAll("{customer_name}", customerName)
    .replaceAll("{store_name}", String(general.store_name ?? "our store"))
    .replaceAll("{order_total}", formatMoney(order.total ?? 0, general));
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const cell = 'style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:14px;color:#333;"';
const cellR = 'style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:14px;color:#333;text-align:right;"';

function addressBlock(title: string, a: any, general: Record<string, any>): string {
  if (!a || (!a.address_1 && !a.first_name && !a.city)) return "";
  const lines = [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    a.company,
    a.address_1,
    a.address_2,
    [a.city, a.state, a.postcode].filter(Boolean).join(", "),
    a.country,
    a.email,
    a.phone,
  ].filter(Boolean).map(esc);
  return `<td style="vertical-align:top;padding:12px;width:50%;">
    <h3 style="margin:0 0 8px;font-size:15px;color:#333;">${esc(title)}</h3>
    <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">${lines.join("<br/>")}</p>
  </td>`;
}

export interface RenderExtra {
  note?: string;
  refund?: { amount: number; reason?: string };
  paymentInstructions?: { title: string; lines: string[] };
  additionalContent?: string;
}

export interface RenderedEmail {
  subject: string;
  heading: string;
  html: string;
}

/**
 * Render an order email. `settings` is the groups object (uses `emails` for
 * overrides and `general` for store name / money format).
 */
export function renderOrderEmail(
  type: string,
  order: any,
  settings: Record<string, any>,
  extra: RenderExtra = {},
): RenderedEmail {
  const general = settings.general ?? {};
  const typeCfg = (settings.emails ?? {})[type] ?? {};
  const copy = DEFAULT_COPY[type] ?? DEFAULT_COPY.customer_invoice;

  const subject = substitute(typeCfg.subject || copy.subject, order, general);
  const heading = substitute(typeCfg.heading || copy.heading, order, general);
  const intro = substitute(copy.intro, order, general);
  const money = (n: number) => esc(formatMoney(n ?? 0, general));

  const itemRows = (order.line_items || []).map((li: any) => `
    <tr>
      <td ${cell}>${esc(li.name)}${li.sku ? ` <span style="color:#999;">(${esc(li.sku)})</span>` : ""}${
        (li.attributes || []).length
          ? `<br/><span style="color:#777;font-size:12px;">${li.attributes.map((a: any) => `${esc(a.name)}: ${esc(a.option)}`).join(", ")}</span>`
          : ""
      }</td>
      <td ${cellR}>${li.quantity}</td>
      <td ${cellR}>${money(li.total)}</td>
    </tr>`).join("");

  const totalsRows: Array<[string, string]> = [["Subtotal", money(order.subtotal ?? 0)]];
  if (order.discount_total) totalsRows.push(["Discount", `-${money(order.discount_total)}`]);
  for (const fl of order.fee_lines || []) totalsRows.push([esc(fl.name || "Fee"), money(fl.total)]);
  if ((order.shipping_lines || []).length) {
    const title = order.shipping_lines.map((s: any) => esc(s.method_title)).join(", ");
    totalsRows.push([`Shipping (${title})`, money(order.shipping_total ?? 0)]);
  }
  for (const tl of order.tax_lines || []) {
    totalsRows.push([esc(tl.label || "Tax"), money(round2Safe(tl.tax_total + tl.shipping_tax_total))]);
  }
  totalsRows.push(["<strong>Total</strong>", `<strong>${money(order.total ?? 0)}</strong>`]);
  if (order.total_refunded) totalsRows.push(["Refunded", `-${money(order.total_refunded)}`]);

  const totalsHtml = totalsRows.map(([label, value]) => `
    <tr>
      <td colspan="2" ${cellR}>${label}</td>
      <td ${cellR}>${value}</td>
    </tr>`).join("");

  const noteHtml = extra.note
    ? `<div style="margin:16px 0;padding:12px;background:#fdf6e3;border:1px solid #f0e0b0;border-radius:4px;font-size:13px;color:#555;">${esc(extra.note)}</div>`
    : "";

  const refundHtml = extra.refund
    ? `<p style="font-size:13px;color:#555;">Refund amount: <strong>${money(extra.refund.amount)}</strong>${extra.refund.reason ? ` — ${esc(extra.refund.reason)}` : ""}</p>`
    : "";

  const payHtml = extra.paymentInstructions
    ? `<div style="margin:16px 0;padding:12px;background:#f5f8fb;border:1px solid #d4e0ec;border-radius:4px;">
        <h3 style="margin:0 0 8px;font-size:14px;color:#333;">${esc(extra.paymentInstructions.title)}</h3>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">${extra.paymentInstructions.lines.map(esc).join("<br/>")}</p>
      </div>`
    : "";

  const customerNoteHtml = order.customer_note
    ? `<p style="font-size:13px;color:#555;"><strong>Customer note:</strong> ${esc(order.customer_note)}</p>`
    : "";

  const additional = typeCfg.additional_content || extra.additionalContent
    ? `<p style="font-size:13px;color:#555;">${esc(typeCfg.additional_content || extra.additionalContent)}</p>`
    : "";

  const html = `
<div style="background:#f7f7f7;padding:24px 0;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;margin:0 auto;">
    <tr>
      <td style="background:#557da1;padding:24px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${esc(substitute("{store_name}", order, general))}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="margin:0 0 12px;font-size:18px;color:#557da1;">${esc(heading)}</h2>
        <p style="font-size:14px;color:#555;line-height:1.5;">${esc(intro)}</p>
        ${noteHtml}${refundHtml}
        <h3 style="margin:20px 0 8px;font-size:15px;color:#333;">Order #${esc(order.order_number)} (${esc((order.created_date || "").slice(0, 10))})</h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-collapse:collapse;">
          <tr>
            <th ${cell.replace("color:#333", "color:#333;text-align:left")}>Product</th>
            <th ${cellR}>Qty</th>
            <th ${cellR}>Total</th>
          </tr>
          ${itemRows}
          ${totalsHtml}
        </table>
        ${payHtml}${customerNoteHtml}${additional}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            ${addressBlock("Billing address", order.billing, general)}
            ${addressBlock("Shipping address", order.shipping, general)}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;">
        <p style="margin:0;font-size:12px;color:#999;">${esc(general.store_name ?? "")} — powered by the Base44 commerce template</p>
      </td>
    </tr>
  </table>
</div>`;

  return { subject, heading, html };
}

function round2Safe(n: number): number {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}
