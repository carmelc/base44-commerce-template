import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wand2, X } from "lucide-react";

import { call, base44 } from "../../lib/api";
import { COUPON_TYPES } from "../../lib/constants";
import useMoney from "../../hooks/useMoney";
import { useAdminHref } from "../../context/BasePathContext";
import PageHeader from "../../components/PageHeader";
import SearchSelect from "../../components/SearchSelect";
import MoneyInput from "../../components/MoneyInput";
import ConfirmDialog from "../../components/ConfirmDialog";

const EMPTY = {
  code: "",
  discount_type: "fixed_cart",
  amount: null,
  description: "",
  date_expires: null,
  free_shipping: false,
  individual_use: false,
  exclude_sale_items: false,
  product_ids: [],
  excluded_product_ids: [],
  product_category_ids: [],
  excluded_product_category_ids: [],
  minimum_amount: null,
  maximum_amount: null,
  email_restrictions: [],
  usage_limit: null,
  usage_limit_per_user: null,
  limit_usage_to_x_items: null,
};

const TABS = [
  { id: "general", label: "General" },
  { id: "restriction", label: "Usage restriction" },
  { id: "limits", label: "Usage limits" },
];

const randomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");

/** Products picker option loader (server-side search). */
const searchProducts = async (q) => {
  const data = await call("admin-products", "search", { q: q || "", limit: 20 }, { silent: true });
  return (data?.rows || []).map((p) => ({ value: p.id, label: p.name, meta: p.sku }));
};

/** Chips input for allowed emails (supports *@domain.com wildcards). */
function EmailChips({ value = [], onChange }) {
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim().toLowerCase().replace(/,+$/, "");
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText("");
  };
  return (
    <div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="email@example.com or *@example.com — press Enter"
      />
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberField({ value, onChange, placeholder = "Unlimited" }) {
  return (
    <Input
      type="number"
      min="0"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

export default function CouponEditor() {
  const { id } = useParams();
  const isNew = !id;
  const href = useAdminHref();
  const navigate = useNavigate();
  const money = useMoney();

  const [coupon, setCoupon] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState("general");

  // Selected options with labels for the pickers.
  const [productOpts, setProductOpts] = useState({ include: [], exclude: [] });
  const [categories, setCategories] = useState([]);

  const set = (key) => (v) => setCoupon((c) => ({ ...c, [key]: v }));

  // Load categories once (small list, client-filtered in the picker).
  useEffect(() => {
    base44.entities["commerce.ProductCategory"].list("name", 500)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const searchCategories = useMemo(
    () => async (q) =>
      categories
        .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 20)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  const categoryOpts = (ids) =>
    (ids || []).map((cid) => ({
      value: cid,
      label: categories.find((c) => c.id === cid)?.name || cid,
    }));

  // Load the coupon + resolve product labels for stored ids.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    base44.entities["commerce.Coupon"].get(id)
      .then(async (c) => {
        if (cancelled) return;
        setCoupon({ ...EMPTY, ...c });
        const resolve = (ids) =>
          Promise.all(
            (ids || []).map((pid) =>
              base44.entities["commerce.Product"].get(pid)
                .then((p) => ({ value: p.id, label: p.name, meta: p.sku }))
                .catch(() => ({ value: pid, label: pid }))
            )
          );
        const [include, exclude] = await Promise.all([
          resolve(c.product_ids),
          resolve(c.excluded_product_ids),
        ]);
        if (!cancelled) setProductOpts({ include, exclude });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const save = async () => {
    if (!coupon.code?.trim()) {
      toast.error("A coupon code is required");
      return;
    }
    if (coupon.amount === null || coupon.amount === undefined) {
      toast.error("A discount amount is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...coupon,
        code: coupon.code.trim().toLowerCase(),
        // Store the expiry as end-of-day so the coupon works through its last day.
        date_expires: coupon.date_expires
          ? new Date(`${coupon.date_expires.slice(0, 10)}T23:59:59Z`).toISOString()
          : null,
      };
      const saved = await call("admin-coupons", "save", { coupon: payload });
      toast.success("Coupon saved");
      if (isNew && saved?.id) navigate(href(`coupons/${saved.id}`), { replace: true });
      else if (saved) setCoupon((c) => ({ ...c, ...saved }));
    } catch {
      /* toast shown by call() */
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await call("admin-coupons", "delete", { id });
      toast.success("Coupon deleted");
      navigate(href("coupons"));
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPercent = coupon.discount_type === "percent";

  return (
    <div>
      <PageHeader
        title={isNew ? "Add coupon" : `Coupon: ${coupon.code}`}
        backHref={href("coupons")}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-1.5">
                <Label>Coupon code</Label>
                <div className="flex gap-2">
                  <Input
                    value={coupon.code}
                    onChange={(e) => set("code")(e.target.value)}
                    placeholder="e.g. welcome10"
                    className="font-mono lowercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => set("code")(randomCode())}
                  >
                    <Wand2 className="mr-1 h-4 w-4" /> Generate
                  </Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Description (optional)</Label>
                <Textarea
                  rows={2}
                  value={coupon.description || ""}
                  onChange={(e) => set("description")(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Coupon data: vertical tabs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Coupon data</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex min-h-72 flex-col sm:flex-row">
                <div className="flex shrink-0 flex-row gap-1 border-b p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
                  {TABS.map((t) => (
                    <Button
                      key={t.id}
                      variant={tab === t.id ? "secondary" : "ghost"}
                      size="sm"
                      className="justify-start"
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>

                <div className="flex-1 space-y-4 p-4">
                  {tab === "general" && (
                    <>
                      <div className="grid gap-1.5 sm:max-w-sm">
                        <Label>Discount type</Label>
                        <Select value={coupon.discount_type} onValueChange={set("discount_type")}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUPON_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5 sm:max-w-sm">
                        <Label>Coupon amount {isPercent ? "(%)" : ""}</Label>
                        {isPercent ? (
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={coupon.amount ?? ""}
                              onChange={(e) =>
                                set("amount")(e.target.value === "" ? null : Number(e.target.value))
                              }
                              className="pr-8"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                              %
                            </span>
                          </div>
                        ) : (
                          <MoneyInput value={coupon.amount} onChange={set("amount")} />
                        )}
                      </div>
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!!coupon.free_shipping}
                          onCheckedChange={(v) => set("free_shipping")(!!v)}
                          className="mt-0.5"
                        />
                        <span>
                          Allow free shipping
                          <span className="block text-xs text-muted-foreground">
                            Grants access to free-shipping methods that require a coupon.
                          </span>
                        </span>
                      </label>
                      <div className="grid gap-1.5 sm:max-w-sm">
                        <Label>Coupon expiry date</Label>
                        <Input
                          type="date"
                          value={coupon.date_expires ? coupon.date_expires.slice(0, 10) : ""}
                          onChange={(e) => set("date_expires")(e.target.value || null)}
                        />
                      </div>
                    </>
                  )}

                  {tab === "restriction" && (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label>Minimum spend ({money.code})</Label>
                          <MoneyInput
                            value={coupon.minimum_amount}
                            onChange={set("minimum_amount")}
                            placeholder="No minimum"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Maximum spend ({money.code})</Label>
                          <MoneyInput
                            value={coupon.maximum_amount}
                            onChange={set("maximum_amount")}
                            placeholder="No maximum"
                          />
                        </div>
                      </div>
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!!coupon.individual_use}
                          onCheckedChange={(v) => set("individual_use")(!!v)}
                          className="mt-0.5"
                        />
                        <span>
                          Individual use only
                          <span className="block text-xs text-muted-foreground">
                            Cannot be used in conjunction with other coupons.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!!coupon.exclude_sale_items}
                          onCheckedChange={(v) => set("exclude_sale_items")(!!v)}
                          className="mt-0.5"
                        />
                        <span>
                          Exclude sale items
                          <span className="block text-xs text-muted-foreground">
                            The coupon will not apply to items on sale.
                          </span>
                        </span>
                      </label>
                      <Separator />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label>Products</Label>
                          <SearchSelect
                            multiple
                            search={searchProducts}
                            value={productOpts.include}
                            placeholder="Any product"
                            onChange={(opts) => {
                              setProductOpts((o) => ({ ...o, include: opts }));
                              set("product_ids")(opts.map((o) => o.value));
                            }}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Exclude products</Label>
                          <SearchSelect
                            multiple
                            search={searchProducts}
                            value={productOpts.exclude}
                            placeholder="No exclusions"
                            onChange={(opts) => {
                              setProductOpts((o) => ({ ...o, exclude: opts }));
                              set("excluded_product_ids")(opts.map((o) => o.value));
                            }}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Product categories</Label>
                          <SearchSelect
                            multiple
                            search={searchCategories}
                            value={categoryOpts(coupon.product_category_ids)}
                            placeholder="Any category"
                            onChange={(opts) => set("product_category_ids")(opts.map((o) => o.value))}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Exclude categories</Label>
                          <SearchSelect
                            multiple
                            search={searchCategories}
                            value={categoryOpts(coupon.excluded_product_category_ids)}
                            placeholder="No exclusions"
                            onChange={(opts) =>
                              set("excluded_product_category_ids")(opts.map((o) => o.value))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Allowed emails</Label>
                        <EmailChips
                          value={coupon.email_restrictions || []}
                          onChange={set("email_restrictions")}
                        />
                        <p className="text-xs text-muted-foreground">
                          Only these billing emails can use the coupon. Wildcards like{" "}
                          <code>*@example.com</code> are allowed.
                        </p>
                      </div>
                    </>
                  )}

                  {tab === "limits" && (
                    <div className="max-w-sm space-y-4">
                      <div className="grid gap-1.5">
                        <Label>Usage limit per coupon</Label>
                        <NumberField value={coupon.usage_limit} onChange={set("usage_limit")} />
                        <p className="text-xs text-muted-foreground">
                          How many times the coupon can be used in total.
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Limit usage to X items</Label>
                        <NumberField
                          value={coupon.limit_usage_to_x_items}
                          onChange={set("limit_usage_to_x_items")}
                          placeholder="Apply to all qualifying items"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum number of individual items the coupon applies to (product
                          discounts).
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Usage limit per user</Label>
                        <NumberField
                          value={coupon.usage_limit_per_user}
                          onChange={set("usage_limit_per_user")}
                        />
                        <p className="text-xs text-muted-foreground">
                          How many times a single customer (by billing email) can use it.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isNew && (
                <p className="text-sm text-muted-foreground">
                  Used: <span className="font-medium text-foreground">{coupon.usage_count ?? 0}</span>{" "}
                  time{(coupon.usage_count ?? 0) === 1 ? "" : "s"}
                </p>
              )}
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNew ? "Create coupon" : "Save coupon"}
              </Button>
              {!isNew && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this coupon?"
        description="Customers will no longer be able to use it. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}
