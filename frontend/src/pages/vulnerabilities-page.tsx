import { useVulnerabilities } from "@/hooks/use-vulnerabilities";
import { VulnerabilitiesTable } from "./vulnerabilities-table";

export function VulnerabilitiesPage() {
  const { issues, syncStatus, error, sync, clear } = useVulnerabilities();

  const syncLabel =
    syncStatus === "loading"
      ? "Syncing..."
      : syncStatus === "success"
        ? "Synced Vulnerabilities"
        : "Sync Vulnerability Issues";

  const syncClasses =
    "inline-flex h-8 items-center justify-center rounded-md px-3 text-[13px] font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer " +
    (syncStatus === "success"
      ? "bg-brand-green hover:bg-brand-green/90"
      : "bg-brand-blue hover:bg-brand-blue/90");

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
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
          <div className="flex items-center gap-3 pt-1">
            {error && (
              <span className="text-destructive font-medium text-[12px]">
                Error: {error}
              </span>
            )}
            <button
              type="button"
              onClick={clear}
              disabled={issues.length === 0}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border-primary bg-transparent px-3 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary hover:bg-hover-fill disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Clear Vulnerabilities
            </button>
            <button
              type="button"
              onClick={sync}
              disabled={syncStatus === "loading"}
              className={syncClasses}
            >
              {syncLabel}
            </button>
          </div>
        </div>

        <div className="mt-5 h-px bg-border-secondary" />

        <div className="mt-6">
          <VulnerabilitiesTable issues={issues} />
        </div>
      </div>
    </div>
  );
}
