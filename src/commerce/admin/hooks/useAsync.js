import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Run an async function on mount / when deps change.
 * Returns { data, loading, error, refetch, setData }.
 */
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({
      ...s,
      data: typeof updater === "function" ? updater(s.data) : updater,
    }));
  }, []);

  return { ...state, refetch: run, setData };
}
