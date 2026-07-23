import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Trash2, Pencil } from "lucide-react";

import { call, base44 } from "../../lib/api";
import { countryName } from "../../lib/geo-data";
import usePagedList from "../../hooks/usePagedList";
import useDebounce from "../../hooks/useDebounce";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function CustomersList() {
  const href = useAdminHref();
  const navigate = useNavigate();
  const money = useMoney();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const list = usePagedList(
    async (limit, skip, sort) => {
      if (debouncedQuery.trim()) {
        const data = await call("admin-customers", "search", {
          q: debouncedQuery.trim(),
          limit,
          skip,
        });
        return data?.rows || [];
      }
      return base44.entities["commerce.Customer"].list(sort, limit, skip);
    },
    { deps: [debouncedQuery] }
  );

  const doDelete = async () => {
    setDeleting(true);
    try {
      await call("admin-customers", "delete", {
        id: pendingDelete.id,
        reassign_orders_to_guest: true,
      });
      toast.success("Customer deleted");
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
      key: "name",
      label: "Name",
      render: (c) => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
        return (
          <Link
            to={href(`customers/${c.id}`)}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {name || c.email}
            {c.is_guest && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                guest
              </span>
            )}
          </Link>
        );
      },
    },
    {
      key: "email",
      label: "Email / Username",
      render: (c) => (
        <div className="min-w-0">
          <div className="truncate">{c.email}</div>
          {c.username && <div className="truncate text-xs text-muted-foreground">{c.username}</div>}
        </div>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (c) => {
        const b = c.billing || {};
        return [b.city, countryName(b.country)].filter(Boolean).join(", ") || "—";
      },
    },
    {
      key: "orders_count",
      label: "Orders",
      sortable: !debouncedQuery,
      render: (c) => c.orders_count ?? 0,
    },
    {
      key: "total_spent",
      label: "Total spend",
      sortable: !debouncedQuery,
      render: (c) => money.format(c.total_spent ?? 0),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Registered customers and checkout guests."
        actions={
          <Button asChild>
            <Link to={href("customers/new")}>
              <Plus className="mr-1 h-4 w-4" /> Add customer
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, email or username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        sort={list.sort}
        onSort={debouncedQuery ? undefined : list.setSort}
        onRowClick={(c) => navigate(href(`customers/${c.id}`))}
        rowActions={(c) => [
          { label: "Edit", icon: Pencil, onClick: () => navigate(href(`customers/${c.id}`)) },
          { label: "Delete", icon: Trash2, destructive: true, onClick: () => setPendingDelete(c) },
        ]}
        pagination={{ page: list.page, hasNext: list.hasNext, onNext: list.next, onPrev: list.prev }}
        empty={{
          icon: Users,
          title: "No customers yet",
          description: "Customers appear here after checkout or when you add them manually.",
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this customer?"
        description="Their orders are kept and reassigned to Guest. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}
