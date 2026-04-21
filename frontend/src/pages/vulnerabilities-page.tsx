import { useCallback, useMemo, useState } from "react";
import { RefreshCwIcon, Trash2Icon } from "lucide-react";
import type { RowSelectionState, Updater } from "@tanstack/react-table";

import { useVulnerabilities } from "@/hooks/use-vulnerabilities";
import { isIdentifiedIssue } from "@/lib/vulnerability-status";
import { VulnerabilitiesTable } from "./vulnerabilities-table";

export function VulnerabilitiesPage() {
  const { issues, syncStatus, error, fixStatuses, sync, clear, startFix } =
    useVulnerabilities();

  // Selection is lifted up to the page so the primary Resolve button can
  // reflect the current identified vulnerability selection
  // count in its label. We clear selection whenever the user clicks the
  // trash button so the counter matches the (now-empty) table.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      setRowSelection((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  const handleClear = useCallback(() => {
    clear();
    setRowSelection({});
  }, [clear]);

  const selectedIdentifiedIds = useMemo(() => {
    const ids: number[] = [];
    for (const issue of issues) {
      if (
        rowSelection[String(issue.id)] &&
        isIdentifiedIssue(issue, fixStatuses)
      ) {
        ids.push(issue.id);
      }
    }
    return ids;
  }, [fixStatuses, issues, rowSelection]);

  const identifiedIds = useMemo(
    () =>
      issues
        .filter((issue) => isIdentifiedIssue(issue, fixStatuses))
        .map((issue) => issue.id),
    [fixStatuses, issues]
  );

  const hasSelectedRows = useMemo(
    () => issues.some((issue) => rowSelection[String(issue.id)]),
    [issues, rowSelection]
  );

  const targetIds = hasSelectedRows ? selectedIdentifiedIds : identifiedIds;
  const resolveLabel = hasSelectedRows
    ? `Resolve ${selectedIdentifiedIds.length} Vulnerabilit${
        selectedIdentifiedIds.length === 1 ? "y" : "ies"
      }`
    : "Resolve All";

  const handleResolveIssues = useCallback(() => {
    if (targetIds.length === 0) return;
    void startFix(targetIds);
  }, [startFix, targetIds]);

  const syncClassName =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-primary bg-transparent text-text-secondary transition-colors hover:text-text-primary hover:bg-hover-fill disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer " +
    (syncStatus === "success"
      ? "text-brand-green hover:text-brand-green border-brand-green/40"
      : "");

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-start gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-text-primary">
                Vulnerabilities
              </h1>
              <p className="mt-1 text-[13px] text-text-secondary">
                Vulnerabilities reported as issues in the connected GitHub
                codebase.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {error && (
                <span className="text-destructive font-medium text-[12px]">
                  Error: {error}
                </span>
              )}
              <button
                type="button"
                onClick={handleClear}
                disabled={issues.length === 0}
                title="Clear vulnerabilities"
                aria-label="Clear vulnerabilities"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-primary bg-transparent text-text-secondary transition-colors hover:text-text-primary hover:bg-hover-fill disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2Icon className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void sync()}
                disabled={syncStatus === "loading"}
                title={
                  syncStatus === "success"
                    ? "Synced"
                    : "Sync vulnerability issues"
                }
                aria-label="Sync vulnerability issues"
                className={syncClassName}
              >
                <RefreshCwIcon
                  className={
                    "size-4 " +
                    (syncStatus === "loading" ? "animate-spin" : "")
                  }
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={handleResolveIssues}
                disabled={targetIds.length === 0}
                className="inline-flex h-8 items-center justify-center rounded-md bg-brand-blue px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {resolveLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 h-px bg-border-secondary" />

        <div className="mt-6">
          <VulnerabilitiesTable
            issues={issues}
            fixStatuses={fixStatuses}
            onFix={startFix}
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
          />
        </div>
      </div>
    </div>
  );
}
