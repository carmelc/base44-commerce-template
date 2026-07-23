import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import ConfirmDialog from "../../components/ConfirmDialog";
import { slugify } from "../../lib/product-utils";
import useGroupForm from "./useGroupForm";
import TaxRatesTable from "./TaxRatesTable";

const DEFAULTS = {
  prices_include_tax: false,
  tax_based_on: "shipping",
  shipping_tax_class: "inherit",
  round_at_subtotal: false,
  display_prices_shop: "excl",
  display_prices_cart: "excl",
  display_tax_totals: "itemized",
};

function TaxOptions({ classes }) {
  const { form, setField, dirty, saving, save } = useGroupForm("tax", DEFAULTS);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Tax options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Prices entered with tax</Label>
          <RadioGroup
            value={form.prices_include_tax ? "yes" : "no"}
            onValueChange={(v) => setField("prices_include_tax", v === "yes")}
            className="gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" />
              No, I will enter prices exclusive of tax
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" />
              Yes, I will enter prices inclusive of tax
            </label>
          </RadioGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Calculate tax based on</Label>
            <Select value={form.tax_based_on} onValueChange={(v) => setField("tax_based_on", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipping">Customer shipping address</SelectItem>
                <SelectItem value="billing">Customer billing address</SelectItem>
                <SelectItem value="base">Shop base address</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Shipping tax class</Label>
            <Select
              value={form.shipping_tax_class}
              onValueChange={(v) => setField("shipping_tax_class", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Shipping tax class based on cart items</SelectItem>
                {(classes || []).map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Display prices in the shop</Label>
            <Select
              value={form.display_prices_shop}
              onValueChange={(v) => setField("display_prices_shop", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excl">Excluding tax</SelectItem>
                <SelectItem value="incl">Including tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Display prices during cart and checkout</Label>
            <Select
              value={form.display_prices_cart}
              onValueChange={(v) => setField("display_prices_cart", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excl">Excluding tax</SelectItem>
                <SelectItem value="incl">Including tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Display tax totals</Label>
            <Select
              value={form.display_tax_totals}
              onValueChange={(v) => setField("display_tax_totals", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="itemized">Itemized, one line per tax rate</SelectItem>
                <SelectItem value="single">As a single total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!form.round_at_subtotal}
            onCheckedChange={(v) => setField("round_at_subtotal", !!v)}
          />
          Round tax at subtotal level, instead of per line
        </label>

        <div>
          <Button onClick={() => save()} disabled={!dirty || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TaxSettings() {
  const { data: classes, loading, refetch } = useAsync(
    () => base44.entities["commerce.TaxClass"].list("created_date", 100),
    []
  );
  const [tab, setTab] = useState("options");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const createClass = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const slug = slugify(name);
      await base44.entities["commerce.TaxClass"].create({ slug, name });
      toast.success(`Tax class "${name}" added`);
      setAddOpen(false);
      setNewName("");
      await refetch();
      setTab(slug);
    } catch (err) {
      toast.error(err.message || "Failed to add tax class");
    } finally {
      setCreating(false);
    }
  };

  const deleteClass = async () => {
    setDeleting(true);
    try {
      await base44.entities["commerce.TaxClass"].delete(deleteTarget.id);
      toast.success(`Tax class "${deleteTarget.name}" removed. Its tax rates were kept.`);
      setDeleteTarget(null);
      if (tab === deleteTarget.slug) setTab("options");
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete tax class");
    } finally {
      setDeleting(false);
    }
  };

  const current = (classes || []).find((c) => c.slug === tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("options")}
          className={`rounded-md px-3 py-1.5 ${
            tab === "options" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Tax options
        </button>
        <span className="text-muted-foreground">|</span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          (classes || []).map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setTab(c.slug)}
              className={`rounded-md px-3 py-1.5 ${
                tab === c.slug ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name} rates
            </button>
          ))
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add class
        </Button>
      </div>

      {tab === "options" ? (
        <TaxOptions classes={classes} />
      ) : (
        <div className="space-y-3">
          {current && current.slug !== "standard" && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteTarget(current)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove tax class
              </Button>
            </div>
          )}
          <TaxRatesTable taxClass={tab} />
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add tax class</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Class name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Reduced rate"
              onKeyDown={(e) => e.key === "Enter" && createClass()}
            />
            {newName.trim() && (
              <p className="text-xs text-muted-foreground">Slug: {slugify(newName)}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createClass} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Remove tax class "${deleteTarget?.name}"?`}
        description="Products assigned to this class fall back to Standard. Existing tax rates for the class are not deleted."
        confirmLabel="Remove class"
        onConfirm={deleteClass}
        loading={deleting}
      />
    </div>
  );
}
