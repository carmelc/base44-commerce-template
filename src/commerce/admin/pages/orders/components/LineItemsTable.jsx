import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, X } from "lucide-react";

import useMoney from "../../../hooks/useMoney";
import { round2 } from "../../../lib/order-utils";

/**
 * Order line items table: product lines, fee lines, shipping lines, coupon chips.
 *
 * Props:
 * - order: the (draft) order object being displayed/edited
 * - editable: whether qty/price edits & removals are allowed (pending/on-hold)
 * - onChange(patch): merge a partial {line_items|fee_lines|shipping_lines} into the draft
 * - onRemoveCoupon(code): server-side removal (disabled while dirty upstream)
 * - removingCoupon: code currently being removed
 */
export default function LineItemsTable({ order, editable, onChange, onRemoveCoupon, removingCoupon }) {
  const { format } = useMoney();
  const lines = order.line_items || [];
  const fees = order.fee_lines || [];
  const shipping = order.shipping_lines || [];
  const coupons = order.coupon_lines || [];

  const updateLine = (lineId, patch) => {
    onChange({
      line_items: lines.map((l) => {
        if (l.line_id !== lineId) return l;
        const next = { ...l, ...patch };
        // Keep display totals in sync locally; the server recalculates
        // authoritative totals (incl. tax) on save.
        next.subtotal = round2((next.price || 0) * (next.quantity || 0));
        next.total = next.subtotal;
        return next;
      }),
    });
  };

  const removeLine = (lineId) => onChange({ line_items: lines.filter((l) => l.line_id !== lineId) });
  const removeFee = (lineId) => onChange({ fee_lines: fees.filter((f) => f.line_id !== lineId) });
  const removeShipping = (lineId) =>
    onChange({ shipping_lines: shipping.filter((s) => s.line_id !== lineId) });

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-28 text-right">Cost</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">Total</TableHead>
            <TableHead className="w-24 text-right">Tax</TableHead>
            {editable && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && fees.length === 0 && shipping.length === 0 && (
            <TableRow>
              <TableCell colSpan={editable ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                No items. {editable ? "Use “Add product(s)” below." : ""}
              </TableCell>
            </TableRow>
          )}

          {lines.map((line) => (
            <TableRow key={line.line_id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {line.image ? (
                    <img src={line.image} alt="" className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.sku && <span>SKU: {line.sku}</span>}
                      {(line.attributes || []).length > 0 && (
                        <span>
                          {line.sku ? " · " : ""}
                          {line.attributes.map((a) => `${a.name}: ${a.option}`).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    step="any"
                    className="ml-auto h-8 w-24 text-right"
                    value={line.price ?? 0}
                    onChange={(e) => updateLine(line.line_id, { price: Number(e.target.value) || 0 })}
                  />
                ) : (
                  format(line.price || 0)
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    min="1"
                    className="ml-auto h-8 w-16 text-right"
                    value={line.quantity ?? 1}
                    onChange={(e) =>
                      updateLine(line.line_id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                  />
                ) : (
                  `× ${line.quantity}`
                )}
              </TableCell>
              <TableCell className="text-right">{format(line.total || 0)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{format(line.total_tax || 0)}</TableCell>
              {editable && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(line.line_id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}

          {fees.map((fee) => (
            <TableRow key={fee.line_id} className="bg-muted/30">
              <TableCell>
                <span className="text-sm">
                  <Badge variant="outline" className="mr-2">Fee</Badge>
                  {fee.name}
                </span>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right">{format(fee.total || 0)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{format(fee.total_tax || 0)}</TableCell>
              {editable && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFee(fee.line_id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}

          {shipping.map((line) => (
            <TableRow key={line.line_id} className="bg-muted/30">
              <TableCell>
                <span className="text-sm">
                  <Badge variant="outline" className="mr-2">Shipping</Badge>
                  {line.method_title || line.method_id}
                </span>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right">{format(line.total || 0)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{format(line.total_tax || 0)}</TableCell>
              {editable && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeShipping(line.line_id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {coupons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">Coupons:</span>
          {coupons.map((c) => (
            <Badge key={c.code} variant="secondary" className="gap-1 pr-1">
              {c.code} (−{format(c.discount || 0)})
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                disabled={removingCoupon === c.code}
                onClick={() => onRemoveCoupon(c.code)}
                title="Remove coupon"
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
