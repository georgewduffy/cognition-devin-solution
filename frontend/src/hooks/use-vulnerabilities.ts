import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DevinActionState,
  fetchFixIssueStatuses,
  fetchVulnerabilities,
  startFixIssues,
  subscribeGitHubWebhookEvents,
  type FixIssueStatus,
  type VulnerabilityIssue,
} from "@/api/client";

const SUCCESS_DURATION_MS = 5000;
const FIX_POLL_INTERVAL_MS = 4000;

export type SyncStatus = "idle" | "loading" | "success";

interface SyncOptions {
  silent?: boolean;
}

function emptyStatus(issueId: number, state: DevinActionState): FixIssueStatus {
  return {
    issue_id: issueId,
    state,
    session_id: null,
    session_url: null,
    pr_url: null,
    acus_consumed: null,
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

  const sync = useCallback(async (options?: SyncOptions) => {
    const silent = options?.silent === true;
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (!silent) {
      setSyncStatus("loading");
      setError(null);
    }
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

      // Hydrate Devin fix status for every synced issue in a single
      // batch request so a page reload (or a re-sync after a backend
      // reconnect) still shows FIXED/FIXING rows correctly rather than
      // defaulting to NOT_FIXED.
      const hydrated = await fetchFixIssueStatuses(
        data.map((issue) => issue.id)
      ).catch(() => ({} as Record<number, FixIssueStatus>));
      setFixStatuses((prev) => ({ ...prev, ...hydrated }));

      if (!silent) {
        setSyncStatus("success");
        successTimerRef.current = setTimeout(() => {
          setSyncStatus("idle");
          successTimerRef.current = null;
        }, SUCCESS_DURATION_MS);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setSyncStatus("idle");
      }
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

  const startFix = useCallback(async (issueIds: number[]) => {
    if (issueIds.length === 0) return;
    // Optimistically flip every requested row to REQUEST_SENT so the
    // cell changes the moment the user clicks — the backend can then
    // take multiple seconds to create each Devin session.
    setFixStatuses((prev) => {
      const next = { ...prev };
      for (const id of issueIds) {
        next[id] = emptyStatus(id, DevinActionState.REQUEST_SENT);
      }
      return next;
    });
    try {
      const statuses = await startFixIssues(issueIds);
      setFixStatuses((prev) => {
        const next = { ...prev };
        for (const id of issueIds) {
          const status = statuses[id];
          if (status) {
            next[id] = status;
          } else {
            // Backend didn't return an entry for this id — unexpected,
            // but safest to drop it back to NOT_FIXED rather than leave
            // it stuck spinning on REQUEST_SENT forever.
            next[id] = {
              ...emptyStatus(id, DevinActionState.NOT_FIXED),
              error: "No status returned from backend",
            };
          }
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Network / 5xx failure: revert every optimistically-flipped row
      // back to NOT_FIXED and attach the error message so the user
      // gets a tooltip.
      setFixStatuses((prev) => {
        const next = { ...prev };
        for (const id of issueIds) {
          next[id] = {
            ...emptyStatus(id, DevinActionState.NOT_FIXED),
            error: message,
          };
        }
        return next;
      });
    }
  }, []);

  // Poll any FIXING rows for status changes. We key the effect on the
  // sorted id list so the interval only restarts when the set of actively
  // polling issues changes — otherwise the 4s timer would reset on every
  // status update and never actually fire.
  const activePollKey = useMemo(() => {
    return Object.values(fixStatuses)
      .filter(
        (s) =>
          s.state === DevinActionState.FIXING ||
          s.state === DevinActionState.REQUEST_SENT ||
          s.state === DevinActionState.FIXED
      )
      .map((s) => s.issue_id)
      .sort((a, b) => a - b)
      .join(",");
  }, [fixStatuses]);

  useEffect(() => {
    if (!activePollKey) return;
    const ids = activePollKey.split(",").map(Number);
    let cancelled = false;
    const interval = setInterval(async () => {
      const results = await fetchFixIssueStatuses(ids).catch(
        () => ({} as Record<number, FixIssueStatus>)
      );
      if (cancelled) return;
      setFixStatuses((prev) => ({ ...prev, ...results }));
    }, FIX_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activePollKey]);

  useEffect(() => {
    return subscribeGitHubWebhookEvents(() => {
      void sync({ silent: true });
    });
  }, [sync]);

  return { issues, syncStatus, error, fixStatuses, sync, clear, startFix };
}
