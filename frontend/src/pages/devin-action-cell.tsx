import { CheckIcon, LoaderIcon } from "lucide-react";

import {
  DevinActionState,
  type FixIssueStatus,
} from "@/api/client";

interface DevinActionCellProps {
  issueId: number;
  status: FixIssueStatus | undefined;
  onFix: (issueId: number) => void;
}

/**
 * Action cell for the *Devin* column on the Vulnerabilities table.
 *
 * Renders one of four visuals driven by `DevinActionState`:
 *
 * - `NOT_FIXED`   → brand-blue **Fix** button.
 * - `REQUEST_SENT`→ brand-blue spinner + "Starting Devin session…".
 * - `FIXING`      → brand-blue spinner (same spinner as `REQUEST_SENT` — only
 *                   the text next to it changes) + "Fixing".
 * - `FIXED`       → brand-green check + "Fixed" rendered as an `<a>` that
 *                   opens the Devin-generated PR in a new tab.
 *
 * All other state is owned by the parent hook (`useVulnerabilities`); this
 * component stays dumb so the same progression can be rendered from
 * hydrated server status or from optimistic client updates without
 * branching here.
 */
export function DevinActionCell({ issueId, status, onFix }: DevinActionCellProps) {
  const state = status?.state ?? DevinActionState.NOT_FIXED;
  const error = status?.error ?? null;

  if (state === DevinActionState.REQUEST_SENT) {
    return (
      <StatusRow
        label="Starting Devin session…"
        spinnerClassName="text-brand-blue"
      />
    );
  }

  if (state === DevinActionState.FIXING) {
    return <StatusRow label="Fixing" spinnerClassName="text-brand-blue" />;
  }

  if (state === DevinActionState.FIXED && status?.pr_url) {
    return (
      <a
        href={status.pr_url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary hover:underline"
      >
        <CheckIcon className="size-3.5 text-brand-green" aria-hidden />
        Fixed
      </a>
    );
  }

  // NOT_FIXED — show Fix button. Surface any prior error message as a
  // tooltip so the user knows why the previous attempt failed without
  // crowding the cell.
  return (
    <button
      type="button"
      onClick={() => onFix(issueId)}
      title={error ? `Previous attempt failed: ${error}` : undefined}
      className="inline-flex h-7 items-center justify-center rounded-md bg-brand-blue px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      Fix
    </button>
  );
}

function StatusRow({
  label,
  spinnerClassName,
}: {
  label: string;
  spinnerClassName: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-text-primary">
      <LoaderIcon
        className={`size-3.5 animate-spin ${spinnerClassName}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
