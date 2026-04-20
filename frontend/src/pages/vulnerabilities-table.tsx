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

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}

function TypeBadge({ label }: { label: string | null }) {
  if (!label) {
    return <span className="text-text-disabled">—</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border-primary bg-hover-fill px-2 py-0.5 font-mono text-[11px] tracking-wide text-text-secondary">
      {label}
    </span>
  );
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
        <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
          <LoaderIcon
            className="size-3.5 animate-spin text-brand-blue"
            aria-hidden
          />
          Setting up Devin session
        </span>
      );
    case DevinActionState.FIXING:
      return (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-text-primary">
          <LoaderIcon
            className="size-3.5 animate-spin text-brand-blue"
            aria-hidden
          />
          Fixing
        </span>
      );
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
        className="inline-flex h-7 items-center justify-center rounded-md bg-brand-blue px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-blue/90 cursor-pointer"
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
        className="inline-flex h-7 items-center justify-center rounded-md bg-brand-purple px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-purple/90"
      >
        Review
      </a>
    );
  }

  return (
    <span className="text-text-disabled text-[14px] select-none">—</span>
  );
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
      header: "Name",
      meta: { className: "w-1/3 min-w-[280px]" },
      cell: ({ row }) => {
        const { html_url, title, number } = row.original;
        return (
          <a
            href={html_url}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-text-primary hover:underline"
            title={title}
          >
            <span className="text-text-secondary">#{number}</span>{" "}
            <span>{title}</span>
          </a>
        );
      },
    },
    {
      accessorKey: "vulnerability_type",
      header: "Type",
      meta: { className: "min-w-[180px]" },
      cell: ({ row }) => <TypeBadge label={row.original.vulnerability_type} />,
    },
    {
      id: "status",
      header: "Status",
      meta: { className: "min-w-[220px]" },
      cell: ({ row }) => (
        <StatusBadge status={ctx.fixStatuses[row.original.id]} />
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
  const data = useMemo(() => issues, [issues]);
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
    <div className="grid grid-cols-[1fr_auto] items-start">
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
                        "h-14 px-4 py-3.5 align-middle",
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
        <div className="flex flex-col pl-3">
          <div style={{ height: headerH }} />
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex items-center"
              style={{ height: rowHs[i] ?? 57 }}
            >
              <RowAction
                fixStatus={fixStatuses[row.original.id]}
                onResolve={() => onFix([row.original.id])}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
