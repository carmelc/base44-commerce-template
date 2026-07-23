/**
 * Auth guards for backend functions.
 * Admin functions call requireAdmin() before doing anything with asServiceRole.
 */

/** Error carrying an HTTP status; function entrypoints translate it to a Response. */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Current caller, or null when unauthenticated (never throws). */
export async function getCallerUser(base44: any): Promise<any | null> {
  try {
    return (await base44.auth.me()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ensure the caller is an authenticated admin. Returns the user record.
 * Throws HttpError 401 (unauthenticated) or 403 (not admin).
 * Note: entity RLS is the second line of defense — this guard is the first.
 */
export async function requireAdmin(base44: any): Promise<any> {
  const user = await getCallerUser(base44);
  if (!user) throw new HttpError(401, "Authentication required", "unauthenticated");
  if (user.role !== "admin") throw new HttpError(403, "Admin role required", "forbidden");
  return user;
}
