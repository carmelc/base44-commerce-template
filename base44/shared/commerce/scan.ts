/**
 * Full-collection scan helper. Base44's filter() is exact-match with a 5k page
 * cap and no total count, so server-side search/aggregation loops pages of 500.
 * Keep `cap` sane — reports over very large stores should move to a
 * materialized stats entity (see implementation-guidelines.md).
 */

export interface ScanOpts {
  /** Hard cap on records scanned (default 10_000). */
  cap?: number;
  /** Page size per request (default 500). */
  pageSize?: number;
  /** Optional field projection passed through to filter(). */
  fields?: string[];
}

/**
 * Scan every record matching `query` (null/{} = all records via list()).
 * `entityApi` is e.g. `sr.entities["commerce.Order"]`.
 *
 * The 4th arg accepts either a plain number (treated as `cap`) or a full
 * `ScanOpts` object, so both `scanAll(e, {}, "order", 500)` and
 * `scanAll(e, {}, "order", { cap: 500 })` call styles are valid.
 */
export async function scanAll(
  entityApi: any,
  query: Record<string, any> | null = null,
  sort = "-created_date",
  optsOrCap: ScanOpts | number = {},
): Promise<any[]> {
  const opts: ScanOpts = typeof optsOrCap === "number" ? { cap: optsOrCap } : optsOrCap;
  const cap = opts.cap ?? 10_000;
  const pageSize = opts.pageSize ?? 500;
  const out: any[] = [];
  let skip = 0;
  while (out.length < cap) {
    const page = query && Object.keys(query).length
      ? (await entityApi.filter(query, sort, pageSize, skip, opts.fields)) ?? []
      : (await entityApi.list(sort, pageSize, skip)) ?? [];
    out.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
  }
  return out.slice(0, cap);
}

/** Case-insensitive "haystack contains needle" for server-side search actions. */
export function textMatch(haystack: unknown, needle: string): boolean {
  if (!needle) return true;
  return String(haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

/** Slice a filtered array into a page + has_next probe (limit+1 convention). */
export function pageSlice<T>(rows: T[], limit = 20, skip = 0): { rows: T[]; has_next: boolean } {
  const page = rows.slice(skip, skip + limit + 1);
  return { rows: page.slice(0, limit), has_next: page.length > limit };
}
