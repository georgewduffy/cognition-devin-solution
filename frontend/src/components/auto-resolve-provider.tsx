import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchAutoResolveState,
  updateAutoResolveState,
} from "@/api/client";
import { AutoResolveContext } from "@/hooks/auto-resolve-context";

export function AutoResolveProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const state = await fetchAutoResolveState();
        if (!cancelled) {
          setEnabledState(state.enabled);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      const previousEnabled = enabled;
      setEnabledState(nextEnabled);
      setSaving(true);
      setError(null);
      try {
        const state = await updateAutoResolveState(nextEnabled);
        setEnabledState(state.enabled);
      } catch (err) {
        setEnabledState(previousEnabled);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    },
    [enabled]
  );

  const value = useMemo(
    () => ({
      enabled,
      pending: loading || saving,
      error,
      setEnabled,
    }),
    [enabled, error, loading, saving, setEnabled]
  );

  return (
    <AutoResolveContext.Provider value={value}>
      {children}
    </AutoResolveContext.Provider>
  );
}
