/**
 * Single touchpoint for the Base44 SDK client and backend-function calls.
 *
 * Expects your app to export the client as a named `base44` export, as
 * Base44's default `src/api/base44Client.js` does. If your app uses a
 * default export instead, this import is the ONLY line you need to adjust.
 * (A static "named-or-default" probe is not possible here: referencing an
 * export the module doesn't have is a hard error at build time.)
 */
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Invoke a backend function using the template's `{action, ...payload}` convention.
 *
 * - Returns the unwrapped `data` when the function responds with the
 *   `{success, data}` envelope, otherwise the raw response body.
 * - On failure: shows an error toast (unless `opts.silent`) and rethrows an
 *   Error carrying `.code` and `.details` from the function's error body.
 *
 * @param {string} fn - function name without the "commerce/" prefix, e.g.
 *   "admin-orders" (invoked as "commerce/admin-orders" — the prefix is added here)
 * @param {string|null} action - action name, e.g. "status-counts" (null = send payload as-is)
 * @param {object} payload
 * @param {{silent?: boolean}} opts
 */
export async function call(fn, action, payload = {}, opts = {}) {
  try {
    const body = action ? { action, ...payload } : { ...payload };
    const res = await base44.functions.invoke(`commerce/${fn}`, body);
    const data = res?.data;
    if (data && typeof data === "object" && "success" in data) {
      if (data.success === false) {
        throw Object.assign(new Error(data.error || "Request failed"), {
          code: data.code,
          details: data,
        });
      }
      return "data" in data ? data.data : data;
    }
    return data;
  } catch (err) {
    const body = err.response?.data;
    const message = body?.error || err.message || "Request failed";
    const wrapped = Object.assign(new Error(message), {
      code: body?.code || err.code,
      details: body || err.details || null,
      status: err.response?.status,
    });
    if (!opts.silent) toast.error(message);
    throw wrapped;
  }
}

export { base44 };
