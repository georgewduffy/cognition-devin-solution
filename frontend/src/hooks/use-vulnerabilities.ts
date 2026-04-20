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
      // Merge by stable GitHub `id` so re-syncing updates existing rows in
      // place rather than duplicating them.
      setIssues((prev) => {
        const byId = new Map<number, VulnerabilityIssue>(
          prev.map((issue) => [issue.id, issue])
        );
        for (const issue of data) {
          byId.set(issue.id, issue);
        }
        return Array.from(byId.values());
      });
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
