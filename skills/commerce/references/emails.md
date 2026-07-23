# Emails

Transactional email is sent via `base44.integrations.Core.SendEmail` from the shared `emails.ts`. Ten order emails are wired to the lifecycle (see the side-effect matrix in [`skills/commerce/docs/api-admin.md`](../docs/api-admin.md)): `new_order`, `cancelled_order`, `failed_order`, `on_hold_order`, `processing_order`, `completed_order`, `refunded_order`, `partial_refund`, `customer_invoice`, `customer_note`. `reset_password` and `new_account` are handled by **Base44 auth**, not this template.

- Per-type enable/subject/heading/recipient overrides live in the `emails` StoreSettings group (editable in Settings → Emails). Blank = built-in default.
- `emails_sent[]` on each order dedupes lifecycle emails so a re-entered status won't re-send.
- Deliverability (SPF/DKIM, from-address) depends on your Base44 email configuration; set a real `from_address` and `admin_recipients` before going live. Every send is recorded in the `commerce.EmailLog` entity.
