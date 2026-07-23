import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { call } from "../../../lib/api";
import useMoney from "../../../hooks/useMoney";
import { formatDate } from "../../../lib/format";
import { refundableQty, refundableAmount, round2 } from "../../../lib/order-utils";

/**
 * Refund flow: per-line quantities/amounts, shipping amount, restock flag.
 *
 * Props: { order, refunds, onDone() }  — onDone refetches order + refunds.
 */
export default function RefundPanel({ order, refunds, onDone }) {
  const { format } = useMoney();
  const [rows, setRows] = useState({}); // line_id → {quantity, amount}
  const [shippingAmount, setShippingAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [viaGateway, setViaGateway] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gatewayNotice, setGatewayNotice] = useState(false);

  const maxRefund = refundableAmount(order);
  const isStripe = order.payment_method === "stripe";

  const unitNet = (line) => (line.quantity ? (line.total || 0) / line.quantity : 0);

  const setQty = (line, qty) => {
    const capped = Math.max(0, Math.min(qty, refundableQty(order, refunds, line.line_id)));
    setRows((r) => ({
      ...r,
      [line.line_id]: { quantity: capped, amount: round2(capped * unitNet(line)) },
    }));
  };

  const setAmount = (line, amount) => {
    setRows((r) => ({
      ...r,
      [line.line_id]: { quantity: r[line.line_id]?.quantity || 0, amount: Math.max(0, amount) },
    }));
  };

  const lineItems = useMemo(
    () =>
      Object.entries(rows)
        .filter(([, v]) => (v.quantity || 0) > 0 || (v.amount || 0) > 0)
        .map(([line_id, v]) => {
          const line = (order.line_items || []).find((l) => l.line_id === line_id);
          return {
            line_id,
            product_id: line?.product_id,
            variation_id: line?.variation_id,
            quantity: v.quantity || 0,
            refund_total: round2(v.amount || 0),
          };
        }),
    [rows, order.line_items]
  );

  const total = round2(lineItems.reduce((s, l) => s + l.refund_total, 0) + (shippingAmount || 0));
  const overMax = total > maxRefund;

  const submit = async () => {
    setBusy(true);
    setGatewayNotice(false);
    try {
      const data = await call("admin-refunds", "create", {
        order_id: order.id,
        amount: total,
        reason,
        line_items: lineItems,
        shipping_amount: shippingAmount || 0,
        restock_items: restock,
        refund_payment: isStripe && viaGateway,
      });
      if (data?.gateway_refund === "not_implemented") setGatewayNotice(true);
      toast.success(`Refunded ${format(total)}`);
      setRows({});
      setShippingAmount(0);
      setReason("");
      onDone();
    } catch {
      /* toast handled by call() */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold">Refund</h3>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-24 text-right">Refunded</TableHead>
            <TableHead className="w-24 text-right">Qty</TableHead>
            <TableHead className="w-32 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(order.line_items || []).map((line) => {
            const remaining = refundableQty(order, refunds, line.line_id);
            const row = rows[line.line_id] || { quantity: 0, amount: 0 };
            return (
              <TableRow key={line.line_id}>
                <TableCell className="text-sm">
                  {line.name} <span className="text-muted-foreground">× {line.quantity}</span>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {line.quantity - remaining} / {line.quantity}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max={remaining}
                    disabled={remaining === 0}
                    className="ml-auto h-8 w-16 text-right"
                    value={row.quantity}
                    onChange={(e) => setQty(line, parseInt(e.target.value, 10) || 0)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    className="ml-auto h-8 w-24 text-right"
                    value={row.amount}
                    onChange={(e) => setAmount(line, Number(e.target.value) || 0)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Refund shipping</Label>
          <Input
            type="number"
            step="any"
            min="0"
            value={shippingAmount}
            onChange={(e) => setShippingAmount(Number(e.target.value) || 0)}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs">Reason for refund (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={restock} onCheckedChange={(v) => setRestock(Boolean(v))} />
          Restock refunded items
        </label>
        {isStripe && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={viaGateway} onCheckedChange={(v) => setViaGateway(Boolean(v))} />
            Refund via gateway (Stripe)
          </label>
        )}
      </div>

      {gatewayNotice && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Gateway refund not wired</AlertTitle>
          <AlertDescription>
            The refund was recorded, but no money was moved: gateway refunds are a placeholder in this
            template. See <code>skills/commerce/references/stripe-payments.md</code> to wire the Base44 Stripe
            connector.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total available to refund: <span className="font-medium text-foreground">{format(maxRefund)}</span>
        </p>
        <Button onClick={submit} disabled={busy || total <= 0 || overMax} variant="destructive">
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Refund {format(total)}
        </Button>
      </div>
      {overMax && (
        <p className="text-right text-xs text-destructive">Amount exceeds the refundable total.</p>
      )}

      {(refunds || []).length > 0 && (
        <div className="border-t pt-3">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Previous refunds</h4>
          <ul className="space-y-1 text-sm">
            {refunds.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>
                  {formatDate(r.created_date)}
                  {r.reason ? ` — ${r.reason}` : ""}
                  {r.refunded_by ? <span className="text-muted-foreground"> by {r.refunded_by}</span> : null}
                </span>
                <span className="text-destructive">− {format(r.amount || 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
