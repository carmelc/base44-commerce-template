import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { BACKORDER_OPTIONS, STOCK_STATUSES } from "../../../../lib/constants";

const num = (v) => (v === "" ? null : Number(v));

/** SKU + stock management. */
export default function InventoryTab({ product, up }) {
  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label>SKU</Label>
        <Input
          placeholder="Unique stock keeping unit"
          value={product.sku || ""}
          onChange={(e) => up({ sku: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={product.manage_stock}
          onCheckedChange={(v) => up({ manage_stock: Boolean(v) })}
        />
        <Label>Track stock quantity for this product</Label>
      </div>

      {product.manage_stock ? (
        <>
          <div className="space-y-1.5">
            <Label>Stock quantity</Label>
            <Input
              type="number"
              value={product.stock_quantity ?? ""}
              onChange={(e) => up({ stock_quantity: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Allow backorders?</Label>
            <Select value={product.backorders || "no"} onValueChange={(v) => up({ backorders: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BACKORDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Low stock threshold</Label>
            <Input
              type="number"
              placeholder="Store default"
              value={product.low_stock_amount ?? ""}
              onChange={(e) => up({ low_stock_amount: num(e.target.value) })}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label>Stock status</Label>
          <Select value={product.stock_status || "instock"} onValueChange={(v) => up({ stock_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={product.sold_individually}
          onCheckedChange={(v) => up({ sold_individually: Boolean(v) })}
        />
        Limit purchases to 1 item per order
      </label>
    </div>
  );
}
