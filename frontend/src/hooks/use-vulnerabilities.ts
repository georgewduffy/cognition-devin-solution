import { useCallback, useRef, useState } from "react";
import {
  fetchVulnerabilities,
  type VulnerabilityIssue,
} from "@/api/client";

const SUCCESS_DURATION_MS = 5000;

export type SyncStatus = "idle" | "loading" | "success";

export function useVulnerabilities() {
  const [issues, setIssues] = useState<VulnerabilityIssue[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setSyncStatus("loading");
    setError(null);
    try {
      const data = await fetchVulnerabilities();
      // The backend returns the authoritative full set of current
      // vulnerability issues, so replace local state rather than merging —
      // issues whose `vulnerability` label is removed upstream must stop
      // appearing in the table. Update-in-place behaviour on re-sync is
      // preserved by tanstack-table keying rows on the stable GitHub `id`
      // (see `getRowId` in vulnerabilities-table.tsx), which keeps
      // per-row selection/DOM identity across renders.
      setIssues(data);
      setSyncStatus("success");
      successTimerRef.current = setTimeout(() => {
        setSyncStatus("idle");
        successTimerRef.current = null;
      }, SUCCESS_DURATION_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSyncStatus("idle");
    }
  }, []);

  const clear = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setIssues([]);
    setError(null);
    setSyncStatus("idle");
  }, []);

  return { issues, syncStatus, error, sync, clear };
}
