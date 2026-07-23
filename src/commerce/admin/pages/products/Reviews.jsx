import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, MessageSquare, Pencil, ShieldAlert, Star, Trash, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { base44, call } from "../../lib/api";
import usePagedList from "../../hooks/usePagedList";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import { REVIEW_STATUSES } from "../../lib/constants";
import { formatDate } from "../../lib/format";

const TABS = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "hold", label: "Pending" },
  { value: "spam", label: "Spam" },
  { value: "trash", label: "Trash" },
];

function Stars({ rating = 0 }) {
  return (
    <span className="inline-flex" title={`${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export default function Reviews() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [productNames, setProductNames] = useState({});

  const fetcher = useCallback(
    (limit, skip, sort) => {
      const query = tab === "all" ? {} : { status: tab };
      return base44.entities["commerce.ProductReview"].filter(query, sort, limit, skip);
    },
    [tab]
  );

  const list = usePagedList(fetcher, { deps: [tab] });

  // Resolve product names for the visible page (cached).
  useEffect(() => {
    const ids = [...new Set((list.rows || []).map((r) => r.product_id).filter((id) => id && !(id in productNames)))];
    if (!ids.length) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        base44.entities["commerce.Product"].get(id)
          .then((p) => [id, p?.name || "(deleted product)"])
          .catch(() => [id, "(deleted product)"])
      )
    ).then((pairs) => {
      if (!cancelled) setProductNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
  }, [list.rows, productNames]);

  const setStatus = async (ids, status) => {
    for (const id of ids) await call("admin-reviews", "set-status", { id, status });
    toast.success(`Review${ids.length > 1 ? "s" : ""} updated`);
    setSelected([]);
    list.refetch();
  };

  const saveEdit = async () => {
    await call("admin-reviews", "update", { id: editing.id, rating: editing.rating, review: editing.review });
    toast.success("Review updated");
    setEditing(null);
    list.refetch();
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const ids = confirmDelete === "bulk" ? selected : [confirmDelete.id];
      for (const id of ids) await call("admin-reviews", "delete", { id });
      toast.success(`Review${ids.length > 1 ? "s" : ""} deleted`);
      setSelected([]);
      setConfirmDelete(null);
      list.refetch();
    } catch {
      /* toast handled */
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "reviewer",
        label: "Author",
        render: (row) => (
          <div>
            <div className="font-medium">{row.reviewer || "Anonymous"}</div>
            {row.reviewer_email && <div className="text-xs text-muted-foreground">{row.reviewer_email}</div>}
          </div>
        ),
      },
      { key: "rating", label: "Rating", render: (row) => <Stars rating={row.rating || 0} /> },
      {
        key: "review",
        label: "Review",
        render: (row) => (
          <div className="max-w-md">
            <p className="line-clamp-2 text-sm">{row.review}</p>
            {row.verified && <span className="text-xs text-green-700">✓ Verified owner</span>}
          </div>
        ),
      },
      {
        key: "product_id",
        label: "Product",
        className: "hidden md:table-cell",
        render: (row) => productNames[row.product_id] || "…",
      },
      {
        key: "created_date",
        label: "Date",
        className: "hidden lg:table-cell",
        render: (row) => formatDate(row.created_date),
      },
      { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} map={REVIEW_STATUSES} /> },
    ],
    [productNames]
  );

  const rowActions = (row) => {
    const actions = [];
    if (row.status !== "approved") actions.push({ label: "Approve", icon: Check, onClick: () => setStatus([row.id], "approved") });
    if (row.status !== "hold") actions.push({ label: "Hold", icon: MessageSquare, onClick: () => setStatus([row.id], "hold") });
    if (row.status !== "spam") actions.push({ label: "Spam", icon: ShieldAlert, onClick: () => setStatus([row.id], "spam") });
    if (row.status !== "trash") actions.push({ label: "Trash", icon: Trash, onClick: () => setStatus([row.id], "trash") });
    actions.push({ label: "Edit", icon: Pencil, onClick: () => setEditing({ id: row.id, rating: row.rating || 5, review: row.review || "" }) });
    actions.push({ label: "Delete permanently", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) });
    return actions;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reviews" description="Moderate customer product reviews" />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected([]); }}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setStatus(selected, "approved")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => setStatus(selected, "hold")}>Hold</Button>
          <Button size="sm" variant="outline" onClick={() => setStatus(selected, "spam")}>Spam</Button>
          <Button size="sm" variant="outline" onClick={() => setStatus(selected, "trash")}>Trash</Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete("bulk")}>Delete</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        selectable
        selected={selected}
        onSelectChange={setSelected}
        pagination={{ page: list.page, hasNext: list.hasNext, onNext: list.next, onPrev: list.prev }}
        rowActions={rowActions}
        empty={{ icon: MessageSquare, title: "No reviews", description: "Reviews submitted by customers appear here." }}
      />

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit review</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Rating</Label>
                <Select
                  value={String(editing.rating)}
                  onValueChange={(v) => setEditing((e) => ({ ...e, rating: Number(v) }))}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Review</Label>
                <Textarea
                  rows={5}
                  value={editing.review}
                  onChange={(e) => setEditing((prev) => ({ ...prev, review: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete === "bulk" ? `Delete ${selected.length} review(s)?` : "Delete this review?"}
        description="This permanently removes the review."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
