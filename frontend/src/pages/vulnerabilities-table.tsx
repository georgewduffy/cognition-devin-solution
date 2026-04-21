import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LoaderIcon } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";

import {
  DevinActionState,
  type FixIssueStatus,
  type VulnerabilityIssue,
} from "@/api/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getEffectiveFixStatus } from "@/lib/vulnerability-status";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}

function TypeBadge({ label }: { label: string | null }) {
  if (!label) {
    return null;
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border-primary bg-hover-fill px-2 py-0.5 font-mono text-[11px] tracking-wide text-text-secondary">
      {label}
    </span>
  );
}

const loaderClassName =
  "size-3.5 animate-spin text-brand-blue/90 [animation-duration:1.8s]";

function formatAcus(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (value > 0 && value < 0.01) {
    return "<0.01 ACUs";
  }
  if (value < 10) {
    return `${value.toFixed(2)} ACUs`;
  }
  if (value < 100) {
    return `${value.toFixed(1)} ACUs`;
  }
  return `${Math.round(value)} ACUs`;
}

function StatusBadge({ status }: { status: FixIssueStatus | undefined }) {
  const state = status?.state ?? DevinActionState.NOT_FIXED;

  switch (state) {
    case DevinActionState.NOT_FIXED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium bg-red-500/15 text-red-400">
          <span aria-hidden className="size-1.5 rounded-full bg-red-400" />
          Identified
        </span>
      );
    case DevinActionState.REQUEST_SENT:
      return (
        <span className="inline-flex min-w-max items-center justify-end gap-1.5 text-[13px] text-text-secondary">
          <LoaderIcon className={loaderClassName} aria-hidden />
          Waking Devin up
        </span>
      );
    case DevinActionState.FIXING: {
      const acusText = formatAcus(status?.acus_consumed);
      const workingText = (
        <>
          <span className="text-text-primary group-hover:underline">
            Working
          </span>
          {acusText ? (
            <span
              className="text-text-secondary"
              title={
                status?.acus_consumed === null ||
                status?.acus_consumed === undefined
                  ? undefined
                  : `${status.acus_consumed} ACUs consumed`
              }
            >
              {acusText}
            </span>
          ) : null}
        </>
      );
      return (
        <span className="inline-flex min-w-max items-center justify-end gap-1.5 text-[13px]">
          <LoaderIcon className={loaderClassName} aria-hidden />
          {status?.session_url ? (
            <a
              href={status.session_url}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-1.5 underline-offset-4"
            >
              {workingText}
            </a>
          ) : (
            <span className="group inline-flex items-center gap-1.5">
              {workingText}
            </span>
          )}
        </span>
      );
    }
    case DevinActionState.FIXED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium bg-brand-purple/15 text-brand-purple">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-brand-purple"
          />
          PR Ready
        </span>
      );
    case DevinActionState.RESOLVED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium bg-brand-green/15 text-brand-green">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-brand-green"
          />
          Resolved
        </span>
      );
  }
}

function RowAction({
  fixStatus,
  onResolve,
}: {
  fixStatus: FixIssueStatus | undefined;
  onResolve: () => void;
}) {
  const state = fixStatus?.state ?? DevinActionState.NOT_FIXED;
  const error = fixStatus?.error ?? null;

  if (state === DevinActionState.NOT_FIXED) {
    return (
      <button
        type="button"
        onClick={onResolve}
        title={error ? `Previous attempt failed: ${error}` : undefined}
        className="inline-flex items-center justify-center text-[12px] font-medium text-white underline-offset-4 transition-colors hover:underline cursor-pointer"
      >
        Resolve
      </button>
    );
  }

  if (state === DevinActionState.FIXED && fixStatus?.pr_url) {
    return (
      <a
        href={fixStatus.pr_url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center justify-center text-[12px] font-medium text-white underline-offset-4 transition-colors hover:underline"
      >
        Review
      </a>
    );
  }

  return null;
}

interface RowContext {
  fixStatuses: Record<number, FixIssueStatus>;
}

function buildColumns(ctx: RowContext): ColumnDef<VulnerabilityIssue>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            !table.getIsAllPageRowsSelected() &&
            table.getIsSomePageRowsSelected()
          }
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(checked === true)
          }
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select issue #${row.original.number}`}
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        />
      ),
      enableSorting: false,
      meta: { className: "w-12" },
    },
    {
      accessorKey: "title",
      header: "Issue",
      meta: { className: "w-auto min-w-[320px] whitespace-normal" },
      cell: ({ row }) => {
        const { html_url, title, number, vulnerability_type } = row.original;
        return (
          <div className="flex flex-col items-start gap-2">
            <a
              href={html_url}
              target="_blank"
              rel="noreferrer noopener"
              className="block whitespace-normal break-words leading-5 text-text-primary hover:underline"
              title={title}
            >
              <span className="text-text-secondary">#{number}</span>{" "}
              <span>{title}</span>
            </a>
            <TypeBadge label={vulnerability_type} />
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      meta: { className: "w-1/5 min-w-[220px] text-right" },
      cell: ({ row }) => (
        <StatusBadge
          status={getEffectiveFixStatus(row.original, ctx.fixStatuses)}
        />
      ),
    },
  ];
}

interface VulnerabilitiesTableProps {
  issues: VulnerabilityIssue[];
  fixStatuses: Record<number, FixIssueStatus>;
  onFix: (issueIds: number[]) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
}

export function VulnerabilitiesTable({
  issues,
  fixStatuses,
  onFix,
  rowSelection,
  onRowSelectionChange,
}: VulnerabilitiesTableProps) {
  const data = useMemo(
    () => [...issues].sort((a, b) => a.number - b.number),
    [issues]
  );
  const columns = useMemo(
    () => buildColumns({ fixStatuses }),
    [fixStatuses]
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(41);
  const [rowHs, setRowHs] = useState<number[]>([]);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const thead = el.querySelector("thead tr");
    if (thead) setHeaderH(thead.getBoundingClientRect().height);
    const trs = el.querySelectorAll("tbody tr");
    setRowHs(
      Array.from(trs).map((tr) => tr.getBoundingClientRect().height)
    );
  }, [data, columns]);

  const rows = table.getRowModel().rows;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-start gap-3">
      <div
        ref={wrapperRef}
        className="rounded-lg border border-border-primary bg-elevated"
      >
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-border-primary hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-10 px-4 text-[12px] font-medium text-text-secondary",
                      header.column.columnDef.meta?.className
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-border-primary hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 px-4 text-center text-[13px] text-text-secondary"
                >
                  No vulnerabilities yet. Click the sync button to fetch them
                  from GitHub.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="border-border-primary text-[13px] text-text-primary hover:bg-hover-fill"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "h-20 px-4 py-4 align-middle",
                        cell.column.columnDef.meta?.className
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {rows.length > 0 && (
        <div className="flex flex-col">
          <div style={{ height: headerH }} />
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex items-center"
              style={{ height: rowHs[i] ?? 81 }}
            >
              <RowAction
                fixStatus={getEffectiveFixStatus(row.original, fixStatuses)}
                onResolve={() => onFix([row.original.id])}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
