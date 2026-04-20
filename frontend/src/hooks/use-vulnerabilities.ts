import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DevinActionState,
  fetchFixIssueStatus,
  fetchVulnerabilities,
  startFixIssue,
  type FixIssueStatus,
  type VulnerabilityIssue,
} from "@/api/client";

const SUCCESS_DURATION_MS = 5000;
const FIX_POLL_INTERVAL_MS = 4000;

export type SyncStatus = "idle" | "loading" | "success";

function emptyStatus(issueId: number, state: DevinActionState): FixIssueStatus {
  return {
    issue_id: issueId,
    state,
    session_id: null,
    session_url: null,
    pr_url: null,
    error: null,
  };
}

export function useVulnerabilities() {
  const [issues, setIssues] = useState<VulnerabilityIssue[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fixStatuses, setFixStatuses] = useState<
    Record<number, FixIssueStatus>
  >({});
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

      // Hydrate Devin fix status for each synced issue so a page reload
      // (or a re-sync after a backend restart reconnect) still shows
      // FIXED/FIXING rows correctly rather than defaulting to NOT_FIXED.
      const hydrated = await Promise.all(
        data.map((issue) =>
          fetchFixIssueStatus(issue.id).catch(() => null as FixIssueStatus | null)
        )
      );
      setFixStatuses((prev) => {
        const next: Record<number, FixIssueStatus> = { ...prev };
        data.forEach((issue, i) => {
          const status = hydrated[i];
          if (status) {
            next[issue.id] = status;
          }
        });
        return next;
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
    // Keep `fixStatuses` around — the user may clear the table and
    // re-sync, in which case we want to re-attach the existing FIXED/
    // FIXING rows rather than lose progress. Entries for issues that no
    // longer appear upstream are simply never read.
  }, []);

  const startFix = useCallback(async (issueId: number) => {
    setFixStatuses((prev) => ({
      ...prev,
      [issueId]: emptyStatus(issueId, DevinActionState.REQUEST_SENT),
    }));
    try {
      const status = await startFixIssue(issueId);
      setFixStatuses((prev) => ({ ...prev, [issueId]: status }));
    } catch (err) {
      setFixStatuses((prev) => ({
        ...prev,
        [issueId]: {
          ...emptyStatus(issueId, DevinActionState.NOT_FIXED),
          error: err instanceof Error ? err.message : "Unknown error",
        },
      }));
    }
  }, []);

  // Poll any FIXING rows for status changes. We key the effect on the
  // sorted id list so the interval only restarts when the set of actively
  // polling issues changes — otherwise the 4s timer would reset on every
  // status update and never actually fire.
  const activePollKey = useMemo(() => {
    return Object.values(fixStatuses)
      .filter((s) => s.state === DevinActionState.FIXING)
      .map((s) => s.issue_id)
      .sort((a, b) => a - b)
      .join(",");
  }, [fixStatuses]);

  useEffect(() => {
    if (!activePollKey) return;
    const ids = activePollKey.split(",").map(Number);
    let cancelled = false;
    const interval = setInterval(async () => {
      const results = await Promise.all(
        ids.map((id) =>
          fetchFixIssueStatus(id).catch(() => null as FixIssueStatus | null)
        )
      );
      if (cancelled) return;
      setFixStatuses((prev) => {
        const next = { ...prev };
        results.forEach((status, i) => {
          if (status) next[ids[i]] = status;
        });
        return next;
      });
    }, FIX_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activePollKey]);

  return { issues, syncStatus, error, fixStatuses, sync, clear, startFix };
}
