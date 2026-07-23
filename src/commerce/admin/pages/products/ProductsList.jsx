import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ImageIcon, Package, Pencil, Plus, Star, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { base44, call } from "../../lib/api";
import usePagedList from "../../hooks/usePagedList";
import useAsync from "../../hooks/useAsync";
import useDebounce from "../../hooks/useDebounce";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import SearchSelect from "../../components/SearchSelect";
import StatusBadge from "../../components/StatusBadge";
import MoneyInput from "../../components/MoneyInput";
import ConfirmDialog from "../../components/ConfirmDialog";
import { PRODUCT_TYPES, PRODUCT_STATUSES, STOCK_STATUSES, statusMeta } from "../../lib/constants";
import { formatDate } from "../../lib/format";

const ALL = "all";

/** Quick-edit dialog: price, sale price, stock, status. */
function QuickEdit({ product, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && product) {
      setForm({
        regular_price: product.regular_price ?? null,
        sale_price: product.sale_price ?? null,
        stock_quantity: product.stock_quantity ?? null,
        status: product.status || "draft",
      });
    }
  }, [open, product]);

  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      await call("admin-products", "save", { product: { id: product.id, ...form } });
      toast.success("Product updated");
      onOpenChange(false);
      onSaved();
    } catch {
      /* toast handled by call() */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Quick edit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Regular price</Label>
            <MoneyInput value={form.regular_price} onChange={(v) => setForm((f) => ({ ...f, regular_price: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Sale price</Label>
            <MoneyInput value={form.sale_price} onChange={(v) => setForm((f) => ({ ...f, sale_price: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Stock quantity</Label>
            <Input
              type="number"
              value={form.stock_quantity ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, stock_quantity: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsList() {
  const navigate = useNavigate();
  const href = useAdminHref();
  const money = useMoney();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState(null);
  const [type, setType] = useState(ALL);
  const [stock, setStock] = useState(ALL);
  const [selected, setSelected] = useState([]);
  const [quickEdit, setQuickEdit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // product | "bulk"
  const [deleting, setDeleting] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  const { data: categories } = useAsync(() => base44.entities["commerce.ProductCategory"].list(undefined, 1000), []);
  const categoryName = useMemo(() => {
    const map = new Map((categories || []).map((c) => [c.id, c.name]));
    return (id) => map.get(id) || null;
  }, [categories]);

  const usingSearch = Boolean(debouncedQ || category);

  const fetcher = useCallback(
    async (limit, skip, sort) => {
      if (usingSearch) {
        const data = await call("admin-products", "search", {
          q: debouncedQ || undefined,
          category_id: category?.value || undefined,
          type: type === ALL ? undefined : type,
          stock_status: stock === ALL ? undefined : stock,
          sort,
          limit,
          skip,
        });
        return data?.rows || data || [];
      }
      const query = {};
      if (type !== ALL) query.type = type;
      if (stock !== ALL) query.stock_status = stock;
      return base44.entities["commerce.Product"].filter(query, sort, limit, skip);
    },
    [usingSearch, debouncedQ, category, type, stock]
  );

  const list = usePagedList(fetcher, { deps: [debouncedQ, category?.value, type, stock] });

  const toggleFeatured = async (row) => {
    await call("admin-products", "save", { product: { id: row.id, featured: !row.featured } });
    list.refetch();
  };

  const duplicate = async (row) => {
    const data = await call("admin-products", "duplicate", { id: row.id });
    const newId = data?.product?.id || data?.id;
    toast.success("Product duplicated");
    if (newId) navigate(href(`products/${newId}`));
    else list.refetch();
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      if (confirmDelete === "bulk") {
        for (const id of selected) await call("admin-products", "delete", { id });
        toast.success(`${selected.length} product(s) deleted`);
        setSelected([]);
      } else {
        await call("admin-products", "delete", { id: confirmDelete.id });
        toast.success("Product deleted");
      }
      setConfirmDelete(null);
      list.refetch();
    } catch {
      /* toast handled */
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "image",
      label: "",
      className: "w-12",
      render: (row) =>
        row.images?.[0]?.src ? (
          <img src={row.images[0].src} alt="" className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => (
        <div>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => navigate(href(`products/${row.id}`))}
          >
            {row.name || "(no title)"}
          </button>
          {row.sku && <div className="text-xs text-muted-foreground">SKU: {row.sku}</div>}
        </div>
      ),
    },
    { key: "sku", label: "SKU", className: "hidden md:table-cell", render: (row) => row.sku || "—" },
    {
      key: "stock_status",
      label: "Stock",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.stock_status} map={STOCK_STATUSES} />
          {row.manage_stock && row.stock_quantity != null && (
            <span className="text-xs text-muted-foreground">({row.stock_quantity})</span>
          )}
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      render: (row) =>
        row.on_sale && row.sale_price != null ? (
          <span>
            <span className="text-muted-foreground line-through">{money.format(row.regular_price || 0)}</span>{" "}
            {money.format(row.sale_price)}
          </span>
        ) : row.price != null || row.regular_price != null ? (
          money.format(row.price ?? row.regular_price)
        ) : (
          "—"
        ),
    },
    {
      key: "categories",
      label: "Categories",
      className: "hidden lg:table-cell",
      render: (row) => {
        const names = (row.category_ids || []).map(categoryName).filter(Boolean);
        return names.length ? names.join(", ") : "—";
      },
    },
    {
      key: "featured",
      label: "★",
      className: "w-10",
      render: (row) => (
        <button type="button" onClick={() => toggleFeatured(row)} title="Toggle featured">
          <Star
            className={`h-4 w-4 ${row.featured ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ),
    },
    {
      key: "created_date",
      label: "Date",
      sortable: true,
      className: "hidden md:table-cell",
      render: (row) => formatDate(row.created_date),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} map={PRODUCT_STATUSES} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Manage your catalog"
        actions={
          <Button onClick={() => navigate(href("products/new"))}>
            <Plus className="mr-2 h-4 w-4" /> Add new
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <SearchSelect
          className="w-56"
          placeholder="All categories"
          value={category}
          onChange={setCategory}
          search={async (query) =>
            (categories || [])
              .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 20)
              .map((c) => ({ value: c.id, label: c.name }))
          }
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stock</SelectItem>
            {STOCK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete("bulk")}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete ({selected.length})
          </Button>
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
        pagination={{ page: list.page, hasNext: list.hasNext, onNext: list.next, onPrev: list.prev }}
        rowActions={(row) => [
          { label: "Edit", icon: Pencil, onClick: () => navigate(href(`products/${row.id}`)) },
          { label: "Quick edit", icon: Zap, onClick: () => setQuickEdit(row) },
          { label: "Duplicate", icon: Copy, onClick: () => duplicate(row) },
          { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(row) },
        ]}
        empty={{
          icon: Package,
          title: "No products found",
          description: usingSearch ? "Try a different search or filter." : "Create your first product to get started.",
        }}
      />

      <QuickEdit
        product={quickEdit}
        open={Boolean(quickEdit)}
        onOpenChange={(o) => !o && setQuickEdit(null)}
        onSaved={list.refetch}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete === "bulk" ? `Delete ${selected.length} product(s)?` : `Delete "${confirmDelete?.name}"?`}
        description="This permanently deletes the product and its variations."
        confirmLabel="Delete"
        onConfirm={doDelete}
        loading={deleting}
      />
    </div>
  );
}
