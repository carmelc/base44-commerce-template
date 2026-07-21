import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import EmptyState from "./EmptyState";

/**
 * Generic list table.
 *
 * Props:
 * - columns: [{ key, label, sortable?, render?(row), className? }]
 * - rows: array of records
 * - rowKey: field used as key (default "id")
 * - sort / onSort: SDK sort string, e.g. "-created_date"; clicking a sortable
 *   column toggles `key` ↔ `-key`
 * - selectable + selected (array of ids) + onSelectChange(ids)
 * - rowActions(row) → [{ label, onClick, icon?, destructive? }]
 * - onRowClick(row)
 * - pagination: { page, hasNext, onNext, onPrev }
 * - loading, empty: { icon, title, description, action }
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = "id",
  sort,
  onSort,
  selectable = false,
  selected = [],
  onSelectChange,
  rowActions,
  onRowClick,
  pagination,
  loading = false,
  empty,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r[rowKey]));

  const toggleAll = () => {
    if (!onSelectChange) return;
    onSelectChange(allSelected ? [] : rows.map((r) => r[rowKey]));
  };

  const toggleOne = (id) => {
    if (!onSelectChange) return;
    onSelectChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const sortIcon = (key) => {
    if (sort === key) return <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
    if (sort === `-${key}`) return <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
    return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  };

  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    onSort(sort === `-${col.key}` ? col.key : `-${col.key}`);
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className="rounded-lg border bg-background">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${col.className || ""} ${col.sortable ? "cursor-pointer select-none" : ""}`}
                  onClick={() => handleSort(col)}
                >
                  {col.label}
                  {col.sortable && sortIcon(col.key)}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colCount}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-12">
                  <EmptyState {...(empty || { title: "Nothing here yet" })} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row[rowKey]}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(row[rowKey])}
                        onCheckedChange={() => toggleOne(row[rowKey])}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(row) : row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {rowActions(row).map((action, i) => (
                            <DropdownMenuItem
                              key={i}
                              onClick={action.onClick}
                              className={action.destructive ? "text-destructive focus:text-destructive" : ""}
                            >
                              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && (
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
          <span>Page {pagination.page}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={pagination.page <= 1 || loading}
            onClick={pagination.onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!pagination.hasNext || loading}
            onClick={pagination.onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
