import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";

import type { VulnerabilityIssue } from "@/api/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const columns: ColumnDef<VulnerabilityIssue>[] = [
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
    size: 32,
  },
  {
    accessorKey: "title",
    header: "Name",
    cell: ({ row }) => {
      const { html_url, title, number } = row.original;
      return (
        <a
          href={html_url}
          target="_blank"
          rel="noreferrer noopener"
          className="block max-w-[640px] truncate text-text-primary hover:underline"
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
    cell: ({ row }) => <TypeBadge label={row.original.vulnerability_type} />,
  },
  {
    accessorKey: "state",
    header: "Status",
    cell: ({ row }) => <StateBadge state={row.original.state} />,
  },
];

interface VulnerabilitiesTableProps {
  issues: VulnerabilityIssue[];
}

export function VulnerabilitiesTable({ issues }: VulnerabilitiesTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const data = useMemo(() => issues, [issues]);

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border border-border-primary bg-elevated">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-border-primary hover:bg-transparent"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 px-3 text-[12px] font-medium text-text-secondary"
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
                className="h-24 px-3 text-center text-[13px] text-text-secondary"
              >
                No vulnerabilities yet. Click <span className="text-text-primary">Sync Vulnerability Issues</span> to fetch them from GitHub.
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
                  <TableCell key={cell.id} className="px-3 py-2.5">
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
