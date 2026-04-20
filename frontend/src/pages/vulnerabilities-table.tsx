import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";

import type { FixIssueStatus, VulnerabilityIssue } from "@/api/client";
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
import { DevinActionCell } from "./devin-action-cell";

/**
 * Width / min-width classes applied to both the header cell and body cell
 * for each column. We declare them in one place so header and body stay
 * aligned and the columns don't jump as cell content changes size (e.g.
 * the Devin column toggling between "Fix", "Starting Devin session…",
 * "Fixing" and "Fixed").
 *
 * The Name column is capped at a third of the table width per product
 * spec; everything else keeps a generous `min-w-*` to reserve space for
 * its widest possible content.
 */
declare module "@tanstack/react-table" {
  // The generic parameters are required by tanstack's declaration and
  // are unused here — we only piggyback the interface for a shared
  // `className` override across header + body cells.
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

function StateBadge({ state }: { state: string }) {
  const isOpen = state === "open";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium " +
        (isOpen
          ? "bg-brand-green/15 text-brand-green"
          : "bg-white/5 text-text-secondary")
      }
    >
      <span
        aria-hidden
        className={
          "size-1.5 rounded-full " +
          (isOpen ? "bg-brand-green" : "bg-text-disabled")
        }
      />
      {state}
    </span>
  );
}

interface RowContext {
  fixStatuses: Record<number, FixIssueStatus>;
  onFix: (issueIds: number[]) => void;
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
      // `w-1/3` caps the column width at a third of the table so long
      // titles wrap within the column rather than pushing the other
      // columns around; `min-w-[280px]` keeps it readable at narrow
      // viewports.
      meta: { className: "w-1/3 min-w-[280px]" },
      cell: ({ row }) => {
        const { html_url, title, number } = row.original;
        return (
          <a
            href={html_url}
            target="_blank"
            rel="noreferrer noopener"
            className="block whitespace-normal break-words text-text-primary hover:underline"
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
      accessorKey: "state",
      header: "Status",
      meta: { className: "min-w-[140px]" },
      cell: ({ row }) => <StateBadge state={row.original.state} />,
    },
    {
      id: "devin",
      header: "Devin",
      // Reserve enough width to hold the widest possible state text
      // ("Starting Devin session…") without shifting the rest of the
      // table when the cell switches between states.
      meta: { className: "min-w-[220px]" },
      cell: ({ row }) => (
        <DevinActionCell
          issueId={row.original.id}
          status={ctx.fixStatuses[row.original.id]}
          onFix={(id) => ctx.onFix([id])}
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
  const data = useMemo(() => issues, [issues]);
  const columns = useMemo(
    () => buildColumns({ fixStatuses, onFix }),
    [fixStatuses, onFix]
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border border-border-primary bg-elevated">
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
          {table.getRowModel().rows.length === 0 ? (
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
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="border-border-primary text-[13px] text-text-primary hover:bg-hover-fill"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "min-h-[56px] px-4 py-3.5 align-middle whitespace-normal",
                      cell.column.columnDef.meta?.className
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
