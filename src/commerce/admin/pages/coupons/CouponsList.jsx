import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, TicketPercent, Trash2, Pencil } from "lucide-react";

import { call, base44 } from "../../lib/api";
import { COUPON_TYPES } from "../../lib/constants";
import { formatDate, truncate } from "../../lib/format";
import usePagedList from "../../hooks/usePagedList";
import useDebounce from "../../hooks/useDebounce";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function CouponsList() {
  const href = useAdminHref();
  const navigate = useNavigate();
  const money = useMoney();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [selected, setSelected] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null); // coupon | "bulk"
  const [deleting, setDeleting] = useState(false);

  const list = usePagedList(
    async (limit, skip, sort) => {
      if (debouncedQuery.trim()) {
        const data = await call("admin-coupons", "search", {
          q: debouncedQuery.trim(),
          limit,
          skip,
        });
        return data?.rows || [];
      }
      return base44.entities["commerce.Coupon"].list(sort, limit, skip);
    },
    { deps: [debouncedQuery] }
  );

  const amountLabel = (c) =>
    c.discount_type === "percent" ? `${c.amount ?? 0}%` : money.format(c.amount ?? 0);

  const usageLabel = (c) =>
    `${c.usage_count ?? 0} / ${c.usage_limit ?? "∞"}`;

  const doDelete = async () => {
    setDeleting(true);
    try {
      if (pendingDelete === "bulk") {
        await call("admin-coupons", "batch", { delete: selected });
        toast.success(`${selected.length} coupon(s) deleted`);
        setSelected([]);
      } else {
        await call("admin-coupons", "delete", { id: pendingDelete.id });
        toast.success("Coupon deleted");
      }
      setPendingDelete(null);
      list.refetch();
    } catch {
      /* toast shown by call() */
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: !debouncedQuery,
      render: (c) => (
        <Link
          to={href(`coupons/${c.id}`)}
          className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide hover:bg-muted/70"
          onClick={(e) => e.stopPropagation()}
        >
          {c.code}
        </Link>
      ),
    },
    {
      key: "discount_type",
      label: "Type",
      render: (c) =>
        COUPON_TYPES.find((t) => t.value === c.discount_type)?.label || c.discount_type,
    },
    { key: "amount", label: "Amount", render: amountLabel },
    {
      key: "description",
      label: "Description",
      className: "max-w-64",
      render: (c) => (
        <span className="text-muted-foreground">{truncate(c.description, 60) || "—"}</span>
      ),
    },
    { key: "usage", label: "Usage / Limit", render: usageLabel },
    {
      key: "date_expires",
      label: "Expiry date",
      render: (c) => (c.date_expires ? formatDate(c.date_expires) : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Create and manage discount codes."
        actions={
          <Button asChild>
            <Link to={href("coupons/new")}>
              <Plus className="mr-1 h-4 w-4" /> Add coupon
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search coupons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {selected.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setPendingDelete("bulk")}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete selected ({selected.length})
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        sort={list.sort}
        onSort={debouncedQuery ? undefined : list.setSort}
        selectable
        selected={selected}
        onSelectChange={setSelected}
        onRowClick={(c) => navigate(href(`coupons/${c.id}`))}
        rowActions={(c) => [
          { label: "Edit", icon: Pencil, onClick: () => navigate(href(`coupons/${c.id}`)) },
          { label: "Delete", icon: Trash2, destructive: true, onClick: () => setPendingDelete(c) },
        ]}
        pagination={{ page: list.page, hasNext: list.hasNext, onNext: list.next, onPrev: list.prev }}
        empty={{
          icon: TicketPercent,
          title: "No coupons yet",
          description: "Coupons let you offer discounts at checkout.",
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={pendingDelete === "bulk" ? `Delete ${selected.length} coupon(s)?` : "Delete this coupon?"}
        description="Customers will no longer be able to use it. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}
