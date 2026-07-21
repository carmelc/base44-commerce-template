import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useSettings } from "../../../../context/SettingsContext";

const num = (v) => (v === "" ? null : Number(v));
const NONE = "__none__";

/** Weight, dimensions and shipping class. Hidden for virtual/external products. */
export default function ShippingTab({ product, up, refs }) {
  const settings = useSettings();
  const weightUnit = settings?.get("products", "weight_unit", "kg");
  const dimensionUnit = settings?.get("products", "dimension_unit", "cm");
  const dims = product.dimensions || {};
  const classes = refs.shippingClasses || [];

  const setDim = (key, value) => up({ dimensions: { ...dims, [key]: num(value) } });

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label>Weight ({weightUnit})</Label>
        <Input
          type="number"
          step="any"
          value={product.weight ?? ""}
          onChange={(e) => up({ weight: num(e.target.value) })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Dimensions ({dimensionUnit})</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            step="any"
            placeholder="Length"
            value={dims.length ?? ""}
            onChange={(e) => setDim("length", e.target.value)}
          />
          <Input
            type="number"
            step="any"
            placeholder="Width"
            value={dims.width ?? ""}
            onChange={(e) => setDim("width", e.target.value)}
          />
          <Input
            type="number"
            step="any"
            placeholder="Height"
            value={dims.height ?? ""}
            onChange={(e) => setDim("height", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Shipping class</Label>
        <Select
          value={product.shipping_class_id || NONE}
          onValueChange={(v) => up({ shipping_class_id: v === NONE ? "" : v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No shipping class</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Shipping classes are used by some shipping methods to group similar products.
        </p>
      </div>
    </div>
  );
}
