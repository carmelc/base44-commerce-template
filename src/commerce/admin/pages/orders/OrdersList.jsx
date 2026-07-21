import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { call, base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import usePagedList from "../../hooks/usePagedList";
import useDebounce from "../../hooks/useDebounce";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import { ORDER_STATUSES } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { customerName } from "../../lib/order-utils";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import DateRangePicker from "../../components/DateRangePicker";
import StatusBadge from "../../components/StatusBadge";

const TABS = [{ value: "", label: "All" }, ...ORDER_STATUSES];

export default function OrdersList() {
  const href = useAdminHref();
  const navigate = useNavigate();
  const { format } = useMoney();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const searchMode = Boolean(debouncedQuery.trim() || dateRange?.from);

  const counts = useAsync(async () => {
    const data = await call("admin-orders", "status-counts", {}, { silent: true });
    return data?.counts || data || {};
  }, []);

  const list = usePagedList(
    async (limit, skip, sort) => {
      if (searchMode) {
        const data = await call("admin-orders", "search", {
          q: debouncedQuery.trim(),
          status: status || undefined,
          date_min: dateRange?.from || undefined,
          date_max: dateRange?.to || undefined,
          limit,
          skip,
          sort,
        });
        return data?.rows || data || [];
      }
      return base44.entities.Order.filter(status ? { status } : {}, sort, limit, skip);
    },
    { deps: [debouncedQuery, status, dateRange?.from, dateRange?.to] }
  );

  const setStatusTab = (value) => {
    setSelected([]);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  const applyBulk = async () => {
    if (!bulkStatus || selected.length === 0) return;
    setBulkBusy(true);
    try {
      await call("admin-orders", "bulk-status", { ids: selected, status: bulkStatus });
      toast.success(`${selected.length} order(s) updated`);
      setSelected([]);
      setBulkStatus("");
      list.refetch();
      counts.refetch();
    } catch {
      /* toast handled by call() */
    } finally {
      setBulkBusy(false);
    }
  };

  const addOrder = async () => {
    setCreating(true);
    try {
      const data = await call("admin-orders", "create-draft");
      const id = data?.id || data?.order_id || data?.order?.id;
      if (id) navigate(href(`orders/${id}`));
    } catch {
      /* toast handled by call() */
    } finally {
      setCreating(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "order_number",
        label: "Order",
        render: (o) => (
          <span className="font-medium">
            #{o.order_number || o.id} <span className="font-normal text-muted-foreground">{customerName(o)}</span>
          </span>
        ),
      },
      { key: "created_date", label: "Date", sortable: true, render: (o) => formatDate(o.created_date) },
      { key: "status", label: "Status", render: (o) => <StatusBadge status={o.status} /> },
      { key: "total", label: "Total", sortable: true, className: "text-right", render: (o) => format(o.total || 0) },
    ],
    [format]
  );

  const totalCount = Object.values(counts.data || {}).reduce((a, b) => a + (b || 0), 0);

  return (
    <div>
      <PageHeader
        title="Orders"
        actions={
          <Button onClick={addOrder} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Add order
          </Button>
        }
      />

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b pb-px">
        {TABS.map((tab) => {
          const count = tab.value === "" ? totalCount : (counts.data || {})[tab.value] || 0;
          const active = status === tab.value;
          return (
            <button
              key={tab.value || "all"}
              onClick={() => setStatusTab(tab.value)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs text-muted-foreground">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Filters + bulk bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order #, name, email…"
            className="w-64 pl-8"
          />
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        {selected.length > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1">
            <span className="text-sm text-muted-foreground">{selected.length} selected</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Change status to…" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyBulk} disabled={!bulkStatus || bulkBusy}>
              {bulkBusy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Apply
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        sort={list.sort}
        onSort={list.setSort}
        selectable
        selected={selected}
        onSelectChange={setSelected}
        onRowClick={(o) => navigate(href(`orders/${o.id}`))}
        rowActions={(o) => [{ label: "View / edit", onClick: () => navigate(href(`orders/${o.id}`)) }]}
        pagination={{ page: list.page, hasNext: list.hasNext, onNext: list.next, onPrev: list.prev }}
        empty={{
          icon: ShoppingCart,
          title: "No orders found",
          description: searchMode ? "Try adjusting your search or date range." : "Orders will appear here as they come in.",
        }}
      />
    </div>
  );
}
