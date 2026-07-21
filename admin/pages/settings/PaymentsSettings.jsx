import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Info, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";

const emptyBank = () => ({ account_name: "", account_number: "", bank_name: "", sort_code: "", iban: "", bic: "" });

export default function PaymentsSettings() {
  const gateways = useAsync(() => base44.entities.PaymentGateway.list("order", 100), []);
  const [dialog, setDialog] = useState(null); // { gateway (local copy) }
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = gateways.data || [];

  const toggle = async (g, enabled) => {
    try {
      await base44.entities.PaymentGateway.update(g.id, { enabled });
      gateways.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update gateway");
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    setBusy(true);
    try {
      await Promise.all([
        base44.entities.PaymentGateway.update(a.id, { order: b.order ?? target }),
        base44.entities.PaymentGateway.update(b.id, { order: a.order ?? index }),
      ]);
      gateways.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to reorder");
    } finally {
      setBusy(false);
    }
  };

  const saveGateway = async () => {
    setSaving(true);
    try {
      const g = dialog.gateway;
      await base44.entities.PaymentGateway.update(g.id, {
        title: g.title,
        description: g.description,
        settings: g.settings || {},
      });
      toast.success("Payment method saved");
      setDialog(null);
      gateways.refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (gateways.loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {rows.map((g, i) => {
        const isStripe = g.slug === "stripe";
        return (
          <Card key={g.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === rows.length - 1 || busy} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{g.method_title || g.title || g.slug}</div>
                <div className="truncate text-sm text-muted-foreground">{g.method_description || g.description}</div>
                {isStripe && (
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Payment processing not wired</AlertTitle>
                    <AlertDescription>
                      This template models Stripe as data only. Connect the Base44 Stripe
                      connector and implement the checkout wiring — see{" "}
                      <code className="text-xs">implementation-guidelines.md §Stripe</code>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!g.enabled} disabled={isStripe} onCheckedChange={(v) => toggle(g, v)} />
                {!isStripe && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDialog({
                        gateway: {
                          ...g,
                          settings: {
                            ...(g.settings || {}),
                            account_details: g.slug === "bacs" ? (g.settings?.account_details || []) : g.settings?.account_details,
                          },
                        },
                      })
                    }
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Manage
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialog.gateway.method_title || dialog.gateway.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={dialog.gateway.title || ""}
                  onChange={(e) => setDialog({ ...dialog, gateway: { ...dialog.gateway, title: e.target.value } })}
                />
                <p className="text-xs text-muted-foreground">Shown to customers during checkout.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={dialog.gateway.description || ""}
                  onChange={(e) => setDialog({ ...dialog, gateway: { ...dialog.gateway, description: e.target.value } })}
                />
              </div>

              {dialog.gateway.slug === "bacs" && (
                <BankAccountsEditor
                  accounts={dialog.gateway.settings?.account_details || []}
                  onChange={(account_details) =>
                    setDialog({ ...dialog, gateway: { ...dialog.gateway, settings: { ...dialog.gateway.settings, account_details } } })
                  }
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button onClick={saveGateway} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BankAccountsEditor({ accounts, onChange }) {
  const update = (i, key, val) => onChange(accounts.map((a, idx) => (idx === i ? { ...a, [key]: val } : a)));
  const remove = (i) => onChange(accounts.filter((_, idx) => idx !== i));
  const add = () => onChange([...accounts, emptyBank()]);

  return (
    <div className="space-y-3">
      <Label>Bank account details</Label>
      {accounts.length === 0 && <p className="text-xs text-muted-foreground">No accounts yet.</p>}
      {accounts.map((a, i) => (
        <div key={i} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Account {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["account_name", "Account name"],
              ["account_number", "Account number"],
              ["bank_name", "Bank name"],
              ["sort_code", "Sort code"],
              ["iban", "IBAN"],
              ["bic", "BIC / Swift"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={a[key] || ""} onChange={(e) => update(i, key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Add account
      </Button>
    </div>
  );
}
