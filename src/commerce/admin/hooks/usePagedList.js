import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Paged listing over a fetcher(limit, skip, sortString) that returns an array.
 * Uses the limit+1 probe to detect a next page (the SDK has no total count).
 *
 * Returns:
 *   { rows, loading, error, page (1-based), hasNext, next, prev,
 *     sort, setSort, refetch }
 *
 * `deps`: when any dep changes (e.g. a filter), the list resets to page 1.
 */
export default function usePagedList(fetcher, { pageSize = 20, initialSort = "-created_date", deps = [] } = {}) {
  const [page, setPage] = useState(0); // 0-based internally
  const [sort, setSortState] = useState(initialSort);
  const [state, setState] = useState({ rows: [], hasNext: false, loading: true, error: null });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (p, s) => {
      setState((st) => ({ ...st, loading: true }));
      try {
        const rows = (await fetcherRef.current(pageSize + 1, p * pageSize, s)) || [];
        setState({
          rows: rows.slice(0, pageSize),
          hasNext: rows.length > pageSize,
          loading: false,
          error: null,
        });
      } catch (error) {
        setState({ rows: [], hasNext: false, loading: false, error });
      }
    },
    [pageSize]
  );

  // Reset to first page when external deps (filters/search) change.
  const depsKey = JSON.stringify(deps);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (page !== 0) setPage(0);
    else load(0, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  useEffect(() => {
    load(page, sort);
  }, [page, sort, load]);

  const setSort = useCallback((s) => {
    setPage(0);
    setSortState(s);
  }, []);

  return {
    rows: state.rows,
    loading: state.loading,
    error: state.error,
    hasNext: state.hasNext,
    page: page + 1,
    next: () => state.hasNext && setPage((p) => p + 1),
    prev: () => setPage((p) => Math.max(0, p - 1)),
    sort,
    setSort,
    refetch: () => load(page, sort),
  };
}
