import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import MoneyInput from "../../../../components/MoneyInput";
import MediaUploader from "../../../../components/MediaUploader";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import { generateVariationCombos, sameCombo, variationLabel } from "../../../../lib/product-utils";
import { BACKORDER_OPTIONS } from "../../../../lib/constants";

const NONE = "__none__";
const ANY = "__any__";
const num = (v) => (v === "" ? null : Number(v));

const NEW_VARIATION = {
  status: "publish",
  sku: "",
  regular_price: null,
  sale_price: null,
  virtual: false,
  downloadable: false,
  downloads: [],
  download_limit: -1,
  download_expiry: -1,
  tax_status: "parent",
  tax_class: "",
  manage_stock: "parent",
  stock_quantity: null,
  stock_status: "instock",
  backorders: "no",
  weight: null,
  dimensions: { length: null, width: null, height: null },
  shipping_class_id: "",
  image: null,
  menu_order: 0,
  description: "",
  meta_data: [],
};

/** Per-variation expandable edit form. */
function VariationRow({ variation, onChange, onRemove, refs }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...variation, ...patch });
  const dims = variation.dimensions || {};
  const classes = refs.shippingClasses || [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="truncate font-medium">{variationLabel(variation)}</span>
          {variation.sku && <span className="truncate text-xs text-muted-foreground">SKU: {variation.sku}</span>}
        </button>
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox
            checked={variation.status !== "private" && variation.status !== "draft"}
            onCheckedChange={(v) => set({ status: v ? "publish" : "private" })}
          />
          Enabled
        </label>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {open && (
        <div className="grid gap-4 border-t p-3 sm:grid-cols-[140px_1fr]">
          <MediaUploader value={variation.image || null} onChange={(image) => set({ image })} label="Image" />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input value={variation.sku || ""} onChange={(e) => set({ sku: e.target.value })} />
            </div>
            <div />
            <div className="space-y-1.5">
              <Label className="text-xs">Regular price</Label>
              <MoneyInput value={variation.regular_price} onChange={(v) => set({ regular_price: v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sale price</Label>
              <MoneyInput value={variation.sale_price} onChange={(v) => set({ sale_price: v })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Stock management</Label>
              <Select value={variation.manage_stock || "parent"} onValueChange={(v) => set({ manage_stock: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Same as parent</SelectItem>
                  <SelectItem value="yes">Track quantity</SelectItem>
                  <SelectItem value="no">Don't track</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {variation.manage_stock === "yes" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Stock quantity</Label>
                  <Input
                    type="number"
                    value={variation.stock_quantity ?? ""}
                    onChange={(e) => set({ stock_quantity: num(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Backorders</Label>
                  <Select value={variation.backorders || "no"} onValueChange={(v) => set({ backorders: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKORDER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Weight</Label>
              <Input
                type="number"
                step="any"
                value={variation.weight ?? ""}
                onChange={(e) => set({ weight: num(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dimensions (L×W×H)</Label>
              <div className="grid grid-cols-3 gap-1">
                {["length", "width", "height"].map((k) => (
                  <Input
                    key={k}
                    type="number"
                    step="any"
                    placeholder={k[0].toUpperCase()}
                    value={dims[k] ?? ""}
                    onChange={(e) => set({ dimensions: { ...dims, [k]: num(e.target.value) } })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Shipping class</Label>
              <Select
                value={variation.shipping_class_id || NONE}
                onValueChange={(v) => set({ shipping_class_id: v === NONE ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Same as parent</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <Checkbox checked={variation.virtual} onCheckedChange={(v) => set({ virtual: Boolean(v) })} />
                Virtual
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox
                  checked={variation.downloadable}
                  onCheckedChange={(v) => set({ downloadable: Boolean(v) })}
                />
                Downloadable
              </label>
            </div>

            {variation.downloadable && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Downloadable files</Label>
                {(variation.downloads || []).map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="w-48"
                      placeholder="Name"
                      value={d.name || ""}
                      onChange={(e) =>
                        set({
                          downloads: variation.downloads.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Input
                      className="flex-1"
                      placeholder="File URL"
                      value={d.file_url || ""}
                      onChange={(e) =>
                        set({
                          downloads: variation.downloads.map((x, j) =>
                            j === i ? { ...x, file_url: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => set({ downloads: variation.downloads.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set({ downloads: [...(variation.downloads || []), { name: "", file_url: "" }] })}
                >
                  Add file
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Variations manager for variable products: generate combos from the
 * variation-flagged attributes, set defaults, edit each variation inline.
 * All changes persist on the editor's single Save.
 */
export default function VariationsTab({ product, up, refs, variations, setVariations }) {
  const [confirmGenerate, setConfirmGenerate] = useState(null); // pending new combos

  const variationAttrs = useMemo(
    () => (product.attributes || []).filter((a) => a.variation && (a.options || []).length > 0),
    [product.attributes]
  );

  const generate = () => {
    const combos = generateVariationCombos(product.attributes);
    if (!combos.length) {
      toast.error("Add at least one attribute with 'Used for variations' checked first.");
      return;
    }
    const missing = combos.filter((c) => !variations.some((v) => sameCombo(v, c)));
    if (!missing.length) {
      toast.info("All attribute combinations already exist.");
      return;
    }
    setConfirmGenerate(missing);
  };

  const applyGenerate = () => {
    const start = variations.length;
    setVariations([
      ...variations,
      ...confirmGenerate.map((c, i) => ({ ...NEW_VARIATION, ...c, menu_order: start + i })),
    ]);
    toast.success(`${confirmGenerate.length} variation(s) added — save to persist.`);
    setConfirmGenerate(null);
  };

  const setDefault = (attrName, option) => {
    const rest = (product.default_attributes || []).filter((d) => d.name !== attrName);
    const attr = variationAttrs.find((a) => a.name === attrName);
    up({
      default_attributes:
        option === ANY
          ? rest
          : [...rest, { attribute_id: attr?.attribute_id || "", name: attrName, option }],
    });
  };

  if (!variationAttrs.length) {
    return (
      <p className="max-w-md text-sm text-muted-foreground">
        Before adding variations, define attributes on the Attributes tab and check
        “Used for variations” on the ones that should distinguish each variation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="outline" onClick={generate}>
          <Wand2 className="mr-2 h-4 w-4" /> Generate variations from attributes
        </Button>
        <span className="text-sm text-muted-foreground">{variations.length} variation(s)</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {variationAttrs.map((attr) => {
          const current = (product.default_attributes || []).find((d) => d.name === attr.name);
          return (
            <div key={attr.name} className="space-y-1">
              <Label className="text-xs">Default {attr.name}</Label>
              <Select value={current?.option || ANY} onValueChange={(v) => setDefault(attr.name, v)}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>No default</SelectItem>
                  {(attr.options || []).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {variations.map((v, i) => (
          <VariationRow
            key={v.id || `new-${i}`}
            variation={v}
            refs={refs}
            onChange={(nv) => setVariations(variations.map((x, j) => (j === i ? nv : x)))}
            onRemove={() => setVariations(variations.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(confirmGenerate)}
        onOpenChange={(o) => !o && setConfirmGenerate(null)}
        title={`Create ${confirmGenerate?.length || 0} new variation(s)?`}
        description="One variation is created for each missing attribute combination. They are saved when you save the product."
        confirmLabel="Generate"
        destructive={false}
        onConfirm={applyGenerate}
      />
    </div>
  );
}
