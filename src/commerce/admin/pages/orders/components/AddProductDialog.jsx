import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2 } from "lucide-react";

import { call, base44 } from "../../../lib/api";
import SearchSelect from "../../../components/SearchSelect";
import { variationLabel } from "../../../lib/product-utils";

/**
 * Two-step product picker for the order editor:
 * product search → (variable only) variation select → quantity.
 *
 * Props: { open, onOpenChange, onAdd({product, variation|null, quantity}) }
 */
export default function AddProductDialog({ open, onOpenChange, onAdd }) {
  const [picked, setPicked] = useState(null); // {value,label,meta,product}
  const [variations, setVariations] = useState(null); // null = not loaded
  const [variationId, setVariationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loadingVariations, setLoadingVariations] = useState(false);

  useEffect(() => {
    if (!open) {
      setPicked(null);
      setVariations(null);
      setVariationId("");
      setQuantity(1);
    }
  }, [open]);

  const searchProducts = async (q) => {
    const data = await call("admin-products", "search", { q, limit: 20 }, { silent: true });
    const rows = data?.rows || data || [];
    return rows.map((p) => ({
      value: p.id,
      label: p.name,
      meta: [p.sku && `SKU: ${p.sku}`, p.type].filter(Boolean).join(" · "),
      product: p,
    }));
  };

  const handlePick = async (opt) => {
    setPicked(opt);
    setVariations(null);
    setVariationId("");
    if (opt?.product?.type === "variable") {
      setLoadingVariations(true);
      try {
        const rows = await base44.entities["commerce.ProductVariation"].filter({ product_id: opt.value }, "menu_order", 200);
        setVariations(rows || []);
      } finally {
        setLoadingVariations(false);
      }
    }
  };

  const isVariable = picked?.product?.type === "variable";
  const canAdd = picked && quantity > 0 && (!isVariable || variationId);

  const submit = () => {
    const variation = isVariable ? (variations || []).find((v) => v.id === variationId) : null;
    onAdd({ product: picked.product, variation, quantity });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Product</Label>
            <SearchSelect
              search={searchProducts}
              value={picked}
              onChange={handlePick}
              placeholder="Search products…"
            />
          </div>

          {isVariable && (
            <div className="grid gap-1.5">
              <Label>Variation</Label>
              {loadingVariations ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading variations…
                </div>
              ) : (variations || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">This product has no variations yet.</p>
              ) : (
                <Select value={variationId} onValueChange={setVariationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a variation…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(variations || []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {variationLabel(v) || v.sku || v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              className="w-24"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            Add to order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
