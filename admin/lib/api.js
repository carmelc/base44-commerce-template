/**
 * Single touchpoint for the Base44 SDK client and backend-function calls.
 *
 * If your app exports the client differently (e.g. a named export),
 * this is the ONLY file you need to adjust.
 */
import base44 from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Invoke a backend function using the template's `{action, ...payload}` convention.
 *
 * - Returns the unwrapped `data` when the function responds with the
 *   `{success, data}` envelope, otherwise the raw response body.
 * - On failure: shows an error toast (unless `opts.silent`) and rethrows an
 *   Error carrying `.code` and `.details` from the function's error body.
 *
 * @param {string} fn - function name, e.g. "admin-orders"
 * @param {string|null} action - action name, e.g. "status-counts" (null = send payload as-is)
 * @param {object} payload
 * @param {{silent?: boolean}} opts
 */
export async function call(fn, action, payload = {}, opts = {}) {
  try {
    const body = action ? { action, ...payload } : { ...payload };
    const res = await base44.functions.invoke(fn, body);
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
