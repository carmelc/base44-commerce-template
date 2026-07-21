import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import MoneyInput from "../../../../components/MoneyInput";

/** External/affiliate product: outbound URL + button text + pricing. */
export default function ExternalTab({ product, up }) {
  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label>Product URL</Label>
        <Input
          type="url"
          placeholder="https://example.com/product"
          value={product.external_url || ""}
          onChange={(e) => up({ external_url: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Where customers are sent to buy this product.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Button text</Label>
        <Input
          placeholder="Buy product"
          value={product.button_text || ""}
          onChange={(e) => up({ button_text: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Regular price</Label>
          <MoneyInput value={product.regular_price} onChange={(v) => up({ regular_price: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>Sale price</Label>
          <MoneyInput value={product.sale_price} onChange={(v) => up({ sale_price: v })} />
        </div>
      </div>
    </div>
  );
}
