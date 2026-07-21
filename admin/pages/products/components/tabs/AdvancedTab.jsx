import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import MetaDataEditor from "../../../../components/MetaDataEditor";

/** Purchase note, menu order, reviews toggle and custom meta data. */
export default function AdvancedTab({ product, up }) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label>Purchase note</Label>
        <Textarea
          rows={3}
          placeholder="Optional note sent to the customer after purchase"
          value={product.purchase_note || ""}
          onChange={(e) => up({ purchase_note: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Menu order</Label>
        <Input
          type="number"
          className="w-32"
          value={product.menu_order ?? 0}
          onChange={(e) => up({ menu_order: e.target.value === "" ? 0 : Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">Custom ordering position (lower shows first).</p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={product.reviews_allowed !== false}
          onCheckedChange={(v) => up({ reviews_allowed: Boolean(v) })}
        />
        <Label>Enable reviews</Label>
      </div>

      <div className="space-y-1.5">
        <Label>Custom fields</Label>
        <MetaDataEditor value={product.meta_data || []} onChange={(meta_data) => up({ meta_data })} />
      </div>
    </div>
  );
}
