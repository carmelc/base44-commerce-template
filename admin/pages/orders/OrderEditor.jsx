import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Loader2, Mail, Pencil, Plus, RotateCw, Ticket, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { call, base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import { ORDER_STATUSES } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";
import { canEditLines, customerName, round2 } from "../../lib/order-utils";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import AddressForm from "../../components/AddressForm";
import SearchSelect from "../../components/SearchSelect";
import ConfirmDialog from "../../components/ConfirmDialog";
import MetaDataEditor from "../../components/MetaDataEditor";
import LineItemsTable from "./components/LineItemsTable";
import AddProductDialog from "./components/AddProductDialog";
import TotalsBox from "./components/TotalsBox";
import RefundPanel from "./components/RefundPanel";
import OrderNotesPanel from "./components/OrderNotesPanel";
import DownloadPermissionsPanel from "./components/DownloadPermissionsPanel";

/** Keys of the order that this editor patches. */
const DRAFT_KEYS = ["status", "customer_id", "billing", "shipping", "line_items", "fee_lines", "shipping_lines", "meta_data"];

const draftFrom = (order) =>
  DRAFT_KEYS.reduce((d, k) => {
    d[k] = order?.[k] ?? (k.endsWith("_lines") || k === "line_items" || k === "meta_data" ? [] : k === "billing" || k === "shipping" ? {} : "");
    return d;
  }, {});

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `line_${Math.random().toString(36).slice(2)}`);

export default function OrderEditor() {
  const { id } = useParams();
  const href = useAdminHref();
  const navigate = useNavigate();
  const { format } = useMoney();

  // `/orders/new` → create a draft server-side, then swap to the real id.
  useEffect(() => {
    if (id) return;
    let cancelled = false;
    call("admin-orders", "create-draft").then((data) => {
      const newId = data?.id || data?.order_id || data?.order?.id;
      if (!cancelled && newId) navigate(href(`orders/${newId}`), { replace: true });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const order = useAsync(() => (id ? base44.entities.Order.get(id) : Promise.resolve(null)), [id]);
  const notes = useAsync(
    () => (id ? base44.entities.OrderNote.filter({ order_id: id }, "-created_date", 100) : Promise.resolve([])),
    [id]
  );
  const refunds = useAsync(
    () => (id ? base44.entities.OrderRefund.filter({ order_id: id }, "-created_date", 100) : Promise.resolve([])),
    [id]
  );
  const permissions = useAsync(
    () => (id ? base44.entities.DownloadPermission.filter({ order_id: id }, "-created_date", 100) : Promise.resolve([])),
    [id]
  );

  const [draft, setDraft] = useState(null);
  const [customerOpt, setCustomerOpt] = useState(null);
  const [editBilling, setEditBilling] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [feeDialog, setFeeDialog] = useState(false);
  const [shippingDialog, setShippingDialog] = useState(false);
  const [couponDialog, setCouponDialog] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(""); // recalculate | coupon | invoice | delete

  // (Re)initialize the local draft whenever the order loads.
  useEffect(() => {
    if (!order.data) return;
    setDraft(draftFrom(order.data));
    setCustomerOpt(
      order.data.customer_id
        ? { value: order.data.customer_id, label: customerName(order.data) }
        : null
    );
    setEditBilling(false);
    setEditShipping(false);
  }, [order.data]);

  const dirty = useMemo(() => {
    if (!order.data || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(draftFrom(order.data));
  }, [draft, order.data]);

  const patchDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const refetchAll = () => {
    order.refetch();
    notes.refetch();
    refunds.refetch();
    permissions.refetch();
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const before = draftFrom(order.data);
      const changed = (key) => JSON.stringify(draft[key]) !== JSON.stringify(before[key]);
      const patch = {};

      // Passthrough fields the server stores verbatim.
      for (const key of ["status", "customer_id", "billing", "shipping", "meta_data"]) {
        if (changed(key)) patch[key] = draft[key];
      }
      // Line-level edits are sent as INTENT specs; the server reprices via the
      // totals engine (taxes, coupons, totals) — never as raw line arrays.
      if (changed("line_items")) {
        patch.items = (draft.line_items || []).map((l) => ({
          product_id: l.product_id,
          variation_id: l.variation_id || undefined,
          quantity: l.quantity,
          // pre-discount unit price so the engine re-applies coupons once
          price_override: l.quantity ? round2((l.subtotal ?? l.price * l.quantity) / l.quantity) : l.price,
          attributes: l.attributes,
          meta_data: l.meta_data,
        }));
      }
      if (changed("fee_lines")) {
        patch.fees = (draft.fee_lines || []).map((f) => ({
          name: f.name,
          amount: f.total,
          tax_class: f.tax_class,
          tax_status: f.tax_status,
        }));
      }
      if (changed("shipping_lines")) {
        // Manual admin shipping lines (title + cost); server folds them into totals.
        patch.shipping_lines = (draft.shipping_lines || []).map((s) => ({
          method_title: s.method_title,
          total: s.total,
          total_tax: s.total_tax,
        }));
      }

      if (Object.keys(patch).length === 0) return;
      await call("admin-orders", "update", { order_id: id, patch });
      toast.success("Order saved");
      refetchAll();
    } catch {
      /* toast handled by call() */
    } finally {
      setSaving(false);
    }
  };

  const serverOp = async (label, fn) => {
    setWorking(label);
    try {
      await fn();
      refetchAll();
    } catch {
      /* toast handled by call() */
    } finally {
      setWorking("");
    }
  };

  const recalculate = () =>
    serverOp("recalculate", async () => {
      await call("admin-orders", "recalculate", { order_id: id });
      toast.success("Totals recalculated");
    });

  const sendInvoice = () =>
    serverOp("invoice", async () => {
      await call("admin-orders", "send-email", { order_id: id, type: "customer_invoice" });
      toast.success("Order details sent to customer");
    });

  const deleteOrder = () =>
    serverOp("delete", async () => {
      await call("admin-orders", "delete", { order_id: id });
      toast.success("Order deleted");
      navigate(href("orders"));
    });

  const searchCustomers = async (q) => {
    const data = await call("admin-customers", "search", { q, limit: 20 }, { silent: true });
    const rows = data?.rows || data || [];
    return rows.map((c) => ({
      value: c.id,
      label: `${[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email} (${c.email})`,
    }));
  };

  const addProductLine = ({ product, variation, quantity }) => {
    const price = variation?.price ?? variation?.regular_price ?? product.price ?? product.regular_price ?? 0;
    const line = {
      line_id: uid(),
      product_id: product.id,
      variation_id: variation?.id || "",
      name: product.name,
      sku: variation?.sku || product.sku || "",
      quantity,
      price,
      tax_class: variation?.tax_class || product.tax_class || "standard",
      subtotal: price * quantity,
      subtotal_tax: 0,
      total: price * quantity,
      total_tax: 0,
      taxes: [],
      attributes: (variation?.attributes || []).map((a) => ({ name: a.name, option: a.option })),
      meta_data: [],
    };
    patchDraft({ line_items: [...(draft?.line_items || []), line] });
  };

  if (!id || order.loading || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!order.data) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Order not found.</p>;
  }

  const o = order.data;
  const editable = canEditLines(o);
  const view = { ...o, ...draft }; // draft lines/addresses over server totals

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Order #{o.order_number || o.id}
            <StatusBadge status={o.status} />
          </span>
        }
        description={`Placed ${formatDateTime(o.created_date)} via ${o.created_via || "checkout"}${
          o.payment_method_title ? ` · ${o.payment_method_title}` : ""
        }`}
        backHref={href("orders")}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 xl:col-span-2">
          {/* General */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">General</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={draft.status} onValueChange={(v) => patchDraft({ status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <SearchSelect
                  search={searchCustomers}
                  value={customerOpt}
                  onChange={(opt) => {
                    setCustomerOpt(opt);
                    patchDraft({ customer_id: opt?.value || "" });
                  }}
                  placeholder="Guest — search customers…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              { key: "billing", title: "Billing", edit: editBilling, setEdit: setEditBilling, showEmail: true },
              { key: "shipping", title: "Shipping", edit: editShipping, setEdit: setEditShipping, showEmail: false },
            ].map(({ key, title, edit, setEdit, showEmail }) => (
              <Card key={key}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <div className="flex gap-1">
                    {key === "shipping" && edit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => patchDraft({ shipping: { ...draft.billing, email: undefined } })}
                        title="Copy from billing"
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> From billing
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEdit(!edit)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {edit ? (
                    <AddressForm
                      value={draft[key]}
                      onChange={(v) => patchDraft({ [key]: v })}
                      showEmail={showEmail}
                    />
                  ) : (
                    <AddressDisplay address={draft[key]} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LineItemsTable
                order={view}
                editable={editable}
                onChange={patchDraft}
                removingCoupon={working === "coupon" ? "*" : ""}
                onRemoveCoupon={(code) =>
                  serverOp("coupon", async () => {
                    await call("admin-orders", "remove-coupon", { order_id: id, code });
                    toast.success(`Coupon ${code} removed`);
                  })
                }
              />
              {editable && (
                <div className="flex flex-wrap gap-2 border-t p-3">
                  <Button variant="outline" size="sm" onClick={() => setAddProductOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add product(s)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setFeeDialog(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add fee
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShippingDialog(true)}>
                    <Truck className="mr-1 h-3.5 w-3.5" /> Add shipping
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={dirty}
                    title={dirty ? "Save your changes first" : undefined}
                    onClick={() => setCouponDialog(true)}
                  >
                    <Ticket className="mr-1 h-3.5 w-3.5" /> Apply coupon
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={dirty || working === "recalculate"}
                    title={dirty ? "Save your changes first" : undefined}
                    onClick={recalculate}
                  >
                    {working === "recalculate" ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Recalculate
                  </Button>
                </div>
              )}
              <div className="border-t p-4">
                <TotalsBox order={o} />
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowRefund((v) => !v)}>
                    {showRefund ? "Close refund" : "Refund"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {showRefund && (
            <RefundPanel
              order={o}
              refunds={refunds.data || []}
              onDone={() => {
                setShowRefund(false);
                refetchAll();
              }}
            />
          )}

          <DownloadPermissionsPanel
            orderId={id}
            permissions={permissions.data || []}
            loading={permissions.loading}
            onChanged={() => permissions.refetch()}
          />

          {/* Custom fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Custom fields</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaDataEditor value={draft.meta_data || []} onChange={(v) => patchDraft({ meta_data: v })} />
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={save} disabled={!dirty || saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save order
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={sendInvoice}
                disabled={working === "invoice"}
              >
                {working === "invoice" ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-1.5 h-4 w-4" />
                )}
                Send order details to customer
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete order
              </Button>
            </CardContent>
          </Card>

          {o.customer_note && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer provided note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap rounded-md border border-blue-200 bg-blue-50 p-2.5 text-sm">
                  {o.customer_note}
                </p>
              </CardContent>
            </Card>
          )}

          <OrderNotesPanel
            orderId={id}
            notes={notes.data || []}
            loading={notes.loading}
            onChanged={() => notes.refetch()}
          />
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <AddProductDialog open={addProductOpen} onOpenChange={setAddProductOpen} onAdd={addProductLine} />

      <NameAmountDialog
        open={feeDialog}
        onOpenChange={setFeeDialog}
        title="Add fee"
        nameLabel="Fee name"
        onSubmit={({ name, amount }) =>
          patchDraft({
            fee_lines: [
              ...(draft.fee_lines || []),
              { line_id: uid(), name, total: amount, total_tax: 0, tax_status: "taxable", tax_class: "standard" },
            ],
          })
        }
      />

      <NameAmountDialog
        open={shippingDialog}
        onOpenChange={setShippingDialog}
        title="Add shipping"
        nameLabel="Method title"
        onSubmit={({ name, amount }) =>
          patchDraft({
            shipping_lines: [
              ...(draft.shipping_lines || []),
              { line_id: uid(), method_id: "flat_rate", instance_id: "", method_title: name, total: amount, total_tax: 0, taxes: [] },
            ],
          })
        }
      />

      <CouponDialog
        open={couponDialog}
        onOpenChange={setCouponDialog}
        onSubmit={(code) =>
          serverOp("coupon", async () => {
            await call("admin-orders", "apply-coupon", { order_id: id, code });
            toast.success(`Coupon ${code} applied`);
          })
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete order #${o.order_number || o.id}?`}
        description="Only pending, cancelled or failed orders can be deleted. This cannot be undone."
        confirmLabel="Delete order"
        loading={working === "delete"}
        onConfirm={deleteOrder}
      />
    </div>
  );
}

/* ── Small local pieces ─────────────────────────────────────────────── */

function AddressDisplay({ address = {} }) {
  const rows = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address_1,
    address.address_2,
    [address.city, address.state, address.postcode].filter(Boolean).join(", "),
    address.country,
    address.email,
    address.phone,
  ].filter(Boolean);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No address set.</p>;
  return (
    <address className="text-sm not-italic leading-6 text-muted-foreground">
      {rows.map((r, i) => (
        <div key={i}>{r}</div>
      ))}
    </address>
  );
}

function NameAmountDialog({ open, onOpenChange, title, nameLabel, onSubmit }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!open) {
      setName("");
      setAmount(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>{nameLabel}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Amount</Label>
            <Input type="number" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSubmit({ name: name.trim(), amount });
              onOpenChange(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CouponDialog({ open, onOpenChange, onSubmit }) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) setCode("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply coupon</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Coupon code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. welcome10" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!code.trim()}
            onClick={() => {
              onSubmit(code.trim().toLowerCase());
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
