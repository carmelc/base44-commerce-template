import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import MoneyInput from "../../../../components/MoneyInput";
import { TAX_STATUSES } from "../../../../lib/constants";
import { isVariable } from "../../../../lib/product-utils";

/** Convert an ISO datetime to the value a date input expects (yyyy-mm-dd). */
const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : "");
const fromDateInput = (v) => (v ? new Date(`${v}T00:00:00Z`).toISOString() : null);

/** Pricing + tax. For variable products only tax fields apply (prices per variation). */
export default function GeneralTab({ product, up, refs }) {
  const scheduled = Boolean(product.date_on_sale_from || product.date_on_sale_to);
  const taxClasses = refs.taxClasses || [];

  return (
    <div className="max-w-md space-y-4">
      {isVariable(product) ? (
        <p className="text-sm text-muted-foreground">
          Prices for variable products are set per variation on the Variations tab.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Regular price</Label>
            <MoneyInput
              value={product.regular_price}
              onChange={(v) => up({ regular_price: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sale price</Label>
            <MoneyInput value={product.sale_price} onChange={(v) => up({ sale_price: v })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={scheduled}
              onCheckedChange={(v) =>
                up(v ? { date_on_sale_from: new Date().toISOString() } : { date_on_sale_from: null, date_on_sale_to: null })
              }
            />
            <Label>Schedule sale</Label>
          </div>
          {scheduled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Sale start</Label>
                <Input
                  type="date"
                  value={toDateInput(product.date_on_sale_from)}
                  onChange={(e) => up({ date_on_sale_from: fromDateInput(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sale end</Label>
                <Input
                  type="date"
                  value={toDateInput(product.date_on_sale_to)}
                  onChange={(e) => up({ date_on_sale_to: fromDateInput(e.target.value) })}
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Tax status</Label>
          <Select value={product.tax_status} onValueChange={(v) => up({ tax_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAX_STATUSES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tax class</Label>
          <Select value={product.tax_class || "standard"} onValueChange={(v) => up({ tax_class: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(taxClasses.length ? taxClasses : [{ slug: "standard", name: "Standard" }]).map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
